import React, { useState } from 'react';
import {
  X,
  ArrowRight,
  HardDrive,
  Copy,
  MoveRight,
  CheckCircle2,
  AlertCircle,
  Cloud,
  Check,
  Zap,
} from 'lucide-react';
import { DriveAccount, DriveItem } from '../types/drive';
import { formatBytes } from '../utils/driveLogic';

interface CloudMigrationModalProps {
  items: DriveItem[];
  accounts: DriveAccount[];
  currentAccountId: string;
  onClose: () => void;
  onMigrateComplete: (migratedCount: number, totalBytes: number, targetAccountName: string) => void;
}

export const CloudMigrationModal: React.FC<CloudMigrationModalProps> = ({
  items,
  accounts,
  currentAccountId,
  onClose,
  onMigrateComplete,
}) => {
  // Target accounts: accounts other than the item's current account
  const sourceAccount = accounts.find((a) => a.id === (items[0]?.accountId || currentAccountId)) || accounts[0];
  const eligibleTargets = accounts.filter((a) => a.id !== sourceAccount?.id);

  const [targetAccountId, setTargetAccountId] = useState(eligibleTargets[0]?.id || '');
  const [migrationMode, setMigrationMode] = useState<'move' | 'copy'>('move');
  const [isMigrating, setIsMigrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFileStep, setCurrentFileStep] = useState('');
  const [error, setError] = useState<string | null>(null);

  const totalBytes = items.reduce((sum, i) => sum + (i.size || 0), 0);
  const targetAccount = accounts.find((a) => a.id === targetAccountId);

  const targetUsed = targetAccount?.quota?.used || 0;
  const targetTotal = targetAccount?.quota?.total || 1099511627776;
  const targetFree = Math.max(0, targetTotal - targetUsed);
  const hasSufficientSpace = targetFree >= totalBytes;

  const handleStartMigration = async () => {
    if (!targetAccountId) {
      setError('Please select a target OneDrive account');
      return;
    }
    if (!hasSufficientSpace) {
      setError('Target account does not have enough free storage space.');
      return;
    }

    setIsMigrating(true);
    setError(null);
    setProgress(10);

    try {
      // Simulate stepped progress for user clarity
      for (let i = 0; i < items.length; i++) {
        setCurrentFileStep(`Transferring ${items[i].name}...`);
        setProgress(Math.round(((i + 1) / items.length) * 80));
        await new Promise((r) => setTimeout(r, 150));
      }

      setCurrentFileStep('Reconciling drive storage allocations...');
      setProgress(90);

      const res = await fetch('/api/drive/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemIds: items.map((i) => i.id),
          sourceAccountId: sourceAccount?.id,
          targetAccountId,
          mode: migrationMode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Cloud migration failed');
      }

      setProgress(100);
      setCurrentFileStep('Migration complete!');

      setTimeout(() => {
        onMigrateComplete(items.length, totalBytes, targetAccount?.name || 'Target Drive');
        onClose();
      }, 600);
    } catch (err: any) {
      setError(err.message || 'Failed to complete cloud migration');
      setIsMigrating(false);
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
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                Direct Cloud-to-Cloud Migration
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Zero Local Download
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Transfer {items.length} item{items.length !== 1 ? 's' : ''} ({formatBytes(totalBytes)}) between OneDrive tenants
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isMigrating}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Transfer Visual Route */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
            {/* Source */}
            <div className="flex-1 min-w-0">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Source Account</span>
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: sourceAccount?.color || '#3b82f6' }}
                />
                <span className="text-xs font-semibold text-slate-200 truncate">{sourceAccount?.name}</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block truncate">{sourceAccount?.tenantName}</span>
            </div>

            <div className="flex flex-col items-center px-2">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shadow">
                <ArrowRight className="w-4 h-4 text-sky-400" />
              </div>
              <span className="text-[9px] text-slate-400 mt-1 uppercase font-semibold">Direct Stream</span>
            </div>

            {/* Target */}
            <div className="flex-1 min-w-0 text-right">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Destination</span>
              {targetAccount ? (
                <div>
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-xs font-semibold text-slate-200 truncate">{targetAccount.name}</span>
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: targetAccount.color || '#10b981' }}
                    />
                  </div>
                  <span className="text-[11px] text-emerald-400 mt-0.5 block">
                    {formatBytes(targetFree)} available
                  </span>
                </div>
              ) : (
                <span className="text-xs text-rose-400">No other accounts</span>
              )}
            </div>
          </div>

          {/* Destination Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Select Destination OneDrive Account</label>
            {eligibleTargets.length > 0 ? (
              <select
                value={targetAccountId}
                onChange={(e) => setTargetAccountId(e.target.value)}
                disabled={isMigrating}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              >
                {eligibleTargets.map((acc) => {
                  const free = Math.max(0, (acc.quota?.total || 1099511627776) - (acc.quota?.used || 0));
                  return (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.tenantName}) — {formatBytes(free)} free
                    </option>
                  );
                })}
              </select>
            ) : (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                You only have 1 connected OneDrive account. Connect another account from the sidebar to migrate files across accounts.
              </div>
            )}
          </div>

          {/* Migration Mode */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Migration Behavior</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setMigrationMode('move')}
                disabled={isMigrating}
                className={`p-3 rounded-xl border text-left transition-all ${
                  migrationMode === 'move'
                    ? 'bg-sky-500/10 border-sky-500/40 text-slate-100 ring-1 ring-sky-500/30'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1 font-semibold text-xs text-sky-400">
                  <MoveRight className="w-3.5 h-3.5" />
                  <span>Move Files</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Reassigns files to target drive and frees up space on the source drive.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMigrationMode('copy')}
                disabled={isMigrating}
                className={`p-3 rounded-xl border text-left transition-all ${
                  migrationMode === 'copy'
                    ? 'bg-indigo-500/10 border-indigo-500/40 text-slate-100 ring-1 ring-indigo-500/30'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1 font-semibold text-xs text-indigo-400">
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Files</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Clones items to target drive and keeps original intact on source drive.
                </p>
              </button>
            </div>
          </div>

          {/* Progress / Error Display */}
          {isMigrating && (
            <div className="space-y-2 p-3.5 rounded-xl bg-slate-950 border border-slate-800 animate-fadeIn">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium truncate max-w-[260px]">{currentFileStep}</span>
                <span className="text-sky-400 font-mono font-bold">{progress}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/80 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>High-speed cloud-to-cloud conduit</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isMigrating}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStartMigration}
              disabled={isMigrating || !hasSufficientSpace || eligibleTargets.length === 0}
              className="px-4 py-2 text-xs font-bold text-white rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50 active:scale-95 flex items-center gap-1.5"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>{isMigrating ? 'Migrating...' : `Start Migration (${items.length} Files)`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
