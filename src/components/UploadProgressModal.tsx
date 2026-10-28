import React, { useState } from 'react';
import {
  X,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Minimize2,
  Maximize2,
  Trash2,
  Globe,
  Plus,
  Gauge,
  Clock,
  HardDrive,
  ArrowUpRight,
} from 'lucide-react';
import { UploadTransferItem, DriveAccount } from '../types/drive';
import { formatBytes } from '../utils/driveLogic';
import { FileIcon } from './FileIcon';

interface UploadProgressModalProps {
  isOpen: boolean;
  isMinimized: boolean;
  onClose: () => void;
  onToggleMinimize: () => void;
  transfers: UploadTransferItem[];
  onClearCompleted: () => void;
  onRemoveTransfer: (id: string) => void;
  onTriggerFileSelect: () => void;
  onRemoteUrlUpload?: (url: string, customName?: string) => Promise<void>;
  accounts: DriveAccount[];
}

export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  if (seconds < 1) return '< 1s';
  const rounded = Math.ceil(seconds);
  if (rounded < 60) return `${rounded}s`;
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  if (mins < 60) {
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

export const UploadProgressModal: React.FC<UploadProgressModalProps> = ({
  isOpen,
  isMinimized,
  onClose,
  onToggleMinimize,
  transfers,
  onClearCompleted,
  onRemoveTransfer,
  onTriggerFileSelect,
  onRemoteUrlUpload,
}) => {
  const [showUrlPull, setShowUrlPull] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [customFileName, setCustomFileName] = useState('');
  const [isPullingUrl, setIsPullingUrl] = useState(false);

  if (!isOpen && transfers.length === 0) return null;
  if (!isOpen) return null;

  const activeTransfers = transfers.filter(
    (t) => t.status === 'uploading' || t.status === 'queued'
  );
  const completedTransfers = transfers.filter((t) => t.status === 'completed');
  const errorTransfers = transfers.filter((t) => t.status === 'error');

  const totalBytes = transfers.reduce((sum, t) => sum + (t.fileSize || 0), 0);
  const totalUploadedBytes = transfers.reduce(
    (sum, t) => sum + (t.status === 'completed' ? t.fileSize : t.uploadedBytes || 0),
    0
  );
  const remainingBytes = Math.max(0, totalBytes - totalUploadedBytes);
  const overallProgress =
    totalBytes > 0 ? Math.min(100, Math.round((totalUploadedBytes / totalBytes) * 100)) : 0;

  // Aggregate live upload speed across currently uploading items
  const totalSpeedBps = activeTransfers.reduce((sum, t) => sum + (t.speedBps || 0), 0);

  // Aggregate remaining ETA in seconds
  const overallEtaSeconds =
    activeTransfers.length > 0
      ? totalSpeedBps > 0
        ? remainingBytes / totalSpeedBps
        : Math.max(...activeTransfers.map((t) => t.etaSeconds || 1))
      : 0;

  const isAllDone = activeTransfers.length === 0 && transfers.length > 0;

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remoteUrl.trim() || !onRemoteUrlUpload) return;
    setIsPullingUrl(true);
    try {
      await onRemoteUrlUpload(remoteUrl.trim(), customFileName.trim() || undefined);
      setRemoteUrl('');
      setCustomFileName('');
      setShowUrlPull(false);
    } finally {
      setIsPullingUrl(false);
    }
  };

  // Minimized Floating Dock View (bottom-left)
  if (isMinimized) {
    return (
      <div className="fixed bottom-5 left-5 z-50 w-88 max-w-[calc(100vw-2.5rem)] bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
        <div className="p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                isAllDone
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
              }`}
            >
              {isAllDone ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-100 truncate">
                {isAllDone
                  ? `${completedTransfers.length} Upload${completedTransfers.length === 1 ? '' : 's'} Complete`
                  : `Uploading ${activeTransfers.length} item${activeTransfers.length === 1 ? '' : 's'} (${overallProgress}%)`}
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono tabular-nums truncate">
                {!isAllDone ? (
                  <>
                    <span className="text-sky-400 font-semibold">
                      {formatBytes(totalSpeedBps)}/s
                    </span>
                    <span>·</span>
                    <span>{formatBytes(remainingBytes)} left</span>
                    <span>·</span>
                    <span>{formatEta(overallEtaSeconds)}</span>
                  </>
                ) : (
                  <span>{formatBytes(totalBytes)} transferred to OneDrive</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onToggleMinimize}
              title="Expand transfer manager"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close transfer dock"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bottom Progress Strip */}
        <div className="w-full h-1.5 bg-slate-950 overflow-hidden">
          <div
            className={`h-full transition-all duration-200 ${
              isAllDone
                ? 'bg-emerald-500'
                : 'bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-400'
            }`}
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>
    );
  }

  // Full Centered Upload Transfer Dialog
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
      onClick={onToggleMinimize}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dialog Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                isAllDone
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-sky-500/15 border-sky-500/30 text-sky-400'
              }`}
            >
              {isAllDone ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                OneDrive Cloud Upload Manager
              </h2>
              <p className="text-xs text-slate-400">
                {activeTransfers.length > 0
                  ? `Streaming ${activeTransfers.length} active file${activeTransfers.length === 1 ? '' : 's'} directly to Microsoft OneDrive`
                  : transfers.length > 0
                  ? `Completed ${completedTransfers.length} of ${transfers.length} file transfers`
                  : 'Upload local files or pull remote URLs directly to your connected drives'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {transfers.length > 0 && (
              <button
                type="button"
                onClick={onToggleMinimize}
                title="Minimize to floating bar"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 transition-colors"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Minimize</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close upload dialog"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Telemetry Overview Banner */}
        <div className="p-5 border-b border-slate-800/80 bg-slate-950/30 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Metric 1: Upload Speed */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/90 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium text-slate-400 block">
                  Transfer Speed
                </span>
                <span className="text-base font-bold text-sky-400 font-mono tabular-nums mt-0.5 block">
                  {activeTransfers.length > 0
                    ? `${formatBytes(totalSpeedBps)}/s`
                    : isAllDone
                    ? 'Completed'
                    : '0 B/s'}
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
                <Gauge className="w-4 h-4" />
              </div>
            </div>

            {/* Metric 2: Remaining Size */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/90 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium text-slate-400 block">
                  Remaining Size
                </span>
                <span className="text-base font-bold text-slate-100 font-mono tabular-nums mt-0.5 block">
                  {formatBytes(remainingBytes)}
                </span>
                <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                  {formatBytes(totalUploadedBytes)} of {formatBytes(totalBytes)}
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <HardDrive className="w-4 h-4" />
              </div>
            </div>

            {/* Metric 3: Estimated Time Remaining */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/90 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium text-slate-400 block">
                  Estimated Time Left
                </span>
                <span className="text-base font-bold text-emerald-400 font-mono tabular-nums mt-0.5 block">
                  {activeTransfers.length > 0
                    ? formatEta(overallEtaSeconds)
                    : isAllDone
                    ? '0s (Done)'
                    : '—'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                  {completedTransfers.length}/{transfers.length} files finished
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Overall Progress Bar */}
          {transfers.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">
                  Overall Transfer Progress
                </span>
                <span className="font-mono tabular-nums font-semibold text-sky-400">
                  {overallProgress}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${
                    isAllDone
                      ? 'bg-emerald-500'
                      : 'bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-400'
                  }`}
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Optional Remote URL Cloud Pull Drawer */}
        {showUrlPull && onRemoteUrlUpload && (
          <form
            onSubmit={handleUrlSubmit}
            className="px-5 py-3.5 bg-slate-950/90 border-b border-slate-800 space-y-2.5 animate-fadeIn"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                Remote URL Cloud Pull (Server-to-OneDrive Direct Fetch)
              </span>
              <button
                type="button"
                onClick={() => setShowUrlPull(false)}
                className="text-[11px] text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="url"
                required
                placeholder="https://example.com/file.zip"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                className="sm:col-span-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
              />
              <input
                type="text"
                placeholder="Custom filename (optional)"
                value={customFileName}
                onChange={(e) => setCustomFileName(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isPullingUrl || !remoteUrl.trim()}
                className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                {isPullingUrl ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Pulling to OneDrive...</span>
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Start Cloud Pull</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Uploading Items List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2.5 max-h-80">
          {transfers.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 mx-auto">
                <Upload className="w-6 h-6 text-sky-400" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-200">
                  No active uploads in queue
                </p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Select files from your device, drag and drop files anywhere onto the workspace, or pull a file directly from a remote URL.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={onTriggerFileSelect}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Select Files to Upload</span>
                </button>
                {onRemoteUrlUpload && (
                  <button
                    type="button"
                    onClick={() => setShowUrlPull(true)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5 text-sky-400" />
                    <span>Upload from URL</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            transfers.map((item) => {
              const itemRemainingBytes = Math.max(0, item.fileSize - item.uploadedBytes);
              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/90 space-y-2.5 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileIcon type={item.fileType} className="w-8 h-8 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-100 truncate">
                          {item.fileName}
                        </p>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: item.accountColor }}
                          />
                          <span className="truncate max-w-[160px] text-slate-300">
                            {item.accountName}
                          </span>
                          <span>·</span>
                          <span className="font-mono tabular-nums">
                            {formatBytes(item.uploadedBytes)} / {formatBytes(item.fileSize)}
                          </span>
                          {item.status === 'uploading' && (
                            <>
                              <span>·</span>
                              <span className="font-mono tabular-nums text-sky-400 font-medium">
                                {formatBytes(item.speedBps)}/s
                              </span>
                              <span>·</span>
                              <span className="font-mono tabular-nums text-slate-300">
                                {formatBytes(itemRemainingBytes)} left ({formatEta(item.etaSeconds)})
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.status === 'uploading' && (
                        <span className="text-xs font-mono tabular-nums font-semibold text-sky-400 flex items-center gap-1">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          {item.progress}%
                        </span>
                      )}
                      {item.status === 'queued' && (
                        <span className="text-[11px] font-mono text-slate-400">
                          Queued
                        </span>
                      )}
                      {item.status === 'completed' && (
                        <span className="text-xs font-mono tabular-nums font-medium text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          100%
                        </span>
                      )}
                      {item.status === 'error' && (
                        <span
                          title={item.errorMessage}
                          className="text-xs font-medium text-rose-400 flex items-center gap-1"
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          Error
                        </span>
                      )}

                      {(item.status === 'completed' || item.status === 'error') && (
                        <button
                          type="button"
                          onClick={() => onRemoveTransfer(item.id)}
                          aria-label="Remove from transfer list"
                          className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-900 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Individual Item Progress Bar */}
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-150 ${
                        item.status === 'completed'
                          ? 'bg-emerald-500'
                          : item.status === 'error'
                          ? 'bg-rose-500'
                          : 'bg-sky-500'
                      }`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>

                  {item.errorMessage && (
                    <p className="text-[11px] text-rose-400 font-mono">
                      {item.errorMessage}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Dialog Footer */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTriggerFileSelect}
              className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Files</span>
            </button>

            {onRemoteUrlUpload && !showUrlPull && (
              <button
                type="button"
                onClick={() => setShowUrlPull(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                <span>Pull from URL</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(completedTransfers.length > 0 || errorTransfers.length > 0) && (
              <button
                type="button"
                onClick={onClearCompleted}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Finished</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
