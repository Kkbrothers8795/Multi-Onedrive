export type AccountType = 'business' | 'education' | 'personal';

export interface DriveAccount {
  id: string;
  name: string;
  email: string;
  tenantName: string;
  accountType: AccountType;
  color: string;
  isLive: boolean; // true if connected via real Microsoft Graph OAuth2
  clientId?: string;
  tenantId?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  deltaToken?: string; // Microsoft Graph delta token for incremental sync
  lastSyncedAt?: string;
  syncStatus?: 'idle' | 'syncing' | 'error' | 'synced';
  quota: {
    total: number;
    used: number;
    remaining: number;
    state: 'normal' | 'nearing' | 'critical' | 'exceeded';
  };
  connectedAt: string;
}

export type FileCategory =
  | 'folder'
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'pdf'
  | 'image'
  | 'video'
  | 'audio'
  | 'archive'
  | 'code'
  | 'other';

export interface DriveItem {
  id: string;
  name: string;
  accountId: string;
  accountName: string;
  accountColor: string;
  parentId: string | null; // null represents drive root
  isFolder: boolean;
  size: number; // in bytes
  lastModifiedDateTime: string;
  createdDateTime: string;
  webUrl: string;
  downloadUrl?: string;
  mimeType?: string;
  fileType: FileCategory;
  starred?: boolean;
  shared?: boolean;
  deleted?: boolean;
  content?: string; // sample or raw text content for previewing
  shareLink?: string;
  tags?: string[];
  eTag?: string;
}

export type ViewMode = 'grid' | 'list';

export type NavigationFilter = 'all' | 'recent' | 'starred' | 'shared' | 'trash';

export type SortField = 'name' | 'size' | 'date' | 'account';
export type SortOrder = 'asc' | 'desc';

export type DateFilterOption = 'any' | 'today' | '7days' | '30days' | 'year';
export type SizeFilterOption = 'any' | 'small' | 'medium' | 'large' | 'huge'; // small <1MB, medium 1-10MB, large 10-50MB, huge >50MB

export interface AdvancedFilterOptions {
  search?: string;
  accountId?: string | 'all';
  folderId?: string | null;
  category?: FileCategory | 'all';
  dateFilter?: DateFilterOption;
  sizeFilter?: SizeFilterOption;
  navFilter?: NavigationFilter;
  includeTrash?: boolean;
}

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  action: 'create_folder' | 'upload' | 'download' | 'delete' | 'restore' | 'rename' | 'move' | 'sync' | 'share';
  itemName: string;
  accountId: string;
  accountName: string;
  details?: string;
}

export interface DeltaSyncResult {
  addedOrUpdated: DriveItem[];
  deletedIds: string[];
  newDeltaToken?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  adminEmail?: string;
}

