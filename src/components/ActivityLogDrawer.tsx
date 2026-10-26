import React from 'react';
import {
  X,
  History,
  Upload,
  Download,
  Trash2,
  FolderInput,
  Edit2,
  RefreshCw,
  FolderPlus,
  Share2,
} from 'lucide-react';
import { ActivityLogEntry } from '../types/drive';
import { formatRelativeTime } from '../utils/driveLogic';

interface ActivityLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entries: ActivityLogEntry[];
  onClear: () => void;
}

export const ActivityLogDrawer: React.FC<ActivityLogDrawerProps> = ({
  isOpen,
  onClose,
  entries,
  onClear,
}) => {
  if (!isOpen) return null;

  const getActionIcon = (action: ActivityLogEntry['action']) => {
    switch (action) {
      case 'upload':
        return <Upload className="w-3.5 h-3.5 text-sky-400" />;
      case 'download':
        return <Download className="w-3.5 h-3.5 text-emerald-400" />;
      case 'delete':
        return <Trash2 className="w-3.5 h-3.5 text-rose-400" />;
      case 'restore':
        return <RefreshCw className="w-3.5 h-3.5 text-teal-400" />;
      case 'create_folder':
        return <FolderPlus className="w-3.5 h-3.5 text-amber-400" />;
      case 'move':
        return <FolderInput className="w-3.5 h-3.5 text-indigo-400" />;
      case 'rename':
        return <Edit2 className="w-3.5 h-3.5 text-blue-400" />;
      case 'share':
        return <Share2 className="w-3.5 h-3.5 text-purple-400" />;
      case 'sync':
      default:
        return <RefreshCw className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-sky-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Audit & Sync Stream</h3>
              <p className="text-[11px] text-slate-400">Real-time Multi-Drive Operation Log</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {entries.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No recent file activity recorded yet.
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-start gap-3 hover:border-slate-750 transition-colors"
              >
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 shrink-0 mt-0.5">
                  {getActionIcon(entry.action)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-semibold text-slate-200 capitalize">
                      {entry.action.replace('_', ' ')}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      {formatRelativeTime(entry.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-sky-300 font-medium truncate mt-0.5">
                    {entry.itemName}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Drive: <span className="text-slate-300 font-medium">{entry.accountName}</span>
                    {entry.details && ` • ${entry.details}`}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {entries.length > 0 && (
          <div className="p-3 border-t border-slate-800 bg-slate-950/40 flex justify-end">
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-slate-400 hover:text-rose-400 transition-colors"
            >
              Clear Log History
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
