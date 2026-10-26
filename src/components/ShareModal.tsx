import React, { useState } from 'react';
import { X, Share2, Copy, Check, Globe, Lock, Shield } from 'lucide-react';
import { DriveItem } from '../types/drive';

interface ShareModalProps {
  item: DriveItem | null;
  onClose: () => void;
  onGenerateLink?: (item: DriveItem, type: 'view' | 'edit') => Promise<string>;
}

export const ShareModal: React.FC<ShareModalProps> = ({ item, onClose, onGenerateLink }) => {
  const [permissionType, setPermissionType] = useState<'view' | 'edit'>('view');
  const [copied, setCopied] = useState(false);

  if (!item) return null;

  const publicDownloadUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?download=${encodeURIComponent(item.id)}`
    : `/?download=${encodeURIComponent(item.id)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(publicDownloadUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Share Link</h3>
              <p className="text-[11px] text-slate-400">Microsoft Graph Sharing Link</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              File to Share
            </label>
            <p className="text-xs text-slate-200 font-medium truncate bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              {item.name}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Access Permission
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPermissionType('view')}
                className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                  permissionType === 'view'
                    ? 'bg-sky-600/15 border-sky-500 text-sky-400 font-semibold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>View only</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-normal">Can view and download</p>
              </button>

              <button
                type="button"
                onClick={() => setPermissionType('edit')}
                className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                  permissionType === 'edit'
                    ? 'bg-sky-600/15 border-sky-500 text-sky-400 font-semibold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Can edit</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-normal">Can edit in Office Online</p>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Generated Shareable Link
            </label>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800">
              <input
                type="text"
                readOnly
                value={publicDownloadUrl}
                className="w-full bg-transparent text-xs text-sky-300 font-mono focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-[11px] text-emerald-400 mt-1.5 flex items-center gap-1">
              <Globe className="w-3 h-3" />
              <span>Public Link: Anyone with this link can view and download without login.</span>
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-750 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
