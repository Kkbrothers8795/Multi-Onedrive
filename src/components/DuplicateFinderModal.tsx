import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  CopyCheck,
  Trash2,
  Sparkles,
  CheckCircle2,
  HardDrive,
  Search,
  Layers,
  CheckSquare,
  Square,
  ShieldCheck,
  Loader2,
  Filter,
} from 'lucide-react';
import { DriveAccount, DriveItem, DuplicateGroup } from '../types/drive';
import { formatBytes } from '../utils/driveLogic';
import { FileIcon } from './FileIcon';

interface DuplicateFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: DriveItem[];
  accounts: DriveAccount[];
  onDeduplicateComplete: (deletedIds: string[], reclaimedBytes: number) => void;
}

export const DuplicateFinderModal: React.FC<DuplicateFinderModalProps> = ({
  isOpen,
  onClose,
  items,
  accounts,
  onDeduplicateComplete,
}) => {
  const [scanMode, setScanMode] = useState<'exact' | 'smart'>('exact');
  const [keepStrategy, setKeepStrategy] = useState<'newest' | 'oldest'>('newest');
  const [selectedDuplicateIds, setSelectedDuplicateIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Build duplicate clusters across all connected OneDrive accounts
  const duplicateGroups = useMemo<DuplicateGroup[]>(() => {
    const activeFiles = items.filter((i) => !i.deleted && !i.isFolder);
    const map = new Map<string, DriveItem[]>();

    for (const file of activeFiles) {
      let key = '';
      if (scanMode === 'exact') {
        // Exact match by lowercase filename + byte size across accounts
        key = `${file.name.trim().toLowerCase()}::${file.size}`;
      } else {
        // Smart stem match: strips "Copy of ", "(1)", "(2)" and matches extension + size
        const normalizedName = file.name
          .trim()
          .toLowerCase()
          .replace(/^copy of\s+/i, '')
          .replace(/\s*\(\d+\)(\.[^.]+)?$/, '$1');
        key = `${normalizedName}::${file.size}`;
      }

      const list = map.get(key) || [];
      list.push(file);
      map.set(key, list);
    }

    const groups: DuplicateGroup[] = [];
    for (const [key, groupItems] of map.entries()) {
      if (groupItems.length > 1) {
        const sorted = [...groupItems].sort((a, b) => {
          const tA = new Date(a.lastModifiedDateTime).getTime();
          const tB = new Date(b.lastModifiedDateTime).getTime();
          return keepStrategy === 'newest' ? tB - tA : tA - tB;
        });

        const singleSize = sorted[0].size || 0;
        const wastedBytes = singleSize * (sorted.length - 1);

        groups.push({
          key,
          fileName: sorted[0].name,
          size: singleSize,
          matchType: scanMode === 'exact' ? 'exact_name_size' : 'normalized_stem',
          items: sorted,
          wastedBytes,
        });
      }
    }

    return groups
      .filter((g) =>
        searchFilter.trim()
          ? g.fileName.toLowerCase().includes(searchFilter.trim().toLowerCase())
          : true
      )
      .sort((a, b) => b.wastedBytes - a.wastedBytes);
  }, [items, scanMode, keepStrategy, searchFilter]);

  // Auto-select all redundant copies (all except index 0 in each group) whenever groups or strategy change
  useEffect(() => {
    if (!isOpen) return;
    const autoSelected = new Set<string>();
    for (const group of duplicateGroups) {
      // Index 0 is the "Keep" copy; indices 1..n are redundant duplicates
      for (let i = 1; i < group.items.length; i++) {
        autoSelected.add(group.items[i].id);
      }
    }
    setSelectedDuplicateIds(autoSelected);
  }, [duplicateGroups, isOpen, keepStrategy, scanMode]);

  if (!isOpen) return null;

  const totalWastedBytes = duplicateGroups.reduce((acc, g) => acc + g.wastedBytes, 0);
  const selectedReclaimBytes = items
    .filter((i) => selectedDuplicateIds.has(i.id))
    .reduce((acc, i) => acc + (i.size || 0), 0);

  const toggleItemSelection = (id: string) => {
    setSelectedDuplicateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAutoSelectRedundant = () => {
    const autoSelected = new Set<string>();
    for (const group of duplicateGroups) {
      for (let i = 1; i < group.items.length; i++) {
        autoSelected.add(group.items[i].id);
      }
    }
    setSelectedDuplicateIds(autoSelected);
  };

  const handleDeduplicateNow = async () => {
    if (selectedDuplicateIds.size === 0) return;
    setIsDeleting(true);
    try {
      const idsArray = Array.from(selectedDuplicateIds);
      const res = await fetch('/api/drive/deduplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: idsArray }),
      });
      const data = await res.json().catch(() => null);
      const freed = data?.reclaimedBytes ?? selectedReclaimBytes;
      onDeduplicateComplete(idsArray, freed);
      setSelectedDuplicateIds(new Set());
    } finally {
      setIsDeleting(false);
    }
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-amber-600/20">
              <CopyCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-100">
                  Duplicate File Finder & Cross-Account Deduplicator
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 font-mono tabular-nums">
                  {accounts.length} Drives Scanned
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Detects redundant copies across all connected OneDrive accounts ({accounts.map((a) => a.name.split(' ')[0]).join(', ') || 'All Drives'}) and reclaims wasted space in one click.
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

        {/* Summary Telemetry Strip */}
        <div className="grid grid-cols-3 gap-3 px-6 py-3.5 bg-slate-950/50 border-b border-slate-800/80">
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Duplicate Clusters</span>
            </div>
            <p className="text-base font-bold text-white font-mono tabular-nums mt-1">
              {duplicateGroups.length} <span className="text-xs font-normal text-slate-400">groups</span>
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <HardDrive className="w-3.5 h-3.5 text-rose-400" />
              <span>Total Wasted Storage</span>
            </div>
            <p className="text-base font-bold text-rose-300 font-mono tabular-nums mt-1">
              {formatBytes(totalWastedBytes)}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ready to Reclaim</span>
            </div>
            <p className="text-base font-bold text-emerald-400 font-mono tabular-nums mt-1">
              {formatBytes(selectedReclaimBytes)}{' '}
              <span className="text-xs font-normal text-slate-400">
                ({selectedDuplicateIds.size} files)
              </span>
            </p>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="px-6 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setScanMode('exact')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  scanMode === 'exact'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Exact Name + Size
              </button>
              <button
                type="button"
                onClick={() => setScanMode('smart')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  scanMode === 'smart'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Smart Stem Match (Copy of / (1))
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Keep:</span>
              <select
                value={keepStrategy}
                onChange={(e) => setKeepStrategy(e.target.value as 'newest' | 'oldest')}
                className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
              >
                <option value="newest" className="bg-slate-900">Newest Modified Copy</option>
                <option value="oldest" className="bg-slate-900">Oldest Original Copy</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter duplicates..."
                className="pl-8 pr-3 py-1 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500 w-44"
              />
            </div>

            <button
              type="button"
              onClick={handleAutoSelectRedundant}
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              Auto-Select Redundant
            </button>
          </div>
        </div>

        {/* Duplicate Clusters List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {duplicateGroups.length === 0 ? (
            <div className="py-14 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">
                  Zero Duplicate Files Found Across Connected Drives
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  All files across your connected OneDrive accounts are unique. Try switching to "Smart Stem Match" to check for numbered copies like "(1)".
                </p>
              </div>
            </div>
          ) : (
            duplicateGroups.map((group) => (
              <div
                key={group.key}
                className="rounded-xl bg-slate-950 border border-slate-800/90 overflow-hidden"
              >
                <div className="px-4 py-2.5 bg-slate-900/80 border-b border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileIcon type={group.items[0].fileType} className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-semibold text-slate-100 truncate">
                      {group.fileName}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono tabular-nums">
                      {group.items.length} copies · {formatBytes(group.size)} each
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-semibold text-rose-400 tabular-nums shrink-0">
                    Wasting {formatBytes(group.wastedBytes)}
                  </span>
                </div>

                <div className="divide-y divide-slate-900">
                  {group.items.map((item, idx) => {
                    const isPrimaryKeep = idx === 0;
                    const isSelected = selectedDuplicateIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleItemSelection(item.id)}
                        className={`px-4 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-rose-950/20 hover:bg-rose-950/30'
                            : 'hover:bg-slate-900/40'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-rose-400 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600 shrink-0" />
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-medium text-slate-200 truncate">
                                {item.name}
                              </span>
                              {isPrimaryKeep ? (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-semibold flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3" />
                                  Keep ({keepStrategy === 'newest' ? 'Newest' : 'Original'})
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[10px] font-semibold">
                                  Redundant Duplicate
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: item.accountColor }}
                              />
                              <span className="text-slate-300 font-medium">{item.accountName}</span>
                              <span>·</span>
                              <span className="font-mono tabular-nums">
                                Modified {new Date(item.lastModifiedDateTime).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span className="text-xs font-mono tabular-nums text-slate-400 shrink-0">
                          {formatBytes(item.size)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            Selected <span className="text-white font-semibold font-mono tabular-nums">{selectedDuplicateIds.size}</span> duplicate file(s) to remove ({formatBytes(selectedReclaimBytes)} freed)
          </div>

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
              disabled={selectedDuplicateIds.size === 0 || isDeleting}
              onClick={handleDeduplicateNow}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-rose-600/20 transition-all"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deduplicating Drives...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>One-Click Deduplicate & Free {formatBytes(selectedReclaimBytes)}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
