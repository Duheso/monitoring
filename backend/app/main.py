from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse, StreamingResponse
import logging
try:
    from websockets.exceptions import ConnectionClosedOK, ConnectionClosedError
except Exception:
    ConnectionClosedOK = ConnectionClosedError = Exception
import asyncio
import subprocess
import psutil
import json
import time
import socket
from collections import deque
from pathlib import Path
from typing import Optional
import os
from fastapi import Request
from pydantic import BaseModel
from .auth import create_access_token, verify_token, authenticate_pam

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('monitor')

app = FastAPI(title='DGX Monitor', version='2.0.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# ── Auth dependency ───────────────────────────────────────────────────────────
_bearer = HTTPBearer(auto_error=False)

async def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    token: Optional[str] = Query(default=None),
) -> str:
    raw = (creds.credentials if creds else None) or token or ''
    user = verify_token(raw)
    if not user:
        raise HTTPException(status_code=401, detail='Invalid or expired token')
    return user

# ── Static files ───────────────────────────────────────────────────────────────
static_dir = Path(__file__).resolve().parents[2] / 'frontend' / 'dist'
if static_dir.exists():
    assets_dir = static_dir / 'assets'
    if assets_dir.exists():
        app.mount('/assets', StaticFiles(directory=str(assets_dir)), name='assets')

    @app.get('/favicon.ico')
    def favicon():
        f = static_dir / 'favicon.ico'
        return FileResponse(str(f) if f.exists() else str(static_dir / 'index.html'))


# ── Bootstrap psutil ──────────────────────────────────────────────────────────
def init_psutil():
    try:
        psutil.cpu_percent(percpu=True)
    except Exception:
        pass
    try:
        for p in psutil.process_iter():
            try:
                p.cpu_percent(None)
            except Exception:
                continue
    except Exception:
        pass


init_psutil()

# ── Layout persistence ────────────────────────────────────────────────────────
base_data_dir = Path(__file__).resolve().parents[2]
try:
    data_dir = base_data_dir / 'backend_data'
    data_dir.mkdir(exist_ok=True)
except PermissionError:
    try:
        data_dir = Path('/var/lib/dgx-monitor')
        data_dir.mkdir(parents=True, exist_ok=True)
    except Exception:
        data_dir = Path('/tmp/dgx-monitor')
        data_dir.mkdir(parents=True, exist_ok=True)

layouts_dir = data_dir / 'layouts'
layouts_dir.mkdir(exist_ok=True)

services_file = data_dir / 'services.json'

# ── In-memory metrics history (circular buffer ~5 min @ 1 Hz) ─────────────────
HISTORY_MAX = 300
metrics_history: deque = deque(maxlen=HISTORY_MAX)

# ── Rate tracking for network / disk I/O ─────────────────────────────────────
_prev_net: dict = {}
_prev_disk: dict = {}
_prev_ts: float = 0.0


class LayoutPayload(BaseModel):
    layout: list


class LoginPayload(BaseModel):
    username: str
    password: str


# ── API: auth ─────────────────────────────────────────────────────────────────
@app.post('/api/auth/login')
def login(payload: LoginPayload):
    if not authenticate_pam(payload.username, payload.password):
        raise HTTPException(status_code=401, detail='Invalid username or password')
    token = create_access_token(payload.username)
    return {'access_token': token, 'token_type': 'bearer', 'username': payload.username}


@app.get('/api/auth/me')
def auth_me(current_user: str = Depends(get_current_user)):
    return {'username': current_user}


# ── API: layout ───────────────────────────────────────────────────────────────
@app.get('/api/layout')
def get_layout(current_user: str = Depends(get_current_user)):
    p = layouts_dir / f"{current_user}.json"
    if p.exists():
        try:
            return json.loads(p.read_text())
        except Exception:
            return {'layout': None, 'instances': None}
    return {'layout': None, 'instances': None}


@app.post('/api/layout')
async def post_layout(req: Request, current_user: str = Depends(get_current_user)):
    try:
        body = await req.json()
        p = layouts_dir / f"{current_user}.json"
        p.write_text(json.dumps(body))
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'error': str(e)}


