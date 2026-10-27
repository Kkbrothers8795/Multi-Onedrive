import {
  DriveItem,
  DriveAccount,
  FileCategory,
  SortField,
  SortOrder,
  NavigationFilter,
  AdvancedFilterOptions,
  DateFilterOption,
  SizeFilterOption,
  DeltaSyncResult,
} from '../types/drive';

/**
 * Formats bytes to human-readable format (B, KB, MB, GB, TB)
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  if (bytes < 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
  return `${val} ${sizes[i] || 'TB'}`;
}

/**
 * Formats ISO date to readable relative or local date
 */
export function formatRelativeTime(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Categorizes a file by its extension or MIME type
 */
export function getFileCategory(fileName: string, mimeType?: string): FileCategory {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (mimeType) {
    if (mimeType.includes('folder')) return 'folder';
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('image')) return 'image';
    if (mimeType.includes('video')) return 'video';
    if (mimeType.includes('audio')) return 'audio';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'spreadsheet';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('gzip') || mimeType.includes('rar')) return 'archive';
    if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('xml')) return 'code';
  }

  // Fallback by extension
  if (['docx', 'doc', 'rtf', 'odt', 'pages', 'txt', 'md'].includes(ext)) return 'document';
  if (['xlsx', 'xls', 'csv', 'tsv', 'numbers', 'ods'].includes(ext)) return 'spreadsheet';
  if (['pptx', 'ppt', 'key', 'odp'].includes(ext)) return 'presentation';
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'tiff', 'ico'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext)) return 'audio';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return 'archive';
  if (['ts', 'tsx', 'js', 'jsx', 'json', 'py', 'html', 'css', 'go', 'rs', 'java', 'c', 'cpp', 'sh', 'sql', 'yaml', 'yml'].includes(ext)) return 'code';

  return 'other';
}

/**
 * Checks if a date falls within the selected date filter range
 */
export function matchesDateFilter(isoDate: string, filter: DateFilterOption, now: number = Date.now()): boolean {
  if (filter === 'any' || !filter) return true;
  const time = new Date(isoDate).getTime();
  if (isNaN(time)) return true;

  const msInDay = 24 * 60 * 60 * 1000;
  const diffMs = now - time;

  switch (filter) {
    case 'today':
      return diffMs <= msInDay && diffMs >= 0;
    case '7days':
      return diffMs <= 7 * msInDay && diffMs >= 0;
    case '30days':
      return diffMs <= 30 * msInDay && diffMs >= 0;
    case 'year':
      return diffMs <= 365 * msInDay && diffMs >= 0;
    default:
      return true;
  }
}

/**
 * Checks if a file size falls within the selected size filter
 */
export function matchesSizeFilter(sizeInBytes: number, filter: SizeFilterOption, isFolder: boolean): boolean {
  if (filter === 'any' || !filter) return true;
  if (isFolder) return false;

  const MB = 1024 * 1024;
  switch (filter) {
    case 'small': // < 1 MB
      return sizeInBytes < 1 * MB;
    case 'medium': // 1 MB - 10 MB
      return sizeInBytes >= 1 * MB && sizeInBytes < 10 * MB;
    case 'large': // 10 MB - 50 MB
      return sizeInBytes >= 10 * MB && sizeInBytes < 50 * MB;
    case 'huge': // > 50 MB
      return sizeInBytes >= 50 * MB;
    default:
      return true;
  }
}

/**
 * Filter items according to search query, active account, folder, category, date, and size filters
 */
