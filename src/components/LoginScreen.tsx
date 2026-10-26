import React, { useState } from 'react';
import {
  Cloud,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface LoginScreenProps {
  onLogin: (password: string) => Promise<boolean>;
  onBypassAsGuest?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setIsLoading(true);
    setError(null);

    try {
      const success = await onLogin(password);
      if (!success) {
        setError('Incorrect administrator password. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check server connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 selection:bg-sky-500/30">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-600 flex items-center justify-center mx-auto shadow-xl shadow-sky-500/20 mb-3 text-white">
            <Cloud className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">MultiDrive for OneDrive Business</h1>
          <p className="text-xs text-slate-400 mt-1">Unified Multi-Account Enterprise File Hub</p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <ShieldCheck className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-slate-200">Administrator Access Required</h2>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Only authorized personnel can view connected drives, manage files, and sync accounts. Public download links remain accessible to everyone without logging in.
          </p>

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-xs text-rose-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Admin Password</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoFocus
                  placeholder="Enter administrator password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 text-xs text-slate-100 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !password}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-sky-600/25 flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50"
            >
              <span>{isLoading ? 'Verifying...' : 'Sign In as Administrator'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Info & Default Password Hint */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start gap-2.5 text-[11px] text-slate-400">
              <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <p>
                  Default password: <code className="text-sky-300 font-mono font-semibold">admin123</code>
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  You can change this password inside the dashboard or via <code className="text-slate-300">ADMIN_PASSWORD</code> environment variable in Vercel.
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-6 flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>Public download links work without logging in</span>
        </p>
      </div>
    </div>
  );
};
