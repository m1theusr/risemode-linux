#!/usr/bin/env bash
# Instala o daemon risemode-tempd, o serviço systemd de usuário,
# a regra udev (pede sudo) e a extensão GNOME.
set -euo pipefail
cd "$(dirname "$0")"

UUID="risemode-cooler@m1theusr"

echo "==> daemon -> ~/.local/bin/risemode-tempd"
install -Dm755 risemode-tempd "$HOME/.local/bin/risemode-tempd"

echo "==> serviço -> ~/.config/systemd/user/risemode-tempd.service"
install -Dm644 risemode-tempd.service "$HOME/.config/systemd/user/risemode-tempd.service"
systemctl --user daemon-reload

if [[ "${1:-}" != "--no-udev" ]]; then
    echo "==> regra udev -> /etc/udev/rules.d/70-risemode-cooler.rules (sudo)"
    sudo install -Dm644 70-risemode-cooler.rules /etc/udev/rules.d/70-risemode-cooler.rules
    sudo udevadm control --reload-rules
    sudo udevadm trigger --subsystem-match=hidraw
fi

echo "==> extensão GNOME -> ~/.local/share/gnome-shell/extensions/$UUID"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"
rm -rf "$DEST"
mkdir -p "$DEST"
cp -r "gnome-extension/$UUID/." "$DEST/"

echo "==> ativando serviço"
systemctl --user enable --now risemode-tempd.service

gnome-extensions enable "$UUID" 2>/dev/null || true

cat <<EOF

Pronto!
 - O display já deve mostrar a temperatura da CPU.
 - Faça logout/login (Wayland) para o GNOME carregar a extensão; depois,
   se preciso: gnome-extensions enable $UUID
 - O botão "Cooler Display" aparece nas Configurações Rápidas (canto superior direito).
 - Logs: journalctl --user -u risemode-tempd -f
EOF
