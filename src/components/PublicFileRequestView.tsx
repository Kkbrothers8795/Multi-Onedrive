import React, { useState, useEffect, useRef } from 'react';
import {
  FolderUp,
  Upload,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HardDrive,
  Gauge,
  Clock,
  ArrowLeft,
  User,
} from 'lucide-react';
import { formatBytes } from '../utils/driveLogic';
import { formatEta } from './UploadProgressModal';

interface PublicFileRequestViewProps {
  requestId: string;
  onNavigateHome: () => void;
}

interface DropzoneTransfer {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedBytes: number;
  speedBps: number;
  etaSeconds: number;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  errorMessage?: string;
}

export const PublicFileRequestView: React.FC<PublicFileRequestViewProps> = ({
  requestId,
  onNavigateHome,
}) => {
  const [meta, setMeta] = useState<{
    id: string;
    title: string;
    description?: string;
    accountName: string;
    folderName: string;
    requiresPin: boolean;
    expiresAt?: string;
    isExpired: boolean;
    maxFileSizeMB: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pin, setPin] = useState('');
  const [uploaderName, setUploaderName] = useState('');
  const [transfers, setTransfers] = useState<DropzoneTransfer[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch(`/api/public/file-request/${encodeURIComponent(requestId)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'File Request Dropzone not found');
        }
        setMeta(data);
      })
      .catch((err) => {
        setError(err.message || 'Could not load File Request Dropzone');
      })
      .finally(() => setLoading(false));
  }, [requestId]);

  const handleFilesSelected = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0 || !meta) return;

    if (meta.requiresPin && !pin.trim()) {
      setError('Please enter the required security PIN before uploading files.');
      return;
    }
    setError(null);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const txId = `dz-${Date.now()}-${i}`;
      const startTime = Date.now();

      setTransfers((prev) => [
        {
          id: txId,
          fileName: file.name,
          fileSize: file.size,
          uploadedBytes: 0,
          speedBps: 0,
          etaSeconds: 0,
          progress: 0,
          status: 'uploading',
        },
        ...prev,
      ]);

      try {
        const base64Content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open(
            'POST',
            `/api/public/file-request/${encodeURIComponent(requestId)}/upload`,
            true
          );
          xhr.setRequestHeader('Content-Type', 'application/json');

          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) {
              const ratio = ev.total > 0 ? ev.loaded / ev.total : 0;
              const uploadedBytes = Math.round(ratio * file.size);
              const elapsedSec = Math.max(0.15, (Date.now() - startTime) / 1000);
              const speedBps = Math.round(uploadedBytes / elapsedSec);
              const remainingBytes = Math.max(0, file.size - uploadedBytes);
              const etaSeconds = speedBps > 0 ? remainingBytes / speedBps : 0;

              setTransfers((prev) =>
                prev.map((t) =>
                  t.id === txId
                    ? {
                        ...t,
                        uploadedBytes,
                        speedBps,
                        etaSeconds,
                        progress: Math.min(99, Math.round(ratio * 100)),
                      }
                    : t
                )
              );
            }
          };

          xhr.onload = () => {
            let parsed: any = null;
            try {
              parsed = JSON.parse(xhr.responseText);
            } catch {}

            if (xhr.status >= 200 && xhr.status < 300 && parsed?.success) {
              const elapsedSec = Math.max(0.2, (Date.now() - startTime) / 1000);
              setTransfers((prev) =>
                prev.map((t) =>
                  t.id === txId
                    ? {
                        ...t,
                        uploadedBytes: file.size,
                        speedBps: Math.round(file.size / elapsedSec),
                        etaSeconds: 0,
                        progress: 100,
                        status: 'completed',
                      }
                    : t
                )
              );
              resolve();
            } else {
              reject(new Error(parsed?.error || `Upload failed (${xhr.status})`));
            }
          };

          xhr.onerror = () => reject(new Error('Network error during upload'));
          xhr.send(
            JSON.stringify({
              fileName: file.name,
              mimeType: file.type || 'application/octet-stream',
              base64Content,
              pin: pin.trim(),
              uploaderName: uploaderName.trim(),
            })
          );
        });
      } catch (err: any) {
        setTransfers((prev) =>
          prev.map((t) =>
            t.id === txId
              ? {
                  ...t,
                  status: 'error',
                  errorMessage: err.message || 'Upload failed',
                }
              : t
          )
        );
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200 p-4">
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin mb-3" />
        <p className="text-xs text-slate-400">Loading Secure OneDrive File Request Dropzone...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans">
      <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-slate-950/70 border-b border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-600/20">
              <FolderUp className="w-6 h-6" />
            </div>
            <div>
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/30">
                MultiDrive OneDrive Dropzone
              </span>
              <h1 className="text-lg font-bold text-white mt-1">
                {meta?.title || 'File Request Dropzone'}
              </h1>
              {meta?.description && (
                <p className="text-xs text-slate-400 mt-0.5">{meta.description}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onNavigateHome}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Admin Portal</span>
          </button>
        </div>

        {error && !meta ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
            <p className="text-sm font-semibold text-rose-200">{error}</p>
          </div>
        ) : meta?.isExpired ? (
          <div className="p-8 text-center space-y-3">
            <Clock className="w-10 h-10 text-amber-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-200">
              This File Request Link Has Expired
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Destination info */}
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
              <span className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-sky-400" />
                <span>Destination: <strong>{meta?.accountName}</strong> ({meta?.folderName})</span>
              </span>
              <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                Max {meta?.maxFileSizeMB || 500} MB / file
              </span>
            </div>

            {/* Uploader Name & Optional PIN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Your Name / Organization (Optional)
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={uploaderName}
                    onChange={(e) => setUploaderName(e.target.value)}
                    placeholder="e.g., Alex Rivera"
                    className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {meta?.requiresPin && (
                <div>
                  <label className="block text-[11px] font-medium text-amber-300 mb-1">
                    Security PIN Required *
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="Enter Dropzone PIN"
                      className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-amber-500/40 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Drag and Drop Area */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
              className="hidden"
            />
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files) handleFilesSelected(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`p-8 rounded-2xl border-2 border-dashed cursor-pointer text-center transition-all ${
                isDragging
                  ? 'border-sky-400 bg-sky-500/10'
                  : 'border-slate-700 hover:border-sky-500/60 bg-slate-950/50'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 mx-auto mb-3">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-200">
                Click or Drag & Drop Files Here to Upload to OneDrive
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Direct encrypted stream with live speed, remaining size & ETA telemetry
              </p>
            </div>

            {/* Live Transfer Queue */}
            {transfers.length > 0 && (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pt-2">
                {transfers.map((tx) => {
                  const remBytes = Math.max(0, tx.fileSize - tx.uploadedBytes);
                  return (
                    <div
                      key={tx.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-200 truncate">
                          {tx.fileName}
                        </span>
                        <span className="text-xs font-mono font-bold tabular-nums text-sky-400">
                          {tx.status === 'completed' ? '100% · Uploaded' : `${tx.progress}%`}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono tabular-nums flex-wrap">
                        <span>
                          {formatBytes(tx.uploadedBytes)} / {formatBytes(tx.fileSize)}
                        </span>
                        {tx.status === 'uploading' && (
                          <>
                            <span>·</span>
                            <span className="text-sky-400 flex items-center gap-1">
                              <Gauge className="w-3 h-3" />
                              {formatBytes(tx.speedBps)}/s
                            </span>
                            <span>·</span>
                            <span>{formatBytes(remBytes)} left ({formatEta(tx.etaSeconds)})</span>
                          </>
                        )}
                      </div>

                      <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-200 ${
                            tx.status === 'completed'
                              ? 'bg-emerald-500'
                              : tx.status === 'error'
                              ? 'bg-rose-500'
                              : 'bg-sky-500'
                          }`}
                          style={{ width: `${tx.progress}%` }}
                        />
                      </div>

                      {tx.errorMessage && (
                        <p className="text-[11px] text-rose-400">{tx.errorMessage}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
