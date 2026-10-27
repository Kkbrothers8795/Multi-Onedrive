import React, { useState } from 'react';
import { X, Share2, Copy, Check, Globe, Shield, Download, FileText, Code2, Link2, Sparkles, CheckCircle2 } from 'lucide-react';
import { DriveItem } from '../types/drive';

interface ShareModalProps {
  item: DriveItem | null;
  onClose: () => void;
  onUpdateItemSecurity?: (itemId: string, sharePin?: string, expiresAt?: string) => Promise<void>;
  onGenerateLink?: (item: DriveItem, type: 'view' | 'edit') => Promise<string>;
}

export const ShareModal: React.FC<ShareModalProps> = ({ item, onClose, onUpdateItemSecurity }) => {
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'direct' | 'embed' | 'security'>('preview');

  // Security state
  const [pinEnabled, setPinEnabled] = useState(Boolean(item?.sharePin));
  const [pinValue, setPinValue] = useState(item?.sharePin || '');
  const [expiryEnabled, setExpiryEnabled] = useState(Boolean(item?.expiresAt));
  const [expiryValue, setExpiryValue] = useState(item?.expiresAt ? item.expiresAt.substring(0, 16) : '');
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);
  const [securitySaved, setSecuritySaved] = useState(false);

  if (!item) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const publicPreviewUrl = `${origin}/?download=${encodeURIComponent(item.id)}`;
  const directStreamUrl = `${origin}/api/public/download/${encodeURIComponent(item.id)}`;
  const markdownSnippet = `[Download ${item.name}](${directStreamUrl})`;
  const htmlSnippet = `<a href="${directStreamUrl}" download="${item.name}">${item.name}</a>`;

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2200);
  };

  const handlePresetExpiry = (hours: number) => {
    const target = new Date(Date.now() + hours * 60 * 60 * 1000);
    // Format for datetime-local: YYYY-MM-DDTHH:mm
    const localIso = new Date(target.getTime() - target.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setExpiryValue(localIso);
    setExpiryEnabled(true);
  };

  const handleSaveSecurity = async () => {
    setIsSavingSecurity(true);
    try {
      const pinToSave = pinEnabled && pinValue.trim() ? pinValue.trim() : undefined;
      const expiryToSave = expiryEnabled && expiryValue ? new Date(expiryValue).toISOString() : undefined;

      await fetch(`/api/items/${encodeURIComponent(item.id)}/share-security`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sharePin: pinToSave, expiresAt: expiryToSave }),
      });

      if (onUpdateItemSecurity) {
        await onUpdateItemSecurity(item.id, pinToSave, expiryToSave);
      }
      setSecuritySaved(true);
      setTimeout(() => setSecuritySaved(false), 2500);
    } catch (err) {
      console.error('Failed to update share security:', err);
    } finally {
      setIsSavingSecurity(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                Lifetime Share Link
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                  Site-Routed • Never Expires
                </span>
                {item.sharePin && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
                    PIN Protected
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400 truncate max-w-xs">{item.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950/30 px-4 pt-2 gap-2 text-xs overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`pb-2 px-2.5 font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'preview'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Public Preview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('direct')}
            className={`pb-2 px-2.5 font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'direct'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Direct Stream</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`pb-2 px-2.5 font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'security'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>PIN &amp; Expiration</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('embed')}
            className={`pb-2 px-2.5 font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'embed'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Embed Snippets</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Lifetime Guarantee Banner */}
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-200 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-emerald-300 font-semibold">100% Lifetime Validity (Through Site):</strong>
              <p className="mt-0.5 text-[11px] text-emerald-200/90 leading-relaxed">
                This link streams files directly through this server. It never redirects to Microsoft SharePoint expiring URLs and remains active indefinitely until the file is deleted.
              </p>
            </div>
          </div>

          {activeTab === 'preview' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Public In-Browser Preview &amp; Download Link
              </label>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800">
                <input
                  type="text"
                  readOnly
                  value={publicPreviewUrl}
                  className="w-full bg-transparent text-xs text-sky-300 font-mono focus:outline-none select-all"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(publicPreviewUrl, 'preview')}
                  className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition-all"
                >
                  {copiedType === 'preview' ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedType === 'preview' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1">
                <Globe className="w-3 h-3 text-sky-400" />
                <span>Recipients can preview videos, audio, PDFs, text, and download directly without signing in.</span>
              </p>
            </div>
          )}

          {activeTab === 'direct' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Direct Raw File Download Stream (Direct Binary Attachment)
              </label>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800">
                <input
                  type="text"
                  readOnly
                  value={directStreamUrl}
                  className="w-full bg-transparent text-xs text-emerald-300 font-mono focus:outline-none select-all"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(directStreamUrl, 'direct')}
                  className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all"
                >
                  {copiedType === 'direct' ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedType === 'direct' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1">
                <Download className="w-3 h-3 text-emerald-400" />
                <span>Ideal for automated scripts, curl, wget, or direct one-click browser download prompts.</span>
              </p>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4">
              {/* PIN Password Protection Section */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-semibold text-slate-200">Password / PIN Protection</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pinEnabled}
                      onChange={(e) => setPinEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                  </label>
                </div>

                {pinEnabled && (
                  <div className="space-y-1.5 animate-fadeIn">
                    <label className="text-[11px] text-slate-400">Set Security PIN or Passphrase</label>
                    <input
                      type="text"
                      value={pinValue}
                      onChange={(e) => setPinValue(e.target.value)}
                      placeholder="e.g. 8492 or SecretDoc#1"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-amber-200 focus:outline-none focus:border-amber-500 font-mono"
                    />
                    <p className="text-[10px] text-slate-400">
                      Recipients must enter this PIN before the file can be viewed or downloaded.
                    </p>
                  </div>
                )}
              </div>

              {/* Link Expiration Section */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-semibold text-slate-200">Link Expiration (Auto-Revoke)</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={expiryEnabled}
                      onChange={(e) => setExpiryEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
                  </label>
                </div>

                {expiryEnabled && (
                  <div className="space-y-2 animate-fadeIn">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handlePresetExpiry(24)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 border border-slate-700"
                      >
                        24 Hours
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePresetExpiry(24 * 7)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 border border-slate-700"
                      >
                        7 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePresetExpiry(24 * 30)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 border border-slate-700"
                      >
                        30 Days
                      </button>
                    </div>

                    <input
                      type="datetime-local"
                      value={expiryValue}
                      onChange={(e) => setExpiryValue(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                    />
                    <p className="text-[10px] text-slate-400">
                      After this date and time, public downloads will be blocked with a 410 Expired status.
                    </p>
                  </div>
                )}
              </div>

              {/* Save Button */}
              <div className="flex items-center justify-between pt-1">
                {securitySaved ? (
                  <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                    <Check className="w-3.5 h-3.5" /> Security settings updated!
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">Updates link security instantly</span>
                )}

                <button
                  type="button"
                  onClick={handleSaveSecurity}
                  disabled={isSavingSecurity}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50"
                >
                  {isSavingSecurity ? 'Saving...' : 'Save Link Security'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'embed' && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-300">Markdown Format</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(markdownSnippet, 'md')}
                    className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1"
                  >
                    {copiedType === 'md' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedType === 'md' ? 'Copied' : 'Copy Markdown'}</span>
                  </button>
                </div>
                <pre className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                  {markdownSnippet}
                </pre>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-300">HTML Tag Format</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(htmlSnippet, 'html')}
                    className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1"
                  >
                    {copiedType === 'html' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedType === 'html' ? 'Copied' : 'Copy HTML'}</span>
                  </button>
                </div>
                <pre className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                  {htmlSnippet}
                </pre>
              </div>
            </div>
          )}

          {/* Item Metadata Pills */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.accountColor || '#0284c7' }} />
              <span className="text-slate-300 font-medium">{item.accountName}</span>
            </div>
            <span>Item ID: <code className="text-slate-400 font-mono text-[11px]">{item.id}</code></span>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-200 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
