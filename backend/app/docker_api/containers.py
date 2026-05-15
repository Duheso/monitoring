"""Docker Containers CRUD + Actions API."""
import time
from fastapi import APIRouter, Depends, Request
from ..config import get_current_user
from .helpers import (
    load_containers, save_containers, load_hosts, find_host,
    get_docker_client, gen_id,
)

router = APIRouter(prefix='/api/docker/containers', tags=['docker-containers'])


@router.get('')
def list_containers(_u: str = Depends(get_current_user)):
    return {'containers': load_containers()}


@router.post('')
async def add_container(req: Request, _u: str = Depends(get_current_user)):
    try:
        body = await req.json()
        container_name = body.get('container_name', '').strip()
        host_id = body.get('host_id', '').strip()
        if not container_name:
            return {'ok': False, 'error': 'container_name required'}
        if not host_id:
            return {'ok': False, 'error': 'host_id required'}
        if not find_host(host_id):
            return {'ok': False, 'error': 'host not found'}

        containers = load_containers()
        # Avoid duplicates
        for c in containers:
            if c['container_name'] == container_name and c['host_id'] == host_id:
                return {'ok': False, 'error': 'container already monitored'}

        entry = {
            'id': gen_id(),
            'container_name': container_name,
            'host_id': host_id,
            'created_at': time.time(),
        }
        containers.append(entry)
        save_containers(containers)
        return {'ok': True, 'container': entry}
    except Exception as e:
        return {'ok': False, 'error': str(e)}


@router.delete('/{container_id}')
def delete_container(container_id: str, _u: str = Depends(get_current_user)):
    containers = load_containers()
    containers = [c for c in containers if c['id'] != container_id]
    save_containers(containers)
    return {'ok': True}


@router.get('/by-host/{host_id}')
def list_available_containers(host_id: str, _u: str = Depends(get_current_user)):
    """List ALL containers on a host (for selection UI)."""
    host = find_host(host_id)
    if not host:
        return {'ok': False, 'error': 'host not found'}
    try:
        client = get_docker_client(host)
        containers = client.containers.list(all=True)
        result = []
        for c in containers:
            result.append({
                'name': c.name,
                'id': c.short_id,
                'status': c.status,
                'image': str(c.image.tags[0]) if c.image.tags else str(c.image.short_id),
                'created': c.attrs.get('Created', ''),
            })
        client.close()
        return {'ok': True, 'containers': result}
    except Exception as e:
        return {'ok': False, 'error': str(e)[:200]}


VALID_ACTIONS = {
    'start', 'stop', 'restart', 'pause', 'unpause', 'remove',
    'pull', 'recreate', 'recreate_no_cache',
}


@router.post('/{container_id}/action')
async def container_action(container_id: str, req: Request, _u: str = Depends(get_current_user)):
    try:
        body = await req.json()
        action = body.get('action', '')
        if action not in VALID_ACTIONS:
            return {'ok': False, 'error': f'invalid action: {action}'}

        containers = load_containers()
        mc = None
        for c in containers:
            if c['id'] == container_id:
                mc = c
                break
        if not mc:
            return {'ok': False, 'error': 'monitored container not found'}

        host = find_host(mc['host_id'])
        if not host:
            return {'ok': False, 'error': 'host not found'}

        client = get_docker_client(host)

        if action == 'pull':
            container = client.containers.get(mc['container_name'])
            image_name = container.image.tags[0] if container.image.tags else None
            if not image_name:
                client.close()
                return {'ok': False, 'error': 'container has no tagged image to pull'}
            client.images.pull(image_name)
            client.close()
            return {'ok': True, 'message': f'pulled {image_name}'}

        if action in ('recreate', 'recreate_no_cache'):
            container = client.containers.get(mc['container_name'])
            config = container.attrs
            image_name = container.image.tags[0] if container.image.tags else None
            name = container.name

            # Extract run config
            host_config = config.get('HostConfig', {})
            networking = config.get('NetworkSettings', {})
            env = config.get('Config', {}).get('Env', [])
            cmd = config.get('Config', {}).get('Cmd')
            ports = host_config.get('PortBindings', {})
            volumes = host_config.get('Binds', [])
            restart_policy = host_config.get('RestartPolicy', {})
            network_mode = host_config.get('NetworkMode', 'default')
            labels = config.get('Config', {}).get('Labels', {})

            # Pull new image if no cache
            if action == 'recreate_no_cache' and image_name:
                client.images.pull(image_name)

            # Stop and remove old container
            try:
                container.stop(timeout=10)
            except Exception:
                pass
            container.remove(force=True)

            # Create and start new container
            run_kwargs = {
                'image': image_name or config['Config']['Image'],
                'name': name,
                'environment': env,
                'ports': ports,
                'volumes': volumes,
                'restart_policy': restart_policy,
                'network_mode': network_mode,
                'labels': labels,
                'detach': True,
            }
            if cmd:
                run_kwargs['command'] = cmd

            client.containers.run(**run_kwargs)
            client.close()
            return {'ok': True, 'message': f'recreated {name}'}

        # Simple actions: start, stop, restart, pause, unpause, remove
        container = client.containers.get(mc['container_name'])

        if action == 'start':
            container.start()
        elif action == 'stop':
            container.stop(timeout=10)
        elif action == 'restart':
            container.restart(timeout=10)
        elif action == 'pause':
            container.pause()
        elif action == 'unpause':
            container.unpause()
        elif action == 'remove':
            force = body.get('force', False)
            container.stop(timeout=5)
            container.remove(force=force)
            # Also remove from monitored list
            containers = [c for c in load_containers() if c['id'] != container_id]
            save_containers(containers)

        client.close()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'error': str(e)[:200]}