export function filterItems(items: DriveItem[], options: AdvancedFilterOptions): DriveItem[] {
  const {
    search = '',
    accountId = 'all',
    folderId = null,
    category = 'all',
    dateFilter = 'any',
    sizeFilter = 'any',
    navFilter = 'all',
  } = options;

  const searchLower = search.trim().toLowerCase();
  const isGlobalFilterActive = !!searchLower || dateFilter !== 'any' || sizeFilter !== 'any' || category !== 'all';

  return items.filter((item) => {
    // Trash filter: items marked deleted only show in 'trash' view
    if (navFilter === 'trash') {
      if (!item.deleted) return false;
    } else {
      if (item.deleted) return false;
    }

    // Account filter
    if (accountId && accountId !== 'all') {
      if (item.accountId !== accountId) return false;
    }

    // Navigation section filter
    if (navFilter === 'starred' && !item.starred) return false;
    if (navFilter === 'shared' && !item.shared) return false;
    if (navFilter === 'recent') {
      // Recent items within last 30 days
      const modifiedTime = new Date(item.lastModifiedDateTime).getTime();
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      if (modifiedTime < thirtyDaysAgo) return false;
    }

    // When NOT searching globally and NOT in special views:
    // constrain to the current folder level
    if (!isGlobalFilterActive && (navFilter === 'all' || !navFilter)) {
      if (item.parentId !== folderId) return false;
    }

    // Search query matching name, tags, or account
    if (searchLower) {
      const nameMatch = item.name.toLowerCase().includes(searchLower);
      const tagMatch = item.tags?.some((t) => t.toLowerCase().includes(searchLower));
      const accountMatch = item.accountName.toLowerCase().includes(searchLower);
      const contentMatch = item.content?.toLowerCase().includes(searchLower);
      if (!nameMatch && !tagMatch && !accountMatch && !contentMatch) return false;
    }

    // Category filter
    if (category && category !== 'all') {
      if (item.isFolder) return false; // files only for category filter
      if (item.fileType !== category) return false;
    }

    // Date modified filter
    if (!matchesDateFilter(item.lastModifiedDateTime, dateFilter)) {
      return false;
    }

    // Size filter
    if (!matchesSizeFilter(item.size, sizeFilter, item.isFolder)) {
      return false;
    }

    return true;
  });
}

/**
 * Sorts items, prioritizing folders first unless sorted by size or explicitly requested
 */
export function sortItems(
  items: DriveItem[],
  sortBy: SortField = 'name',
  sortOrder: SortOrder = 'asc'
): DriveItem[] {
  const factor = sortOrder === 'asc' ? 1 : -1;

  return [...items].sort((a, b) => {
    // Folders always come first unless sorting by size
    if (sortBy !== 'size') {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
    }

    switch (sortBy) {
      case 'name':
        return factor * a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      case 'size':
        return factor * (a.size - b.size);
      case 'date':
        return factor * (new Date(a.lastModifiedDateTime).getTime() - new Date(b.lastModifiedDateTime).getTime());
      case 'account':
        return factor * a.accountName.localeCompare(b.accountName);
      default:
        return 0;
    }
  });
}

/**
 * Calculates aggregate storage across all connected OneDrive accounts
 */
export function calculateAggregateStorage(accounts: DriveAccount[]): {
  total: number;
  used: number;
  remaining: number;
  percent: number;
} {
  const total = accounts.reduce((acc, a) => acc + (a.quota?.total || 0), 0);
  const used = accounts.reduce((acc, a) => acc + (a.quota?.used || 0), 0);
  const remaining = Math.max(0, total - used);
  const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

  return { total, used, remaining, percent };
}

/**
 * Builds breadcrumb trail from root to the currently selected folder
 */
export function buildBreadcrumbs(
  items: DriveItem[],
  currentFolderId: string | null,
  account?: DriveAccount
): { id: string | null; name: string }[] {
  const crumbs: { id: string | null; name: string }[] = [];

  crumbs.push({
    id: null,
    name: account ? account.name : 'All Drives',
  });

  if (!currentFolderId) return crumbs;

  let curr: DriveItem | undefined = items.find((it) => it.id === currentFolderId);
  const pathStack: { id: string; name: string }[] = [];

  const visited = new Set<string>();
  while (curr && !visited.has(curr.id)) {
    visited.add(curr.id);
    pathStack.unshift({ id: curr.id, name: curr.name });
    if (!curr.parentId) break;
    curr = items.find((it) => it.id === curr?.parentId);
  }

  return [...crumbs, ...pathStack];
}

