import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  Shield,
  Key,
  Copy,
  Check,
  ExternalLink,
  Plus,
  Trash2,
  AlertTriangle,
  Sparkles,
  Building,
  CheckCircle2,
} from 'lucide-react';
import { DriveAccount } from '../types/drive';
import { MicrosoftGraphService } from '../services/microsoftGraph';
import { extractErrorMessage } from '../utils/formatError';

interface ConnectAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: DriveAccount[];
  onAddAccount: (account: DriveAccount) => void;
  onRemoveAccount: (accountId: string) => void;
  onClearAllDemoAccounts?: () => void;
}

export const ConnectAccountModal: React.FC<ConnectAccountModalProps> = ({
  isOpen,
  onClose,
  accounts,
  onAddAccount,
  onRemoveAccount,
  onClearAllDemoAccounts,
}) => {
  const [activeTab, setActiveTab] = useState<'oauth' | 'manage'>('oauth');
  const [clientId, setClientId] = useState('');
  const [tenantId, setTenantId] = useState('common');
  const [clientSecret, setClientSecret] = useState('');
  const [accountName, setAccountName] = useState('');
  const [color, setColor] = useState('#0284c7');
  const [copiedUri, setCopiedUri] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Exact callback URL based on environment
  const redirectUri = typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback`
    : 'https://ais-dev-dvc2cvhrcuguyy57g7c6rv-186422582482.asia-east1.run.app/auth/callback';

  const copyRedirectUri = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 2000);
  };

  // Listen for OAuth postMessage from popup
  useEffect(() => {
    const handleAuthMessage = async (event: MessageEvent) => {
      // Validate origin
      if (
        event.origin !== window.location.origin &&
        !event.origin.endsWith('.run.app') &&
        !event.origin.includes('localhost') &&
        !event.origin.includes('127.0.0.1')
      ) {
        return;
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const { code } = event.data;
        if (!code) return;

        setIsConnecting(true);
        setAuthError(null);

        try {
          // Exchange code for token with backend
          const tokenRes = await fetch('/api/auth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code,
              clientId: clientId.trim() || undefined,
              clientSecret: clientSecret.trim() || undefined,
              tenant: tenantId.trim() || 'common',
              redirectUri,
            }),
          });

          const tokenData = await tokenRes.json().catch(() => null);
          if (!tokenRes.ok || !tokenData) {
            const errorMsg = extractErrorMessage(
              tokenData,
              `Token exchange failed with status ${tokenRes.status}`
            );
            throw new Error(errorMsg);
          }

          const accessToken = tokenData.access_token;
          const refreshToken = tokenData.refresh_token;

          if (!accessToken) {
            throw new Error(
              extractErrorMessage(tokenData, 'Microsoft did not return an access token')
            );
          }

          // Fetch user profile and drive quota from Microsoft Graph
          const profile = await MicrosoftGraphService.getUserProfile(accessToken);
          const quota = await MicrosoftGraphService.getDriveQuota(accessToken);

          const newAccount: DriveAccount = {
            id: `acc-live-${Date.now()}`,
            name: accountName.trim() || `${profile.displayName} (OneDrive Business)`,
            email: profile.mail || profile.userPrincipalName,
            tenantName: tenantId !== 'common' ? tenantId : 'microsoft.com',
            accountType: 'business',
            color: color || '#0284c7',
            isLive: true,
            clientId: clientId.trim(),
            tenantId: tenantId.trim(),
            accessToken,
            refreshToken,
            expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
            quota: {
              total: quota.total,
              used: quota.used,
              remaining: quota.remaining,
              state: quota.state,
            },
            connectedAt: new Date().toISOString(),
          };

          onAddAccount(newAccount);
          onClose();
        } catch (err: any) {
          console.error('Account connection failed:', err);
          setAuthError(extractErrorMessage(err, 'Failed to complete OAuth authentication'));
        } finally {
          setIsConnecting(false);
        }
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        const errorMsg = extractErrorMessage(
          event.data.errorDescription || event.data.error,
          'Authentication was cancelled or rejected by Microsoft'
        );
        setAuthError(errorMsg);
        setIsConnecting(false);
      }
    };

    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, [clientId, clientSecret, tenantId, accountName, color, redirectUri, onAddAccount, onClose]);

  // Initiate real OAuth popup
  const handleConnectWithMicrosoft = async () => {
    setAuthError(null);
    try {
      const activeClientId = clientId.trim() || 'c7e8e527-3932-4467-8451-b06bd9e013bf'; // default multi-tenant client ID fallback
      const activeTenant = tenantId.trim() || 'common';
      const state = `oauth_state_${Date.now()}`;
      const scopes = 'User.Read Files.ReadWrite.All offline_access Sites.ReadWrite.All';

      const authUrl = `https://login.microsoftonline.com/${activeTenant}/oauth2/v2.0/authorize?` +
        new URLSearchParams({
          client_id: activeClientId,
          response_type: 'code',
          redirect_uri: redirectUri,
          response_mode: 'query',
          scope: scopes,
          state: state,
          prompt: 'select_account',
        }).toString();

      const popup = window.open(
        authUrl,
        'microsoft_oauth_popup',
        'width=600,height=720,status=no,resizable=yes'
      );

      if (!popup) {
        setAuthError('Popup was blocked by your browser. Please allow popups for this site.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Could not open Microsoft sign-in window');
    }
  };

  // Add interactive enterprise demo sandbox account
  const handleAddDemoAccount = (orgName: string, email: string, colorHex: string) => {
    const newDemoAccount: DriveAccount = {
      id: `acc-demo-${Date.now()}`,
      name: `${orgName} (OneDrive for Business)`,
      email,
      tenantName: `${orgName.toLowerCase().replace(/\s+/g, '')}.onmicrosoft.com`,
      accountType: 'business',
      color: colorHex,
      isLive: false,
      quota: {
        total: 1099511627776, // 1 TB
        used: 214748364800, // 200 GB
        remaining: 884763262976,
        state: 'normal',
      },
      connectedAt: new Date().toISOString(),
    };

    onAddAccount(newDemoAccount);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
              <Cloud className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                Connect OneDrive for Business
              </h2>
              <p className="text-xs text-slate-400">
                Microsoft Graph API & OAuth 2.0 Multi-Account Manager
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('oauth')}
                className={`px-3 py-1 rounded-lg transition-colors font-medium ${
                  activeTab === 'oauth'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Connect New
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('manage')}
                className={`px-3 py-1 rounded-lg transition-colors font-medium ${
                  activeTab === 'manage'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Manage ({accounts.length})
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'oauth' ? (
            <div className="space-y-5">
              {/* Azure AD App Registration Instructions Card */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-sky-400">
                  <span className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    Microsoft Azure Entra ID OAuth 2.0 Setup
                  </span>
                  <a
                    href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-sky-400 hover:underline flex items-center gap-1"
                  >
                    <span>Azure Portal</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Register your app in Azure Portal under <strong>App Registrations</strong> with <strong>Web</strong> platform. Add this exact Redirect URI to your app settings:
                </p>

                {/* Redirect URI with 1-click Copy */}
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-sky-300">
                  <span className="truncate">{redirectUri}</span>
                  <button
                    type="button"
                    onClick={copyRedirectUri}
                    className="shrink-0 flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
                  >
                    {copiedUri ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedUri ? 'Copied' : 'Copy URI'}</span>
                  </button>
                </div>

                <div className="text-[11px] text-slate-400">
                  Required Microsoft Graph Delegated Permissions: <code className="text-slate-300">Files.ReadWrite.All</code>, <code className="text-slate-300">User.Read</code>, <code className="text-slate-300">offline_access</code>.
                </div>
              </div>

              {authError && (
                <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-800 text-xs text-rose-200 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                    <div className="flex-1 break-words">
                      <strong className="font-semibold text-rose-300">Authentication Error:</strong>
                      <p className="mt-1 leading-relaxed font-mono text-[11px] bg-black/40 p-2 rounded-lg border border-rose-900/60 select-all">
                        {extractErrorMessage(authError)}
                      </p>
                    </div>
                  </div>

                  {(authError.includes('AADSTS50011') || authError.toLowerCase().includes('redirect_uri')) && (
                    <div className="p-2.5 rounded-lg bg-sky-950/70 border border-sky-800/80 text-[11px] text-sky-200 space-y-1">
                      <p className="font-semibold text-sky-300">Redirect URI Mismatch Fix (AADSTS50011):</p>
                      <p className="text-slate-300">
                        In Azure Portal &gt; App registrations &gt; your app &gt; <strong>Authentication</strong>, add this exact Web Redirect URI:
                      </p>
                      <div className="flex items-center justify-between gap-2 font-mono text-sky-300 bg-slate-900 px-2 py-1 rounded border border-slate-700">
                        <span className="truncate">{redirectUri}</span>
                        <button
                          type="button"
                          onClick={copyRedirectUri}
                          className="text-xs px-2 py-0.5 rounded bg-sky-800 hover:bg-sky-700 text-white shrink-0"
                        >
                          {copiedUri ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  )}

                  {(authError.includes('AADSTS7000215') || authError.toLowerCase().includes('client_secret')) && (
                    <div className="p-2.5 rounded-lg bg-amber-950/70 border border-amber-800/80 text-[11px] text-amber-200">
                      <strong className="text-amber-300">Client Secret Fix:</strong>
                      <p className="mt-0.5 text-slate-300">
                        In Azure Portal &gt; App registrations &gt; <strong>Certificates &amp; secrets</strong>, generate a new Client Secret Value and paste it into the Client Secret field below.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* OAuth Credentials Form */}
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Azure Client ID (Application ID)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 00000000-0000-0000-0000-000000000000"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      className="w-full bg-slate-950 text-xs text-slate-200 border border-slate-800 rounded-xl px-3 py-2 focus:border-sky-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Tenant ID
                    </label>
                    <input
                      type="text"
                      placeholder="common or your-tenant-guid"
                      value={tenantId}
                      onChange={(e) => setTenantId(e.target.value)}
                      className="w-full bg-slate-950 text-xs text-slate-200 border border-slate-800 rounded-xl px-3 py-2 focus:border-sky-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Account Label (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Acme Corp OneDrive"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      className="w-full bg-slate-950 text-xs text-slate-200 border border-slate-800 rounded-xl px-3 py-2 focus:border-sky-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Account Badge Color
                    </label>
                    <div className="flex items-center gap-2">
                      {['#0284c7', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setColor(c)}
                          style={{ backgroundColor: c }}
                          className={`w-6 h-6 rounded-full border-2 transition-transform ${
                            color === c ? 'border-white scale-110' : 'border-transparent opacity-80'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Microsoft OAuth Sign In Action */}
              <button
                type="button"
                onClick={handleConnectWithMicrosoft}
                disabled={isConnecting}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-sky-600/25 flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50"
              >
                <Cloud className="w-4 h-4" />
                <span>
                  {isConnecting ? 'Waiting for Microsoft Authentication...' : 'Sign in with Microsoft (OAuth 2.0)'}
                </span>
              </button>

              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800"></div>
                </div>
                <span className="relative px-3 bg-slate-900 text-slate-500 text-[11px] uppercase font-semibold">
                  Or Instantly Add Enterprise Sandbox
                </span>
              </div>

              {/* Quick Demo Pre-configured Business Accounts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    handleAddDemoAccount('Microsoft Cloud Partner', 'partner.alex@microsoftcloud.com', '#06b6d4')
                  }
                  className="p-3 text-left rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-sky-500/50 transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                    <p className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300">
                      + Microsoft Partner Tenant
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">1 TB E5 Enterprise Storage Sandbox</p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleAddDemoAccount('Stark Industries Cloud', 'tony@starkindustries.onmicrosoft.com', '#ec4899')
                  }
                  className="p-3 text-left rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-pink-500/50 transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-pink-400"></span>
                    <p className="text-xs font-semibold text-slate-200 group-hover:text-pink-300">
                      + Stark Aerospace Cloud
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">1 TB Business Premium Sandbox</p>
                </button>
              </div>
            </div>
          ) : (
            /* Manage Existing Accounts Tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{accounts.length} Connected OneDrive for Business Account{accounts.length === 1 ? '' : 's'}</span>
                {onClearAllDemoAccounts && accounts.some((a) => !a.isLive) && (
                  <button
                    type="button"
                    onClick={onClearAllDemoAccounts}
                    className="text-[11px] text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear All Demo Accounts</span>
                  </button>
                )}
              </div>

              {accounts.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs">
                  <p>No OneDrive accounts connected.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('oauth')}
                    className="mt-2 text-sky-400 hover:underline font-medium"
                  >
                    + Connect a Live Microsoft 365 Account
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {accounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: acc.color }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-slate-200 truncate">{acc.name}</p>
                            {acc.isLive ? (
                              <span className="text-[9px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.2 rounded">
                                Live Graph API
                              </span>
                            ) : (
                              <span className="text-[9px] font-semibold bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded">
                                Demo Showcase
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">{acc.email}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onRemoveAccount(acc.id)}
                        title="Disconnect this account"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
