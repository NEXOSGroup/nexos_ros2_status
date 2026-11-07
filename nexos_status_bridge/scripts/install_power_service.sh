#!/usr/bin/env bash
# Grant the bridge user a narrow NOPASSWD sudo rule so the ros_status power
# button can start/stop ONLY the EPOS drive bringup unit. Nothing else.
#
# Usage:  sudo bash install_power_service.sh [bridge-user] [unit]
set -euo pipefail

USER_NAME="${1:-nexos}"
UNIT="${2:-epos-bringup.service}"
SYSTEMCTL="$(command -v systemctl || echo /usr/bin/systemctl)"
DEST="/etc/sudoers.d/nexos-epos-power"

if [[ $EUID -ne 0 ]]; then
  echo "Please run as root (sudo)." >&2
  exit 1
fi

TMP="$(mktemp)"
cat >"$TMP" <<EOF
# Managed by nexos_status_bridge/install_power_service.sh
# Lets '$USER_NAME' switch the EPOS drive bringup on/off via the ros_status
# power button, and nothing else.
$USER_NAME ALL=(root) NOPASSWD: $SYSTEMCTL start $UNIT, $SYSTEMCTL stop $UNIT
EOF

# Validate before installing, so a typo can never lock sudo.
visudo -cf "$TMP"
install -m 0440 -o root -g root "$TMP" "$DEST"
rm -f "$TMP"

echo "Installed $DEST:"
cat "$DEST"
echo
echo "Test (should NOT prompt for a password):"
echo "  sudo -n $SYSTEMCTL is-active $UNIT"
