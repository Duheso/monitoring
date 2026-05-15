"""vLLM Metrics Sidecar — collects and aggregates metrics from a vLLM instance.

Periodically polls vLLM /metrics (Prometheus) and /v1/models,
calculates derived metrics (tokens/s, latency percentiles, efficiency),
and exposes a JSON API at GET /metrics.
"""
import time
import re
import os
import asyncio
from collections import deque
from fastapi import FastAPI
from contextlib import asynccontextmanager
import httpx

VLLM_URL = os.getenv('VLLM_URL', 'http://localhost:8000')
POLL_INTERVAL = int(os.getenv('POLL_INTERVAL', '5'))
HISTORY_WINDOW = int(os.getenv('HISTORY_WINDOW', '60'))  # seconds of history for derived metrics

# ── In-memory state ───────────────────────────────────────────────────────────
_history: deque = deque(maxlen=HISTORY_WINDOW * 2)
_current: dict = {}
_model_info: dict = {}
_gpu_info: list = []
_lock = asyncio.Lock()


def parse_prometheus(text: str) -> dict:
    """Parse Prometheus text format into a structured dict."""
    metrics = {}
    for line in text.strip().splitlines():
        if line.startswith('#') or not line.strip():
            continue
        # Handle labels: metric_name{label="value",...} value
        m = re.match(r'^(\w+)(\{[^}]*\})?\s+(.+)$', line)
        if not m:
            continue
        name, labels_str, val_str = m.group(1), m.group(2) or '', m.group(3)
        try:
            val = float(val_str)
        except ValueError:
            val = val_str

        if labels_str:
            key = f'{name}{labels_str}'
        else:
            key = name

        if name not in metrics:
            metrics[name] = {}
        if labels_str:
            metrics[name][labels_str] = val
        else:
            metrics[name]['_value'] = val

    return metrics


def _extract_scalar(metrics: dict, name: str, default=0.0) -> float:
    """Extract a scalar value from parsed Prometheus metrics."""
    m = metrics.get(name, {})
    if '_value' in m:
        return m['_value']
    # If only one label variant, return its value
    vals = list(m.values())
    return vals[0] if len(vals) == 1 else default


def _extract_histogram_p(metrics: dict, name_bucket: str, percentile: float) -> float:
    """Estimate a percentile from histogram buckets."""
    buckets = metrics.get(name_bucket, {})
    sorted_buckets = []
    for k, v in buckets.items():
        m = re.search(r'le="([^"]+)"', k)
        if m:
            le = m.group(1)
            if le == '+Inf':
                le_val = float('inf')
            else:
                le_val = float(le)
            sorted_buckets.append((le_val, v))
    if not sorted_buckets:
        return 0.0
    sorted_buckets.sort(key=lambda x: x[0])
    total = sorted_buckets[-1][1]
    if total == 0:
        return 0.0
    target = total * percentile
    for le_val, count in sorted_buckets:
        if count >= target:
            return le_val
    return sorted_buckets[-1][0]


