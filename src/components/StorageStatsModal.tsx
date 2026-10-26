import React, { useState } from 'react';
import {
  X,
  HardDrive,
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
  ShieldCheck,
  FolderOpen,
  FileCheck,
  CheckCircle2,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { DriveAccount, DriveItem } from '../types/drive';
import {
  formatBytes,
  getAccountStorageDistribution,
  calculateStorageByCategory,
} from '../utils/driveLogic';

interface StorageStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: DriveAccount[];
  items: DriveItem[];
  aggregateStorage: { total: number; used: number; remaining: number; percent: number };
}

export const StorageStatsModal: React.FC<StorageStatsModalProps> = ({
  isOpen,
  onClose,
  accounts,
  items,
  aggregateStorage,
}) => {
  const [activeView, setActiveView] = useState<'distribution' | 'comparison' | 'categories'>('distribution');

  if (!isOpen) return null;

  const accountSlices = getAccountStorageDistribution(accounts);
  const categorySlices = calculateStorageByCategory(items);

  // Heaviest account
  const heaviestAccount = [...accountSlices].sort((a, b) => b.usedBytes - a.usedBytes)[0];

  // Bar chart data in Gigabytes
  const GB = 1024 * 1024 * 1024;
  const barChartData = accounts.map((acc) => {
    const usedGB = parseFloat(((acc.quota?.used || 0) / GB).toFixed(1));
    const totalGB = parseFloat(((acc.quota?.total || 0) / GB).toFixed(1));
    const remainingGB = parseFloat((Math.max(0, totalGB - usedGB)).toFixed(1));

    return {
      name: acc.name.replace(/\s*\([^)]*\)/, ''), // Shorten name for chart axis
      fullName: acc.name,
      usedGB,
      remainingGB,
      totalGB,
      color: acc.color,
    };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
              <HardDrive className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <span>Cloud Storage Analytics & Distribution</span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
                  Recharts Analytics
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Cross-tenant quota consumption across {accounts.length} connected OneDrive for Business accounts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveView('distribution')}
                className={`px-3 py-1 rounded-lg transition-colors font-medium flex items-center gap-1.5 ${
                  activeView === 'distribution'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <PieIcon className="w-3.5 h-3.5" />
                <span>Distribution</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('comparison')}
                className={`px-3 py-1 rounded-lg transition-colors font-medium flex items-center gap-1.5 ${
                  activeView === 'comparison'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Comparison</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('categories')}
                className={`px-3 py-1 rounded-lg transition-colors font-medium flex items-center gap-1.5 ${
                  activeView === 'categories'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>File Types</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close stats modal"
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Total Cloud Quota</span>
              <p className="text-base font-bold text-slate-100 mt-0.5">
                {formatBytes(aggregateStorage.total)}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">{accounts.length} Drives Combined</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Total Consumed</span>
              <p className="text-base font-bold text-sky-400 mt-0.5">
                {formatBytes(aggregateStorage.used)}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">{aggregateStorage.percent}% allocated</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Available Headroom</span>
              <p className="text-base font-bold text-emerald-400 mt-0.5">
                {formatBytes(aggregateStorage.remaining)}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Free storage capacity</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Heaviest Drive</span>
              <p className="text-base font-bold text-slate-100 truncate mt-0.5" title={heaviestAccount?.name}>
                {heaviestAccount ? heaviestAccount.formattedUsed : '—'}
              </p>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">{heaviestAccount?.name || '—'}</p>
            </div>
          </div>

          {/* Active Chart View */}
          {activeView === 'distribution' && (
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                    Storage Usage Proportion by Account
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Visualizing consumption share across your connected OneDrive business drives
                  </p>
                </div>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-slate-750 p-3 rounded-xl shadow-2xl text-xs text-slate-200 space-y-1">
                              <div className="flex items-center gap-2 font-bold text-white">
                                <span
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: data.color }}
                                />
                                <span>{data.name}</span>
                              </div>
                              <p className="text-sky-300 font-mono">
                                Used: {data.formattedUsed} of {data.formattedTotal}
                              </p>
                              <p className="text-slate-400">
                                Share of Total Used: <strong className="text-white">{data.percentOfUsed}%</strong>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value, entry: any) => (
                        <span className="text-xs text-slate-300 font-medium mr-4">
                          {value}: <strong className="text-white">{entry.payload?.formattedUsed}</strong>
                        </span>
                      )}
                    />
                    <Pie
                      data={accountSlices}
                      cx="50%"
                      cy="45%"
                      innerRadius={65}
                      outerRadius={105}
                      paddingAngle={4}
                      dataKey="usedBytes"
                      nameKey="name"
                      stroke="#020617"
                      strokeWidth={3}
                    >
                      {accountSlices.map((entry, index) => (
                        <Cell key={`slice-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeView === 'comparison' && (
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  Used vs. Available Quota Comparison (in GB)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Side-by-side capacity breakdown per OneDrive for Business account
                </p>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="name"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      unit=" GB"
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-slate-750 p-3 rounded-xl shadow-2xl text-xs text-slate-200 space-y-1">
                              <p className="font-bold text-white">{item.fullName}</p>
                              <p className="text-sky-400">Used: {item.usedGB} GB</p>
                              <p className="text-emerald-400">Remaining: {item.remainingGB} GB</p>
                              <p className="text-slate-400 border-t border-slate-800 pt-1">
                                Total Quota: {item.totalGB} GB
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      formatter={(value) => (
                        <span className="text-xs text-slate-300 font-medium mr-4">
                          {value === 'usedGB' ? 'Used Storage (GB)' : 'Available Space (GB)'}
                        </span>
                      )}
                    />
                    <Bar dataKey="usedGB" name="usedGB" fill="#0284c7" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="remainingGB" name="remainingGB" fill="#10b981" opacity={0.6} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeView === 'categories' && (
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  Storage Consumption by File Category
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Aggregate volume consumed across all accounts categorized by file type
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900 border border-slate-750 p-2.5 rounded-lg text-xs text-slate-200">
                                <p className="font-semibold text-white">{data.name}</p>
                                <p className="text-sky-300 mt-0.5">{data.formatted} ({data.count} files)</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Pie
                        data={categorySlices}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="bytes"
                        nameKey="name"
                      >
                        {categorySlices.map((entry, index) => (
                          <Cell key={`cat-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2 flex flex-col justify-center">
                  {categorySlices.map((c) => (
                    <div
                      key={c.category}
                      className="p-2.5 rounded-xl bg-slate-900 border border-slate-850 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="font-medium text-slate-200">{c.name}</span>
                        <span className="text-[10px] text-slate-500">({c.count} files)</span>
                      </div>
                      <span className="font-mono text-slate-300 font-semibold">{c.formatted}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Account Breakdown Table */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Drive Account</th>
                  <th className="py-2.5 px-3">Used Storage</th>
                  <th className="py-2.5 px-3">Quota Limit</th>
                  <th className="py-2.5 px-3">Consumption Bar</th>
                  <th className="py-2.5 px-4 text-right">Quota Utilization</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {accountSlices.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-900/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: acc.color }}
                        />
                        <span className="font-semibold text-slate-200">{acc.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">{acc.formattedUsed}</td>
                    <td className="py-3 px-3 font-mono text-slate-400">{acc.formattedTotal}</td>
                    <td className="py-3 px-3 w-48">
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, acc.percentOfTotal)}%`,
                            backgroundColor: acc.color,
                          }}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-sky-400">
                      {acc.percentOfTotal}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Real-time storage telemetry synced across Microsoft 365 tenants</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-750 rounded-xl transition-colors"
          >
            Close Panel
          </button>
        </div>
      </div>
    </div>
  );
};
