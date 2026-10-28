import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MessageSquare,
  Globe,
  Save,
} from 'lucide-react';
import { WebhookConfig, WebhookDeliveryLog } from '../types/drive';

interface WebhookAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: any, type?: 'success' | 'error' | 'info') => void;
}

export const WebhookAlertsModal: React.FC<WebhookAlertsModalProps> = ({
  isOpen,
  onClose,
  showToast,
}) => {
  const [config, setConfig] = useState<WebhookConfig>({
    enabled: false,
    telegramEnabled: false,
    telegramBotToken: '',
    telegramChatId: '',
    discordEnabled: false,
    discordWebhookUrl: '',
    customWebhookEnabled: false,
    customWebhookUrl: '',
    events: {
      onUpload: true,
      onDownload: true,
      onLowStorage: true,
      onFileRequestUpload: true,
      onDeduplicate: true,
    },
  });
  const [logs, setLogs] = useState<WebhookDeliveryLog[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/webhooks/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.config) setConfig(data.config);
        if (Array.isArray(data.logs)) setLogs(data.logs);
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/webhooks/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) throw new Error('Failed to save webhook settings');
      showToast('Telegram, Discord & Webhook alert settings saved!', 'success');
    } catch (err) {
      showToast(err, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const res = await fetch('/api/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (Array.isArray(data.logs)) setLogs(data.logs);
      showToast('Dispatched live test notification to configured channels!', 'success');
    } catch (err) {
      showToast(err, 'error');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[88vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-sky-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">
                Telegram, Discord & Webhook Real-Time Alerts
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Receive instant push alerts when files are uploaded, shared links are downloaded, or free storage drops below 10%.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Master Enable Toggle */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-100">
                Enable Real-Time Event Notifications
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Automatically dispatch non-blocking server notifications when drive events occur.
              </p>
            </div>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
            />
          </div>

          {/* Channels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Telegram Bot */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-bold text-slate-100">Telegram Bot API</span>
                </div>
                <input
                  type="checkbox"
                  checked={config.telegramEnabled}
                  onChange={(e) => setConfig({ ...config, telegramEnabled: e.target.checked })}
                  className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Bot Token (@BotFather)</label>
                <input
                  type="password"
                  value={config.telegramBotToken}
                  onChange={(e) => setConfig({ ...config, telegramBotToken: e.target.value })}
                  placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Telegram Chat / Channel ID</label>
                <input
                  type="text"
                  value={config.telegramChatId}
                  onChange={(e) => setConfig({ ...config, telegramChatId: e.target.value })}
                  placeholder="e.g., -100192837465 or 987654321"
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {/* Discord & Custom Webhook */}
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-slate-100">Discord Webhook</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.discordEnabled}
                    onChange={(e) => setConfig({ ...config, discordEnabled: e.target.checked })}
                    className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                  />
                </div>
                <input
                  type="url"
                  value={config.discordWebhookUrl}
                  onChange={(e) => setConfig({ ...config, discordWebhookUrl: e.target.value })}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-100">Custom JSON Webhook</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.customWebhookEnabled}
                    onChange={(e) => setConfig({ ...config, customWebhookEnabled: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </div>
                <input
                  type="url"
                  value={config.customWebhookUrl}
                  onChange={(e) => setConfig({ ...config, customWebhookUrl: e.target.value })}
                  placeholder="https://your-server.com/webhook"
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Event Triggers */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Trigger Events
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {[
                { key: 'onUpload', label: 'When a file is uploaded to OneDrive' },
                { key: 'onDownload', label: 'When someone downloads a shared file' },
                { key: 'onFileRequestUpload', label: 'When a client uploads to a Dropzone link' },
                { key: 'onLowStorage', label: 'When drive free storage drops below 10%' },
                { key: 'onDeduplicate', label: 'When duplicate files are cleaned up' },
              ].map((ev) => (
                <label
                  key={ev.key}
                  className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-900/70 border border-slate-800/80 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={(config.events as any)[ev.key] !== false}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        events: { ...config.events, [ev.key]: e.target.checked },
                      })
                    }
                    className="w-3.5 h-3.5 accent-sky-500 rounded"
                  />
                  <span className="text-slate-200">{ev.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Recent Delivery Logs */}
          {logs.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Recent Alert Deliveries
              </h3>
              <div className="max-h-32 overflow-y-auto space-y-1.5">
                {logs.slice(0, 8).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {log.success ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      )}
                      <span className="uppercase font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                        {log.channel}
                      </span>
                      <span className="text-slate-200 font-medium truncate">{log.event}</span>
                      {log.error && <span className="text-rose-400">({log.error})</span>}
                    </div>
                    <span className="text-slate-500 font-mono tabular-nums shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={isTesting}
            onClick={handleTest}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>Send Test Alert</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-sky-600/20 transition-all"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save Alert Settings</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