# ── API: history ──────────────────────────────────────────────────────────────
@app.get('/api/history')
def get_history(points: int = 300, _u: str = Depends(get_current_user)):
    pts = min(points, HISTORY_MAX)
    data = list(metrics_history)[-pts:]
    return {'points': data}


# ── API: health ───────────────────────────────────────────────────────────────
@app.get('/api/health')
def health():
    return {'status': 'ok', 'history_points': len(metrics_history)}


# ── Helpers: services persistence ─────────────────────────────────────────────
def load_services() -> list:
    if services_file.exists():
        try:
            return json.loads(services_file.read_text())
        except Exception:
            pass
    return []


def save_services(svcs: list):
    services_file.write_text(json.dumps(svcs))


def check_service_status(name: str) -> dict:
    result = {'name': name, 'status': 'unknown', 'active_state': '', 'sub_state': '', 'description': ''}
    try:
        out = subprocess.check_output(
            ['systemctl', 'show', name, '--property=ActiveState,SubState,Description,LoadState'],
            encoding='utf-8', timeout=5
        )
        props = {}
        for line in out.strip().splitlines():
            if '=' in line:
                k, v = line.split('=', 1)
                props[k.strip()] = v.strip()
        result['active_state'] = props.get('ActiveState', 'unknown')
        result['sub_state']    = props.get('SubState', '')
        result['load_state']   = props.get('LoadState', '')
        result['description']  = props.get('Description', name)
        result['status']       = props.get('ActiveState', 'unknown')
    except Exception as e:
        result['status'] = 'error'
        result['description'] = str(e)
    return result


# ── API: services ─────────────────────────────────────────────────────────────
@app.get('/api/services')
def get_services(_u: str = Depends(get_current_user)):
    svcs = load_services()
    return {'services': [check_service_status(s) for s in svcs]}


@app.post('/api/services')
async def add_service(req: Request, _u: str = Depends(get_current_user)):
    try:
        body = await req.json()
        name = body.get('name', '').strip()
        if not name:
            return {'ok': False, 'error': 'name required'}
        svcs = load_services()
        if name not in svcs:
            svcs.append(name)
            save_services(svcs)
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'error': str(e)}


@app.delete('/api/services/{name}')
def delete_service(name: str, _u: str = Depends(get_current_user)):
    svcs = load_services()
    svcs = [s for s in svcs if s != name]
    save_services(svcs)
    return {'ok': True}


@app.post('/api/services/{name}/action')
async def service_action(name: str, req: Request, _u: str = Depends(get_current_user)):
    try:
        body = await req.json()
        action = body.get('action', '')  # start | stop | restart
        if action not in ('start', 'stop', 'restart'):
            return {'ok': False, 'error': 'invalid action'}
        subprocess.check_call(['sudo', 'systemctl', action, name], timeout=10)
        return {'ok': True}
    except subprocess.CalledProcessError as e:
        return {'ok': False, 'error': f'systemctl returned {e.returncode}'}
    except Exception as e:
        return {'ok': False, 'error': str(e)}


# ── API: journal SSE ──────────────────────────────────────────────────────────
@app.get('/api/journal/{service}')
async def stream_journal(service: str, lines: int = 100, follow: bool = True,
                         _u: str = Depends(get_current_user)):
    async def generate():
        cmd = ['journalctl', '-u', service, '-n', str(lines), '--no-pager', '-o', 'short-precise']
        if follow:
            cmd.append('-f')
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            while True:
                try:
                    line = await asyncio.wait_for(proc.stdout.readline(), timeout=30)
                except asyncio.TimeoutError:
                    yield b'data: {"keepalive":true}\n\n'
                    continue
                if not line:
                    break
                text = line.decode('utf-8', errors='replace').rstrip()
                payload = json.dumps({'line': text})
                yield f'data: {payload}\n\n'.encode()
        except Exception as e:
            yield f'data: {json.dumps({"error": str(e)})}\n\n'.encode()
        finally:
            try:
                proc.terminate()
            except Exception:
                pass

    return StreamingResponse(
        generate(),
        media_type='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'},
    )


# ── Helpers ───────────────────────────────────────────────────────────────────
def _safe_int(val: str) -> int | str:
    try:
        return int(val.strip())
    except Exception:
        return val.strip()


