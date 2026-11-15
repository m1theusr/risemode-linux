import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {QuickToggle, SystemIndicator} from 'resource:///org/gnome/shell/ui/quickSettings.js';

const UNIT = 'risemode-tempd.service';
const POLL_SECONDS = 2;

function systemctl(args) {
    return new Promise((resolve) => {
        try {
            const proc = Gio.Subprocess.new(['systemctl', '--user', ...args],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
            proc.communicate_utf8_async(null, null, (p, res) => {
                try {
                    const [, stdout] = p.communicate_utf8_finish(res);
                    resolve((stdout ?? '').trim());
                } catch (e) {
                    resolve('');
                }
            });
        } catch (e) {
            resolve('');
        }
    });
}

function readStatus() {
    try {
        const path = GLib.build_filenamev([GLib.get_user_runtime_dir(), 'risemode-tempd.json']);
        const [ok, bytes] = GLib.file_get_contents(path);
        if (!ok)
            return null;
        const st = JSON.parse(new TextDecoder().decode(bytes));
        if (Date.now() / 1000 - st.ts > 10)
            return null;
        return st;
    } catch (e) {
        return null;
    }
}

const CoolerToggle = GObject.registerClass(
class CoolerToggle extends QuickToggle {
    _init(gicon) {
        super._init({
            title: 'Cooler Display',
            subtitle: 'Desligado',
            gicon,
            toggleMode: true,
        });
        this._busy = false;
        this.connect('clicked', () => this._apply(this.checked));
    }

    async _apply(enable) {
        this._busy = true;
        this.subtitle = enable ? 'Iniciando…' : 'Parando…';
        await systemctl([enable ? 'enable' : 'disable', '--now', UNIT]);
        this._busy = false;
        await this.refresh();
    }

    async refresh() {
        if (this._busy)
            return;
        const state = await systemctl(['is-active', UNIT]);
        const active = state === 'active' || state === 'activating';
        if (this.checked !== active)
            this.checked = active;

        if (!active) {
            this.subtitle = state === 'failed' ? 'Falhou (veja journalctl)' : 'Desligado';
            return;
        }
        const st = readStatus();
        if (!st)
            this.subtitle = 'Aguardando…';
        else if (!st.connected)
            this.subtitle = 'Cooler não encontrado';
        else
            this.subtitle = `CPU ${st.cpu_temp} °C · ${st.cpu_usage}%`;
    }
});

const CoolerIndicator = GObject.registerClass(
class CoolerIndicator extends SystemIndicator {
    _init(gicon) {
        super._init();
        this._toggle = new CoolerToggle(gicon);
        this.quickSettingsItems.push(this._toggle);
    }

    get toggle() {
        return this._toggle;
    }

    destroy() {
        this.quickSettingsItems.forEach(item => item.destroy());
        super.destroy();
    }
});

export default class RiseModeCoolerExtension extends Extension {
    enable() {
        const gicon = Gio.icon_new_for_string(`${this.path}/icons/cooler-symbolic.svg`);
        this._indicator = new CoolerIndicator(gicon);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);

        this._indicator.toggle.refresh();
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, POLL_SECONDS, () => {
            this._indicator?.toggle.refresh();
            return GLib.SOURCE_CONTINUE;
        });
    }

    disable() {
        if (this._timer) {
            GLib.source_remove(this._timer);
            this._timer = null;
        }
        this._indicator?.destroy();
        this._indicator = null;
    }
}
