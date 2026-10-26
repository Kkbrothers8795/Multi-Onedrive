import React from 'react';
import {
  MoreVertical,
  Star,
  Download,
  Share2,
  Trash2,
  FolderInput,
  Edit2,
  Eye,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { DriveItem } from '../types/drive';
import { FileIcon } from './FileIcon';
import { formatBytes, formatRelativeTime } from '../utils/driveLogic';

interface FileGridProps {
  items: DriveItem[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  onItemClick: (item: DriveItem) => void;
  onToggleStar: (item: DriveItem, e: React.MouseEvent) => void;
  onPreview: (item: DriveItem) => void;
  onDownload: (item: DriveItem, e: React.MouseEvent) => void;
  onShare: (item: DriveItem, e: React.MouseEvent) => void;
  onRename: (item: DriveItem, e: React.MouseEvent) => void;
  onMove: (item: DriveItem, e: React.MouseEvent) => void;
  onDelete: (item: DriveItem, e: React.MouseEvent) => void;
  onRestore?: (item: DriveItem, e: React.MouseEvent) => void;
  isTrashView?: boolean;
}

export const FileGrid: React.FC<FileGridProps> = ({
  items,
  selectedIds,
  onToggleSelect,
  onItemClick,
  onToggleStar,
  onPreview,
  onDownload,
  onShare,
  onRename,
  onMove,
  onDelete,
  onRestore,
  isTrashView = false,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 p-4">
      {items.map((item) => {
        const isSelected = selectedIds.has(item.id);

        return (
          <div
            key={item.id}
            onClick={() => onItemClick(item)}
            className={`group relative flex flex-col justify-between p-3.5 rounded-2xl border transition-all cursor-pointer select-none bg-slate-900/70 hover:bg-slate-850 hover:shadow-lg hover:shadow-sky-950/20 ${
              isSelected
                ? 'border-sky-500 ring-2 ring-sky-500/30 bg-sky-950/30'
                : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            {/* Top row: Checkbox, Account Badge, Star */}
            <div className="flex items-center justify-between gap-1.5 mb-2">
              <div
                onClick={(e) => onToggleSelect(item.id, e)}
                className="p-1 -m-1 text-slate-400 hover:text-white"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  aria-label={`Select ${item.name}`}
                  className="rounded border-slate-700 text-sky-500 focus:ring-sky-500 focus:ring-offset-slate-900 bg-slate-800 cursor-pointer h-3.5 w-3.5"
                />
              </div>

              {/* Source Account Pill */}
              <div
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium max-w-[140px] truncate"
                style={{
                  backgroundColor: `${item.accountColor}18`,
                  color: item.accountColor,
                  border: `1px solid ${item.accountColor}33`,
                }}
                title={`Stored in: ${item.accountName}`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.accountColor }}
                />
                <span className="truncate">{item.accountName}</span>
              </div>

              {/* Star toggle */}
              {!isTrashView && (
                <button
                  type="button"
                  onClick={(e) => onToggleStar(item, e)}
                  aria-label={item.starred ? 'Unstar file' : 'Star file'}
                  className={`p-1 rounded hover:bg-slate-850 transition-colors ${
                    item.starred
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-slate-400 hover:text-slate-200 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${item.starred ? 'fill-yellow-400' : ''}`} />
                </button>
              )}
            </div>

            {/* Middle: File/Folder Icon & Name */}
            <div className="flex items-start gap-3 my-2">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                <FileIcon type={item.fileType} size={28} />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="text-xs font-semibold text-slate-100 line-clamp-2 leading-snug break-words group-hover:text-sky-300 transition-colors"
                  title={item.name}
                >
                  {item.name}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {item.isFolder ? 'Folder' : formatBytes(item.size)}
                </p>
              </div>
            </div>

            {/* Bottom Row: Last Modified & Quick Hover Actions */}
            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
              <span title={new Date(item.lastModifiedDateTime).toLocaleString()}>
                {formatRelativeTime(item.lastModifiedDateTime)}
              </span>

              {/* Quick Actions Bar */}
              <div
                className="flex items-center gap-0.5 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                {!item.isFolder && (
                  <button
                    type="button"
                    onClick={() => onPreview(item)}
                    title="Preview file"
                    aria-label={`Preview ${item.name}`}
                    className="p-1 rounded text-slate-400 hover:text-sky-400 hover:bg-slate-800"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                )}

                {!item.isFolder && (
                  <button
                    type="button"
                    onClick={(e) => onDownload(item, e)}
                    title="Download file"
                    aria-label={`Download ${item.name}`}
                    className="p-1 rounded text-slate-400 hover:text-emerald-400 hover:bg-slate-800"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => onShare(item, e)}
                  title="Share link"
                  aria-label={`Share ${item.name}`}
                  className="p-1 rounded text-slate-400 hover:text-sky-400 hover:bg-slate-800"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={(e) => onMove(item, e)}
                  title="Move / Transfer across drives"
                  aria-label={`Move ${item.name}`}
                  className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-800"
                >
                  <FolderInput className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={(e) => onRename(item, e)}
                  title="Rename"
                  aria-label={`Rename ${item.name}`}
                  className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>

                {isTrashView ? (
                  <button
                    type="button"
                    onClick={(e) => onRestore && onRestore(item, e)}
                    title="Restore file"
                    aria-label={`Restore ${item.name}`}
                    className="p-1 rounded text-emerald-400 hover:bg-slate-800"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => onDelete(item, e)}
                    title="Delete"
                    aria-label={`Delete ${item.name}`}
                    className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