def _safe_float(val: str) -> float | str:
    try:
        return round(float(val.strip()), 2)
    except Exception:
        return val.strip()


# ── GPU metrics via nvidia-smi ────────────────────────────────────────────────
def collect_gpu_metrics() -> tuple[list, list]:
    gpus: list = []
    gpu_processes: list = []
    try:
        fields = (
            'index,name,uuid,'
            'memory.total,memory.used,memory.free,'
            'utilization.gpu,utilization.memory,'
            'temperature.gpu,'
            'power.draw,power.limit,'
            'clocks.sm,clocks.mem,'
            'pcie.link.gen.current,pcie.link.width.current'
        )
        out = subprocess.check_output(
            ['nvidia-smi', f'--query-gpu={fields}', '--format=csv,noheader,nounits'],
            encoding='utf-8', timeout=5
        )
        for line in out.strip().splitlines():
            parts = [p.strip() for p in line.split(',')]
            if len(parts) < 15:
                continue
            (idx, name, uuid,
             mem_total, mem_used, mem_free,
             util_gpu, util_mem,
             temp,
             pwr_draw, pwr_limit,
             clk_sm, clk_mem,
             pcie_gen, pcie_width) = parts[:15]
            gpus.append({
                'index':          _safe_int(idx),
                'name':           name,
                'uuid':           uuid,
                'memory_total':   _safe_int(mem_total),
                'memory_used':    _safe_int(mem_used),
                'memory_free':    _safe_int(mem_free),
                'utilization':    _safe_int(util_gpu),
                'memory_utilization': _safe_int(util_mem),
                'temperature':    _safe_int(temp),
                'power_draw':     _safe_float(pwr_draw),
                'power_limit':    _safe_float(pwr_limit),
                'clock_sm':       _safe_int(clk_sm),
                'clock_mem':      _safe_int(clk_mem),
                'pcie_gen':       _safe_int(pcie_gen),
                'pcie_width':     _safe_int(pcie_width),
            })
    except Exception:
        pass

    try:
        out2 = subprocess.check_output(
            ['nvidia-smi', '--query-compute-apps=pid,process_name,used_memory,gpu_uuid',
             '--format=csv,noheader,nounits'],
            encoding='utf-8', timeout=5
        )
        for line in out2.strip().splitlines():
            parts = [p.strip() for p in line.split(',')]
            if len(parts) >= 4:
                pid_s, pname, used_mem, gpu_uuid = parts[:4]
                try:
                    pid_v = int(pid_s)
                except Exception:
                    pid_v = pid_s
                gpu_processes.append({
                    'pid': pid_v,
                    'name': pname,
                    'used_memory': used_mem,
                    'gpu_uuid': gpu_uuid,
                })
    except Exception:
        pass

    return gpus, gpu_processes


# ── Network I/O rates ─────────────────────────────────────────────────────────
_IGNORED_IFACES = {'lo'}
_ACTIVE_PREFIXES = ('enp', 'eth', 'ens', 'bond', 'ib')


