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
import { LoginScreen } from './components/LoginScreen';
import { PublicDownloadView } from './components/PublicDownloadView';
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
} from 'lucide-react';

export default function App() {
  // 1. Check for public direct download/share links (?download=FILE_ID or ?share=FILE_ID)
  // Public downloads do NOT require login.
  const [publicFileId, setPublicFileId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('download') || params.get('share');
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
      if (dismissed) return [];
      const saved = localStorage.getItem('onedrive_multidrive_accounts');
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

  // Real-time synchronization
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(new Date().toISOString());

  // Toast notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

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

  // Verify Admin Session on mount (unless on public download link)
  useEffect(() => {
    if (publicFileId) {
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
  }, [publicFileId]);

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

        // If server has saved accounts, load them!
        if (Array.isArray(data.accounts) && data.accounts.length > 0) {
          setAccounts(data.accounts);
          if (Array.isArray(data.items)) {
            setItems(data.items);
          }
        } else {
          // Check local storage for any previously saved accounts
          let loadedFromLocal = false;
          try {
            const savedAcc = localStorage.getItem('onedrive_multidrive_accounts');
            const savedItems = localStorage.getItem('onedrive_multidrive_items');
            if (savedAcc) {
              const parsed = JSON.parse(savedAcc);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setAccounts(parsed);
                if (savedItems) setItems(JSON.parse(savedItems));
                loadedFromLocal = true;
              }
            }
          } catch {}

          // If no accounts exist anywhere, keep empty. NEVER auto-seed demo accounts!
          if (!loadedFromLocal) {
            setAccounts([]);
            setItems([]);
          }
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

  // Toast helper
  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 3500);
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

  // Real-time synchronization runner
  const triggerRealtimeSync = async (isManual: boolean = false) => {
    if (isSyncing) return;
    setIsSyncing(true);

    try {
      // Sync live connected accounts via Microsoft Graph API
      const liveAccounts = accounts.filter((a) => a.isLive && a.accessToken);

      for (const liveAcc of liveAccounts) {
        try {
          const quota = await MicrosoftGraphService.getDriveQuota(liveAcc.accessToken!);
          const latestItems = await MicrosoftGraphService.listChildren(liveAcc.accessToken!, liveAcc, 'root');

          setAccounts((prev) =>
            prev.map((acc) =>
              acc.id === liveAcc.id
                ? {
                    ...acc,
                    quota: {
                      total: quota.total,
                      used: quota.used,
                      remaining: quota.remaining,
                      state: quota.state,
                    },
                    lastSyncedAt: new Date().toISOString(),
                    syncStatus: 'synced',
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
          console.error(`Live account sync error for ${liveAcc.name}:`, err);
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
    } catch {
      showToast(`Failed to download "${item.name}"`, 'error');
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
    } catch {
      showToast('Failed to create ZIP download', 'error');
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
        console.error('Failed to create folder on Microsoft Graph:', err);
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
      MicrosoftGraphService.renameItem(acc.accessToken, acc, item.id, newName).catch(console.error);
    }
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

  // File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const targetAccount = currentAccount || accounts[0];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const category = getFileCategory(file.name, file.type);

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
        } else if (file.type.startsWith('video/') || file.type.startsWith('audio/') || file.type === 'application/pdf') {
          downloadUrl = URL.createObjectURL(file);
        }
      } catch {
        sampleContent = undefined;
      }

      const newItem: DriveItem = {
        id: `upload-${Date.now()}-${i}`,
        name: file.name,
        accountId: targetAccount.id,
        accountName: targetAccount.name,
        accountColor: targetAccount.color,
        parentId: currentFolderId,
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

      logActivity('upload', file.name, targetAccount.name, targetAccount.id);

      // Live account graph upload
      if (targetAccount.isLive && targetAccount.accessToken) {
        MicrosoftGraphService.uploadFile(
          targetAccount.accessToken,
          targetAccount,
          currentFolderId,
          file
        ).catch(console.error);
      }
    }

    showToast(`Uploaded ${files.length} file(s) to ${targetAccount.name}`);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Add new connected account
  const handleAddAccount = (newAccount: DriveAccount) => {
    setAccounts((prev) => [...prev, newAccount]);
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

  // 1. Render Public Unauthenticated Download Link View
  if (publicFileId) {
    return (
      <PublicDownloadView
        fileId={publicFileId}
        cachedItems={items}
        onNavigateToLogin={() => {
          window.history.replaceState({}, '', window.location.pathname);
          setPublicFileId(null);
        }}
      />
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
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-white">
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
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onSelectAccount={(accId) => {
            setSelectedAccountId(accId);
            setCurrentFolderId(null);
            handleClearSelection();
          }}
          activeNavFilter={navFilter}
          onSelectNavFilter={(filter) => {
            setNavFilter(filter);
            setCurrentFolderId(null);
            handleClearSelection();
          }}
          onOpenConnectModal={() => setIsConnectModalOpen(true)}
          onOpenStatsModal={() => setIsStatsModalOpen(true)}
          aggregateStorage={aggregateStorage}
        />

        {/* Center Content Workspace */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-950 overflow-y-auto">
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
            onBatchDownloadZip={handleBatchDownloadZip}
            onBatchMoveClick={() => {
              const moving = items.filter((i) => selectedIds.has(i.id));
              setItemsToMove(moving);
            }}
            onBatchDeleteClick={handleBatchDelete}
            onClearSelection={handleClearSelection}
            onSelectAll={handleSelectAll}
            isAllSelected={selectedIds.size > 0 && selectedIds.size === visibleItems.length}
            totalVisibleCount={visibleItems.length}
            currentAccount={currentAccount}
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
        </main>
      </div>

      {/* Modals & Dialogs */}
      <FilePreviewModal
        item={previewItem}
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
      />

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

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-750 text-xs text-slate-100 shadow-2xl animate-bounce">
          {toastMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
}