def compute_derived(metrics: dict, prev_metrics: dict, dt: float) -> dict:
    """Compute derived metrics from raw Prometheus data."""
    derived = {}

    # Tokens per second (rate of change)
    gen_total = _extract_scalar(metrics, 'vllm_generation_tokens_total')
    prompt_total = _extract_scalar(metrics, 'vllm_prompt_tokens_total')
    prev_gen = _extract_scalar(prev_metrics, 'vllm_generation_tokens_total') if prev_metrics else gen_total
    prev_prompt = _extract_scalar(prev_metrics, 'vllm_prompt_tokens_total') if prev_metrics else prompt_total

    if dt > 0:
        derived['generation_tokens_per_sec'] = round((gen_total - prev_gen) / dt, 2)
        derived['prompt_tokens_per_sec'] = round((prompt_total - prev_prompt) / dt, 2)
    else:
        derived['generation_tokens_per_sec'] = 0
        derived['prompt_tokens_per_sec'] = 0

    # Avg throughput (reported by vLLM)
    derived['avg_generation_throughput'] = _extract_scalar(metrics, 'vllm_avg_generation_throughput_toks_per_s')

    # Running / waiting requests
    derived['num_requests_running'] = _extract_scalar(metrics, 'vllm_num_requests_running')
    derived['num_requests_waiting'] = _extract_scalar(metrics, 'vllm_num_requests_waiting')

    # Total requests by status
    req_total_m = metrics.get('vllm_request_success_total', metrics.get('vllm_num_requests_total', {}))
    derived['total_requests'] = sum(v for v in req_total_m.values() if isinstance(v, (int, float)))

    # Error count
    err_m = metrics.get('vllm_request_failure_total', {})
    derived['total_errors'] = sum(v for v in err_m.values() if isinstance(v, (int, float)))

    # Error rate
    total = derived['total_requests'] + derived['total_errors']
    derived['error_rate'] = round(derived['total_errors'] / total * 100, 2) if total > 0 else 0

    # Latency percentiles (from histograms)
    derived['p50_e2e_latency'] = round(_extract_histogram_p(metrics, 'vllm_e2e_request_latency_seconds_bucket', 0.50), 4)
    derived['p95_e2e_latency'] = round(_extract_histogram_p(metrics, 'vllm_e2e_request_latency_seconds_bucket', 0.95), 4)
    derived['p99_e2e_latency'] = round(_extract_histogram_p(metrics, 'vllm_e2e_request_latency_seconds_bucket', 0.99), 4)

    # TTFT percentiles
    derived['p50_ttft'] = round(_extract_histogram_p(metrics, 'vllm_time_to_first_token_seconds_bucket', 0.50), 4)
    derived['p95_ttft'] = round(_extract_histogram_p(metrics, 'vllm_time_to_first_token_seconds_bucket', 0.95), 4)

    # KV cache utilization
    derived['gpu_cache_usage_pct'] = round(_extract_scalar(metrics, 'vllm_gpu_cache_usage_perc') * 100, 2)
    derived['cpu_cache_usage_pct'] = round(_extract_scalar(metrics, 'vllm_cpu_cache_usage_perc') * 100, 2)

    # Preemptions
    derived['num_preemptions'] = _extract_scalar(metrics, 'vllm_num_preemptions_total')

    # Batch size (avg prompt + generation in one step)
    derived['avg_prompt_throughput'] = _extract_scalar(metrics, 'vllm_avg_prompt_throughput_toks_per_s')

    return derived


async def poll_vllm():
    """Background polling task."""
    global _current, _model_info, _gpu_info
    prev_metrics = None
    prev_ts = time.time()

    async with httpx.AsyncClient(timeout=5) as client:
        while True:
            now = time.time()
            dt = now - prev_ts
            prev_ts = now

            try:
                r = await client.get(f'{VLLM_URL}/metrics')
                raw = parse_prometheus(r.text)
                derived = compute_derived(raw, prev_metrics, dt)
                prev_metrics = raw

                async with _lock:
                    _current = {
                        'ts': now,
                        'raw': raw,
                        'derived': derived,
                    }
                    _history.append({'ts': now, **derived})
            except Exception:
                async with _lock:
                    _current = {'ts': now, 'error': 'cannot reach vLLM', 'derived': {}, 'raw': {}}

            # Model info (less frequent)
            if int(now) % 30 < POLL_INTERVAL:
                try:
                    r = await client.get(f'{VLLM_URL}/v1/models')
                    data = r.json().get('data', [])
                    async with _lock:
                        _model_info = data[0] if data else {}
                except Exception:
                    pass

            # GPU info via nvidia-smi (if available)
            if int(now) % 10 < POLL_INTERVAL:
                try:
                    import subprocess
                    out = subprocess.check_output(
                        ['nvidia-smi', '--query-gpu=index,name,utilization.gpu,memory.used,memory.total,temperature.gpu',
                         '--format=csv,noheader,nounits'],
                        encoding='utf-8', timeout=5,
                    )
                    gpus = []
                    for line in out.strip().splitlines():
                        parts = [p.strip() for p in line.split(',')]
                        if len(parts) >= 6:
                            gpus.append({
                                'index': int(parts[0]),
                                'name': parts[1],
                                'utilization': float(parts[2]),
                                'memory_used': float(parts[3]),
                                'memory_total': float(parts[4]),
                                'temperature': float(parts[5]),
                            })
                    async with _lock:
                        _gpu_info = gpus
                except Exception:
                    pass

            await asyncio.sleep(POLL_INTERVAL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(poll_vllm())
    yield
    task.cancel()

app = FastAPI(title='vLLM Metrics Sidecar', version='1.0.0', lifespan=lifespan)


@app.get('/health')
def health():
    return {'status': 'ok', 'vllm_url': VLLM_URL}


@app.get('/metrics')
async def get_metrics():
    async with _lock:
        return {
            'ts': _current.get('ts', 0),
            'status': 'online' if 'derived' in _current and _current['derived'] else 'offline',
            'derived': _current.get('derived', {}),
            'model': _model_info,
            'gpus': _gpu_info,
            'history': list(_history),
        }