def collect_network(delta: float) -> dict:
    global _prev_net
    try:
        counters = psutil.net_io_counters(pernic=True)
        stats    = psutil.net_if_stats()
        addrs    = psutil.net_if_addrs()
        interfaces: dict = {}

        for iface, c in counters.items():
            if iface in _IGNORED_IFACES:
                continue
            # only report interfaces that are up and match known prefixes
            if not stats.get(iface, None) or not stats[iface].isup:
                if not any(iface.startswith(p) for p in _ACTIVE_PREFIXES):
                    continue

            prev = _prev_net.get(iface)
            if prev and delta > 0:
                sent_rate = max(0, (c.bytes_sent - prev['bytes_sent']) / delta)
                recv_rate = max(0, (c.bytes_recv - prev['bytes_recv']) / delta)
            else:
                sent_rate = recv_rate = 0.0

            # collect IP addresses (IPv4 + IPv6)
            iface_addrs = addrs.get(iface, [])
            ips = []
            for a in iface_addrs:
                if a.family == socket.AF_INET:        # IPv4
                    ips.append({'addr': a.address, 'netmask': a.netmask, 'version': 4})
                elif a.family == socket.AF_INET6:     # IPv6
                    addr6 = a.address.split('%')[0]   # strip zone id
                    ips.append({'addr': addr6, 'netmask': a.netmask, 'version': 6})

            interfaces[iface] = {
                'bytes_sent':       c.bytes_sent,
                'bytes_recv':       c.bytes_recv,
                'bytes_sent_rate':  round(sent_rate, 1),
                'bytes_recv_rate':  round(recv_rate, 1),
                'packets_sent':     c.packets_sent,
                'packets_recv':     c.packets_recv,
                'errin':            c.errin,
                'errout':           c.errout,
                'dropin':           getattr(c, 'dropin', 0),
                'dropout':          getattr(c, 'dropout', 0),
                'is_up':            stats[iface].isup if iface in stats else False,
                'speed_mbps':       stats[iface].speed if iface in stats else 0,
                'addrs':            ips,
                'mac':              next((a.address for a in iface_addrs if a.family == 17), ''),
            }
            _prev_net[iface] = {'bytes_sent': c.bytes_sent, 'bytes_recv': c.bytes_recv}

        total_sent = sum(v['bytes_sent_rate'] for v in interfaces.values())
        total_recv = sum(v['bytes_recv_rate'] for v in interfaces.values())
        return {
            'interfaces':       interfaces,
            'total_sent_rate':  round(total_sent, 1),
            'total_recv_rate':  round(total_recv, 1),
        }
    except Exception:
        return {'interfaces': {}, 'total_sent_rate': 0.0, 'total_recv_rate': 0.0}


# ── Disk I/O rates ────────────────────────────────────────────────────────────
def collect_disk_io(delta: float) -> dict:
    global _prev_disk
    try:
        c = psutil.disk_io_counters()
        if not c:
            return {}
        prev = _prev_disk
        if prev and delta > 0:
            read_rate  = max(0, (c.read_bytes  - prev.get('read_bytes',  c.read_bytes))  / delta)
            write_rate = max(0, (c.write_bytes - prev.get('write_bytes', c.write_bytes)) / delta)
            read_iops  = max(0, (c.read_count  - prev.get('read_count',  c.read_count))  / delta)
            write_iops = max(0, (c.write_count - prev.get('write_count', c.write_count)) / delta)
        else:
            read_rate = write_rate = read_iops = write_iops = 0.0

        _prev_disk = {
            'read_bytes':  c.read_bytes,
            'write_bytes': c.write_bytes,
            'read_count':  c.read_count,
            'write_count': c.write_count,
        }
        return {
            'read_bytes_rate':  round(read_rate,  1),
            'write_bytes_rate': round(write_rate, 1),
            'read_iops':        round(read_iops,  1),
            'write_iops':       round(write_iops, 1),
            'read_bytes_total': c.read_bytes,
            'write_bytes_total': c.write_bytes,
        }
    except Exception:
        return {}


# ── System info (cached; refreshed every N calls) ────────────────────────────
_sys_cache: dict = {}
_sys_cache_ts: float = 0.0
_SYS_CACHE_TTL = 60.0   # refresh static info every 60 s


def _read_dmi(field: str) -> str:
    try:
        p = Path(f'/sys/class/dmi/id/{field}')
        return p.read_text().strip() if p.exists() else ''
    except Exception:
        return ''


def _read_dgx_release() -> dict:
    result = {}
    try:
        for line in Path('/etc/dgx-release').read_text().splitlines():
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                result[k.strip()] = v.strip().strip('"')
    except Exception:
        pass
    return result


def _read_nvidia_info() -> dict:
    info = {}
    try:
        out = subprocess.check_output(
            ['nvidia-smi', '--query-gpu=driver_version,name',
             '--format=csv,noheader'],
            encoding='utf-8', timeout=5
        )
        first = out.strip().splitlines()[0] if out.strip() else ''
        parts = [p.strip() for p in first.split(',')]
        if parts:
            info['driver_version'] = parts[0]
        # CUDA version from nvidia-smi header
        header = subprocess.check_output(['nvidia-smi'], encoding='utf-8', timeout=5)
        import re
        m = re.search(r'CUDA Version:\s*([\d.]+)', header)
        if m:
            info['cuda_version'] = m.group(1)
        m2 = re.search(r'NVIDIA-SMI\s+([\d.]+)', header)
        if m2:
            info['nvidia_smi_version'] = m2.group(1)
    except Exception:
        pass
    return info


