"""Docker Hosts CRUD API."""
import time
from fastapi import APIRouter, Depends, Request
from ..config import get_current_user
from .helpers import load_hosts, save_hosts, find_host, get_docker_client, gen_id

router = APIRouter(prefix='/api/docker/hosts', tags=['docker-hosts'])


@router.get('')
def list_hosts(_u: str = Depends(get_current_user)):
    return {'hosts': load_hosts()}


@router.post('')
async def add_host(req: Request, _u: str = Depends(get_current_user)):
    try:
        body = await req.json()
        host = {
            'id': gen_id(),
            'name': body.get('name', '').strip(),
            'host': body.get('host', '').strip(),
            'port': int(body.get('port', 2375)),
            'tls': bool(body.get('tls', False)),
            'is_local': bool(body.get('is_local', False)),
            'created_at': time.time(),
        }
        if not host['name']:
            return {'ok': False, 'error': 'name required'}
        if not host['is_local'] and not host['host']:
            return {'ok': False, 'error': 'host address required for remote hosts'}
        hosts = load_hosts()
        hosts.append(host)
        save_hosts(hosts)
        return {'ok': True, 'host': host}
    except Exception as e:
        return {'ok': False, 'error': str(e)}


@router.put('/{host_id}')
async def update_host(host_id: str, req: Request, _u: str = Depends(get_current_user)):
    try:
        body = await req.json()
        hosts = load_hosts()
        for h in hosts:
            if h['id'] == host_id:
                if 'name' in body:
                    h['name'] = body['name'].strip()
                if 'host' in body:
                    h['host'] = body['host'].strip()
                if 'port' in body:
                    h['port'] = int(body['port'])
                if 'tls' in body:
                    h['tls'] = bool(body['tls'])
                if 'is_local' in body:
                    h['is_local'] = bool(body['is_local'])
                save_hosts(hosts)
                return {'ok': True, 'host': h}
        return {'ok': False, 'error': 'host not found'}
    except Exception as e:
        return {'ok': False, 'error': str(e)}


@router.delete('/{host_id}')
def delete_host(host_id: str, _u: str = Depends(get_current_user)):
    hosts = load_hosts()
    hosts = [h for h in hosts if h['id'] != host_id]
    save_hosts(hosts)
    return {'ok': True}


@router.post('/{host_id}/test')
def test_host(host_id: str, _u: str = Depends(get_current_user)):
    host = find_host(host_id)
    if not host:
        return {'ok': False, 'error': 'host not found'}
    try:
        client = get_docker_client(host)
        info = client.info()
        client.close()
        return {
            'ok': True,
            'info': {
                'server_version': info.get('ServerVersion', ''),
                'os': info.get('OperatingSystem', ''),
                'containers': info.get('Containers', 0),
                'images': info.get('Images', 0),
                'name': info.get('Name', ''),
            },
        }
    except Exception as e:
        return {'ok': False, 'error': str(e)[:200]}
