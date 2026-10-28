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
  clientSecret?: string;
  tenantId?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  deltaToken?: string; // Microsoft Graph delta token for incremental sync
  lastSyncedAt?: string;
  syncStatus?: 'idle' | 'syncing' | 'error' | 'synced';
  needsReauth?: boolean;
  authError?: string;
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
  sharePin?: string; // Optional security PIN for downloading/previewing
  expiresAt?: string; // ISO string for link expiration
  downloadCount?: number;
  lastDownloadedAt?: string;
  tags?: string[];
  eTag?: string;
}

export type ViewMode = 'grid' | 'list';

export type NavigationFilter = 'all' | 'recent' | 'starred' | 'shared' | 'trash' | 'analytics';

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
  action: 'create_folder' | 'upload' | 'download' | 'delete' | 'restore' | 'rename' | 'move' | 'sync' | 'share' | 'migrate';
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

export interface DailyBandwidthStat {
  date: string;
  bytes: number;
  downloads: number;
}

export interface TopFileStat {
  id: string;
  name: string;
  fileType: FileCategory;
  downloads: number;
  bytes: number;
  accountName: string;
}

export interface VisitorLog {
  id: string;
  fileId: string;
  fileName: string;
  ip: string;
  country: string;
  countryCode: string;
  city: string;
  userAgent: string;
  timestamp: string;
  bytes: number;
}

export interface AnalyticsSummary {
  totalDownloads: number;
  totalBytesServed: number;
  uniqueVisitors: number;
  topCountry: string;
  dailyBandwidth: DailyBandwidthStat[];
  topFiles: TopFileStat[];
  recentLogs: VisitorLog[];
}

export interface CloudMigrationRequest {
  itemIds: string[];
  sourceAccountId: string;
  targetAccountId: string;
  mode: 'copy' | 'move';
}

export interface UploadTransferItem {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedBytes: number;
  speedBps: number;
  etaSeconds: number;
  progress: number;
  status: 'queued' | 'uploading' | 'completed' | 'error';
  accountId: string;
  accountName: string;
  accountColor: string;
  fileType: FileCategory;
  startedAt: number;
  completedAt?: number;
  errorMessage?: string;
  sourceType?: 'local' | 'url';
}

export interface FileRequestLink {
  id: string;
  title: string;
  description?: string;
  accountId: string; // 'auto' or specific account ID
  accountName: string;
  folderId: string | null;
  folderName: string;
  pin?: string;
  expiresAt?: string;
  maxFileSizeMB?: number;
  createdAt: string;
  uploadCount: number;
  totalBytesUploaded: number;
  active: boolean;
}

export interface WebhookConfig {
  enabled: boolean;
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  discordEnabled: boolean;
  discordWebhookUrl: string;
  customWebhookEnabled: boolean;
  customWebhookUrl: string;
  events: {
    onUpload: boolean;
    onDownload: boolean;
    onLowStorage: boolean;
    onFileRequestUpload: boolean;
    onDeduplicate: boolean;
  };
}

export interface WebhookDeliveryLog {
  id: string;
  timestamp: string;
  channel: 'telegram' | 'discord' | 'webhook';
  event: string;
  message: string;
  success: boolean;
  error?: string;
}

export interface DuplicateGroup {
  key: string;
  fileName: string;
  size: number;
  matchType: 'exact_name_size' | 'content_hash' | 'normalized_stem';
  items: DriveItem[];
  wastedBytes: number;
}