def collect_system_info() -> dict:
    global _sys_cache, _sys_cache_ts
    now = time.time()
    # Return cached if fresh enough
    if _sys_cache and (now - _sys_cache_ts) < _SYS_CACHE_TTL:
        # Update only the dynamic parts
        _sys_cache['uptime'] = int(now - psutil.boot_time())
        try:
            load1, load5, load15 = psutil.getloadavg()
            _sys_cache['load_avg_1']  = round(load1,  2)
            _sys_cache['load_avg_5']  = round(load5,  2)
            _sys_cache['load_avg_15'] = round(load15, 2)
        except Exception:
            pass
        return _sys_cache

    try:
        boot_ts = psutil.boot_time()
        uptime  = int(now - boot_ts)
        load1, load5, load15 = psutil.getloadavg()
        try:
            freq = psutil.cpu_freq()
            cpu_freq_mhz = round(freq.current, 1) if freq else None
            cpu_freq_max = round(freq.max, 1) if freq else None
        except Exception:
            cpu_freq_mhz = cpu_freq_max = None
        cpu_count_logical  = psutil.cpu_count(logical=True)
        cpu_count_physical = psutil.cpu_count(logical=False)
        try:
            with open('/proc/cpuinfo') as f:
                cpu_model = next(
                    (ln.split(':')[1].strip()
                     for ln in f if ln.startswith('model name')), 'Unknown')
        except Exception:
            cpu_model = 'Unknown'
        try:
            hostname = socket.gethostname()
        except Exception:
            hostname = ''

        # OS info
        os_info = {}
        try:
            for line in Path('/etc/os-release').read_text().splitlines():
                if '=' in line:
                    k, v = line.split('=', 1)
                    os_info[k.strip()] = v.strip().strip('"')
        except Exception:
            pass
        try:
            import subprocess as _sp
            lsb = _sp.check_output(['lsb_release', '-a'], encoding='utf-8', timeout=5, stderr=_sp.DEVNULL)
            for line in lsb.splitlines():
                if ':' in line:
                    k, v = line.split(':', 1)
                    os_info[k.strip()] = v.strip()
        except Exception:
            pass

        # DMI / chassis
        chassis_info = {
            'chassis_type':    _read_dmi('chassis_type'),
            'chassis_serial':  _read_dmi('chassis_serial'),
            'chassis_vendor':  _read_dmi('chassis_vendor'),
            'chassis_version': _read_dmi('chassis_version'),
            'product_name':    _read_dmi('product_name'),
            'product_serial':  _read_dmi('product_serial'),
            'bios_version':    _read_dmi('bios_version'),
            'bios_date':       _read_dmi('bios_date'),
        }

        # DGX release
        dgx = _read_dgx_release()

        # NVIDIA
        nv = _read_nvidia_info()

        result = {
            'uptime':             uptime,
            'boot_time':          boot_ts,
            'load_avg_1':         round(load1, 2),
            'load_avg_5':         round(load5, 2),
            'load_avg_15':        round(load15, 2),
            'cpu_count_logical':  cpu_count_logical,
            'cpu_count_physical': cpu_count_physical,
            'cpu_freq_mhz':       cpu_freq_mhz,
            'cpu_freq_max_mhz':   cpu_freq_max,
            'cpu_model':          cpu_model,
            'hostname':           hostname,
            # OS
            'os_name':            os_info.get('Distributor ID') or os_info.get('NAME', ''),
            'os_description':     os_info.get('Description') or os_info.get('PRETTY_NAME', ''),
            'os_release':         os_info.get('Release') or os_info.get('VERSION_ID', ''),
            'os_codename':        os_info.get('Codename') or os_info.get('VERSION_CODENAME', ''),
            # DMI
            **chassis_info,
            # DGX
            'dgx_pretty_name':    dgx.get('DGX_PRETTY_NAME', ''),
            'dgx_swbuild_date':   dgx.get('DGX_SWBUILD_DATE', ''),
            'dgx_swbuild_version':dgx.get('DGX_SWBUILD_VERSION', ''),
            'dgx_commit_id':      dgx.get('DGX_COMMIT_ID', ''),
            'dgx_platform':       dgx.get('DGX_PLATFORM', ''),
            'dgx_serial_number':  dgx.get('DGX_SERIAL_NUMBER', ''),
            'dgx_ota_version':    dgx.get('DGX_OTA_VERSION', ''),
            'dgx_ota_date':       dgx.get('DGX_OTA_DATE', ''),
            # NVIDIA
            'driver_version':     nv.get('driver_version', ''),
            'cuda_version':       nv.get('cuda_version', ''),
            'nvidia_smi_version': nv.get('nvidia_smi_version', ''),
        }
        _sys_cache    = result
        _sys_cache_ts = now
        return result
    except Exception:
        return {}


