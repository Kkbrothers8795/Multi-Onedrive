import React, { useState } from 'react';
import {
  X,
  Download,
  ExternalLink,
  Share2,
  Trash2,
  FileText,
  Calendar,
  HardDrive,
  Copy,
  Check,
  Code,
  Table as TableIcon,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { DriveItem } from '../types/drive';
import { FileIcon } from './FileIcon';
import { FileViewer } from './FileViewer';
import { formatBytes } from '../utils/driveLogic';

interface FilePreviewModalProps {
  item: DriveItem | null;
  onClose: () => void;
  onDownload: (item: DriveItem) => void;
  onShare: (item: DriveItem) => void;
  onDelete: (item: DriveItem) => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  item,
  onClose,
  onDownload,
  onShare,
  onDelete,
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'metadata'>('preview');
  const [copiedId, setCopiedId] = useState(false);

  if (!item) return null;

  const copyItemId = () => {
    navigator.clipboard.writeText(item.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Parse CSV content if spreadsheet
  const renderSpreadsheetContent = () => {
    if (!item.content) {
      return (
        <div className="p-8 text-center text-slate-400">
          <p className="text-sm">Spreadsheet preview ready.</p>
          <p className="text-xs text-slate-400 mt-1">Open in Excel Online or download to view all formulas and worksheets.</p>
        </div>
      );
    }
    const rows = item.content.trim().split('\n').map((r) => r.split(','));
    const headers = rows[0] || [];
    const dataRows = rows.slice(1);

    return (
      <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/80">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-800 text-slate-300 font-semibold">
              {headers.map((h, i) => (
                <th key={i} className="py-2 px-3 border-r border-slate-800 last:border-r-0">
                  {h.trim()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-[11px] text-slate-300">
            {dataRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-850">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="py-1.5 px-3 border-r border-slate-800/60 last:border-r-0">
                    {cell.trim()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-950/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 shrink-0">
              <FileIcon type={item.fileType} size={24} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-100 truncate" title={item.name}>
                {item.name}
              </h2>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                <span
                  className="inline-flex items-center gap-1 font-medium px-2 py-0.2 rounded-full text-[10px]"
                  style={{
                    backgroundColor: `${item.accountColor}20`,
                    color: item.accountColor,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: item.accountColor }}
                  />
                  {item.accountName}
                </span>
                <span>•</span>
                <span>{formatBytes(item.size)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Tab Selector */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1 rounded-lg transition-colors font-medium ${
                  activeTab === 'preview'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('metadata')}
                className={`px-3 py-1 rounded-lg transition-colors font-medium flex items-center gap-1 ${
                  activeTab === 'metadata'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Info className="w-3 h-3" />
                <span>Graph Info</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-900/50">
          {activeTab === 'preview' ? (
            <FileViewer item={item} onDownload={() => onDownload(item)} />
          ) : (
            /* Microsoft Graph Item Metadata Inspection */
            <div className="space-y-4">
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="text-xs font-semibold text-sky-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Microsoft Graph Item Resource</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Drive Item ID
                    </label>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-sky-300 font-mono text-[11px] truncate">{item.id}</code>
                      <button
                        type="button"
                        onClick={copyItemId}
                        className="text-slate-400 hover:text-white p-1"
                        title="Copy Item ID"
                      >
                        {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Account Owner
                    </label>
                    <p className="text-slate-200 mt-0.5 font-medium">{item.accountName}</p>
                  </div>

                  <div>
                    <label className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Created Date
                    </label>
                    <p className="text-slate-200 mt-0.5">{new Date(item.createdDateTime).toLocaleString()}</p>
                  </div>

                  <div>
                    <label className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Last Modified Date
                    </label>
                    <p className="text-slate-200 mt-0.5">{new Date(item.lastModifiedDateTime).toLocaleString()}</p>
                  </div>

                  <div>
                    <label className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Exact Size
                    </label>
                    <p className="text-slate-200 mt-0.5 font-mono">{item.size.toLocaleString()} bytes ({formatBytes(item.size)})</p>
                  </div>

                  <div>
                    <label className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Category / MIME
                    </label>
                    <p className="text-slate-200 mt-0.5 font-mono">{item.mimeType || item.fileType}</p>
                  </div>
                </div>

                {item.webUrl && (
                  <div className="pt-2 border-t border-slate-800">
                    <label className="text-slate-400 block text-[10px] uppercase font-semibold">
                      SharePoint / OneDrive Web URL
                    </label>
                    <a
                      href={item.webUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-400 hover:underline text-xs flex items-center gap-1 mt-1 truncate"
                    >
                      <span className="truncate">{item.webUrl}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onDownload(item)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>

            <a
              href={item.webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
              <span>Open in Office Online</span>
            </a>

            <button
              type="button"
              onClick={() => onShare(item)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
            >
              <Share2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Share Link</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              onDelete(item);
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 text-xs font-medium transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};
