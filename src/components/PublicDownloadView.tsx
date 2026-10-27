import React, { useState, useEffect } from 'react';
import {
  Download,
  ExternalLink,
  Cloud,
  Lock,
  ShieldCheck,
  FileText,
  Calendar,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  LogIn,
} from 'lucide-react';
import { DriveItem } from '../types/drive';
import { FileIcon } from './FileIcon';
import { FileViewer } from './FileViewer';
import { formatBytes, formatRelativeTime } from '../utils/driveLogic';

interface PublicDownloadViewProps {
  fileId: string;
  onNavigateToLogin: () => void;
  cachedItems?: DriveItem[];
}

export const PublicDownloadView: React.FC<PublicDownloadViewProps> = ({
  fileId,
  onNavigateToLogin,
  cachedItems = [],
}) => {
  const [item, setItem] = useState<DriveItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Security & PIN state
  const [requiresPin, setRequiresPin] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [unlockedPin, setUnlockedPin] = useState<string | null>(null);

  useEffect(() => {
    // Check cached items first
    const localMatch = cachedItems.find((i) => i.id === fileId);
    if (localMatch && !localMatch.sharePin && !localMatch.expiresAt) {
      setItem(localMatch);
      setLoading(false);
      return;
    }

    // Otherwise fetch public metadata from server endpoint
    fetch(`/api/public/file/${encodeURIComponent(fileId)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.status === 410 || data.isExpired) {
          throw new Error('This shared link has expired and is no longer available.');
        }
        if (!res.ok && res.status !== 401) {
          throw new Error(data.error || 'Shared file not found or has been removed');
        }
        return data;
      })
      .then((data) => {
        if (data.requiresPin) {
          setRequiresPin(true);
          setItem(data);
          setLoading(false);
          return;
        }
        setItem(data);
        setLoading(false);
      })
      .catch((err) => {
        // Fallback: check localStorage directly
        try {
          const stored = localStorage.getItem('onedrive_multidrive_items');
          if (stored) {
            const parsed = JSON.parse(stored);
            const found = parsed.find((i: any) => i.id === fileId);
            if (found && !found.sharePin) {
              setItem(found);
              setLoading(false);
              return;
            }
          }
        } catch {}
        setError(err.message || 'File not found');
        setLoading(false);
      });
  }, [fileId, cachedItems]);

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enteredPin.trim()) {
      setPinError('Please enter the security PIN');
      return;
    }
    setVerifyingPin(true);
    setPinError(null);

    try {
      const res = await fetch(`/api/public/verify-pin/${encodeURIComponent(fileId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: enteredPin.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.verified) {
        setPinError(data.error || 'Incorrect security PIN. Please try again.');
        return;
      }

      // Fetch full file metadata with PIN header
      const metaRes = await fetch(`/api/public/file/${encodeURIComponent(fileId)}?pin=${encodeURIComponent(enteredPin.trim())}`);
      const meta = await metaRes.json();
      setItem(meta);
      setUnlockedPin(enteredPin.trim());
      setRequiresPin(false);
    } catch {
      setPinError('Connection error while validating security PIN');
    } finally {
      setVerifyingPin(false);
    }
  };

  const handleDownload = () => {
    if (!item) return;
    setDownloading(true);

    try {
      if (item.downloadUrl && item.downloadUrl.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = item.downloadUrl;
        link.download = item.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Route strictly through site permanent streaming proxy (with PIN if protected)
        const pinParam = unlockedPin ? `?pin=${encodeURIComponent(unlockedPin)}` : '';
        window.location.href = `/api/public/download/${encodeURIComponent(item.id)}${pinParam}`;
      }
    } finally {
      setTimeout(() => setDownloading(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-100">MultiDrive Public File Access</h1>
            <p className="text-[11px] text-slate-400">Direct Download • Lifetime Site Streaming</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onNavigateToLogin}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
        >
          <LogIn className="w-3.5 h-3.5 text-sky-400" />
          <span>Admin Sign In</span>
        </button>
      </header>

      {/* Main Download Container */}
      <main className="flex-1 flex items-center justify-center p-4">
        {loading ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Locating shared file on OneDrive...</p>
          </div>
        ) : error ? (
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-950/60 border border-rose-800/80 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">File Not Available</h2>
              <p className="text-xs text-slate-400 mt-1">{error}</p>
            </div>
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
            >
              Go to Home / Admin Login
            </button>
          </div>
        ) : requiresPin && item ? (
          /* Password / PIN Prompt Screen */
          <div className="max-w-md w-full bg-slate-900 border border-amber-800/60 rounded-3xl p-7 shadow-2xl space-y-5 text-center animate-fadeIn">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
              <Lock className="w-7 h-7" />
            </div>

            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Password Protected File
              </span>
              <h2 className="text-base font-bold text-slate-100 mt-2 truncate" title={item.name}>
                {item.name}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                The owner has secured this file. Enter the PIN or passphrase to preview and download.
              </p>
            </div>

            <form onSubmit={handleVerifyPin} className="space-y-4 text-left">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Security PIN / Passphrase</label>
                <div className="relative">
                  <input
                    type="password"
                    value={enteredPin}
                    onChange={(e) => {
                      setEnteredPin(e.target.value);
                      setPinError(null);
                    }}
                    placeholder="Enter PIN..."
                    autoFocus
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-amber-500 tracking-wider font-mono placeholder:tracking-normal placeholder:font-sans"
                  />
                </div>
                {pinError && (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{pinError}</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={verifyingPin}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-semibold text-xs shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {verifyingPin ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying PIN...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Unlock &amp; Access File</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : item ? (
          <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            {/* File Header */}
            <div className="flex items-start gap-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner shrink-0">
                <FileIcon type={item.fileType} size={36} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{
                      backgroundColor: `${item.accountColor || '#0284c7'}20`,
                      color: item.accountColor || '#0284c7',
                      border: `1px solid ${item.accountColor || '#0284c7'}40`,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: item.accountColor || '#0284c7' }}
                    />
                    <span>{item.accountName || 'OneDrive for Business'}</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Public Link Verified
                  </span>
                </div>

                <h2 className="text-base font-bold text-slate-100 break-words" title={item.name}>
                  {item.name}
                </h2>

                <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                  <span className="font-semibold text-slate-300 font-mono">{formatBytes(item.size)}</span>
                  <span>•</span>
                  <span>Modified {formatRelativeTime(item.lastModifiedDateTime)}</span>
                </div>
              </div>
            </div>

            {/* Interactive File Previewer */}
            <div className="pt-2">
              <FileViewer item={item} onDownload={handleDownload} />
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs shadow-xl shadow-sky-600/25 flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <Download className="w-4 h-4" />
                <span>{downloading ? 'Starting download...' : `Download File (${formatBytes(item.size)})`}</span>
              </button>

              {item.webUrl && (
                <a
                  href={item.webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-2xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                  <span>Open in Microsoft 365 Online</span>
                </a>
              )}
            </div>

            {/* Security Notice */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Encrypted Microsoft Graph Transfer</span>
              </span>
              <span>MultiDrive Cloud</span>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
};
