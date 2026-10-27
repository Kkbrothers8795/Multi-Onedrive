import React, { useState, useRef } from 'react';
import {
  X,
  Download,
  Upload,
  Database,
  CheckCircle2,
  AlertCircle,
  FileJson,
  RefreshCw,
  HardDrive,
  Shield,
  Layers,
  ArrowRight,
  Check,
} from 'lucide-react';
import { DriveAccount, DriveItem } from '../types/drive';
import { formatBytes } from '../utils/driveLogic';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: DriveAccount[];
  items: DriveItem[];
  onRestoreComplete: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  accounts,
  items,
  onRestoreComplete,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [restorePassword, setRestorePassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const totalBytes = accounts.reduce((sum, a) => sum + (a.quota?.used || 0), 0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccessMessage(null);
    setImportFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = event.target?.result as string;
        const parsed = JSON.parse(raw);

        // Validate basic structure
        const accs = Array.isArray(parsed.accounts) ? parsed.accounts : [];
        const its = Array.isArray(parsed.items) ? parsed.items : [];

        if (accs.length === 0 && its.length === 0) {
          setError('The selected file does not contain valid accounts or items. Please upload a server-store.json backup.');
          setParsedData(null);
          return;
        }

        setParsedData(parsed);
      } catch (err: any) {
        setError(`Failed to parse JSON file: ${err.message}`);
        setParsedData(null);
      }
    };
    reader.readAsText(file);
  };

  const handleExportDownload = () => {
    window.location.href = '/api/backup/export';
  };

  const handleImportSubmit = async () => {
    if (!parsedData) {
      setError('Please select a valid backup JSON file first.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch('/api/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: parsedData,
          mode: importMode,
          restorePassword,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to restore backup');
      }

      setSuccessMessage(resData.message || 'Backup restored successfully!');
      setTimeout(() => {
        onRestoreComplete();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Error occurred during backup restoration');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                Backup &amp; Migration Tool
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  server-store.json
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Export current installation state or restore from an existing setup
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950/30 px-5 pt-2 gap-3 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'export'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Backup</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'import'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import / Restore</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {activeTab === 'export' ? (
            /* Export Screen */
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-xs font-semibold text-slate-300 block">Current Installation Snapshot</span>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Connected Tenants</span>
                    <span className="text-lg font-black text-slate-100 font-mono">{accounts.length}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Indexed Items</span>
                    <span className="text-lg font-black text-slate-100 font-mono">{items.length}</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                  <span>Storage Footprint:</span>
                  <span className="font-mono text-slate-300 font-semibold">{formatBytes(totalBytes)}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-sky-950/30 border border-sky-800/40 text-xs text-sky-200 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Exporting creates a complete JSON replica of your <code className="font-mono text-sky-300">server-store.json</code>. You can import this into any new deployment (Vercel, Docker, Serv00, or local machine) to restore all accounts and files instantly.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportDownload}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-sky-600/25 flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <Download className="w-4 h-4" />
                <span>Download Backup Snapshot (JSON)</span>
              </button>
            </div>
          ) : (
            /* Import Screen */
            <div className="space-y-4 animate-fadeIn">
              {/* File Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-6 rounded-2xl border-2 border-dashed border-slate-700 hover:border-cyan-500/60 bg-slate-950/60 hover:bg-slate-950 transition-all cursor-pointer text-center space-y-2 group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".json,application/json"
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  <FileJson className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">
                    {importFile ? importFile.name : 'Click or Drag & Drop server-store.json'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Accepts raw <code className="text-cyan-300 font-mono">server-store.json</code> or MultiDrive backup exports
                  </p>
                </div>
              </div>

              {/* Parsed Summary Preview */}
              {parsedData && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-cyan-800/50 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Backup Validated
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {parsedData.exportedAt ? new Date(parsedData.exportedAt).toLocaleDateString() : 'Raw store'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Accounts in Backup</span>
                      <span className="text-base font-bold text-slate-100 font-mono">
                        {Array.isArray(parsedData.accounts) ? parsedData.accounts.length : 0}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Files & Folders</span>
                      <span className="text-base font-bold text-slate-100 font-mono">
                        {Array.isArray(parsedData.items) ? parsedData.items.length : 0}
                      </span>
                    </div>
                  </div>

                  {/* Mode Selector */}
                  <div className="space-y-2 pt-1">
                    <label className="text-[11px] font-semibold text-slate-300 block">Restore Strategy</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setImportMode('replace')}
                        className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                          importMode === 'replace'
                            ? 'bg-rose-500/10 border-rose-500/40 text-slate-200'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        <span className="font-semibold block text-rose-400">Clean Replace</span>
                        <span className="text-[10px] text-slate-400">Replaces current data with backup state</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setImportMode('merge')}
                        className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                          importMode === 'merge'
                            ? 'bg-cyan-500/10 border-cyan-500/40 text-slate-200'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        <span className="font-semibold block text-cyan-400">Merge &amp; Append</span>
                        <span className="text-[10px] text-slate-400">Combines backup with existing drives</span>
                      </button>
                    </div>
                  </div>

                  {/* Password Option */}
                  {parsedData.adminPassword && (
                    <label className="flex items-center gap-2 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={restorePassword}
                        onChange={(e) => setRestorePassword(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-900 text-cyan-600 focus:ring-0"
                      />
                      <span className="text-[11px] text-slate-300">
                        Also restore administrator password from this backup
                      </span>
                    </label>
                  )}
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/80 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-800/80 text-xs text-emerald-300 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleImportSubmit}
                disabled={!parsedData || isProcessing}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-40 active:scale-98"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Restoring Backup...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Apply &amp; Restore Backup</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span className="text-[11px]">Seamless cross-server migration</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
