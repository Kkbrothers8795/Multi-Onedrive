import React, { useState, useEffect } from 'react';
import {
  X,
  FolderUp,
  Plus,
  Copy,
  Check,
  Trash2,
  Lock,
  Calendar,
  HardDrive,
  ExternalLink,
  Sparkles,
  Loader2,
  Link2,
} from 'lucide-react';
import { DriveAccount, DriveItem, FileRequestLink } from '../types/drive';
import { formatBytes } from '../utils/driveLogic';

interface FileRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: DriveAccount[];
  folders: DriveItem[];
  showToast: (msg: any, type?: 'success' | 'error' | 'info') => void;
}

export const FileRequestModal: React.FC<FileRequestModalProps> = ({
  isOpen,
  onClose,
  accounts,
  folders,
  showToast,
}) => {
  const [requests, setRequests] = useState<FileRequestLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New File Request Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState<string>('auto');
  const [folderId, setFolderId] = useState<string>('');
  const [pin, setPin] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [maxFileSizeMB, setMaxFileSizeMB] = useState<number>(500);

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/file-requests');
      if (res.ok) {
        const data = await res.json();
        setRequests(Array.isArray(data.requests) ? data.requests : []);
      }
    } catch {
      // Ignore network error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRequests();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getPublicRequestUrl = (reqId: string) => {
    if (typeof window === 'undefined') return `?request=${reqId}`;
    return `${window.location.origin}${window.location.pathname}?request=${encodeURIComponent(reqId)}`;
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Please enter a title for the File Request Dropzone', 'error');
      return;
    }

    setIsCreating(true);
    try {
      const selectedAcc = accounts.find((a) => a.id === accountId);
      const selectedFold = folders.find((f) => f.id === folderId);

      const res = await fetch('/api/file-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          accountId,
          accountName:
            accountId === 'auto'
              ? 'Auto Load-Balanced (Highest Free Quota)'
              : selectedAcc?.name || 'OneDrive Account',
          folderId: folderId || null,
          folderName: selectedFold ? selectedFold.name : 'Root (/onedrive)',
          pin: pin.trim() || undefined,
          expiresAt: expiresAt || undefined,
          maxFileSizeMB,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.request) {
        throw new Error(data.error || 'Could not create File Request link');
      }

      setRequests((prev) => [data.request, ...prev]);
      setTitle('');
      setDescription('');
      setPin('');
      setExpiresAt('');
      showToast(`Created Public File Request Dropzone "${data.request.title}"`, 'success');
    } catch (err) {
      showToast(err, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    try {
      await fetch(`/api/file-requests/${id}`, { method: 'DELETE' });
      setRequests((prev) => prev.filter((r) => r.id !== id));
      showToast('Removed File Request Dropzone link', 'info');
    } catch (err) {
      showToast(err, 'error');
    }
  };

  const handleCopyLink = (id: string) => {
    const url = getPublicRequestUrl(id);
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    showToast('Public Upload Dropzone link copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[88vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-600/20">
              <FolderUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-100">
                  Public File Request & Dropzone Links
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/30">
                  Upload-Only Share Links
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Allow clients or external users to upload files directly into your OneDrive folders without needing your admin password.
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

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Create New Dropzone Form */}
          <form onSubmit={handleCreateRequest} className="lg:col-span-5 space-y-3.5 bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Create Upload Dropzone
              </h3>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Dropzone Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Client 4K Video Assets Submission"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Instructions for Uploader (Optional)
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please drop your project ZIP or raw media files here..."
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-sky-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Target OneDrive Account
                </label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                >
                  <option value="auto">⚡ Auto Load-Balanced</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Destination Folder
                </label>
                <select
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                >
                  <option value="">Root (/onedrive)</option>
                  {folders
                    .filter((f) => accountId === 'auto' || f.accountId === accountId)
                    .map((fold) => (
                      <option key={fold.id} value={fold.id}>
                        📁 {fold.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Optional Access PIN
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="No PIN"
                    className="w-full pl-8 pr-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Max File Size (MB)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10240}
                  value={maxFileSizeMB}
                  onChange={(e) => setMaxFileSizeMB(Number(e.target.value) || 500)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono tabular-nums focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Optional Expiration Date
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isCreating}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-sky-600/20 transition-all"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating Dropzone Link...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Generate Public Dropzone Link</span>
                </>
              )}
            </button>
          </form>

          {/* Right: Active Dropzone Links */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Active Dropzone Links ({requests.length})
              </h3>
            </div>

            {isLoading ? (
              <div className="py-12 flex items-center justify-center text-slate-400 text-xs gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                <span>Loading file request links...</span>
              </div>
            ) : requests.length === 0 ? (
              <div className="flex-1 rounded-2xl bg-slate-950/60 border border-slate-800/80 p-8 flex flex-col items-center justify-center text-center">
                <Link2 className="w-8 h-8 text-slate-600 mb-2" />
                <p className="text-xs font-semibold text-slate-300">
                  No Public File Request Links Yet
                </p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                  Create a link on the left to let anyone upload files directly to your OneDrive without logging in.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 overflow-y-auto pr-1">
                {requests.map((req) => {
                  const isCopied = copiedId === req.id;
                  const publicUrl = getPublicRequestUrl(req.id);
                  return (
                    <div
                      key={req.id}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/90 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs font-bold text-slate-100">{req.title}</h4>
                            {req.pin && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-mono">
                                PIN: {req.pin}
                              </span>
                            )}
                            {req.expiresAt && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">
                                Exp: {new Date(req.expiresAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {req.description && (
                            <p className="text-[11px] text-slate-400 mt-0.5">{req.description}</p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteRequest(req.id)}
                          title="Delete Dropzone Link"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1 text-slate-300">
                          <HardDrive className="w-3 h-3 text-sky-400" />
                          {req.accountName}
                        </span>
                        <span>·</span>
                        <span>📁 {req.folderName}</span>
                        <span>·</span>
                        <span className="font-mono tabular-nums text-emerald-400">
                          {req.uploadCount || 0} uploads ({formatBytes(req.totalBytesUploaded || 0)})
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          readOnly
                          value={publicUrl}
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 select-all focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleCopyLink(req.id)}
                          className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{isCopied ? 'Copied' : 'Copy Link'}</span>
                        </button>
                        <a
                          href={publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          title="Preview Public Dropzone Page"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
