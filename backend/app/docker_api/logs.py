"""Docker container logs — SSE streaming (mirrors journal endpoint pattern)."""
import asyncio
import json
from fastapi import APIRouter, Depends
from starlette.responses import StreamingResponse
from ..config import get_current_user
from .helpers import load_containers, find_host, get_docker_client

router = APIRouter(prefix='/api/docker/containers', tags=['docker-logs'])


@router.get('/{container_id}/logs')
async def stream_container_logs(
    container_id: str,
    lines: int = 100,
    follow: bool = True,
    _u: str = Depends(get_current_user),
):
    # Find monitored container
    containers = load_containers()
    mc = None
    for c in containers:
        if c['id'] == container_id:
            mc = c
            break
    if not mc:
        async def err():
            yield f'data: {json.dumps({"error": "container not found"})}\n\n'.encode()
        return StreamingResponse(err(), media_type='text/event-stream')

    host = find_host(mc['host_id'])
    if not host:
        async def err():
            yield f'data: {json.dumps({"error": "host not found"})}\n\n'.encode()
        return StreamingResponse(err(), media_type='text/event-stream')

    async def generate():
        client = None
        try:
            client = get_docker_client(host)
            container = client.containers.get(mc['container_name'])

            if follow:
                # Stream logs in follow mode
                log_gen = container.logs(
                    stream=True, follow=True,
                    tail=lines, timestamps=True,
                )
                loop = asyncio.get_event_loop()
                while True:
                    try:
                        chunk = await asyncio.wait_for(
                            loop.run_in_executor(None, lambda: next(log_gen, None)),
                            timeout=30,
                        )
                    except asyncio.TimeoutError:
                        yield b'data: {"keepalive":true}\n\n'
                        continue
                    except StopIteration:
                        break

                    if chunk is None:
                        break

                    text = chunk.decode('utf-8', errors='replace').rstrip()
                    for line in text.split('\n'):
                        if line:
                            payload = json.dumps({'line': line})
                            yield f'data: {payload}\n\n'.encode()
            else:
                # Just dump the last N lines
                output = container.logs(tail=lines, timestamps=True)
                text = output.decode('utf-8', errors='replace')
                for line in text.strip().split('\n'):
                    if line:
                        payload = json.dumps({'line': line})
                        yield f'data: {payload}\n\n'.encode()
        except Exception as e:
            yield f'data: {json.dumps({"error": str(e)[:200]})}\n\n'.encode()
        finally:
            if client:
                try:
                    client.close()
                except Exception:
                    pass

    return StreamingResponse(
        generate(),
        media_type='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'},
    )
