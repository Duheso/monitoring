"""vLLM Instances CRUD API."""
import time
import httpx
from fastapi import APIRouter, Depends, Request
from ..config import get_current_user
from .helpers import load_instances, save_instances, find_instance, gen_id

router = APIRouter(prefix='/api/vllm/instances', tags=['vllm'])


@router.get('')
def list_instances(_u: str = Depends(get_current_user)):
    return {'instances': load_instances()}


@router.post('')
async def add_instance(req: Request, _u: str = Depends(get_current_user)):
    try:
        body = await req.json()
        inst = {
            'id': gen_id(),
            'name': body.get('name', '').strip(),
            'url': body.get('url', '').strip().rstrip('/'),
            'sidecar_url': body.get('sidecar_url', '').strip().rstrip('/'),
            'created_at': time.time(),
        }
        if not inst['name']:
            return {'ok': False, 'error': 'name required'}
        if not inst['url']:
            return {'ok': False, 'error': 'url required'}
        instances = load_instances()
        instances.append(inst)
        save_instances(instances)
        return {'ok': True, 'instance': inst}
    except Exception as e:
        return {'ok': False, 'error': str(e)}


@router.put('/{inst_id}')
async def update_instance(inst_id: str, req: Request, _u: str = Depends(get_current_user)):
    try:
        body = await req.json()
        instances = load_instances()
        for inst in instances:
            if inst['id'] == inst_id:
                if 'name' in body:
                    inst['name'] = body['name'].strip()
                if 'url' in body:
                    inst['url'] = body['url'].strip().rstrip('/')
                if 'sidecar_url' in body:
                    inst['sidecar_url'] = body['sidecar_url'].strip().rstrip('/')
                save_instances(instances)
                return {'ok': True, 'instance': inst}
        return {'ok': False, 'error': 'instance not found'}
    except Exception as e:
        return {'ok': False, 'error': str(e)}


@router.delete('/{inst_id}')
def delete_instance(inst_id: str, _u: str = Depends(get_current_user)):
    instances = load_instances()
    instances = [i for i in instances if i['id'] != inst_id]
    save_instances(instances)
    return {'ok': True}


@router.post('/{inst_id}/test')
def test_instance(inst_id: str, _u: str = Depends(get_current_user)):
    inst = find_instance(inst_id)
    if not inst:
        return {'ok': False, 'error': 'instance not found'}
    result = {'vllm': None, 'sidecar': None}

    # Test vLLM endpoint
    try:
        r = httpx.get(f"{inst['url']}/v1/models", timeout=5)
        if r.status_code == 200:
            models = r.json().get('data', [])
            result['vllm'] = {
                'status': 'online',
                'models': [m.get('id', '') for m in models],
            }
        else:
            result['vllm'] = {'status': 'error', 'code': r.status_code}
    except Exception as e:
        result['vllm'] = {'status': 'offline', 'error': str(e)[:100]}

    # Test sidecar
    if inst.get('sidecar_url'):
        try:
            r = httpx.get(f"{inst['sidecar_url']}/health", timeout=5)
            result['sidecar'] = {'status': 'online' if r.status_code == 200 else 'error'}
        except Exception as e:
            result['sidecar'] = {'status': 'offline', 'error': str(e)[:100]}

    ok = result['vllm'] and result['vllm']['status'] == 'online'
    return {'ok': ok, 'result': result}
