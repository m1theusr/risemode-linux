# Rise Mode Aura Ice ARGB — display de temperatura no Linux

Faz o display do water cooler Rise Mode (RM-WAIB-05-ARGB) mostrar a temperatura da CPU no Linux,
com um botão para ligar e desligar nas Configurações Rápidas do GNOME.

## Análise do software original (Windows, v8.0)

- O `.exe` é um instalador **Inno Setup 6.1**. Ele contém o "Rise Mode Temp CPU Driver R2.2", feito em .NET a partir de um fork do LibreHardwareMonitor.
- Componentes:
  - `Rise Mode Temp CPU Driver R2.2.exe`: lê os sensores com o LibreHardwareMonitor e, a cada 1 s, escreve 11 bytes no named pipe `tifPipe`.
  - `SendTemp.exe`: lê o pipe e repassa os bytes para todo dispositivo HID com VID `0xAA88` e PID `0x8666`.
  - `CPU Server.exe`: serviço do Windows que só inicia o `SendTemp.exe`.
  - `PawnIO_setup.exe`: driver de kernel do Windows para ler os sensores. No Linux ele é desnecessário, porque o kernel já oferece o `hwmon`.
- Dispositivo USB: `aa88:8666`, "铭研科技 温度显示HID设备" ("dispositivo HID de exibição de temperatura"). O report descriptor declara um input report e um output report de 10 bytes, sem report ID.

### Protocolo (output report)

| byte | conteúdo                     |
|------|------------------------------|
| 0    | `0x00` (report ID)           |
| 1    | temperatura da CPU (°C)      |
| 2    | temperatura da GPU (°C)      |
| 3    | uso da CPU (%)               |
| 4    | uso da memória (%)           |
| 5    | temperatura da placa-mãe (°C)* |
| 6    | uso da GPU (%)               |
| 7–10 | `0x00`                       |

\* Quando não há sensor, o software original estima esse valor: `30 + min(cpu,gpu) × 0,15` (ou `× 0,2` acima de 45 °C).

Não existe handshake nem inicialização: basta escrever o pacote no `/dev/hidrawN` uma vez por segundo.

## Componentes desta versão para Linux

- `risemode-tempd`: daemon em Python 3, sem dependências externas. Ele lê:
  - `coretemp`, `k10temp` ou `zenpower` (CPU);
  - `amdgpu` ou `nvidia-smi` (GPU);
  - `/proc/stat` e `/proc/meminfo` (uso da CPU e da memória).

  Ele reconecta sozinho se o cabo USB for desconectado e grava o estado em `$XDG_RUNTIME_DIR/risemode-tempd.json`.
- `risemode-tempd.service`: serviço systemd de usuário.
- `70-risemode-cooler.rules`: regra udev (`uaccess`) que deixa o usuário logado escrever no display sem root.
- `gnome-extension/risemode-cooler@m1theusr`: toggle "Cooler Display" nas Configurações Rápidas (GNOME 45–50). Ele mostra a temperatura atual e liga ou desliga o serviço (`systemctl --user enable/disable --now`).

## Instalação

```bash
./install.sh            # instala tudo (pede sudo para a regra udev)
./install.sh --no-udev  # instala sem a regra udev
```

Depois, faça logout e login para o GNOME carregar a extensão.

Opções do daemon (para editar em `ExecStart` no `.service`):

```
risemode-tempd -v           # mostra no log o que está sendo enviado
risemode-tempd --offset -3  # soma um ajuste à temperatura da CPU
risemode-tempd --no-gpu     # não consulta a GPU (evita chamar o nvidia-smi)
risemode-tempd -i 2         # envia a cada 2 s
```

Logs: `journalctl --user -u risemode-tempd -f`

Remoção: `./uninstall.sh`
