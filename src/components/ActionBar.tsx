import React, { useRef } from 'react';
import {
  Upload,
  FolderPlus,
  LayoutGrid,
  List,
  ArrowUpDown,
  Download,
  Trash2,
  FolderInput,
  X,
  ChevronRight,
  HardDrive,
  CheckSquare,
} from 'lucide-react';
import { ViewMode, SortField, SortOrder, DriveAccount } from '../types/drive';

interface ActionBarProps {
  breadcrumbs: { id: string | null; name: string }[];
  onNavigateBreadcrumb: (id: string | null) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sortField: SortField;
  onSortFieldChange: (field: SortField) => void;
  sortOrder: SortOrder;
  onSortOrderChange: (order: SortOrder) => void;
  selectedCount: number;
  onUploadClick: () => void;
  onNewFolderClick: () => void;
  onBatchDownloadZip: () => void;
  onBatchMoveClick: () => void;
  onBatchDeleteClick: () => void;
  onClearSelection: () => void;
  onSelectAll: () => void;
  isAllSelected: boolean;
  totalVisibleCount: number;
  currentAccount?: DriveAccount;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  breadcrumbs,
  onNavigateBreadcrumb,
  viewMode,
  onViewModeChange,
  sortField,
  onSortFieldChange,
  sortOrder,
  onSortOrderChange,
  selectedCount,
  onUploadClick,
  onNewFolderClick,
  onBatchDownloadZip,
  onBatchMoveClick,
  onBatchDeleteClick,
  onClearSelection,
  onSelectAll,
  isAllSelected,
  totalVisibleCount,
  currentAccount,
}) => {
  return (
    <div className="bg-slate-900/60 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
      {/* Left: Breadcrumb Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-xs text-slate-400">
        <HardDrive className="w-3.5 h-3.5 text-sky-400 shrink-0" />
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          return (
            <React.Fragment key={crumb.id || 'root'}>
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
              <button
                type="button"
                onClick={() => onNavigateBreadcrumb(crumb.id)}
                className={`truncate max-w-[180px] font-medium hover:text-white transition-colors ${
                  isLast ? 'text-slate-100 font-semibold' : 'text-slate-400'
                }`}
                title={crumb.name}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Center/Right: Actions & Batch Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Batch Operations Bar when items are selected */}
        {selectedCount > 0 ? (
          <div className="flex items-center gap-1.5 bg-sky-950/80 border border-sky-800/80 px-2.5 py-1 rounded-xl text-xs text-sky-200 animate-fadeIn">
            <span className="font-semibold text-white mr-1">{selectedCount} selected</span>

            <button
              type="button"
              onClick={onBatchDownloadZip}
              title="Download selected items as ZIP archive"
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-800 hover:bg-sky-700 text-white font-medium transition-colors"
            >
              <Download className="w-3 h-3" />
              <span>Download ZIP</span>
            </button>

            <button
              type="button"
              onClick={onBatchMoveClick}
              title="Move or transfer files to another folder or account"
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              <FolderInput className="w-3 h-3 text-amber-400" />
              <span>Move</span>
            </button>

            <button
              type="button"
              onClick={onBatchDeleteClick}
              title="Delete selected items"
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/60 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete</span>
            </button>

            <button
              type="button"
              onClick={onClearSelection}
              aria-label="Clear selection"
              className="p-1 hover:text-white text-sky-300 ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          /* Normal Action Buttons */
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onUploadClick}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl shadow-sm transition-all active:scale-95"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload</span>
            </button>

            <button
              type="button"
              onClick={onNewFolderClick}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-medium rounded-xl transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
              <span>New Folder</span>
            </button>
          </div>
        )}

        <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

        {/* Select All Toggle */}
        {totalVisibleCount > 0 && (
          <button
            type="button"
            onClick={onSelectAll}
            title={isAllSelected ? 'Deselect all' : 'Select all visible items'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors text-xs flex items-center gap-1"
          >
            <CheckSquare className={`w-3.5 h-3.5 ${isAllSelected ? 'text-sky-400' : ''}`} />
            <span className="hidden md:inline">{isAllSelected ? 'Deselect' : 'Select All'}</span>
          </button>
        )}

        {/* Sort Menu */}
        <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl px-2 py-1 text-xs">
          <ArrowUpDown className="w-3 h-3 text-slate-400" />
          <select
            value={sortField}
            onChange={(e) => onSortFieldChange(e.target.value as any)}
            className="bg-transparent text-slate-300 focus:outline-none cursor-pointer pr-1"
          >
            <option value="name" className="bg-slate-900">Name</option>
            <option value="date" className="bg-slate-900">Date Modified</option>
            <option value="size" className="bg-slate-900">Size</option>
            <option value="account" className="bg-slate-900">Account</option>
          </select>
          <button
            type="button"
            onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
            title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
            className="text-slate-400 hover:text-white px-1 font-bold text-[10px]"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5">
          <button
            type="button"
            onClick={() => onViewModeChange('grid')}
            aria-label="Grid view"
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'grid'
                ? 'bg-slate-800 text-sky-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('list')}
            aria-label="List view"
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'list'
                ? 'bg-slate-800 text-sky-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
