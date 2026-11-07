#!/usr/bin/env bash
# Install ros_status on a ROS 2 host: deploy the web page and enable systemd
# autostart for rosbridge + the static web server.
#
# Usage:  sudo scripts/install.sh [ROS_DISTRO]   (default: lyrical)
set -euo pipefail

DISTRO="${1:-lyrical}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_USER="${SUDO_USER:-$USER}"
WEB_DST="/home/${TARGET_USER}/ros_status"

if [[ $EUID -ne 0 ]]; then echo "Run with sudo." >&2; exit 1; fi

echo "== rosbridge =="
apt-get install -y "ros-${DISTRO}-rosbridge-suite"

echo "== deploy web page to ${WEB_DST} =="
install -d -o "${TARGET_USER}" -g "${TARGET_USER}" "${WEB_DST}"
cp "${REPO_DIR}/web/"* "${WEB_DST}/"
chown -R "${TARGET_USER}:${TARGET_USER}" "${WEB_DST}"

echo "== systemd services =="
for svc in ros-rosbridge ros-status-web; do
  sed "s/lyrical/${DISTRO}/g; s|/home/nexos/ros_status|${WEB_DST}|g; s/^User=nexos/User=${TARGET_USER}/g" \
      "${REPO_DIR}/systemd/${svc}.service" > "/etc/systemd/system/${svc}.service"
done
systemctl daemon-reload
systemctl enable --now ros-rosbridge.service ros-status-web.service

echo "== done =="
echo "Open http://<this-host>:8080  (rosbridge on :9090)"
echo "Optional host vitals: colcon build --packages-select nexos_status_agent && ros2 run nexos_status_agent agent"
