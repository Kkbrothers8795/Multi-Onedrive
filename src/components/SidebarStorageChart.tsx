import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { DriveAccount } from '../types/drive';
import { formatBytes, getAccountStorageDistribution } from '../utils/driveLogic';
import { BarChart3, ChevronRight } from 'lucide-react';

interface SidebarStorageChartProps {
  accounts: DriveAccount[];
  onOpenStatsModal: () => void;
}

export const SidebarStorageChart: React.FC<SidebarStorageChartProps> = ({
  accounts,
  onOpenStatsModal,
}) => {
  const slices = getAccountStorageDistribution(accounts);
  const totalUsed = slices.reduce((acc, s) => acc + s.usedBytes, 0);

  if (accounts.length === 0 || totalUsed === 0) {
    return null;
  }

  // Format data for Recharts Pie
  const chartData = slices.map((s) => ({
    name: s.name,
    value: s.usedBytes,
    color: s.color,
    formatted: s.formattedUsed,
    percent: s.percentOfUsed,
  }));

  return (
    <div className="mt-3 pt-3 border-t border-slate-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
          <BarChart3 className="w-3.5 h-3.5 text-sky-400" />
          <span>Storage Breakdown</span>
        </span>
        <button
          type="button"
          onClick={onOpenStatsModal}
          className="text-[11px] font-medium text-sky-400 hover:text-sky-300 flex items-center gap-0.5 hover:underline"
          title="Open detailed storage analytics"
        >
          <span>Analytics</span>
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Recharts Mini Donut Chart */}
      <div className="h-28 w-full relative flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-slate-950 border border-slate-800 p-2 rounded-lg shadow-xl text-[11px] text-slate-200">
                      <div className="flex items-center gap-1.5 font-semibold text-white">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: data.color }}
                        />
                        <span className="truncate max-w-[130px]">{data.name}</span>
                      </div>
                      <p className="mt-1 text-slate-400">
                        {data.formatted} ({data.percent}% of used)
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={28}
              outerRadius={46}
              paddingAngle={3}
              dataKey="value"
              stroke="#0f172a"
              strokeWidth={2}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] font-bold text-slate-100">{formatBytes(totalUsed)}</span>
          <span className="text-[9px] text-slate-400 uppercase tracking-tighter">Total Used</span>
        </div>
      </div>

      {/* Micro Legend */}
      <div className="space-y-1 mt-1">
        {slices.slice(0, 3).map((s) => (
          <div key={s.id} className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1.5 min-w-0 max-w-[120px]">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-slate-300 truncate">{s.name}</span>
            </div>
            <span className="text-slate-400 font-mono">{s.formattedUsed} ({s.percentOfUsed}%)</span>
          </div>
        ))}
        {slices.length > 3 && (
          <p className="text-[9px] text-slate-500 text-right">+{slices.length - 3} more accounts</p>
        )}
      </div>
    </div>
  );
};