/**
 * Performs batch delete (marks as deleted or moves to trash)
 */
export function batchDeleteItems(items: DriveItem[], itemIds: string[]): DriveItem[] {
  const idSet = new Set(itemIds);
  return items.map((item) => {
    if (idSet.has(item.id)) {
      return { ...item, deleted: true, lastModifiedDateTime: new Date().toISOString() };
    }
    return item;
  });
}

/**
 * Permanently deletes items
 */
export function batchPermanentDeleteItems(items: DriveItem[], itemIds: string[]): DriveItem[] {
  const idSet = new Set(itemIds);
  return items.filter((item) => !idSet.has(item.id));
}

/**
 * Restores items from trash
 */
export function batchRestoreItems(items: DriveItem[], itemIds: string[]): DriveItem[] {
  const idSet = new Set(itemIds);
  return items.map((item) => {
    if (idSet.has(item.id)) {
      return { ...item, deleted: false, lastModifiedDateTime: new Date().toISOString() };
    }
    return item;
  });
}

/**
 * Performs batch move to a target folder and target account
 */
export function batchMoveItems(
  items: DriveItem[],
  itemIds: string[],
  targetFolderId: string | null,
  targetAccount?: DriveAccount
): DriveItem[] {
  const idSet = new Set(itemIds);
  return items.map((item) => {
    if (idSet.has(item.id)) {
      return {
        ...item,
        parentId: targetFolderId,
        accountId: targetAccount ? targetAccount.id : item.accountId,
        accountName: targetAccount ? targetAccount.name : item.accountName,
        accountColor: targetAccount ? targetAccount.color : item.accountColor,
        lastModifiedDateTime: new Date().toISOString(),
      };
    }
    return item;
  });
}

/**
 * Merges delta sync changes into the existing items list
 */
export function applyDeltaChanges(existingItems: DriveItem[], delta: DeltaSyncResult): DriveItem[] {
  const deletedSet = new Set(delta.deletedIds);
  const updatedMap = new Map<string, DriveItem>();
  delta.addedOrUpdated.forEach((item) => updatedMap.set(item.id, item));

  // Filter out deleted items, replace updated ones
  const retained = existingItems
    .filter((item) => !deletedSet.has(item.id))
    .map((item) => (updatedMap.has(item.id) ? updatedMap.get(item.id)! : item));

  // Add brand new items
  const existingIds = new Set(retained.map((i) => i.id));
  const newItems = delta.addedOrUpdated.filter((item) => !existingIds.has(item.id));

  return [...retained, ...newItems];
}

/**
 * Returns distribution slices for each connected account
 */
export interface StorageAccountSlice {
  id: string;
  name: string;
  usedBytes: number;
  totalBytes: number;
  formattedUsed: string;
  formattedTotal: string;
  percentOfUsed: number;
  percentOfTotal: number;
  color: string;
}

export function getAccountStorageDistribution(accounts: DriveAccount[]): StorageAccountSlice[] {
  const totalUsed = accounts.reduce((sum, a) => sum + (a.quota?.used || 0), 0);
  return accounts.map((acc) => {
    const used = acc.quota?.used || 0;
    const total = acc.quota?.total || 0;
    return {
      id: acc.id,
      name: acc.name,
      usedBytes: used,
      totalBytes: total,
      formattedUsed: formatBytes(used),
      formattedTotal: formatBytes(total),
      percentOfUsed: totalUsed > 0 ? Math.round((used / totalUsed) * 100) : 0,
      percentOfTotal: total > 0 ? Math.round((used / total) * 100) : 0,
      color: acc.color,
    };
  });
}

/**
 * Calculates storage volume grouped by file category
 */
