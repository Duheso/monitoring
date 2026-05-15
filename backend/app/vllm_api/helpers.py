"""Shared helpers for vLLM API — persistence."""
import json
from pathlib import Path
from typing import Optional
import uuid

from ..config import data_dir

vllm_instances_file = data_dir / 'vllm_instances.json'


def load_instances() -> list:
    if vllm_instances_file.exists():
        try:
            return json.loads(vllm_instances_file.read_text())
        except Exception:
            pass
    return []


def save_instances(instances: list):
    vllm_instances_file.write_text(json.dumps(instances, indent=2))


def find_instance(inst_id: str) -> Optional[dict]:
    for i in load_instances():
        if i['id'] == inst_id:
            return i
    return None


def gen_id() -> str:
    return uuid.uuid4().hex[:12]
