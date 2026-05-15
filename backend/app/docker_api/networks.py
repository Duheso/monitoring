"""Docker Networks API — list, create, remove, connect, disconnect."""
from fastapi import APIRouter, Depends, Request
from ..config import get_current_user
from .helpers import find_host, get_docker_client

router = APIRouter(prefix='/api/docker', tags=['docker-networks'])


@router.get('/hosts/{host_id}/networks')
def list_networks(host_id: str, _u: str = Depends(get_current_user)):
    host = find_host(host_id)
    if not host:
        return {'ok': False, 'error': 'host not found'}
    try:
        client = get_docker_client(host)
        networks = client.networks.list()
        result = []
        for n in networks:
            n.reload()
            containers = []
            for cid, cinfo in (n.attrs.get('Containers') or {}).items():
                containers.append({
                    'id': cid[:12],
                    'name': cinfo.get('Name', ''),
                    'ipv4': cinfo.get('IPv4Address', ''),
                })
            result.append({
                'id': n.short_id,
                'name': n.name,
                'driver': n.attrs.get('Driver', ''),
                'scope': n.attrs.get('Scope', ''),
                'containers': containers,
            })
        client.close()
        return {'ok': True, 'networks': result}
    except Exception as e:
        return {'ok': False, 'error': str(e)[:200]}


@router.post('/hosts/{host_id}/networks')
async def create_network(host_id: str, req: Request, _u: str = Depends(get_current_user)):
    host = find_host(host_id)
    if not host:
        return {'ok': False, 'error': 'host not found'}
    try:
        body = await req.json()
        name = body.get('name', '').strip()
        driver = body.get('driver', 'bridge')
        if not name:
            return {'ok': False, 'error': 'network name required'}

        client = get_docker_client(host)
        network = client.networks.create(name, driver=driver)
        client.close()
        return {'ok': True, 'network': {'id': network.short_id, 'name': network.name}}
    except Exception as e:
        return {'ok': False, 'error': str(e)[:200]}


@router.delete('/networks/{host_id}/{network_name}')
def remove_network(host_id: str, network_name: str, _u: str = Depends(get_current_user)):
    host = find_host(host_id)
    if not host:
        return {'ok': False, 'error': 'host not found'}
    try:
        client = get_docker_client(host)
        network = client.networks.get(network_name)
        network.remove()
        client.close()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'error': str(e)[:200]}


@router.post('/networks/{host_id}/{network_name}/connect')
async def connect_container(host_id: str, network_name: str, req: Request, _u: str = Depends(get_current_user)):
    host = find_host(host_id)
    if not host:
        return {'ok': False, 'error': 'host not found'}
    try:
        body = await req.json()
        container_name = body.get('container_name', '').strip()
        if not container_name:
            return {'ok': False, 'error': 'container_name required'}

        client = get_docker_client(host)
        network = client.networks.get(network_name)
        network.connect(container_name)
        client.close()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'error': str(e)[:200]}


@router.post('/networks/{host_id}/{network_name}/disconnect')
async def disconnect_container(host_id: str, network_name: str, req: Request, _u: str = Depends(get_current_user)):
    host = find_host(host_id)
    if not host:
        return {'ok': False, 'error': 'host not found'}
    try:
        body = await req.json()
        container_name = body.get('container_name', '').strip()
        if not container_name:
            return {'ok': False, 'error': 'container_name required'}

        client = get_docker_client(host)
        network = client.networks.get(network_name)
        network.disconnect(container_name)
        client.close()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'error': str(e)[:200]}