export function calculateStorageByCategory(items: DriveItem[]): {
  category: FileCategory;
  name: string;
  bytes: number;
  formatted: string;
  count: number;
  color: string;
}[] {
  const categoryColors: Record<FileCategory, string> = {
    folder: '#f59e0b',
    document: '#3b82f6',
    spreadsheet: '#10b981',
    presentation: '#f97316',
    pdf: '#f43f5e',
    image: '#a855f7',
    video: '#0ea5e9',
    audio: '#6366f1',
    archive: '#d97706',
    code: '#14b8a6',
    other: '#94a3b8',
  };

  const map = new Map<FileCategory, { bytes: number; count: number }>();
  for (const item of items) {
    if (item.deleted || item.isFolder) continue;
    const existing = map.get(item.fileType) || { bytes: 0, count: 0 };
    map.set(item.fileType, {
      bytes: existing.bytes + item.size,
      count: existing.count + 1,
    });
  }

  return Array.from(map.entries())
    .map(([cat, val]) => ({
      category: cat,
      name: cat.charAt(0).toUpperCase() + cat.slice(1) + 's',
      bytes: val.bytes,
      formatted: formatBytes(val.bytes),
      count: val.count,
      color: categoryColors[cat] || '#94a3b8',
    }))
    .sort((a, b) => b.bytes - a.bytes);
}

/**
 * Automatically determines the optimal OneDrive account for file uploads
 * based on highest remaining storage capacity and availability.
 */
export function findBestAccountForUpload(
  accounts: DriveAccount[],
  fileSize: number = 0
): { account: DriveAccount; freeBytes: number; formattedFree: string; reason: string } | null {
  if (!accounts || accounts.length === 0) return null;

  // Calculate remaining bytes for each account
  const evaluated = accounts.map((acc) => {
    const total = acc.quota?.total || 1099511627776; // default 1 TB
    const used = acc.quota?.used || 0;
    const free = Math.max(0, total - used);
    return { account: acc, freeBytes: free };
  });

  // Sort by highest free bytes first
  evaluated.sort((a, b) => b.freeBytes - a.freeBytes);

  // Find first account with enough free space for the file
  const candidate = evaluated.find((e) => e.freeBytes >= fileSize) || evaluated[0];
  if (!candidate) return null;

  return {
    account: candidate.account,
    freeBytes: candidate.freeBytes,
    formattedFree: formatBytes(candidate.freeBytes),
    reason: `Highest available capacity (${formatBytes(candidate.freeBytes)} free of ${formatBytes(candidate.account.quota?.total || 1099511627776)})`,
  };
}

/**
 * Performs direct cloud-to-cloud migration of files across connected accounts
 */
export function migrateItemsAcrossAccounts(
  items: DriveItem[],
  itemIds: string[],
  targetAccount: DriveAccount,
  mode: 'copy' | 'move'
): { updatedItems: DriveItem[]; migratedCount: number; totalBytes: number } {
  const idSet = new Set(itemIds);
  const targetItems = items.filter((i) => idSet.has(i.id));
  const totalBytes = targetItems.reduce((acc, i) => acc + (i.size || 0), 0);

  if (mode === 'move') {
    const updated = items.map((item) => {
      if (idSet.has(item.id)) {
        return {
          ...item,
          accountId: targetAccount.id,
          accountName: targetAccount.name,
          accountColor: targetAccount.color,
          lastModifiedDateTime: new Date().toISOString(),
        };
      }
      return item;
    });
    return { updatedItems: updated, migratedCount: targetItems.length, totalBytes };
  } else {
    // Copy mode: clone items with new IDs on target account
    const cloned: DriveItem[] = targetItems.map((orig) => ({
      ...orig,
      id: `copy-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: `Copy of ${orig.name}`,
      accountId: targetAccount.id,
      accountName: targetAccount.name,
      accountColor: targetAccount.color,
      createdDateTime: new Date().toISOString(),
      lastModifiedDateTime: new Date().toISOString(),
    }));
    return { updatedItems: [...cloned, ...items], migratedCount: cloned.length, totalBytes };
  }
}

