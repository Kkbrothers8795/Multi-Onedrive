import React from 'react';
import {
  Filter,
  X,
  Calendar,
  Layers,
  FileCheck,
  Check,
  RotateCcw,
} from 'lucide-react';
import {
  FileCategory,
  DateFilterOption,
  SizeFilterOption,
  DriveAccount,
} from '../types/drive';

interface AdvancedSearchFilterBarProps {
  category: FileCategory | 'all';
  onCategoryChange: (cat: FileCategory | 'all') => void;
  dateFilter: DateFilterOption;
  onDateFilterChange: (date: DateFilterOption) => void;
  sizeFilter: SizeFilterOption;
  onSizeFilterChange: (size: SizeFilterOption) => void;
  selectedAccountId: string | 'all';
  onAccountChange: (accId: string | 'all') => void;
  accounts: DriveAccount[];
  matchingCount: number;
  totalCount: number;
  onResetFilters: () => void;
  onClose: () => void;
}

const CATEGORIES: { id: FileCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All Types' },
  { id: 'document', label: 'Documents' },
  { id: 'spreadsheet', label: 'Spreadsheets' },
  { id: 'presentation', label: 'Presentations' },
  { id: 'pdf', label: 'PDFs' },
  { id: 'image', label: 'Images' },
  { id: 'code', label: 'Code & Data' },
  { id: 'archive', label: 'Archives' },
];

const DATE_OPTIONS: { id: DateFilterOption; label: string }[] = [
  { id: 'any', label: 'Any time' },
  { id: 'today', label: 'Today (24h)' },
  { id: '7days', label: 'Last 7 days' },
  { id: '30days', label: 'Last 30 days' },
  { id: 'year', label: 'Past year' },
];

const SIZE_OPTIONS: { id: SizeFilterOption; label: string; desc: string }[] = [
  { id: 'any', label: 'Any size', desc: 'All files' },
  { id: 'small', label: 'Small', desc: '< 1 MB' },
  { id: 'medium', label: 'Medium', desc: '1 MB – 10 MB' },
  { id: 'large', label: 'Large', desc: '10 MB – 50 MB' },
  { id: 'huge', label: 'Huge', desc: '> 50 MB' },
];

export const AdvancedSearchFilterBar: React.FC<AdvancedSearchFilterBarProps> = ({
  category,
  onCategoryChange,
  dateFilter,
  onDateFilterChange,
  sizeFilter,
  onSizeFilterChange,
  selectedAccountId,
  onAccountChange,
  accounts,
  matchingCount,
  totalCount,
  onResetFilters,
  onClose,
}) => {
  const isFilterActive =
    category !== 'all' || dateFilter !== 'any' || sizeFilter !== 'any' || selectedAccountId !== 'all';

  return (
    <div className="bg-slate-900/95 border-b border-slate-800 p-4 shadow-xl transition-all animate-fadeIn">
      <div className="flex items-center justify-between gap-4 mb-3 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
          <Filter className="w-3.5 h-3.5" />
          <span>Advanced Multi-Account Search & Filters</span>
          <span className="text-slate-400 font-normal">
            (Found {matchingCount} of {totalCount} items)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isFilterActive && (
            <button
              type="button"
              onClick={onResetFilters}
              className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors px-2 py-1 rounded bg-slate-800/60"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters panel"
            className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Account Scope */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Layers className="w-3 h-3 text-sky-400" />
            <span>Target Drive Account</span>
          </label>
          <select
            value={selectedAccountId}
            onChange={(e) => onAccountChange(e.target.value)}
            className="w-full bg-slate-950 text-xs text-slate-200 border border-slate-800 rounded-lg p-2 focus:border-sky-500 focus:outline-none"
          >
            <option value="all">All Connected Accounts ({accounts.length})</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
        </div>

        {/* File Type Category */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <FileCheck className="w-3 h-3 text-emerald-400" />
            <span>File Category</span>
          </label>
          <select
            value={category}
            onChange={(e) => onCategoryChange(e.target.value as any)}
            className="w-full bg-slate-950 text-xs text-slate-200 border border-slate-800 rounded-lg p-2 focus:border-sky-500 focus:outline-none"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date Modified Filter */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-amber-400" />
            <span>Last Modified</span>
          </label>
          <select
            value={dateFilter}
            onChange={(e) => onDateFilterChange(e.target.value as any)}
            className="w-full bg-slate-950 text-xs text-slate-200 border border-slate-800 rounded-lg p-2 focus:border-sky-500 focus:outline-none"
          >
            {DATE_OPTIONS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        {/* Size Filter */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-purple-400" />
            <span>File Size</span>
          </label>
          <select
            value={sizeFilter}
            onChange={(e) => onSizeFilterChange(e.target.value as any)}
            className="w-full bg-slate-950 text-xs text-slate-200 border border-slate-800 rounded-lg p-2 focus:border-sky-500 focus:outline-none"
          >
            {SIZE_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({s.desc})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Quick Category Chips */}
      <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2 border-t border-slate-800/60">
        <span className="text-[11px] text-slate-400 mr-1">Quick Filter:</span>
        {CATEGORIES.map((cat) => {
          const isSelected = category === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onCategoryChange(cat.id)}
              className={`text-xs px-2.5 py-1 rounded-full transition-all ${
                isSelected
                  ? 'bg-sky-600 text-white font-medium shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-750 hover:text-slate-200'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
