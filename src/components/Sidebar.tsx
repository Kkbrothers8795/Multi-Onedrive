import React from 'react';
import {
  Layers,
  Clock,
  Star,
  Users,
  Trash2,
  HardDrive,
  PlusCircle,
  ShieldCheck,
  Building2,
  Laptop,
  CheckCircle,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { DriveAccount, NavigationFilter } from '../types/drive';
import { formatBytes } from '../utils/driveLogic';
import { SidebarStorageChart } from './SidebarStorageChart';

interface SidebarProps {
  accounts: DriveAccount[];
  selectedAccountId: string | 'all';
  onSelectAccount: (accId: string | 'all') => void;
  activeNavFilter: NavigationFilter;
  onSelectNavFilter: (filter: NavigationFilter) => void;
  onOpenConnectModal: () => void;
  onOpenStatsModal: () => void;
  aggregateStorage: { total: number; used: number; remaining: number; percent: number };
}

export const Sidebar: React.FC<SidebarProps> = ({
  accounts,
  selectedAccountId,
  onSelectAccount,
  activeNavFilter,
  onSelectNavFilter,
  onOpenConnectModal,
  onOpenStatsModal,
  aggregateStorage,
}) => {
  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 select-none overflow-y-auto">
      {/* Primary Navigation Views */}
      <div className="p-3 space-y-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-3 py-1">
          Unified Views
        </div>

        <button
          type="button"
          onClick={() => {
            onSelectAccount('all');
            onSelectNavFilter('all');
          }}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
            selectedAccountId === 'all' && activeNavFilter === 'all'
              ? 'bg-sky-600/15 text-sky-400 border border-sky-500/30 font-semibold'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-sky-400" />
            <span>All Drives (Unified)</span>
          </div>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400">
            {accounts.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectNavFilter('recent')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
            activeNavFilter === 'recent'
              ? 'bg-sky-600/15 text-sky-400 border border-sky-500/30 font-semibold'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-400" />
          <span>Recent Files</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectNavFilter('starred')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
            activeNavFilter === 'starred'
              ? 'bg-sky-600/15 text-sky-400 border border-sky-500/30 font-semibold'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
        >
          <Star className="w-4 h-4 text-yellow-400" />
          <span>Starred & Pinned</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectNavFilter('shared')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
            activeNavFilter === 'shared'
              ? 'bg-sky-600/15 text-sky-400 border border-sky-500/30 font-semibold'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-400" />
          <span>Shared with Me</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectNavFilter('trash')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
            activeNavFilter === 'trash'
              ? 'bg-sky-600/15 text-sky-400 border border-sky-500/30 font-semibold'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
        >
          <Trash2 className="w-4 h-4 text-rose-400" />
          <span>Recycle Bin</span>
        </button>
      </div>

      <div className="h-px bg-slate-800 mx-3 my-1" />

      {/* Connected Accounts Section */}
      <div className="p-3 flex-1 space-y-1">
        <div className="flex items-center justify-between px-3 py-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Connected Accounts
          </span>
          <button
            type="button"
            onClick={onOpenConnectModal}
            title="Connect another account"
            aria-label="Add account"
            className="text-slate-400 hover:text-sky-400 transition-colors p-0.5"
          >
            <PlusCircle className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1">
          {accounts.map((acc) => {
            const isSelected = selectedAccountId === acc.id && activeNavFilter === 'all';
            const usedPct =
              acc.quota?.total > 0
                ? Math.round((acc.quota.used / acc.quota.total) * 100)
                : 0;

            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => {
                  onSelectAccount(acc.id);
                  onSelectNavFilter('all');
                }}
                className={`w-full text-left p-2.5 rounded-xl transition-all border ${
                  isSelected
                    ? 'bg-slate-800/90 border-slate-700 shadow-sm'
                    : 'bg-transparent border-transparent hover:bg-slate-800/50 hover:border-slate-800'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className="w-3 h-3 rounded-full mt-1 shrink-0 ring-2 ring-slate-900"
                    style={{ backgroundColor: acc.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-semibold text-slate-200 truncate">{acc.name}</p>
                      {acc.isLive ? (
                        <span className="text-[9px] font-medium bg-emerald-950 text-emerald-400 border border-emerald-800 px-1 py-0.2 rounded">
                          Live
                        </span>
                      ) : (
                        <span className="text-[9px] font-medium bg-slate-800 text-slate-400 px-1 py-0.2 rounded">
                          Connected
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">{acc.email}</p>

                    {/* Account Storage Gauge */}
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                        <span>{formatBytes(acc.quota?.used || 0)}</span>
                        <span>{formatBytes(acc.quota?.total || 0)}</span>
                      </div>
                      <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, usedPct)}%`,
                            backgroundColor: acc.color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onOpenConnectModal}
          className="w-full mt-2 py-2 px-3 rounded-xl border border-dashed border-slate-700 hover:border-sky-500/50 text-xs text-slate-400 hover:text-sky-400 hover:bg-sky-500/5 flex items-center justify-center gap-1.5 transition-all"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Add OneDrive Account</span>
        </button>
      </div>

      {/* Aggregate Storage Overview Widget */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40">
        <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-750">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-sky-400" />
              Total Cloud Quota
            </span>
            <span className="text-xs font-bold text-sky-400">{aggregateStorage.percent}%</span>
          </div>

          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden flex mb-2">
            {accounts.map((acc) => {
              const shareOfTotal =
                aggregateStorage.total > 0
                  ? ((acc.quota?.used || 0) / aggregateStorage.total) * 100
                  : 0;
              return (
                <div
                  key={acc.id}
                  style={{
                    width: `${shareOfTotal}%`,
                    backgroundColor: acc.color,
                  }}
                  title={`${acc.name}: ${formatBytes(acc.quota?.used || 0)}`}
                />
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Used: {formatBytes(aggregateStorage.used)}</span>
            <span>Free: {formatBytes(aggregateStorage.remaining)}</span>
          </div>

          {/* Recharts Usage Distribution Donut */}
          <SidebarStorageChart
            accounts={accounts}
            onOpenStatsModal={onOpenStatsModal}
          />
        </div>
      </div>
    </aside>
  );
};
