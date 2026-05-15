"""Shared helpers for docker API — persistence, client factory."""
import json
import uuid
from pathlib import Path
from typing import Optional
import docker

from ..config import data_dir

# ── Persistence files ─────────────────────────────────────────────────────────
docker_hosts_file = data_dir / 'docker_hosts.json'
docker_containers_file = data_dir / 'docker_containers.json'


def _load_json(path: Path) -> list:
    if path.exists():
        try:
            return json.loads(path.read_text())
        except Exception:
            pass
    return []


def _save_json(path: Path, data: list):
    path.write_text(json.dumps(data, indent=2))


# ── Host helpers ──────────────────────────────────────────────────────────────
def load_hosts() -> list:
    return _load_json(docker_hosts_file)


def save_hosts(hosts: list):
    _save_json(docker_hosts_file, hosts)


def find_host(host_id: str) -> Optional[dict]:
    for h in load_hosts():
        if h['id'] == host_id:
            return h
    return None


# ── Container helpers ─────────────────────────────────────────────────────────
def load_containers() -> list:
    return _load_json(docker_containers_file)


def save_containers(containers: list):
    _save_json(docker_containers_file, containers)


# ── Docker client factory ────────────────────────────────────────────────────
def get_docker_client(host: dict) -> docker.DockerClient:
    """Create a DockerClient from a host config dict."""
    if host.get('is_local', False):
        return docker.DockerClient(base_url='unix:///var/run/docker.sock', timeout=10)

    port = host.get('port', 2375)
    addr = host.get('host', 'localhost')

    if host.get('tls', False):
        tls_config = docker.tls.TLSConfig(verify=False)
        return docker.DockerClient(
            base_url=f'tcp://{addr}:{port}',
            tls=tls_config,
            timeout=10,
        )

    return docker.DockerClient(base_url=f'tcp://{addr}:{port}', timeout=10)


def gen_id() -> str:
    return uuid.uuid4().hex[:12]
