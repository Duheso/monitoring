#!/usr/bin/env bash
set -euo pipefail

SERVICE_SRC="$(dirname "$0")/../deployment/monitoring.service"
SERVICE_DST="/etc/systemd/system/monitoring.service"

if [ "$EUID" -ne 0 ]; then
  echo "This script must be run as root. Use sudo." >&2
  exit 2
fi

cp "$SERVICE_SRC" "$SERVICE_DST"
systemctl daemon-reload
systemctl enable monitoring.service
systemctl start monitoring.service

echo "monitoring.service installed and started. Check status with: systemctl status monitoring.service"
