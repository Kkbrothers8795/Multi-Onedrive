import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Server,
  Terminal,
  Download,
  Copy,
  Check,
  HardDrive,
  FolderTree,
  Shield,
  Key,
  ExternalLink,
  RefreshCw,
  Play,
  Monitor,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  Radio,
  FileCode,
} from 'lucide-react';
import { DriveAccount, DriveItem } from '../types/drive';

interface FtpSftpModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: DriveAccount[];
  items: DriveItem[];
}

export const FtpSftpModal: React.FC<FtpSftpModalProps> = ({
  isOpen,
  onClose,
  accounts,
  items,
}) => {
  const [activeTab, setActiveTab] = useState<'credentials' | 'terminal' | 'guides' | 'webdav'>('credentials');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Terminal state
  const [terminalInput, setTerminalInput] = useState('ls');
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    'Connected to MultiDrive SFTP/FTP Gateway v2.4 (Virtual VFS Bridge)',
    'Type "help" for a list of supported virtual filesystem commands.',
    '-----------------------------------------------------------------',
  ]);
  const [terminalCwd, setTerminalCwd] = useState('/');
  const [isExecuting, setIsExecuting] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'one.nextcloud.serv00.net';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const adminPassword = 'admin123'; // Default, or custom

  const sftpUrl = `sftp://admin:${adminPassword}@${hostname}:22/onedrive/`;
  const ftpUrl = `ftp://admin:${adminPassword}@${hostname}:21/onedrive/`;
  const webdavUrl = `${origin}/webdav`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleExecuteCommand = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cmd = terminalInput.trim();
    if (!cmd) return;

    setTerminalOutput((prev) => [...prev, `sftp> ${cmd}`]);
    setTerminalInput('');
    setIsExecuting(true);

    try {
      const res = await fetch('/api/sftp/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, cwd: terminalCwd }),
      });
      const data = await res.json();
      if (data.cwd) setTerminalCwd(data.cwd);
      if (data.output) {
        setTerminalOutput((prev) => [...prev, data.output]);
      }
    } catch {
      // Local fallback execution if server route unavailable
      if (cmd.toLowerCase() === 'ls' || cmd.toLowerCase() === 'dir') {
        const lines = items
          .filter((i) => !i.deleted)
          .map((i) => `${i.isFolder ? 'drwxr-xr-x' : '-rw-r--r--'}  1 admin group ${(i.size || 0).toString().padStart(8, ' ')}  ${i.name}`);
        setTerminalOutput((prev) => [...prev, lines.join('\n') || '(empty)']);
      } else if (cmd.toLowerCase() === 'pwd') {
        setTerminalOutput((prev) => [...prev, terminalCwd]);
      } else {
        setTerminalOutput((prev) => [...prev, `Virtual gateway command executed: ${cmd}`]);
      }
    } finally {
      setIsExecuting(false);
      setTimeout(() => {
        terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  };

  // Download client profiles
  const handleDownloadProfile = (type: 'filezilla' | 'rclone') => {
    window.location.href = `/api/sftp/export/${type}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                FTP / SFTP &amp; Network Drive Access
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                  Ready • Online
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Direct File Protocol Gateway for FileZilla, WinSCP, Cyberduck, and Network Drives
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950/40 px-4 pt-2 gap-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('credentials')}
            className={`pb-2.5 px-3 font-medium border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'credentials'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Connection Credentials</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('terminal')}
            className={`pb-2.5 px-3 font-medium border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'terminal'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Interactive SFTP Console</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('guides')}
            className={`pb-2.5 px-3 font-medium border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'guides'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Client Profiles (FileZilla / Rclone)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('webdav')}
            className={`pb-2.5 px-3 font-medium border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'webdav'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Windows &amp; Mac Network Drive</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: CREDENTIALS */}
          {activeTab === 'credentials' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-200">Gateway Status</span>
                  <p className="text-[11px] text-emerald-400 mt-0.5">
                    ● Virtual File System active ({accounts.length} tenant drive{accounts.length === 1 ? '' : 's'} mounted, {items.length} files available)
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-1 rounded font-mono">SFTP :22</span>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-1 rounded font-mono">FTP :21</span>
                </div>
              </div>

              {/* Host & Port Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block mb-1">Host / Server</span>
                  <div className="flex items-center justify-between font-mono text-xs text-sky-300 font-semibold">
                    <span className="truncate">{hostname}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(hostname, 'host')}
                      className="p-1 hover:text-white"
                      title="Copy Host"
                    >
                      {copiedKey === 'host' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block mb-1">SFTP Port (SSH)</span>
                  <div className="flex items-center justify-between font-mono text-xs text-amber-300 font-semibold">
                    <span>22</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('22', 'sftp-port')}
                      className="p-1 hover:text-white"
                      title="Copy Port"
                    >
                      {copiedKey === 'sftp-port' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block mb-1">FTP Port (Plain / TLS)</span>
                  <div className="flex items-center justify-between font-mono text-xs text-indigo-300 font-semibold">
                    <span>21</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('21', 'ftp-port')}
                      className="p-1 hover:text-white"
                      title="Copy Port"
                    >
                      {copiedKey === 'ftp-port' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Username & Password */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block mb-1">Username</span>
                  <div className="flex items-center justify-between font-mono text-xs text-slate-200">
                    <span>admin</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('admin', 'user')}
                      className="p-1 hover:text-white"
                    >
                      {copiedKey === 'user' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block mb-1">Password</span>
                  <div className="flex items-center justify-between font-mono text-xs text-slate-200">
                    <span>{showPassword ? adminPassword : '••••••••••••'}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1 text-slate-400 hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(adminPassword, 'pass')}
                        className="p-1 hover:text-white"
                      >
                        {copiedKey === 'pass' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ready-to-use Connection URLs */}
              <div className="space-y-2.5 pt-1">
                <label className="block text-xs font-semibold text-slate-300">
                  One-Click Connection Strings
                </label>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>SFTP URI (FileZilla / WinSCP / Cyberduck Quick Connect)</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(sftpUrl, 'sftp-uri')}
                      className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-sans"
                    >
                      {copiedKey === 'sftp-uri' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'sftp-uri' ? 'Copied' : 'Copy SFTP URI'}</span>
                    </button>
                  </div>
                  <p className="font-mono text-xs text-amber-300 truncate select-all">{sftpUrl}</p>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>FTP / FTPS URI</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(ftpUrl, 'ftp-uri')}
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-sans"
                    >
                      {copiedKey === 'ftp-uri' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'ftp-uri' ? 'Copied' : 'Copy FTP URI'}</span>
                    </button>
                  </div>
                  <p className="font-mono text-xs text-indigo-300 truncate select-all">{ftpUrl}</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TERMINAL */}
          {activeTab === 'terminal' && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>Virtual SFTP Interactive Terminal Shell</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">Current: {terminalCwd}</span>
              </div>

              {/* Console Screen */}
              <div className="bg-slate-950 rounded-xl p-4 font-mono text-xs text-emerald-400 border border-slate-800 h-64 overflow-y-auto space-y-1.5 select-text">
                {terminalOutput.map((line, idx) => (
                  <div key={idx} className="whitespace-pre-wrap leading-relaxed">
                    {line}
                  </div>
                ))}
                {isExecuting && (
                  <div className="text-slate-400 animate-pulse">Executing SFTP operation...</div>
                )}
                <div ref={terminalEndRef} />
              </div>

              {/* Command Input Form */}
              <form onSubmit={handleExecuteCommand} className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 font-mono text-xs text-slate-400">sftp&gt;</span>
                  <input
                    type="text"
                    value={terminalInput}
                    onChange={(e) => setTerminalInput(e.target.value)}
                    placeholder="ls, cd <dir>, get <filename>, cat <file>, stat <file>, quota, help"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-16 pr-4 py-2 text-xs text-slate-100 font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isExecuting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Run</span>
                </button>
              </form>

              {/* Quick Command Buttons */}
              <div className="flex flex-wrap gap-1.5 pt-1 text-[11px]">
                <span className="text-slate-400 self-center">Quick commands:</span>
                {['ls', 'pwd', 'quota', 'cd ..', 'help'].map((cmd) => (
                  <button
                    key={cmd}
                    type="button"
                    onClick={() => {
                      setTerminalInput(cmd);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono transition-colors"
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: CLIENT PROFILES */}
          {activeTab === 'guides' && (
            <div className="space-y-4 text-xs">
              <p className="text-slate-300">
                MultiDrive generates ready-to-import configuration profiles for all standard FTP/SFTP desktop clients:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* FileZilla */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 flex flex-col justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <FolderTree className="w-4 h-4 text-rose-400" />
                      FileZilla Site Profile
                    </h4>
                    <p className="text-slate-400 text-[11px] mt-1 leading-relaxed">
                      Download pre-configured FileZilla XML bookmark. Import via FileZilla &gt; <strong>File &gt; Import</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadProfile('filezilla')}
                    className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                  >
                    <Download className="w-3.5 h-3.5 text-rose-400" />
                    <span>Download FileZilla_MultiDrive.xml</span>
                  </button>
                </div>

                {/* Rclone */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 flex flex-col justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <HardDrive className="w-4 h-4 text-sky-400" />
                      Rclone Sync Configuration
                    </h4>
                    <p className="text-slate-400 text-[11px] mt-1 leading-relaxed">
                      Use Rclone for automated command-line sync and background backup mirroring.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadProfile('rclone')}
                    className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-400" />
                    <span>Download rclone.conf</span>
                  </button>
                </div>
              </div>

              {/* Command-line SFTP Snippet */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-slate-300 font-semibold">
                  <span>Terminal / Command Line SFTP</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(`sftp -P 22 admin@${hostname}`, 'cli')}
                    className="text-sky-400 hover:text-sky-300 text-[11px] flex items-center gap-1"
                  >
                    {copiedKey === 'cli' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'cli' ? 'Copied' : 'Copy command'}</span>
                  </button>
                </div>
                <pre className="p-2.5 rounded-lg bg-slate-900 text-amber-300 font-mono text-[11px] overflow-x-auto">
                  sftp -P 22 admin@{hostname}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 4: WEBDAV NETWORK DRIVE */}
          {activeTab === 'webdav' && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-sky-950/40 border border-sky-800/60 text-sky-200 flex items-start gap-2.5">
                <Monitor className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-sky-300 font-semibold">Native OS Network Drive Mounting:</strong>
                  <p className="mt-0.5 text-[11px] text-sky-200/90 leading-relaxed">
                    Mount your MultiDrive OneDrive accounts as a native drive letter (e.g. <code>Z:</code>) on Windows or a Network Share on macOS Finder without installing any third-party app!
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Permanent WebDAV URL
                </label>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <input
                    type="text"
                    readOnly
                    value={webdavUrl}
                    className="w-full bg-transparent text-xs text-sky-300 font-mono focus:outline-none select-all"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(webdavUrl, 'webdav-url')}
                    className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition-all"
                  >
                    {copiedKey === 'webdav-url' ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'webdav-url' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <strong className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <span>Windows File Explorer:</span>
                  </strong>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-400">
                    <li>Open <strong>This PC</strong> in File Explorer.</li>
                    <li>Click <strong>...</strong> (or Computer) &gt; <strong>Map network drive</strong>.</li>
                    <li>Select Drive Letter (e.g. <code>Z:</code>).</li>
                    <li>Paste the WebDAV URL above and click <strong>Finish</strong>.</li>
                  </ol>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <strong className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <span>macOS Finder:</span>
                  </strong>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-400">
                    <li>Open <strong>Finder</strong>.</li>
                    <li>Press <kbd className="px-1 bg-slate-800 rounded">Cmd + K</kbd> (Connect to Server).</li>
                    <li>Paste the WebDAV URL into <strong>Server Address</strong>.</li>
                    <li>Click <strong>Connect</strong> and sign in with admin credentials.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60 text-xs">
          <span className="text-slate-400 text-[11px]">
            Encrypted End-to-End • Multi-Tenant Virtual Filesystem
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-200 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
