import React from 'react';
import {
  Cloud,
  Search,
  SlidersHorizontal,
  RefreshCw,
  Plus,
  History,
  HardDrive,
  X,
  LogOut,
  Server,
  Activity,
  Database,
  Key,
  ShieldCheck,
  Menu,
} from 'lucide-react';
import { DriveAccount } from '../types/drive';
import { formatBytes } from '../utils/driveLogic';

interface NavbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedAccountId: string;
  onSelectAccount: (accId: string) => void;
  accounts: DriveAccount[];
  isAdvancedFilterOpen: boolean;
  onToggleAdvancedFilter: () => void;
  isSyncing: boolean;
  onManualSync: () => void;
  lastSyncedAt: string;
  onOpenConnectModal: () => void;
  onOpenActivityLog: () => void;
  onOpenStatsModal?: () => void;
  onOpenFtpSftpModal?: () => void;
  onOpenAnalytics?: () => void;
  onOpenBackupModal?: () => void;
  onOpenDatabaseModal?: () => void;
  onOpenChangePasswordModal?: () => void;
  onToggleMobileSidebar?: () => void;
  onLogout?: () => void;
  aggregateStorage: { total: number; used: number; remaining: number; percent: number };
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  onSearchChange,
  isAdvancedFilterOpen,
  onToggleAdvancedFilter,
  isSyncing,
  onManualSync,
  lastSyncedAt,
  onOpenConnectModal,
  onOpenActivityLog,
  onOpenStatsModal,
  onOpenFtpSftpModal,
  onOpenAnalytics,
  onOpenBackupModal,
  onOpenDatabaseModal,
  onOpenChangePasswordModal,
  onToggleMobileSidebar,
  onLogout,
  aggregateStorage,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full max-w-full overflow-x-hidden bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-3 sm:px-4 py-2.5">
      <div className="flex items-center justify-between gap-2 sm:gap-3 min-w-0 w-full">
        {/* Left: Mobile Drawer Toggle + Brand */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          {onToggleMobileSidebar && (
            <button
              type="button"
              onClick={onToggleMobileSidebar}
              aria-label="Toggle navigation sidebar"
              className="lg:hidden p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 transition-colors shrink-0"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white font-bold shrink-0">
            <Cloud className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-semibold text-slate-100 text-sm sm:text-base tracking-tight truncate">
                MultiDrive
              </span>
              <span className="hidden md:inline-block text-[10px] font-medium tracking-wide uppercase px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800 shrink-0">
                OneDrive Business
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden xl:block truncate">
              Unified Microsoft 365 Cloud Storage
            </p>
          </div>
        </div>

        {/* Global Multi-Account Search Input */}
        <div className="flex-1 min-w-0 max-w-xl relative">
          <div className="relative flex items-center min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              aria-label="Search all connected OneDrive accounts"
              placeholder="Search files & folders..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full min-w-0 bg-slate-950/80 text-xs sm:text-sm text-slate-200 placeholder-slate-500 pl-9 pr-16 sm:pr-24 py-2 rounded-xl border border-slate-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-10 sm:right-16 text-slate-400 hover:text-slate-200 p-1"
                aria-label="Clear search query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onToggleAdvancedFilter}
              aria-label="Toggle advanced filters"
              className={`absolute right-1.5 px-2 py-1 text-xs font-medium rounded-lg flex items-center gap-1 transition-colors ${
                isAdvancedFilterOpen
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filters</span>
            </button>
          </div>
        </div>

        {/* Right Action Tools: Sync, Quota, Database, Connect */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Real-time Sync Status & Trigger */}
          <div className="hidden xl:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-750 text-xs">
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isSyncing ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
              ></span>
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isSyncing ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
              ></span>
            </span>
            <span className="text-slate-300 font-medium">
              {isSyncing ? 'Syncing...' : 'Live Sync'}
            </span>
            <button
              type="button"
              onClick={onManualSync}
              disabled={isSyncing}
              aria-label="Synchronize OneDrive files now"
              title={`Last synced: ${new Date(lastSyncedAt).toLocaleTimeString()}`}
              className="text-slate-400 hover:text-sky-400 disabled:opacity-50 transition-transform active:rotate-180 p-0.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-sky-400' : ''}`} />
            </button>
          </div>

          {/* Combined Quota Meter Pill */}
          <button
            type="button"
            onClick={onOpenStatsModal}
            title="Click to view detailed storage analytics & Recharts distribution"
            className="hidden 2xl:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 transition-colors cursor-pointer"
          >
            <HardDrive className="w-3.5 h-3.5 text-sky-400" />
            <span>
              <strong className="text-white font-semibold">{formatBytes(aggregateStorage.used)}</strong> /{' '}
              {formatBytes(aggregateStorage.total)}
            </span>
          </button>

          {/* High-Speed Database & Secure Access Engine Trigger */}
          {onOpenDatabaseModal && (
            <button
              type="button"
              onClick={onOpenDatabaseModal}
              aria-label="Open Database & Security Engine"
              title="High-Speed Database (SQLite WAL / Redis / Firebase) & Secure Access Vault"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all shadow-sm"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Database</span>
            </button>
          )}

          {/* FTP & SFTP Gateway Trigger */}
          {onOpenFtpSftpModal && (
            <button
              type="button"
              onClick={onOpenFtpSftpModal}
              aria-label="FTP / SFTP and Network Drive Settings"
              title="FTP / SFTP & Network Drive Gateway"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold transition-all shadow-sm"
            >
              <Server className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden lg:inline">FTP / SFTP</span>
            </button>
          )}

          {/* Analytics Dashboard Trigger */}
          {onOpenAnalytics && (
            <button
              type="button"
              onClick={onOpenAnalytics}
              aria-label="View Bandwidth & Access Analytics"
              title="Bandwidth & Access Analytics"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-semibold transition-all shadow-sm"
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden xl:inline">Analytics</span>
            </button>
          )}

          {/* Backup & Restore Store Trigger */}
          {onOpenBackupModal && (
            <button
              type="button"
              onClick={onOpenBackupModal}
              aria-label="Backup or Restore Installation"
              title="Backup & Restore (server-store.json)"
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-semibold transition-all shadow-sm"
            >
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden 2xl:inline">Backup</span>
            </button>
          )}

          {/* Activity Log Trigger */}
          <button
            type="button"
            onClick={onOpenActivityLog}
            aria-label="View activity and audit log"
            title="Activity & Sync Log"
            className="hidden sm:flex p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
          >
            <History className="w-4 h-4" />
          </button>

          {/* Connect Account CTA */}
          <button
            type="button"
            onClick={onOpenConnectModal}
            aria-label="Connect another OneDrive for Business account"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-sky-600/20 transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Connect</span>
          </button>

          {/* Admin Change Password */}
          {onOpenChangePasswordModal && (
            <button
              type="button"
              onClick={onOpenChangePasswordModal}
              aria-label="Change administrator password"
              title="Change Admin Password"
              className="hidden md:flex items-center gap-1.5 p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-all shadow-sm"
            >
              <Key className="w-3.5 h-3.5 text-sky-400" />
            </button>
          )}

          {/* Admin Logout */}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              aria-label="Log out of admin session"
              title="Log out (Switch to Protected Mode)"
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

