/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  INITIAL_ACCOUNTS,
  INITIAL_ITEMS,
} from './data/seedDrives';
import {
  DriveAccount,
  DriveItem,
  FileCategory,
  ViewMode,
  SortField,
  SortOrder,
  NavigationFilter,
  DateFilterOption,
  SizeFilterOption,
  ActivityLogEntry,
  UploadTransferItem,
} from './types/drive';
import {
  filterItems,
  sortItems,
  calculateAggregateStorage,
  buildBreadcrumbs,
  batchDeleteItems,
  batchRestoreItems,
  batchPermanentDeleteItems,
  batchMoveItems,
  getFileCategory,
  findBestAccountForUpload,
  formatBytes,
} from './utils/driveLogic';
import { downloadSingleFile, downloadItemsAsZip } from './utils/fileDownloader';
import { MicrosoftGraphService } from './services/microsoftGraph';

// UI Components
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { AdvancedSearchFilterBar } from './components/AdvancedSearchFilterBar';
import { ActionBar } from './components/ActionBar';
import { FileGrid } from './components/FileGrid';
import { FileList } from './components/FileList';
import { FilePreviewModal } from './components/FilePreviewModal';
import { ConnectAccountModal } from './components/ConnectAccountModal';
import { NewFolderModal } from './components/NewFolderModal';
import { RenameModal } from './components/RenameModal';
import { MoveModal } from './components/MoveModal';
import { ShareModal } from './components/ShareModal';
import { ActivityLogDrawer } from './components/ActivityLogDrawer';
import { StorageStatsModal } from './components/StorageStatsModal';
import { FtpSftpModal } from './components/FtpSftpModal';
import { CloudMigrationModal } from './components/CloudMigrationModal';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { BackupModal } from './components/BackupModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { UploadProgressModal } from './components/UploadProgressModal';
import { DuplicateFinderModal } from './components/DuplicateFinderModal';
import { FileRequestModal } from './components/FileRequestModal';
import { PublicFileRequestView } from './components/PublicFileRequestView';
import { WebhookAlertsModal } from './components/WebhookAlertsModal';
import { DatabaseSecurityModal } from './components/DatabaseSecurityModal';
import { VercelTelemetry } from './components/VercelTelemetry';
import { LoginScreen } from './components/LoginScreen';
import { PublicDownloadView } from './components/PublicDownloadView';
import { parseDetailedError, extractErrorMessage } from './utils/formatError';
import {
  FolderOpen,
  Upload,
  Cloud,
  CheckCircle2,
  AlertCircle,
  FileSearch,
  Sparkles,
  Plus,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
  Database,
  ChevronDown,
  ChevronUp,
  X,
  Server,
  Copy,
  Check,
} from 'lucide-react';

function normalizeLoadedAccount(a: DriveAccount): DriveAccount {
  const anyAcc = a as any;
  const accessToken = a.accessToken || anyAcc.access_token || '';
  const refreshToken = a.refreshToken || anyAcc.refresh_token || '';
  const hasTokens = Boolean(accessToken || refreshToken);
  const claims = MicrosoftGraphService.extractJwtClaims(accessToken);
  return {
    ...a,
    isLive: Boolean(a.isLive || hasTokens),
    accessToken: accessToken || a.accessToken,
    refreshToken: refreshToken || a.refreshToken,
    clientId: a.clientId || anyAcc.client_id || claims.appId || undefined,
    tenantId: a.tenantId || anyAcc.tenant_id || claims.tenantId || undefined,
    needsReauth: false,
    syncStatus: 'synced',
    authError: undefined,
  };
}

