#!/usr/bin/env bash
set -uo pipefail
UUID="risemode-cooler@m1theusr"
gnome-extensions disable "$UUID" 2>/dev/null
systemctl --user disable --now risemode-tempd.service 2>/dev/null
rm -f  "$HOME/.local/bin/risemode-tempd" "$HOME/.config/systemd/user/risemode-tempd.service"
rm -rf "$HOME/.local/share/gnome-shell/extensions/$UUID"
systemctl --user daemon-reload
if [[ -f /etc/udev/rules.d/70-risemode-cooler.rules ]]; then
    sudo rm -f /etc/udev/rules.d/70-risemode-cooler.rules && sudo udevadm control --reload-rules
fi
echo "Removido."