# ── Main metrics collector ────────────────────────────────────────────────────
def collect_metrics() -> dict:
    global _prev_ts
    now   = time.time()
    delta = now - _prev_ts if _prev_ts > 0 else 0.0
    _prev_ts = now

    # CPU
    try:
        cpu_total   = psutil.cpu_percent(interval=0.1)
        cpu_percore = psutil.cpu_percent(interval=0.1, percpu=True)
    except Exception:
        cpu_total, cpu_percore = 0.0, []

    # Memory
    try:
        vm = psutil.virtual_memory()
        memory = {
            'total':     vm.total,
            'available': vm.available,
            'used':      vm.used,
            'cached':    getattr(vm, 'cached', 0),
            'buffers':   getattr(vm, 'buffers', 0),
            'percent':   vm.percent,
        }
    except Exception:
        memory = {}

    # Disk usage
    try:
        du   = psutil.disk_usage('/')
        disk = {
            'total':   du.total,
            'used':    du.used,
            'free':    du.free,
            'percent': du.percent,
        }
    except Exception:
        disk = {}

    # Disk I/O
    disk_io = collect_disk_io(delta)

    # Processes (top by CPU)
    procs: list = []
    try:
        now_ts = time.time()
        for p in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent', 'status', 'username', 'create_time']):
            try:
                info = dict(p.info)
                ct = info.get('create_time')
                info['runtime_secs'] = int(now_ts - ct) if ct else None
                procs.append(info)
            except Exception:
                continue
        procs = sorted(procs, key=lambda x: x.get('cpu_percent', 0) or 0, reverse=True)[:20]
    except Exception:
        procs = []

    # GPUs
    gpus, gpu_processes = collect_gpu_metrics()

    # Network
    network = collect_network(delta)

    # System info (only compute once every 10 iterations to save cpu)
    system_info = collect_system_info()

    snapshot = {
        'ts':          now,
        'cpu':         {'total': cpu_total, 'percore': cpu_percore},
        'memory':      memory,
        'disk':        disk,
        'disk_io':     disk_io,
        'processes':   procs,
        'gpus':        gpus,
        'gpu_processes': gpu_processes,
        'network':     network,
        'system':      system_info,
    }
    metrics_history.append(snapshot)
    return snapshot


# ── WebSocket endpoint ────────────────────────────────────────────────────────
@app.websocket('/ws')
async def websocket_metrics(websocket: WebSocket, token: str = ''):
    user = verify_token(token)
    if not user:
        await websocket.close(code=4001)
        return
    await websocket.accept()
    logger.info('WebSocket client connected: %s (%s)', websocket.client, user)
    try:
        await asyncio.sleep(0.15)
        while True:
            metrics = collect_metrics()
            try:
                await websocket.send_text(json.dumps(metrics))
            except (ConnectionClosedOK, ConnectionClosedError, WebSocketDisconnect):
                break
            except Exception as e:
                logger.debug('WebSocket send error: %s', e)
                break
            await asyncio.sleep(1)
    finally:
        logger.info('WebSocket client disconnected: %s', websocket.client)
        try:
            await websocket.close()
        except Exception:
            pass


# ── Root: serve frontend ──────────────────────────────────────────────────────
@app.get('/')
def root():
    index = static_dir / 'index.html'
    if index.exists():
        return FileResponse(str(index))
    return {'status': 'DGX Monitor v2 backend running'}
