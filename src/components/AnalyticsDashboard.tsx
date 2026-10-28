import React, { useState, useEffect } from 'react';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Clock,
  Download,
  FileText,
  Globe2,
  HardDrive,
  RefreshCw,
  RotateCcw,
  Shield,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import { AnalyticsSummary, VisitorLog, TopFileStat } from '../types/drive';
import { formatBytes } from '../utils/driveLogic';
import { FileIcon } from './FileIcon';

interface AnalyticsDashboardProps {
  onOpenFile?: (fileId: string) => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = () => {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartMetric, setChartMetric] = useState<'bandwidth' | 'downloads'>('bandwidth');
  const [isResetting, setIsResetting] = useState(false);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/analytics/summary');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load analytics summary:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 8000);
    const onFocus = () => fetchAnalytics();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset all bandwidth and download analytics? This will clear visitor logs and download counts.')) {
      return;
    }
    setIsResetting(true);
    try {
      await fetch('/api/analytics/reset', { method: 'POST' });
      await fetchAnalytics();
    } finally {
      setIsResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Loading bandwidth and traffic analytics...</p>
        </div>
      </div>
    );
  }

  const chartData = (data?.dailyBandwidth || []).map((d) => ({
    date: d.date.slice(5), // MM-DD
    mb: Number((d.bytes / (1024 * 1024)).toFixed(1)),
    downloads: d.downloads,
    fullDate: d.date,
  }));

  // Geographic calculations
  const countryCounts: Record<string, { count: number; code: string; flag: string }> = {};
  const flagMap: Record<string, string> = {
    US: '🇺🇸',
    GB: '🇬🇧',
    DE: '🇩🇪',
    JP: '🇯🇵',
    CA: '🇨🇦',
    SG: '🇸🇬',
    IN: '🇮🇳',
    AU: '🇦🇺',
    FR: '🇫🇷',
    BR: '🇧🇷',
  };

  for (const log of data?.recentLogs || []) {
    const code = log.countryCode || 'US';
    if (!countryCounts[log.country]) {
      countryCounts[log.country] = {
        count: 0,
        code,
        flag: flagMap[code] || '🌐',
      };
    }
    countryCounts[log.country].count++;
  }

  const sortedCountries = Object.entries(countryCounts)
    .map(([country, info]) => ({
      country,
      ...info,
      percent: Math.round((info.count / Math.max(1, data?.recentLogs?.length || 1)) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto max-w-7xl mx-auto w-full">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Activity className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-100">Bandwidth &amp; Access Analytics</h1>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              Live Stream Engine
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time telemetry for public link downloads, server bandwidth consumption, and global visitor reach.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Updating...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={isResetting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-300 text-xs font-semibold border border-slate-800 hover:border-rose-800/60 transition-colors shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Stats</span>
          </button>
        </div>
      </div>

      {/* 4 Core Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Downloads */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Total File Downloads</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
              <Download className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-100 font-mono">
              {(data?.totalDownloads || 0).toLocaleString()}
            </span>
            <span className="text-xs text-emerald-400 font-semibold flex items-center">
              <ArrowUpRight className="w-3.5 h-3.5" /> +14%
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Lifetime files streamed through site</p>
        </div>

        {/* Total Bandwidth */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Bandwidth Consumed</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-100 font-mono">
              {formatBytes(data?.totalBytesServed || 0)}
            </span>
            <span className="text-xs text-indigo-400 font-semibold">Direct Proxy</span>
          </div>
          <p className="text-[11px] text-slate-400">Data streamed without Microsoft rate-limits</p>
        </div>

        {/* Unique Visitors */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Unique Client IPs</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-100 font-mono">
              {(data?.uniqueVisitors || 0).toLocaleString()}
            </span>
            <span className="text-xs text-emerald-400 font-semibold">Active</span>
          </div>
          <p className="text-[11px] text-slate-400">Distinct external IP addresses</p>
        </div>

        {/* Top Country */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Top Traffic Origin</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Globe2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-slate-100 truncate">
              {data?.topCountry || 'United States'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Leading geographical region</p>
        </div>
      </div>

      {/* Main Charts & Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Bandwidth / Download Timeline Chart */}
        <div className="lg:col-span-2 p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sky-400" />
                14-Day Traffic &amp; Bandwidth Volume
              </h3>
              <p className="text-[11px] text-slate-400">Daily breakdown of outbound file streams</p>
            </div>

            {/* Metric Toggle */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setChartMetric('bandwidth')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  chartMetric === 'bandwidth'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Bandwidth (MB)
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('downloads')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  chartMetric === 'downloads'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Downloads
              </button>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartMetric === 'bandwidth' ? (
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="bandwidthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => [`${val} MB`, 'Bandwidth Served']}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
                  />
                  <Area
                    type="monotone"
                    dataKey="mb"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#bandwidthGrad)"
                  />
                </AreaChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => [`${val} files`, 'Downloads']}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
                  />
                  <Bar dataKey="downloads" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Geographic Distribution Card */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-lg space-y-4 flex flex-col">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-emerald-400" />
              Visitor Geolocation
            </h3>
            <p className="text-[11px] text-slate-400">Origin countries for download requests</p>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-64 pr-1">
            {sortedCountries.length > 0 ? (
              sortedCountries.map((c) => (
                <div key={c.country} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-slate-200">
                      <span className="text-base">{c.flag}</span>
                      <span className="font-medium truncate">{c.country}</span>
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {c.count} reqs ({c.percent}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-sky-500 h-full rounded-full"
                      style={{ width: `${Math.max(5, c.percent)}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 text-center py-8">No visitor logs recorded yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Top Downloaded Files Leaderboard */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky-400" />
              Most Downloaded Files
            </h3>
            <p className="text-[11px] text-slate-400">Highest volume public downloads across all connected OneDrive accounts</p>
          </div>
          <span className="text-xs text-slate-400 font-mono font-medium">
            Top {data?.topFiles?.length || 0} Files
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px]">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">File Name</th>
                <th className="py-2.5 px-3">Source Account</th>
                <th className="py-2.5 px-3 text-right">Downloads</th>
                <th className="py-2.5 px-3 text-right">Bandwidth Served</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {(data?.topFiles || []).map((file, idx) => (
                <tr key={file.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-slate-400 text-xs">{idx + 1}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <FileIcon type={file.fileType} size={18} />
                      <span className="font-medium text-slate-200 truncate max-w-xs">{file.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">{file.accountName}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-400">
                    {file.downloads.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                    {formatBytes(file.bytes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Access Event Logs */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              Live Access Event Stream
            </h3>
            <p className="text-[11px] text-slate-400">Real-time log of incoming file download requests</p>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Last 50 Events</span>
        </div>

        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-2 px-3">Timestamp</th>
                <th className="py-2 px-3">File</th>
                <th className="py-2 px-3">Location</th>
                <th className="py-2 px-3">IP Address</th>
                <th className="py-2 px-3">Client User-Agent</th>
                <th className="py-2 px-3 text-right">Bytes</th>
                <th className="py-2 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 font-mono text-[11px]">
              {(data?.recentLogs || []).map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/30">
                  <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="py-2 px-3 font-sans font-medium text-slate-200 truncate max-w-[200px]" title={log.fileName}>
                    {log.fileName}
                  </td>
                  <td className="py-2 px-3 font-sans text-slate-300 whitespace-nowrap">
                    {log.city ? `${log.city}, ${log.country}` : log.country}
                  </td>
                  <td className="py-2 px-3 text-sky-400/90 whitespace-nowrap">{log.ip}</td>
                  <td className="py-2 px-3 text-slate-500 font-sans text-[10px] truncate max-w-[200px]" title={log.userAgent}>
                    {log.userAgent}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-300 font-mono whitespace-nowrap">
                    {formatBytes(log.bytes)}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      200 OK
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
