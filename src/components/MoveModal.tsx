import React, { useState } from 'react';
import { X, FolderInput, HardDrive, Folder } from 'lucide-react';
import { DriveItem, DriveAccount } from '../types/drive';

interface MoveModalProps {
  itemsToMove: DriveItem[];
  allFolders: DriveItem[];
  accounts: DriveAccount[];
  isOpen: boolean;
  onClose: () => void;
  onConfirmMove: (targetFolderId: string | null, targetAccount: DriveAccount) => void;
}

export const MoveModal: React.FC<MoveModalProps> = ({
  itemsToMove,
  allFolders,
  accounts,
  isOpen,
  onClose,
  onConfirmMove,
}) => {
  const initialAccount = accounts.find((a) => a.id === itemsToMove[0]?.accountId) || accounts[0];
  const [selectedAccountId, setSelectedAccountId] = useState(initialAccount?.id || '');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  if (!isOpen || itemsToMove.length === 0) return null;

  const currentTargetAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];

  // Folders belonging to the target account, excluding any of the items being moved
  const movingIds = new Set(itemsToMove.map((i) => i.id));
  const availableFolders = allFolders.filter(
    (f) => f.accountId === selectedAccountId && !movingIds.has(f.id)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTargetAccount) return;
    onConfirmMove(selectedFolderId, currentTargetAccount);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <FolderInput className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Move {itemsToMove.length === 1 ? `"${itemsToMove[0].name}"` : `${itemsToMove.length} Items`}
              </h3>
              <p className="text-[11px] text-slate-400">Transfer across folders and accounts</p>
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-sky-400" />
              <span>Destination OneDrive Account</span>
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => {
                setSelectedAccountId(e.target.value);
                setSelectedFolderId(null);
              }}
              className="w-full bg-slate-950 text-xs text-slate-200 border border-slate-800 rounded-xl px-3 py-2.5 focus:border-sky-500 focus:outline-none"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-amber-400" />
              <span>Destination Folder</span>
            </label>
            <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950 p-2 space-y-1">
              <button
                type="button"
                onClick={() => setSelectedFolderId(null)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
                  selectedFolderId === null
                    ? 'bg-sky-600 text-white font-semibold'
                    : 'text-slate-300 hover:bg-slate-850'
                }`}
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Drive Root (Top Level)</span>
              </button>

              {availableFolders.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFolderId(f.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
                    selectedFolderId === f.id
                      ? 'bg-sky-600 text-white font-semibold'
                      : 'text-slate-300 hover:bg-slate-850'
                  }`}
                >
                  <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{f.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-md shadow-sky-600/20 transition-all"
            >
              Confirm Move
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