export default function App() {
  // 1. Check for public direct download/share links (?download=FILE_ID or ?share=FILE_ID)
  // or Public File Request Dropzone links (?request=REQ_ID)
  // Public links do NOT require login.
  const [publicFileId, setPublicFileId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('download') || params.get('share');
  });

  const [publicRequestId, setPublicRequestId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('request');
  });

  // 2. Admin Authentication state (required to view or manage drive files)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  // 3. Demo Dismissed Flag: Prevents demo accounts from resurrecting after user clears cache
  const [isDemoDismissed, setIsDemoDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('onedrive_multidrive_demo_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  // Guard to prevent client from overwriting server data before GET /api/storage/data resolves
  const isStoreLoaded = useRef<boolean>(false);

  // 4. Persistence state: respects isDemoDismissed and server storage so accounts never vanish on cache wipe
  const [accounts, setAccounts] = useState<DriveAccount[]>(() => {
    try {
      const dismissed = localStorage.getItem('onedrive_multidrive_demo_dismissed') === 'true';
      const saved = localStorage.getItem('onedrive_multidrive_accounts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized = parsed.map((a: DriveAccount) => normalizeLoadedAccount(a));
          const filtered = dismissed ? normalized.filter((a: DriveAccount) => a.isLive) : normalized;
          return filtered.length > 0 ? filtered : normalized;
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  const [items, setItems] = useState<DriveItem[]>(() => {
    try {
      const dismissed = localStorage.getItem('onedrive_multidrive_demo_dismissed') === 'true';
      if (dismissed) return [];
      const saved = localStorage.getItem('onedrive_multidrive_items');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem('onedrive_multidrive_activity');
      return saved ? JSON.parse(saved) : [
        {
          id: 'log-1',
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          action: 'sync',
          itemName: 'All Connected Drives',
          accountId: 'all',
          accountName: 'Unified System',
          details: 'Real-time delta sync initialized for unified OneDrive accounts',
        },
      ];
    } catch {
      return [];
    }
  });

  // Navigation & Filtering State
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [navFilter, setNavFilter] = useState<NavigationFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Advanced Filters
  const [categoryFilter, setCategoryFilter] = useState<FileCategory | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('any');
  const [sizeFilter, setSizeFilter] = useState<SizeFilterOption>('any');
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);

  // Selection & Modals
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewItem, setPreviewItem] = useState<DriveItem | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [renameItem, setRenameItem] = useState<DriveItem | null>(null);
  const [itemsToMove, setItemsToMove] = useState<DriveItem[]>([]);
  const [shareItem, setShareItem] = useState<DriveItem | null>(null);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isFtpSftpModalOpen, setIsFtpSftpModalOpen] = useState(false);
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isDuplicateFinderOpen, setIsDuplicateFinderOpen] = useState(false);
  const [isFileRequestModalOpen, setIsFileRequestModalOpen] = useState(false);
  const [isWebhookAlertsOpen, setIsWebhookAlertsOpen] = useState(false);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [uploadTransfers, setUploadTransfers] = useState<UploadTransferItem[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploadModalMinimized, setIsUploadModalMinimized] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [loadBalancingEnabled, setLoadBalancingEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('multidrive_load_balancing_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  // Real-time synchronization
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(new Date().toISOString());

  // Enhanced Toast notification state (guarantees no [object Object])
  const [toastMessage, setToastMessage] = useState<{
    id: string;
    text: string;
    code?: string;
    details?: string;
    type: 'success' | 'error' | 'info';
    expanded?: boolean;
  } | null>(null);
  const [toastCopied, setToastCopied] = useState(false);

  // Hidden file input
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Save to localStorage & Server Store ONLY AFTER server data has been loaded
  useEffect(() => {
    if (!isStoreLoaded.current) return;
    try {
      localStorage.setItem('onedrive_multidrive_accounts', JSON.stringify(accounts));
      // Sync to server storage (persists even if user clears browser cache)
      fetch('/api/storage/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts, isDemoDismissed }),
      }).catch(() => {});
    } catch (e) {
      console.warn('LocalStorage accounts write failed', e);
    }
  }, [accounts, isDemoDismissed]);

  useEffect(() => {
    if (!isStoreLoaded.current) return;
    try {
      localStorage.setItem('onedrive_multidrive_items', JSON.stringify(items));
      fetch('/api/storage/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      }).catch(() => {});
    } catch (e) {
      console.warn('LocalStorage items write failed', e);
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem('onedrive_multidrive_activity', JSON.stringify(activityLog));
    } catch (e) {
      console.warn('LocalStorage activity write failed', e);
    }
  }, [activityLog]);

  // Verify Admin Session on mount (unless on public download or file request link)
  useEffect(() => {
    if (publicFileId || publicRequestId) {
      setIsAuthChecking(false);
      return;
    }

    const token = localStorage.getItem('onedrive_multidrive_admin_token');
    if (!token) {
      setIsAuthenticated(false);
      setIsAuthChecking(false);
      return;
    }

    fetch('/api/auth/session', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setIsAuthenticated(!!data.authenticated);
      })
      .catch(() => {
        setIsAuthenticated(false);
      })
      .finally(() => {
        setIsAuthChecking(false);
      });
  }, [publicFileId, publicRequestId]);

  // Sync with Server Storage on mount (survives browser cache clears)
  useEffect(() => {
    fetch('/api/storage/data')
      .then((res) => res.json())
      .then((data) => {
        if (data.isDemoDismissed) {
          setIsDemoDismissed(true);
          try {
            localStorage.setItem('onedrive_multidrive_demo_dismissed', 'true');
          } catch {}
        }

        const sanitizeAccounts = (list: DriveAccount[]): DriveAccount[] =>
          list.map((a) => normalizeLoadedAccount(a));

        // Check local storage for any live accounts in case serverless cold start reset /tmp store
        let localAccounts: DriveAccount[] = [];
        let localItems: DriveItem[] = [];
        try {
          const savedAcc = localStorage.getItem('onedrive_multidrive_accounts');
          const savedIt = localStorage.getItem('onedrive_multidrive_items');
          if (savedAcc) {
            const parsed = JSON.parse(savedAcc);
            if (Array.isArray(parsed)) localAccounts = parsed.map((a) => normalizeLoadedAccount(a));
          }
          if (savedIt) {
            const parsedIt = JSON.parse(savedIt);
            if (Array.isArray(parsedIt)) localItems = parsedIt;
          }
        } catch {}

        const rawServerAccounts: DriveAccount[] = Array.isArray(data.accounts) ? data.accounts : [];
        const serverAccounts = sanitizeAccounts(rawServerAccounts);
        const serverHasLive = serverAccounts.some((a) => a.isLive);
        const localHasLive = localAccounts.some((a) => a.isLive);

        if (localHasLive && !serverHasLive) {
          // Restore live accounts from client localStorage to serverless backend
          const cleanLocal = sanitizeAccounts(localAccounts.filter((a) => a.isLive));
          setAccounts(cleanLocal);
          if (localItems.length > 0) setItems(localItems);
        } else if (serverAccounts.length > 0) {
          const filteredServer = data.isDemoDismissed
            ? serverAccounts.filter((a) => a.isLive)
            : serverAccounts;
          setAccounts(filteredServer.length > 0 ? filteredServer : serverAccounts);
          if (Array.isArray(data.items)) {
            setItems(data.items);
          }
        } else if (localAccounts.length > 0) {
          setAccounts(sanitizeAccounts(localAccounts));
          if (localItems.length > 0) setItems(localItems);
        } else {
          setAccounts([]);
          setItems([]);
        }
      })
      .catch((err) => {
        console.warn('Could not sync storage from server:', err);
      })
      .finally(() => {
        isStoreLoaded.current = true;
      });
  }, []);

  // Admin Login Handler
  const handleLogin = async (password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem('onedrive_multidrive_admin_token', data.token);
        setIsAuthenticated(true);
        showToast('Logged in as Administrator');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Admin Logout Handler
  const handleLogout = async () => {
    const token = localStorage.getItem('onedrive_multidrive_admin_token');
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem('onedrive_multidrive_admin_token');
    setIsAuthenticated(false);
    showToast('Signed out of Administrator session', 'info');
  };

  // Demo management handlers
  const handleClearAllDemoAccounts = () => {
    const liveOnly = accounts.filter((a) => a.isLive);
    const liveIds = new Set(liveOnly.map((a) => a.id));
    const liveItemsOnly = items.filter((i) => liveIds.has(i.accountId));
    setAccounts(liveOnly);
    setItems(liveItemsOnly);
    setIsDemoDismissed(true);
    try {
      localStorage.setItem('onedrive_multidrive_demo_dismissed', 'true');
    } catch {}
    fetch('/api/storage/clear-demo', { method: 'POST' }).catch(() => {});
    showToast('All demo accounts removed. Your live accounts are preserved.');
  };

  const handleLoadDemoShowcase = () => {
    setAccounts(INITIAL_ACCOUNTS);
    setItems(INITIAL_ITEMS);
    setIsDemoDismissed(false);
    try {
      localStorage.removeItem('onedrive_multidrive_demo_dismissed');
    } catch {}
    showToast('Loaded demo OneDrive showcase drives');
  };

  // Enhanced Toast helper with automatic Microsoft Graph & OAuth error parsing
  const showToast = (
    msg: unknown,
    type: 'success' | 'error' | 'info' = 'success',
    overrideDetails?: string
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    if (type === 'error') {
      const parsed = parseDetailedError(msg);
      setToastMessage({
        id,
        text: parsed.userFriendlyMessage,
        code: parsed.code,
        details: overrideDetails || parsed.technicalDetails,
        type: 'error',
        expanded: false,
      });
    } else {
      const text = typeof msg === 'string' ? msg : extractErrorMessage(msg);
      setToastMessage({
        id,
        text,
        details: overrideDetails,
        type,
        expanded: false,
      });
    }

    // Auto-dismiss after 4.5s unless expanded
    setTimeout(() => {
      setToastMessage((prev) => (prev?.id === id && !prev.expanded ? null : prev));
    }, 4500);
  };

  // Add activity log
  const logActivity = (
    action: ActivityLogEntry['action'],
    itemName: string,
    accountName: string,
    accountId: string,
    details?: string
  ) => {
    const newEntry: ActivityLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      action,
      itemName,
      accountId,
      accountName,
      details,
    };
    setActivityLog((prev) => [newEntry, ...prev.slice(0, 99)]);
  };

  // Aggregate storage calculations
  const aggregateStorage = useMemo(() => {
    return calculateAggregateStorage(accounts);
  }, [accounts]);

  // Current active account object (if single account selected)
  const currentAccount = useMemo(() => {
    return selectedAccountId !== 'all' ? accounts.find((a) => a.id === selectedAccountId) : undefined;
  }, [accounts, selectedAccountId]);

  // All folders for move destination
  const allFolders = useMemo(() => {
    return items.filter((i) => i.isFolder && !i.deleted);
  }, [items]);

  // Filtered & sorted visible items
  const visibleItems = useMemo(() => {
    const filtered = filterItems(items, {
      search: searchQuery,
      accountId: selectedAccountId,
      folderId: currentFolderId,
      category: categoryFilter,
      dateFilter,
      sizeFilter,
      navFilter,
    });
    return sortItems(filtered, sortField, sortOrder);
  }, [items, searchQuery, selectedAccountId, currentFolderId, categoryFilter, dateFilter, sizeFilter, navFilter, sortField, sortOrder]);

  // Breadcrumbs
  const breadcrumbs = useMemo(() => {
    return buildBreadcrumbs(items, currentFolderId, currentAccount);
  }, [items, currentFolderId, currentAccount]);

  // Proactive background OAuth2 token refresh for all connected live accounts
  const refreshAllLiveTokensInBackground = async () => {
    const liveWithRefresh = accounts.filter(
      (a) => a.isLive && (a.refreshToken || (a as any).refresh_token)
    );
    if (liveWithRefresh.length === 0) return;

    let anyUpdated = false;
    const updatedMap = new Map<string, { accessToken: string; refreshToken?: string; expiresAt?: number }>();

    for (const acc of liveWithRefresh) {
      if (MicrosoftGraphService.isTokenExpiredOrExpiring(acc)) {
        const freshToken = await MicrosoftGraphService.refreshAccountToken(acc);
        if (freshToken) {
          anyUpdated = true;
          updatedMap.set(acc.id, {
            accessToken: freshToken,
            refreshToken: acc.refreshToken,
            expiresAt: acc.expiresAt,
          });
        }
      }
    }

    if (anyUpdated) {
      setAccounts((prev) =>
        prev.map((acc) => {
          const refreshed = updatedMap.get(acc.id);
          if (!refreshed) return acc;
          return {
            ...acc,
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken || acc.refreshToken,
            expiresAt: refreshed.expiresAt || acc.expiresAt,
            syncStatus: 'synced',
            needsReauth: false,
            authError: undefined,
          };
        })
      );
    }
  };

  // Run proactive token refresh whenever live accounts load and every 4 minutes in background
  useEffect(() => {
    refreshAllLiveTokensInBackground();
    const refreshTimer = setInterval(() => {
      refreshAllLiveTokensInBackground();
    }, 4 * 60 * 1000);
    return () => clearInterval(refreshTimer);
  }, [accounts.length]);

  // Real-time synchronization runner
  const triggerRealtimeSync = async (isManual: boolean = false) => {
    if (isSyncing) return;
    setIsSyncing(true);

    try {
      // Sync live connected accounts via Microsoft Graph API with automatic background token refresh
      const liveAccounts = accounts.filter(
        (a) => a.isLive && (a.accessToken || a.refreshToken || (a as any).refresh_token)
      );

      for (const liveAcc of liveAccounts) {
        try {
          const activeToken = await MicrosoftGraphService.ensureValidToken(
            liveAcc,
            liveAcc.accessToken || ''
          );
          const quota = await MicrosoftGraphService.getDriveQuota(activeToken, liveAcc);
          const latestItems = await MicrosoftGraphService.listChildren(activeToken, liveAcc, 'root');

          setAccounts((prev) =>
            prev.map((acc) =>
              acc.id === liveAcc.id
                ? {
                    ...acc,
                    accessToken: liveAcc.accessToken || activeToken,
                    refreshToken: liveAcc.refreshToken,
                    expiresAt: liveAcc.expiresAt,
                    quota: {
                      total: quota.total,
                      used: quota.used,
                      remaining: quota.remaining,
                      state: quota.state,
                    },
                    lastSyncedAt: new Date().toISOString(),
                    syncStatus: 'synced',
                    needsReauth: false,
                    authError: undefined,
                  }
                : acc
            )
          );

          if (latestItems.length > 0) {
            setItems((prev) => {
              // Replace live account root items with fresh Graph items
              const nonLiveItems = prev.filter((i) => i.accountId !== liveAcc.id);
              return [...nonLiveItems, ...latestItems];
            });
          }
        } catch (err) {
          // Silently try refreshing in background on next cycle without locking account as expired
          await MicrosoftGraphService.refreshAccountToken(liveAcc);
          if (isManual) {
            showToast(err, 'error');
          }
        }
      }

      setLastSyncedAt(new Date().toISOString());
      if (isManual) {
        showToast('Unified drives synced successfully with Microsoft Graph');
        logActivity('sync', 'All Connected Drives', 'Unified System', 'all', 'Manual sync completed');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Periodic real-time synchronization interval
  useEffect(() => {
    const timer = setInterval(() => {
      triggerRealtimeSync(false);
    }, 30000); // Poll every 30s
    return () => clearInterval(timer);
  }, [accounts]);

  // Selection handlers
  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === visibleItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleItems.map((i) => i.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Navigate folder or open preview
  const handleItemClick = (item: DriveItem) => {
    if (item.isFolder) {
      setCurrentFolderId(item.id);
      setSelectedIds(new Set());
      setSearchQuery('');
    } else {
      setPreviewItem(item);
    }
  };

  // Toggle star
  const handleToggleStar = (item: DriveItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedStarred = !item.starred;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, starred: updatedStarred } : i))
    );
    showToast(`${updatedStarred ? 'Starred' : 'Unstarred'} "${item.name}"`);
  };

  // Download single file
  const handleDownload = async (item: DriveItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await downloadSingleFile(item);
      showToast(`Downloaded "${item.name}"`);
      logActivity('download', item.name, item.accountName, item.accountId);
    } catch (err) {
      showToast(err, 'error');
    }
  };

  // Batch download ZIP
  const handleBatchDownloadZip = async () => {
    const targetItems = items.filter((i) => selectedIds.has(i.id));
    if (targetItems.length === 0) return;

    try {
      showToast(`Bundling ${targetItems.length} files across drives into ZIP...`, 'info');
      await downloadItemsAsZip(targetItems, 'MultiDrive_Unified_Export.zip');
      showToast(`Exported ${targetItems.length} items as ZIP`);
      logActivity(
        'download',
        `${targetItems.length} items (ZIP Export)`,
        'Multi-Drive Archive',
        'all'
      );
      handleClearSelection();
    } catch (err) {
      showToast(err, 'error');
    }
  };

  // Create folder
  const handleCreateFolder = async (folderName: string, accountId: string) => {
    const targetAcc = accounts.find((a) => a.id === accountId) || accounts[0];
    const newFolder: DriveItem = {
      id: `fold-${Date.now()}`,
      name: folderName,
      accountId: targetAcc.id,
      accountName: targetAcc.name,
      accountColor: targetAcc.color,
      parentId: currentFolderId,
      isFolder: true,
      size: 0,
      lastModifiedDateTime: new Date().toISOString(),
      createdDateTime: new Date().toISOString(),
      webUrl: `https://${targetAcc.tenantName}/Documents/${encodeURIComponent(folderName)}`,
      fileType: 'folder',
    };

    setItems((prev) => [newFolder, ...prev]);
    showToast(`Folder "${folderName}" created in ${targetAcc.name}`);
    logActivity('create_folder', folderName, targetAcc.name, targetAcc.id);

    // Call live Graph API if target account is live
    if (targetAcc.isLive && targetAcc.accessToken) {
      try {
        await MicrosoftGraphService.createFolder(
          targetAcc.accessToken,
          targetAcc,
          currentFolderId,
          folderName
        );
      } catch (err) {
        console.warn('Failed to create folder on Microsoft Graph:', extractErrorMessage(err));
        showToast(err, 'error');
      }
    }
  };

  // Rename item
  const handleRename = (item: DriveItem, newName: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              name: newName,
              fileType: i.isFolder ? 'folder' : getFileCategory(newName, i.mimeType),
              lastModifiedDateTime: new Date().toISOString(),
            }
          : i
      )
    );
    showToast(`Renamed to "${newName}"`);
    logActivity('rename', newName, item.accountName, item.accountId, `Original: ${item.name}`);

    // If live account, call Graph API
    const acc = accounts.find((a) => a.id === item.accountId);
    if (acc?.isLive && acc.accessToken) {
      MicrosoftGraphService.renameItem(acc.accessToken, acc, item.id, newName).catch((err) => {
        showToast(err, 'error');
      });
    }
  };

  // Update item share security (PIN / Expiry)
  const handleUpdateItemSecurity = async (itemId: string, sharePin?: string, expiresAt?: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, sharePin, expiresAt } : i))
    );
    showToast('Updated link password protection & expiration settings');
  };

  // Direct Cloud-to-Cloud Migration Completion Handler
  const handleMigrateComplete = (migratedCount: number, totalBytes: number, targetAccountName: string) => {
    showToast(
      `Cloud Migration Complete: Transferred ${migratedCount} item(s) (${formatBytes(totalBytes)}) to ${targetAccountName}`,
      'success'
    );
    logActivity('migrate', `${migratedCount} items`, targetAccountName, 'cloud-migration', `Transferred ${formatBytes(totalBytes)} via cloud conduit`);
    handleClearSelection();
    // Refresh items and account quotas from server store
    fetch('/api/storage/data')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.items)) setItems(data.items);
        if (Array.isArray(data.accounts)) setAccounts(data.accounts);
      })
      .catch(() => {});
  };

  // Move / transfer items
  const handleConfirmMove = (targetFolderId: string | null, targetAccount: DriveAccount) => {
    const targetItemIds = itemsToMove.map((i) => i.id);
    setItems((prev) => batchMoveItems(prev, targetItemIds, targetFolderId, targetAccount));
    showToast(
      `Moved ${itemsToMove.length} item(s) to ${targetAccount.name}`
    );
    logActivity(
      'move',
      itemsToMove.map((i) => i.name).join(', '),
      targetAccount.name,
      targetAccount.id
    );
    setItemsToMove([]);
    handleClearSelection();
  };

  // Delete item (move to recycle bin or permanent delete)
  const handleDeleteItem = (item: DriveItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (navFilter === 'trash') {
      // Permanent delete
      setItems((prev) => batchPermanentDeleteItems(prev, [item.id]));
      showToast(`Permanently deleted "${item.name}"`);
      logActivity('delete', item.name, item.accountName, item.accountId, 'Permanently deleted');
    } else {
      // Move to recycle bin
      setItems((prev) => batchDeleteItems(prev, [item.id]));
      showToast(`Moved "${item.name}" to Recycle Bin`);
      logActivity('delete', item.name, item.accountName, item.accountId, 'Moved to trash');
    }
  };

  // Batch delete
  const handleBatchDelete = () => {
    const targetIds = Array.from(selectedIds);
    if (targetIds.length === 0) return;

    if (navFilter === 'trash') {
      setItems((prev) => batchPermanentDeleteItems(prev, targetIds));
      showToast(`Permanently deleted ${targetIds.length} item(s)`);
    } else {
      setItems((prev) => batchDeleteItems(prev, targetIds));
      showToast(`Moved ${targetIds.length} item(s) to Recycle Bin`);
    }
    handleClearSelection();
  };

  // Restore item from recycle bin
  const handleRestoreItem = (item: DriveItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setItems((prev) => batchRestoreItems(prev, [item.id]));
    showToast(`Restored "${item.name}"`);
    logActivity('restore', item.name, item.accountName, item.accountId);
  };

  // Core File Upload Processor with Live Telemetry (Speed, Remaining Size, ETA) & Multi-Account Load Balancing
  const processFilesUpload = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    if (accounts.length === 0) {
      showToast('Please connect a OneDrive account first before uploading files', 'error');
      setIsConnectModalOpen(true);
      return;
    }

    let totalUploadedBytes = 0;
    const assignedAccounts: string[] = [];
    const batchTimestamp = Date.now();

    // Open the Upload Manager Dialog immediately so user sees live progress, speed, remaining size & ETA
    setIsUploadModalOpen(true);
    setIsUploadModalMinimized(false);

    // Pre-create transfer queue items for all selected files
    const initialQueueItems: {
      transferId: string;
      file: File;
      targetAccount: DriveAccount;
      balanceTag: string;
      category: FileCategory;
    }[] = files.map((file, idx) => {
      const category = getFileCategory(file.name, file.type);
      let targetAccount = currentAccount || accounts[0];
      let balanceTag = '';

      if (loadBalancingEnabled && accounts.length > 1) {
        const best = findBestAccountForUpload(accounts, file.size);
        if (best) {
          targetAccount = best.account;
          balanceTag = ` (⚡ Routed by Load Balancer: ${best.formattedFree} free)`;
        }
      }

      return {
        transferId: `tx-${batchTimestamp}-${idx}`,
        file,
        targetAccount,
        balanceTag,
        category,
      };
    });

    setUploadTransfers((prev) => [
      ...initialQueueItems.map((entry) => ({
        id: entry.transferId,
        fileName: entry.file.name,
        fileSize: entry.file.size,
        uploadedBytes: 0,
        speedBps: 0,
        etaSeconds: 0,
        progress: 0,
        status: 'uploading' as const,
        accountId: entry.targetAccount.id,
        accountName: entry.targetAccount.name,
        accountColor: entry.targetAccount.color,
        fileType: entry.category,
        startedAt: Date.now(),
        sourceType: 'local' as const,
      })),
      ...prev,
    ]);

    for (let i = 0; i < initialQueueItems.length; i++) {
      const { transferId, file, targetAccount, balanceTag, category } = initialQueueItems[i];
      totalUploadedBytes += file.size;
      assignedAccounts.push(targetAccount.name);

      // Read preview data based on file type
      let sampleContent: string | undefined = undefined;
      let downloadUrl: string | undefined = undefined;

      try {
        if (
          file.type.startsWith('text/') ||
          file.name.endsWith('.json') ||
          file.name.endsWith('.csv') ||
          file.name.endsWith('.md') ||
          file.name.endsWith('.txt') ||
          file.name.endsWith('.ts') ||
          file.name.endsWith('.js')
        ) {
          sampleContent = await file.text();
        } else if (file.type.startsWith('image/')) {
          if (file.size <= 8 * 1024 * 1024) {
            sampleContent = await new Promise<string | undefined>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = () => resolve(undefined);
              reader.readAsDataURL(file);
            });
          }
        } else if (
          file.type.startsWith('video/') ||
          file.type.startsWith('audio/') ||
          file.type === 'application/pdf'
        ) {
          downloadUrl = URL.createObjectURL(file);
        }
      } catch {
        sampleContent = undefined;
      }

      // Ensure parentFolderId actually belongs to targetAccount (important when Load Balancing routes to another drive)
      const currentFolderObj = currentFolderId ? items.find((it) => it.id === currentFolderId) : null;
      const effectiveParentFolderId =
        currentFolderObj && currentFolderObj.accountId === targetAccount.id && !currentFolderId?.startsWith('fold-')
          ? currentFolderId
          : null;

      const newItem: DriveItem = {
        id: `upload-${batchTimestamp}-${i}`,
        name: file.name,
        accountId: targetAccount.id,
        accountName: targetAccount.name,
        accountColor: targetAccount.color,
        parentId: effectiveParentFolderId,
        isFolder: false,
        size: file.size,
        lastModifiedDateTime: new Date().toISOString(),
        createdDateTime: new Date().toISOString(),
        webUrl: `https://${targetAccount.tenantName}/Documents/${encodeURIComponent(file.name)}`,
        downloadUrl,
        mimeType: file.type || 'application/octet-stream',
        fileType: category,
        content: sampleContent,
      };

      setItems((prev) => [newItem, ...prev]);

      // Update account quota
      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === targetAccount.id
            ? {
                ...acc,
                quota: {
                  ...acc.quota,
                  used: acc.quota.used + file.size,
                  remaining: Math.max(0, acc.quota.remaining - file.size),
                },
              }
            : acc
        )
      );

      logActivity(
        'upload',
        file.name,
        targetAccount.name,
        targetAccount.id,
        `${formatBytes(file.size)}${balanceTag}`
      );

      const uploadStartTime = Date.now();
      const updateTransferTelemetry = (loadedBytes: number, totalBytes: number) => {
        const clampedLoaded = Math.min(totalBytes, Math.max(0, loadedBytes));
        const elapsedSec = Math.max(0.15, (Date.now() - uploadStartTime) / 1000);
        const speedBps = Math.round(clampedLoaded / elapsedSec);
        const remainingBytes = Math.max(0, totalBytes - clampedLoaded);
        const etaSeconds = speedBps > 0 ? Math.max(0, remainingBytes / speedBps) : 0;
        const progress = totalBytes > 0 ? Math.min(99, Math.round((clampedLoaded / totalBytes) * 100)) : 99;

        setUploadTransfers((prev) =>
          prev.map((tx) =>
            tx.id === transferId
              ? {
                  ...tx,
                  uploadedBytes: clampedLoaded,
                  speedBps,
                  etaSeconds,
                  progress,
                  status: 'uploading',
                }
              : tx
          )
        );
      };

      const isLiveAccount = Boolean(
        targetAccount.isLive ||
          targetAccount.accessToken ||
          targetAccount.refreshToken ||
          (targetAccount as any).access_token ||
          (targetAccount as any).refresh_token
      );

      // Direct upload to Microsoft OneDrive (with automatic background token refresh & real-time XHR byte progress)
      if (isLiveAccount) {
        const tempId = newItem.id;
        try {
          const uploadedDriveItem = await MicrosoftGraphService.uploadFile(
            targetAccount.accessToken || (targetAccount as any).access_token || '',
            targetAccount,
            effectiveParentFolderId,
            file,
            (loaded, total) => {
              updateTransferTelemetry(loaded, total);
            }
          );

          // Replace optimistic item with real OneDrive DriveItem metadata and ID
          setItems((prev) =>
            prev.map((it) =>
              it.id === tempId
                ? {
                    ...it,
                    ...uploadedDriveItem,
                    parentId: effectiveParentFolderId,
                    content: sampleContent || uploadedDriveItem.content,
                    downloadUrl: uploadedDriveItem.downloadUrl || downloadUrl,
                  }
                : it
            )
          );

          // Persist any refreshed accessToken / refreshToken back to accounts state
          setAccounts((prev) =>
            prev.map((acc) =>
              acc.id === targetAccount.id
                ? {
                    ...acc,
                    isLive: true,
                    accessToken: targetAccount.accessToken || acc.accessToken,
                    refreshToken: targetAccount.refreshToken || acc.refreshToken,
                    expiresAt: targetAccount.expiresAt || acc.expiresAt,
                    clientId: targetAccount.clientId || acc.clientId,
                    tenantId: targetAccount.tenantId || acc.tenantId,
                    syncStatus: 'synced',
                    needsReauth: false,
                    authError: undefined,
                  }
                : acc
            )
          );

          const finalElapsedSec = Math.max(0.2, (Date.now() - uploadStartTime) / 1000);
          const finalSpeed = Math.round(file.size / finalElapsedSec);
          setUploadTransfers((prev) =>
            prev.map((tx) =>
              tx.id === transferId
                ? {
                    ...tx,
                    uploadedBytes: file.size,
                    speedBps: finalSpeed,
                    etaSeconds: 0,
                    progress: 100,
                    status: 'completed',
                    completedAt: Date.now(),
                  }
                : tx
            )
          );
        } catch (err) {
          const rawErr = extractErrorMessage(err);
          console.error('OneDrive direct upload failed:', rawErr);
          // Remove failed optimistic item so MultiDrive never shows a file that failed to upload to OneDrive
          setItems((prev) => prev.filter((it) => it.id !== tempId));
          setUploadTransfers((prev) =>
            prev.map((tx) =>
              tx.id === transferId
                ? {
                    ...tx,
                    etaSeconds: 0,
                    status: 'error',
                    errorMessage: rawErr,
                  }
                : tx
            )
          );
          showToast(err, 'error');
        }
      } else {
        // Smooth telemetry animation for non-live / demo showcase accounts
        const steps = 6;
        for (let step = 1; step <= steps; step++) {
          await new Promise((r) => setTimeout(r, 90));
          updateTransferTelemetry(Math.round((file.size * step) / steps), file.size);
        }
        const finalElapsedSec = Math.max(0.2, (Date.now() - uploadStartTime) / 1000);
        setUploadTransfers((prev) =>
          prev.map((tx) =>
            tx.id === transferId
              ? {
                  ...tx,
                  uploadedBytes: file.size,
                  speedBps: Math.round(file.size / finalElapsedSec),
                  etaSeconds: 0,
                  progress: 100,
                  status: 'completed',
                  completedAt: Date.now(),
                }
              : tx
          )
        );
      }
    }

    const uniqueAssigned = Array.from(new Set(assignedAccounts));
    const targetLabel =
      uniqueAssigned.length === 1 ? uniqueAssigned[0] : `${uniqueAssigned.length} balanced drives`;
    showToast(
      `Processed ${files.length} file(s) (${formatBytes(totalUploadedBytes)}) for ${targetLabel}${
        loadBalancingEnabled && accounts.length > 1 ? ' [⚡ Auto-Balanced]' : ''
      }`
    );
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // File Input Change Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    await processFilesUpload(e.target.files);
  };

  // Remote URL Cloud Pull Handler (fetches remote file server-side & uploads directly to OneDrive)
  const handleRemoteUrlUpload = async (url: string, customName?: string) => {
    if (accounts.length === 0) {
      showToast('Connect a OneDrive account first before pulling remote URLs', 'error');
      return;
    }

    let targetAccount = currentAccount || accounts[0];
    if (loadBalancingEnabled && accounts.length > 1) {
      const best = findBestAccountForUpload(accounts, 10 * 1024 * 1024);
      if (best) targetAccount = best.account;
    }

    const transferId = `url-tx-${Date.now()}`;
    const displayFileName =
      customName?.trim() || decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'remote-file.bin');
    const startTime = Date.now();

    setIsUploadModalOpen(true);
    setIsUploadModalMinimized(false);

    setUploadTransfers((prev) => [
      {
        id: transferId,
        fileName: displayFileName,
        fileSize: 0,
        uploadedBytes: 0,
        speedBps: 0,
        etaSeconds: 2,
        progress: 25,
        status: 'uploading',
        accountId: targetAccount.id,
        accountName: targetAccount.name,
        accountColor: targetAccount.color,
        fileType: getFileCategory(displayFileName),
        startedAt: startTime,
        sourceType: 'url',
      },
      ...prev,
    ]);

    try {
      const res = await fetch('/api/drive/remote-url-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          customFileName: customName,
          accountId: targetAccount.id,
          parentFolderId: currentFolderId,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Remote URL Cloud Pull failed');
      }

      const finalName = data.fileName || displayFileName;
      const finalSize = Number(data.size) || 1024 * 128;
      const elapsedSec = Math.max(0.25, (Date.now() - startTime) / 1000);
      const speedBps = Math.round(finalSize / elapsedSec);

      const newItem: DriveItem = {
        id: data.graphItem?.id || `url-item-${Date.now()}`,
        name: finalName,
        accountId: targetAccount.id,
        accountName: targetAccount.name,
        accountColor: targetAccount.color,
        parentId: currentFolderId,
        isFolder: false,
        size: finalSize,
        lastModifiedDateTime: new Date().toISOString(),
        createdDateTime: new Date().toISOString(),
        webUrl:
          data.graphItem?.webUrl ||
          `https://${targetAccount.tenantName}/Documents/${encodeURIComponent(finalName)}`,
        downloadUrl: data.graphItem?.['@microsoft.graph.downloadUrl'] || url,
        mimeType: data.mimeType || 'application/octet-stream',
        fileType: getFileCategory(finalName, data.mimeType),
      };

      setItems((prev) => [newItem, ...prev]);
      setUploadTransfers((prev) =>
        prev.map((tx) =>
          tx.id === transferId
            ? {
                ...tx,
                fileName: finalName,
                fileSize: finalSize,
                uploadedBytes: finalSize,
                speedBps,
                etaSeconds: 0,
                progress: 100,
                status: 'completed',
                completedAt: Date.now(),
              }
            : tx
        )
      );

      logActivity(
        'upload',
        finalName,
        targetAccount.name,
        targetAccount.id,
        `Pulled from Remote URL (${formatBytes(finalSize)})`
      );
      showToast(`Pulled "${finalName}" (${formatBytes(finalSize)}) directly to ${targetAccount.name}`);
    } catch (err) {
      const msg = extractErrorMessage(err);
      setUploadTransfers((prev) =>
        prev.map((tx) =>
          tx.id === transferId
            ? {
                ...tx,
                status: 'error',
                errorMessage: msg,
                etaSeconds: 0,
              }
            : tx
        )
      );
      showToast(err, 'error');
    }
  };

  // Add new connected account (or update existing account if re-authenticating)
  const handleAddAccount = (newAccount: DriveAccount) => {
    setAccounts((prev) => {
      const existingIdx = prev.findIndex(
        (a) =>
          (a.email && newAccount.email && a.email.toLowerCase() === newAccount.email.toLowerCase()) ||
          a.name.toLowerCase() === newAccount.name.toLowerCase()
      );
      if (existingIdx !== -1) {
        const existing = prev[existingIdx];
        const updated: DriveAccount = {
          ...existing,
          ...newAccount,
          id: existing.id,
          syncStatus: 'synced',
          needsReauth: false,
          authError: undefined,
        };
        const copy = [...prev];
        copy[existingIdx] = updated;
        return copy;
      }
      return [...prev, { ...newAccount, syncStatus: 'synced', needsReauth: false }];
    });
    if (newAccount.isLive) {
      setIsDemoDismissed(true);
      try {
        localStorage.setItem('onedrive_multidrive_demo_dismissed', 'true');
      } catch {}
    }
    showToast(`Connected "${newAccount.name}" successfully!`);
    logActivity('sync', newAccount.name, newAccount.name, newAccount.id, 'Account connected');
  };

  // Remove / disconnect account
  const handleRemoveAccount = (accountId: string) => {
    const acc = accounts.find((a) => a.id === accountId);
    setAccounts((prev) => prev.filter((a) => a.id !== accountId));
    setItems((prev) => prev.filter((i) => i.accountId !== accountId));
    if (selectedAccountId === accountId) {
      setSelectedAccountId('all');
    }
    // Prevent demo data from reappearing once accounts are modified or removed
    setIsDemoDismissed(true);
    try {
      localStorage.setItem('onedrive_multidrive_demo_dismissed', 'true');
    } catch {}
    showToast(`Disconnected "${acc?.name || 'Account'}"`);
  };

  // Clear search and advanced filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setDateFilter('any');
    setSizeFilter('any');
    setSelectedAccountId('all');
  };

  // Handler when a backup is restored
  const handleRestoreComplete = async () => {
    try {
      const res = await fetch('/api/storage/data');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.accounts)) {
          setAccounts(data.accounts);
          localStorage.setItem('onedrive_multidrive_accounts', JSON.stringify(data.accounts));
        }
        if (Array.isArray(data.items)) {
          setItems(data.items);
          localStorage.setItem('onedrive_multidrive_items', JSON.stringify(data.items));
        }
        if (typeof data.isDemoDismissed === 'boolean') {
          setIsDemoDismissed(data.isDemoDismissed);
          localStorage.setItem('onedrive_multidrive_demo_dismissed', String(data.isDemoDismissed));
        }
        showToast('System configuration & storage state restored successfully', 'success');
      }
    } catch (e) {
      showToast('Restoration completed, please refresh the page to reload state', 'info');
    }
  };

  // 1a. Render Public Unauthenticated File Request Dropzone Portal (?request=REQ_ID)
  if (publicRequestId) {
    return (
      <>
        <PublicFileRequestView
          requestId={publicRequestId}
          onNavigateHome={() => {
            window.history.replaceState({}, '', window.location.pathname);
            setPublicRequestId(null);
          }}
        />
        <VercelTelemetry />
      </>
    );
  }

  // 1b. Render Public Unauthenticated Download Link View (?download=FILE_ID or ?share=FILE_ID)
  if (publicFileId) {
    return (
      <>
        <PublicDownloadView
          fileId={publicFileId}
          cachedItems={items}
          onNavigateToLogin={() => {
            window.history.replaceState({}, '', window.location.pathname);
            setPublicFileId(null);
          }}
        />
        <VercelTelemetry />
      </>
    );
  }

  // 2. Render Auth Checking Spinner
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 font-sans">
        <div className="w-12 h-12 rounded-2xl bg-sky-600/20 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-3 animate-pulse">
          <Cloud className="w-6 h-6" />
        </div>
        <p className="text-xs text-slate-400">Verifying MultiDrive Enterprise Access...</p>
      </div>
    );
  }

  // 3. Render Administrator Login Screen
  if (!isAuthenticated) {
    return (
      <>
        <LoginScreen onLogin={handleLogin} />
        <VercelTelemetry />
      </>
    );
  }

  return (
    <div
      className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-white relative"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) {
          setIsDraggingOver(true);
        }
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget === e.target) {
          setIsDraggingOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          processFilesUpload(e.dataTransfer.files);
        }
      }}
    >
      {/* Full-Window Drag-and-Drop Upload Overlay */}
      {isDraggingOver && (
        <div
          onDragLeave={() => setIsDraggingOver(false)}
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md border-2 border-dashed border-sky-500 m-3 rounded-3xl flex flex-col items-center justify-center p-6 text-center animate-fadeIn pointer-events-none"
        >
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-2xl shadow-sky-500/30 mb-4 animate-bounce">
            <Upload className="w-10 h-10" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Drop Files Anywhere to Upload to OneDrive
          </h2>
          <p className="text-xs text-slate-300 mt-1.5 max-w-md">
            {loadBalancingEnabled && accounts.length > 1
              ? 'Smart Multi-Account Load Balancing is active — files will automatically route to the OneDrive tenant with the most available storage.'
              : `Files will upload directly to ${currentAccount?.name || accounts[0]?.name || 'your connected OneDrive'} with live speed & ETA tracking.`}
          </p>
        </div>
      )}

      {/* Hidden file upload input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileUpload}
        className="hidden"
        aria-label="Upload files input"
      />

      {/* Top Navbar */}
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          if (q.trim()) {
            // When user starts searching, automatically expand across all folders
            setCurrentFolderId(null);
          }
        }}
        selectedAccountId={selectedAccountId}
        onSelectAccount={setSelectedAccountId}
        accounts={accounts}
        isAdvancedFilterOpen={isAdvancedFilterOpen}
        onToggleAdvancedFilter={() => setIsAdvancedFilterOpen((prev) => !prev)}
        isSyncing={isSyncing}
        onManualSync={() => triggerRealtimeSync(true)}
        lastSyncedAt={lastSyncedAt}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        onOpenActivityLog={() => setIsActivityLogOpen(true)}
        onOpenStatsModal={() => setIsStatsModalOpen(true)}
        onOpenFtpSftpModal={() => setIsFtpSftpModalOpen(true)}
        onOpenAnalytics={() => {
          setNavFilter('analytics');
          setCurrentFolderId(null);
          handleClearSelection();
        }}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        onOpenDatabaseModal={() => setIsDatabaseModalOpen(true)}
        onOpenChangePasswordModal={() => setIsChangePasswordOpen(true)}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        onLogout={handleLogout}
        aggregateStorage={aggregateStorage}
      />

      {/* Advanced Multi-Account Filter Drawer */}
      {isAdvancedFilterOpen && (
        <AdvancedSearchFilterBar
          category={categoryFilter}
          onCategoryChange={setCategoryFilter}
          dateFilter={dateFilter}
          onDateFilterChange={setDateFilter}
          sizeFilter={sizeFilter}
          onSizeFilterChange={setSizeFilter}
          selectedAccountId={selectedAccountId}
          onAccountChange={setSelectedAccountId}
          accounts={accounts}
          matchingCount={visibleItems.length}
          totalCount={items.filter((i) => !i.deleted).length}
          onResetFilters={handleResetFilters}
          onClose={() => setIsAdvancedFilterOpen(false)}
        />
      )}

      {/* Main Workspace: Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden w-full max-w-full min-w-0">
        {/* Left Sidebar */}
        <Sidebar
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onSelectAccount={(accId) => {
            setSelectedAccountId(accId);
            setCurrentFolderId(null);
            handleClearSelection();
            setIsMobileSidebarOpen(false);
          }}
          activeNavFilter={navFilter}
          onSelectNavFilter={(filter) => {
            setNavFilter(filter);
            setCurrentFolderId(null);
            handleClearSelection();
            setIsMobileSidebarOpen(false);
          }}
          onOpenConnectModal={() => setIsConnectModalOpen(true)}
          onOpenStatsModal={() => setIsStatsModalOpen(true)}
          onOpenFtpSftpModal={() => setIsFtpSftpModalOpen(true)}
          onOpenBackupModal={() => setIsBackupModalOpen(true)}
          onOpenDatabaseModal={() => setIsDatabaseModalOpen(true)}
          onOpenChangePasswordModal={() => setIsChangePasswordOpen(true)}
          onOpenDuplicateFinder={() => setIsDuplicateFinderOpen(true)}
          onOpenFileRequests={() => setIsFileRequestModalOpen(true)}
          onOpenWebhookAlerts={() => setIsWebhookAlertsOpen(true)}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          aggregateStorage={aggregateStorage}
        />

        {/* Center Content Workspace */}
        <main className="flex-1 flex flex-col min-w-0 max-w-full overflow-x-hidden bg-slate-950 overflow-y-auto">
          {navFilter === 'analytics' ? (
            /* Bandwidth & Access Analytics View */
            <AnalyticsDashboard
              onOpenFile={(fileId) => {
                const target = items.find((i) => i.id === fileId);
                if (target) setPreviewItem(target);
              }}
            />
          ) : (
            <>
              {/* Action Bar (Breadcrumbs, Upload, Sort, Batch) */}
              <ActionBar
                breadcrumbs={breadcrumbs}
                onNavigateBreadcrumb={(id) => {
                  setCurrentFolderId(id);
                  handleClearSelection();
                }}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                sortField={sortField}
                onSortFieldChange={setSortField}
                sortOrder={sortOrder}
                onSortOrderChange={setSortOrder}
                selectedCount={selectedIds.size}
                onUploadClick={() => fileInputRef.current?.click()}
                onNewFolderClick={() => setIsNewFolderOpen(true)}
                onOpenTransferModal={() => {
                  setIsUploadModalOpen(true);
                  setIsUploadModalMinimized(false);
                }}
                activeUploadCount={
                  uploadTransfers.filter((t) => t.status === 'uploading' || t.status === 'queued').length
                }
                totalTransfersCount={uploadTransfers.length}
                onBatchDownloadZip={handleBatchDownloadZip}
                onBatchMoveClick={() => {
                  const moving = items.filter((i) => selectedIds.has(i.id));
                  setItemsToMove(moving);
                }}
                onBatchMigrateClick={() => {
                  if (selectedIds.size === 0) {
                    showToast('Select one or more items to migrate across OneDrive drives', 'info');
                    return;
                  }
                  setIsMigrationModalOpen(true);
                }}
                onBatchDeleteClick={handleBatchDelete}
                onClearSelection={handleClearSelection}
                onSelectAll={handleSelectAll}
                isAllSelected={selectedIds.size > 0 && selectedIds.size === visibleItems.length}
                totalVisibleCount={visibleItems.length}
                currentAccount={currentAccount}
                loadBalancingEnabled={loadBalancingEnabled}
                onToggleLoadBalancing={() => {
                  setLoadBalancingEnabled((prev) => {
                    const next = !prev;
                    try {
                      localStorage.setItem('multidrive_load_balancing_enabled', String(next));
                    } catch {}
                    showToast(
                      next
                        ? 'Auto Load Balancing ACTIVE: Large uploads automatically route to whichever OneDrive has the highest free storage.'
                        : 'Auto Load Balancing OFF: Uploads route directly to active selected drive.',
                      'info'
                    );
                    return next;
                  });
                }}
              />

              {/* Items Explorer Body */}
              <div className="flex-1 p-2 sm:p-4">
            {accounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-xl mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-600 flex items-center justify-center text-white mb-4 shadow-xl shadow-sky-500/20">
                  <Cloud className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-slate-100">Connect Your OneDrive Accounts</h2>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  No OneDrive accounts connected yet. Connect your Microsoft 365 or Azure AD enterprise accounts using OAuth2 to view, search, upload, and manage files from one unified interface.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-3 mt-6 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setIsConnectModalOpen(true)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-sky-600/20 transition-all active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Connect Microsoft 365 Account</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLoadDemoShowcase}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-all"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Load Demo Showcase</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mt-10 pt-8 border-t border-slate-900 text-left">
                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                    <p className="text-xs font-semibold text-slate-200">Unified Multi-Drive</p>
                    <p className="text-[11px] text-slate-400 mt-1">Cross-account search & simultaneous multi-tenant sync.</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                    <p className="text-xs font-semibold text-slate-200">Public Downloads</p>
                    <p className="text-[11px] text-slate-400 mt-1">Share links are immediately downloadable without login.</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                    <p className="text-xs font-semibold text-slate-200">Admin Protected</p>
                    <p className="text-[11px] text-slate-400 mt-1">Management, file edits, and account setup require admin password.</p>
                  </div>
                </div>
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4 shadow-inner">
                  {searchQuery ? <FileSearch className="w-8 h-8 text-sky-400" /> : <FolderOpen className="w-8 h-8" />}
                </div>
                <h3 className="text-sm font-semibold text-slate-200">
                  {searchQuery ? 'No matching files found' : 'No items in this location'}
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  {searchQuery
                    ? `No files matching "${searchQuery}" across your connected OneDrive accounts. Try adjusting your search query or filters.`
                    : 'This folder is currently empty. Upload documents or create subfolders to get started.'}
                </p>

                {searchQuery ? (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="mt-4 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition-colors"
                  >
                    Clear Search Filters
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4 flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all active:scale-95"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Files Here</span>
                  </button>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              <FileGrid
                items={visibleItems}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onItemClick={handleItemClick}
                onToggleStar={handleToggleStar}
                onPreview={(item) => setPreviewItem(item)}
                onDownload={handleDownload}
                onShare={(item, e) => {
                  e.stopPropagation();
                  setShareItem(item);
                }}
                onRename={(item, e) => {
                  e.stopPropagation();
                  setRenameItem(item);
                }}
                onMove={(item, e) => {
                  e.stopPropagation();
                  setItemsToMove([item]);
                }}
                onDelete={handleDeleteItem}
                onRestore={handleRestoreItem}
                isTrashView={navFilter === 'trash'}
              />
            ) : (
              <FileList
                items={visibleItems}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onItemClick={handleItemClick}
                onToggleStar={handleToggleStar}
                onPreview={(item) => setPreviewItem(item)}
                onDownload={handleDownload}
                onShare={(item, e) => {
                  e.stopPropagation();
                  setShareItem(item);
                }}
                onRename={(item, e) => {
                  e.stopPropagation();
                  setRenameItem(item);
                }}
                onMove={(item, e) => {
                  e.stopPropagation();
                  setItemsToMove([item]);
                }}
                onDelete={handleDeleteItem}
                onRestore={handleRestoreItem}
                isTrashView={navFilter === 'trash'}
              />
            )}
          </div>
            </>
          )}
        </main>
      </div>

      {/* Modals & Dialogs */}
      <FilePreviewModal
        item={previewItem}
        siblingItems={visibleItems}
        onSelectItem={(it) => setPreviewItem(it)}
        onClose={() => setPreviewItem(null)}
        onDownload={handleDownload}
        onShare={(item) => setShareItem(item)}
        onDelete={(item) => handleDeleteItem(item)}
      />

      <ConnectAccountModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        accounts={accounts}
        onAddAccount={handleAddAccount}
        onRemoveAccount={handleRemoveAccount}
        onClearAllDemoAccounts={handleClearAllDemoAccounts}
      />

      <NewFolderModal
        isOpen={isNewFolderOpen}
        onClose={() => setIsNewFolderOpen(false)}
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onCreateFolder={handleCreateFolder}
      />

      <RenameModal
        item={renameItem}
        onClose={() => setRenameItem(null)}
        onRename={handleRename}
      />

      <MoveModal
        itemsToMove={itemsToMove}
        allFolders={allFolders}
        accounts={accounts}
        isOpen={itemsToMove.length > 0}
        onClose={() => setItemsToMove([])}
        onConfirmMove={handleConfirmMove}
      />

      <ShareModal
        item={shareItem}
        onClose={() => setShareItem(null)}
        onUpdateItemSecurity={handleUpdateItemSecurity}
      />

      {isMigrationModalOpen && (
        <CloudMigrationModal
          items={items.filter((i) => selectedIds.has(i.id))}
          accounts={accounts}
          currentAccountId={selectedAccountId}
          onClose={() => setIsMigrationModalOpen(false)}
          onMigrateComplete={handleMigrateComplete}
        />
      )}

      <ActivityLogDrawer
        isOpen={isActivityLogOpen}
        onClose={() => setIsActivityLogOpen(false)}
        entries={activityLog}
        onClear={() => setActivityLog([])}
      />

      <StorageStatsModal
        isOpen={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
        accounts={accounts}
        items={items}
        aggregateStorage={aggregateStorage}
      />

      <FtpSftpModal
        isOpen={isFtpSftpModalOpen}
        onClose={() => setIsFtpSftpModalOpen(false)}
        accounts={accounts}
        items={items}
      />

      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        accounts={accounts}
        items={items}
        onRestoreComplete={handleRestoreComplete}
      />

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        showToast={(msg, type) => showToast(msg, type)}
      />

      <DuplicateFinderModal
        isOpen={isDuplicateFinderOpen}
        onClose={() => setIsDuplicateFinderOpen(false)}
        items={items}
        accounts={accounts}
        onDeduplicateComplete={(removedIds, freedBytes) => {
          const removeSet = new Set(removedIds);
          setItems((prev) => prev.filter((it) => !removeSet.has(it.id)));
          showToast(
            `Deduplication Complete: Removed ${removedIds.length} duplicate file(s) and reclaimed ${formatBytes(freedBytes)}`,
            'success'
          );
          logActivity(
            'delete',
            `${removedIds.length} duplicate files`,
            'Cross-Account Deduplicator',
            'all',
            `Reclaimed ${formatBytes(freedBytes)}`
          );
          // Refresh quotas from server store
          fetch('/api/storage/data')
            .then((res) => res.json())
            .then((data) => {
              if (Array.isArray(data.accounts)) {
                setAccounts(data.accounts.map((a: DriveAccount) => normalizeLoadedAccount(a)));
              }
            })
            .catch(() => {});
        }}
      />

      <FileRequestModal
        isOpen={isFileRequestModalOpen}
        onClose={() => setIsFileRequestModalOpen(false)}
        accounts={accounts}
        folders={allFolders}
        showToast={(msg, type) => showToast(msg, type)}
      />

      <WebhookAlertsModal
        isOpen={isWebhookAlertsOpen}
        onClose={() => setIsWebhookAlertsOpen(false)}
        showToast={(msg, type) => showToast(msg, type)}
      />

      <DatabaseSecurityModal
        isOpen={isDatabaseModalOpen}
        onClose={() => setIsDatabaseModalOpen(false)}
        showToast={(msg, type) => showToast(msg, type)}
        onStatePulled={handleRestoreComplete}
      />

      <UploadProgressModal
        isOpen={isUploadModalOpen}
        isMinimized={isUploadModalMinimized}
        onToggleMinimize={() => setIsUploadModalMinimized((prev) => !prev)}
        onClose={() => setIsUploadModalOpen(false)}
        transfers={uploadTransfers}
        onClearCompleted={() =>
          setUploadTransfers((prev) =>
            prev.filter((t) => t.status === 'uploading' || t.status === 'queued')
          )
        }
        onRemoveTransfer={(id) =>
          setUploadTransfers((prev) => prev.filter((t) => t.id !== id))
        }
        onTriggerFileSelect={() => fileInputRef.current?.click()}
        onRemoteUrlUpload={handleRemoteUrlUpload}
        accounts={accounts}
      />

      {/* Enhanced Diagnostic Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md w-full px-4 animate-fadeIn select-text pointer-events-auto">
          <div
            className={`p-3.5 rounded-2xl shadow-2xl border flex flex-col gap-2 backdrop-blur-md transition-all ${
              toastMessage.type === 'error'
                ? 'bg-slate-900/95 border-rose-800/80 text-rose-200 shadow-rose-950/60'
                : toastMessage.type === 'info'
                ? 'bg-slate-900/95 border-sky-800/80 text-sky-200 shadow-sky-950/60'
                : 'bg-slate-900/95 border-emerald-800/80 text-emerald-200 shadow-emerald-950/60'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                {toastMessage.type === 'error' ? (
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                ) : toastMessage.type === 'info' ? (
                  <Cloud className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs tracking-tight text-slate-100">
                      {toastMessage.type === 'error'
                        ? 'Operation Error'
                        : toastMessage.type === 'info'
                        ? 'System Information'
                        : 'Success'}
                    </span>
                    {toastMessage.code && (
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-rose-950/80 border border-rose-800/80 text-rose-300 font-semibold">
                        {toastMessage.code}
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5 text-slate-200 leading-relaxed break-words font-medium">
                    {toastMessage.text}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setToastMessage(null)}
                aria-label="Close notification"
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {toastMessage.details && (
              <div className="border-t border-slate-800/80 pt-2 space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setToastMessage((prev) => (prev ? { ...prev, expanded: !prev.expanded } : null))
                    }
                    className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 font-medium transition-colors"
                  >
                    <span>{toastMessage.expanded ? 'Hide Technical Details' : 'View Microsoft Graph Details'}</span>
                    {toastMessage.expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {toastMessage.expanded && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(toastMessage.details || '');
                        setToastCopied(true);
                        setTimeout(() => setToastCopied(false), 2000);
                      }}
                      className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-1"
                    >
                      {toastCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{toastCopied ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>

                {toastMessage.expanded && (
                  <pre className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300 overflow-x-auto max-h-36 select-all">
                    {toastMessage.details}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VPS & Vercel Safe Speed Insights + Web Analytics */}
      <VercelTelemetry />
    </div>
  );
}
