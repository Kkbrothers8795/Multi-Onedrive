import React from 'react';
import {
  Star,
  Download,
  Share2,
  Trash2,
  FolderInput,
  Edit2,
  Eye,
  RotateCcw,
  CheckCircle,
  Lock,
} from 'lucide-react';
import { DriveItem } from '../types/drive';
import { FileIcon } from './FileIcon';
import { formatBytes, formatRelativeTime } from '../utils/driveLogic';

interface FileListProps {
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

export const FileList: React.FC<FileListProps> = ({
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
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-900/50">
            <th className="py-3 px-4 w-10"></th>
            <th className="py-3 px-3">Name</th>
            <th className="py-3 px-3">Drive Account</th>
            <th className="py-3 px-3">Date Modified</th>
            <th className="py-3 px-3">File Size</th>
            <th className="py-3 px-3">Access</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {items.map((item) => {
            const isSelected = selectedIds.has(item.id);

            return (
              <tr
                key={item.id}
                onClick={() => onItemClick(item)}
                className={`group transition-colors cursor-pointer select-none hover:bg-slate-800/40 ${
                  isSelected ? 'bg-sky-950/40' : ''
                }`}
              >
                {/* Checkbox */}
                <td className="py-2.5 px-4" onClick={(e) => onToggleSelect(item.id, e)}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    aria-label={`Select ${item.name}`}
                    className="rounded border-slate-700 text-sky-500 focus:ring-sky-500 bg-slate-800 cursor-pointer h-3.5 w-3.5"
                  />
                </td>

                {/* Name + Icon */}
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileIcon type={item.fileType} size={18} className="shrink-0" />
                    <span
                      className="font-medium text-slate-200 truncate group-hover:text-sky-300 transition-colors max-w-xs md:max-w-md"
                      title={item.name}
                    >
                      {item.name}
                    </span>
                    {item.starred && (
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 shrink-0" />
                    )}
                  </div>
                </td>

                {/* Account badge */}
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <div
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
                    style={{
                      backgroundColor: `${item.accountColor}15`,
                      color: item.accountColor,
                      border: `1px solid ${item.accountColor}30`,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: item.accountColor }}
                    />
                    <span>{item.accountName}</span>
                  </div>
                </td>

                {/* Modified */}
                <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                  {formatRelativeTime(item.lastModifiedDateTime)}
                </td>

                {/* Size */}
                <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap font-mono text-[11px]">
                  {item.isFolder ? '—' : formatBytes(item.size)}
                </td>

                {/* Sharing status */}
                <td className="py-2.5 px-3 whitespace-nowrap">
                  {item.shared ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                      <CheckCircle className="w-3 h-3" />
                      Shared
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                      <Lock className="w-3 h-3 text-slate-400" />
                      Private
                    </span>
                  )}
                </td>

                {/* Actions */}
                <td className="py-2.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <div className="inline-flex items-center gap-1">
                    {!item.isFolder && (
                      <button
                        type="button"
                        onClick={() => onPreview(item)}
                        title="Preview"
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
                        title="Download"
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
                      title="Move"
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
                        title="Restore"
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
