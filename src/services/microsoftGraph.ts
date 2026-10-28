import { DriveAccount, DriveItem } from '../types/drive';
import { getFileCategory } from '../utils/driveLogic';
import { extractErrorMessage } from '../utils/formatError';

/**
 * Microsoft Graph API Client for OneDrive for Business
 * Features proactive background OAuth2 token refresh and direct OneDrive upload.
 */
export class MicrosoftGraphService {
  private static refreshPromises = new Map<string, Promise<string | null>>();

  /**
   * Extracts Azure AD appid (client_id), tid (tenant_id), and exp from a JWT access token
   * Works even if the access token is already expired!
   */
  static extractJwtClaims(token?: string): {
    appId?: string;
    tenantId?: string;
    expMs?: number;
  } {
    if (!token || typeof token !== 'string') return {};
    const parts = token.split('.');
    if (parts.length !== 3) return {};
    try {
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
      const payload = JSON.parse(atob(padded));
      return {
        appId: payload.appid || payload.azp || undefined,
        tenantId: payload.tid || undefined,
        expMs: typeof payload.exp === 'number' ? payload.exp * 1000 : undefined,
      };
    } catch {
      return {};
    }
  }

  /**
   * Sanitizes a filename so OneDrive Graph API never rejects it due to reserved characters
   */
  static sanitizeOneDriveFileName(rawName: string): string {
    const cleaned = (rawName || 'uploaded-file')
      .replace(/["*:<>?/\\|]/g, '_')
      .trim()
      .replace(/^\.+|\.+$/g, '');
    return cleaned || `file-${Date.now()}`;
  }

  /**
   * Checks whether an account's access token is expired or within 10 minutes of expiring
   */
  static isTokenExpiredOrExpiring(account?: DriveAccount): boolean {
    if (!account) return false;
    const bufferMs = 10 * 60 * 1000; // 10 minutes proactive buffer

    const token = account.accessToken || (account as any).access_token;
    const claims = this.extractJwtClaims(token);
    if (claims.appId && !account.clientId) {
      account.clientId = claims.appId;
    }
    if (claims.tenantId && (!account.tenantId || account.tenantId === 'common')) {
      account.tenantId = claims.tenantId;
    }
    if (claims.expMs) {
      account.expiresAt = claims.expMs;
      if (Date.now() >= claims.expMs - bufferMs) {
        return true;
      }
      return false;
    }

    if (account.expiresAt && typeof account.expiresAt === 'number') {
      if (Date.now() >= account.expiresAt - bufferMs) {
        return true;
      }
      return false;
    }

    // If expiresAt is unknown, refresh proactively once
    return true;
  }

  /**
   * Refreshes the access token for an account in the background (deduplicated per account)
   */
  static async refreshAccountToken(account: DriveAccount): Promise<string | null> {
    const refreshToken = account.refreshToken || (account as any).refresh_token;
    if (!refreshToken) return null;

    const existingPromise = this.refreshPromises.get(account.id);
    if (existingPromise) {
      return existingPromise;
    }

    const promise = (async (): Promise<string | null> => {
      let savedClientId = '';
      let savedClientSecret = '';
      let savedTenantId = '';
      try {
        savedClientId = localStorage.getItem('multidrive_oauth_client_id') || '';
        savedClientSecret = localStorage.getItem('multidrive_oauth_client_secret') || '';
        savedTenantId = localStorage.getItem('multidrive_oauth_tenant_id') || '';
      } catch {}

      const jwtClaims = this.extractJwtClaims(account.accessToken || (account as any).access_token);

      const clientId =
        account.clientId ||
        (account as any).client_id ||
        jwtClaims.appId ||
        savedClientId ||
        'c7e8e527-3932-4467-8451-b06bd9e013bf';
      const clientSecret =
        account.clientSecret || (account as any).client_secret || savedClientSecret || undefined;
      const tenant =
        account.tenantId ||
        (account as any).tenant_id ||
        jwtClaims.tenantId ||
        savedTenantId ||
        'common';

      // 1. Primary Refresh via Backend Server (supports Web Confidential Client with client_secret & server env vars)
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: account.id,
            refreshToken,
            accessToken: account.accessToken || (account as any).access_token,
            clientId,
            clientSecret,
            tenant,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.accessToken) {
            account.accessToken = data.accessToken;
            if (data.refreshToken) account.refreshToken = data.refreshToken;
            account.expiresAt = data.expiresAt || Date.now() + (data.expiresIn || 3600) * 1000;
            account.clientId = clientId;
            account.syncStatus = 'synced';
            account.needsReauth = false;
            account.authError = undefined;
            return data.accessToken;
          }
        }
      } catch {
        // Fall through to SPA direct browser token refresh
      }

      // 2. Fallback: Direct Browser Cross-Origin Refresh (supports Azure AD Single-Page Application platform)
      try {
        const bodyParams = new URLSearchParams({
          client_id: clientId,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        });
        const directRes = await fetch(
          `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: bodyParams.toString(),
          }
        );
        if (directRes.ok) {
          const data = await directRes.json();
          if (data.access_token) {
            account.accessToken = data.access_token;
            if (data.refresh_token) account.refreshToken = data.refresh_token;
            account.expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
            account.syncStatus = 'synced';
            account.needsReauth = false;
            account.authError = undefined;
            return data.access_token;
          }
        }
      } catch {
        // Ignore direct CORS error if app is confidential client
      }

      return null;
    })();

    this.refreshPromises.set(account.id, promise);
    try {
      return await promise;
    } finally {
      this.refreshPromises.delete(account.id);
    }
  }

  /**
   * Proactively ensures the account has a valid, non-expired access token before making Graph requests
   */
  static async ensureValidToken(
    account: DriveAccount | undefined,
    fallbackToken: string
  ): Promise<string> {
    if (!account) return fallbackToken;
    if (this.isTokenExpiredOrExpiring(account)) {
      const refreshed = await this.refreshAccountToken(account);
      if (refreshed) {
        return refreshed;
      }
    }
    return account.accessToken || fallbackToken;
  }

  /**
   * Universal Microsoft Graph request handler with proactive token refresh and server proxy
   */
  static async request(
    endpoint: string,
    accessToken: string,
    options: {
      method?: string;
      body?: any;
      headers?: Record<string, string>;
      isBinary?: boolean;
      account?: DriveAccount;
      retryCount?: number;
    } = {}
  ): Promise<any> {
    const { method = 'GET', body, headers = {}, isBinary = false, account, retryCount = 0 } = options;
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    // Proactively refresh token in background before calling Microsoft Graph
    let activeToken = await this.ensureValidToken(account, accessToken);

    const isAuthExpired = (status: number, msg: string) =>
      status === 401 ||
      msg.includes('InvalidAuthenticationToken') ||
      msg.includes('token lifetime') ||
      msg.includes('CompactToken') ||
      msg.includes('Lifetime validation failed');

    // If token was still expired (e.g. client_secret only exists on server), use server proxy first
    // so server can auto-refresh and we avoid browser 401 console warnings
    const shouldPreferProxy = account && this.isTokenExpiredOrExpiring(account) && !isBinary;

    if (!shouldPreferProxy) {
      try {
        const directUrl = `https://graph.microsoft.com/v1.0${cleanEndpoint}`;
        const directHeaders: Record<string, string> = {
          Authorization: `Bearer ${activeToken}`,
          ...headers,
        };

        if (body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob)) {
          directHeaders['Content-Type'] = 'application/json';
        }

        const res = await fetch(directUrl, {
          method,
          headers: directHeaders,
          body: body
            ? typeof body === 'string' || body instanceof Blob || body instanceof FormData
              ? body
              : JSON.stringify(body)
            : undefined,
        });

        if (res.ok) {
          if (account) {
            account.syncStatus = 'synced';
            account.needsReauth = false;
            account.authError = undefined;
          }
          if (isBinary) {
            return await res.blob();
          }
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            return await res.json();
          }
          return await res.text();
        }

        const errorJson = await res.json().catch(() => null);
        const errMsg = errorJson
          ? extractErrorMessage(errorJson)
          : `Graph API returned ${res.status}: ${res.statusText}`;

        if (isAuthExpired(res.status, errMsg) && account && retryCount === 0) {
          const freshToken = await this.refreshAccountToken(account);
          if (freshToken) {
            return this.request(endpoint, freshToken, { ...options, retryCount: 1 });
          }
        }
      } catch {
        // Network or CORS error on direct call; proceed to server proxy
      }
    }

    // Server Proxy call (automatically refreshes token server-side if needed)
    let savedClientId = '';
    let savedClientSecret = '';
    let savedTenantId = '';
    try {
      savedClientId = localStorage.getItem('multidrive_oauth_client_id') || '';
      savedClientSecret = localStorage.getItem('multidrive_oauth_client_secret') || '';
      savedTenantId = localStorage.getItem('multidrive_oauth_tenant_id') || '';
    } catch {}

    const proxyRes = await fetch('/api/graph/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: cleanEndpoint,
        method,
        accessToken: activeToken,
        accountId: account?.id,
        refreshToken: account?.refreshToken || (account as any)?.refresh_token,
        clientId: account?.clientId || (account as any)?.client_id || savedClientId || undefined,
        clientSecret:
          account?.clientSecret || (account as any)?.client_secret || savedClientSecret || undefined,
        tenant: account?.tenantId || (account as any)?.tenant_id || savedTenantId || 'common',
        body,
        headers,
      }),
    });

    const data = await proxyRes.json().catch(() => null);

    // Apply any server-refreshed token back to the account in memory
    if (data && data._refreshedAuth && account) {
      account.accessToken = data._refreshedAuth.accessToken;
      if (data._refreshedAuth.refreshToken) {
        account.refreshToken = data._refreshedAuth.refreshToken;
      }
      if (data._refreshedAuth.expiresAt) {
        account.expiresAt = data._refreshedAuth.expiresAt;
      }
      account.syncStatus = 'synced';
      account.needsReauth = false;
      account.authError = undefined;
    }

    if (!proxyRes.ok || data?._graphError) {
      const errMsg = data
        ? extractErrorMessage(data, `Graph request returned status ${data.status || proxyRes.status}`)
        : `Graph request failed with status ${proxyRes.status}`;
      throw new Error(errMsg);
    }

    return data || { status: 'ok' };
  }

  /**
   * Get authenticated user profile details
   */
  static async getUserProfile(accessToken: string): Promise<{
    id: string;
    displayName: string;
    mail: string;
    userPrincipalName: string;
    jobTitle?: string;
  }> {
    const data = await this.request('/me', accessToken);
    return {
      id: data.id,
      displayName: data.displayName || 'OneDrive User',
      mail: data.mail || data.userPrincipalName || 'user@microsoft.com',
      userPrincipalName: data.userPrincipalName || '',
      jobTitle: data.jobTitle,
    };
  }

  /**
   * Get OneDrive for Business storage quota details
   */
  static async getDriveQuota(
    accessToken: string,
    account?: DriveAccount
  ): Promise<{
    total: number;
    used: number;
    remaining: number;
    state: 'normal' | 'nearing' | 'critical' | 'exceeded';
    driveId: string;
  }> {
    const data = await this.request('/me/drive', accessToken, { account });
    const quota = data.quota || {};
    const total = quota.total || 1099511627776; // 1 TB default for OneDrive Business
    const used = quota.used || 0;
    const remaining = quota.remaining ?? Math.max(0, total - used);
    const state = quota.state || 'normal';

    return {
      total,
      used,
      remaining,
      state: state as any,
      driveId: data.id || 'me-drive',
    };
  }

  /**
   * Maps a Microsoft Graph DriveItem resource to our internal DriveItem format
   */
  static mapGraphItem(item: any, account: DriveAccount): DriveItem {
    const isFolder = !!item.folder;
    const mimeType = item.file?.mimeType || (isFolder ? 'folder' : undefined);
    const fileType = isFolder ? 'folder' : getFileCategory(item.name, mimeType);

    return {
      id: item.id,
      name: item.name,
      accountId: account.id,
      accountName: account.name,
      accountColor: account.color,
      parentId:
        item.parentReference?.id && item.parentReference.id !== 'root'
          ? item.parentReference.id
          : null,
      isFolder,
      size: item.size || 0,
      lastModifiedDateTime: item.lastModifiedDateTime || new Date().toISOString(),
      createdDateTime: item.createdDateTime || new Date().toISOString(),
      webUrl: item.webUrl || `https://onedrive.live.com/?id=${item.id}`,
      downloadUrl: item['@microsoft.graph.downloadUrl'],
      mimeType,
      fileType,
      eTag: item.eTag,
      shared: !!item.shared,
    };
  }

  /**
   * List children of a folder (or root)
   */
  static async listChildren(
    accessToken: string,
    account: DriveAccount,
    folderId: string = 'root'
  ): Promise<DriveItem[]> {
    const endpoint =
      folderId === 'root' || !folderId
        ? '/me/drive/root/children?$top=200&$expand=thumbnails'
        : `/me/drive/items/${folderId}/children?$top=200&$expand=thumbnails`;

    const data = await this.request(endpoint, accessToken, { account });
    const rawItems: any[] = data.value || [];
    return rawItems.map((item) => this.mapGraphItem(item, account));
  }

  /**
   * Search files within a drive using Microsoft Graph search endpoint
   */
  static async searchDrive(
    accessToken: string,
    account: DriveAccount,
    query: string
  ): Promise<DriveItem[]> {
    if (!query.trim()) return [];
    const endpoint = `/me/drive/root/search(q='${encodeURIComponent(query)}')?$top=100`;
    const data = await this.request(endpoint, accessToken, { account });
    const rawItems: any[] = data.value || [];
    return rawItems.map((item) => this.mapGraphItem(item, account));
  }

  /**
   * Create a new folder
   */
  static async createFolder(
    accessToken: string,
    account: DriveAccount,
    parentFolderId: string | null,
    folderName: string
  ): Promise<DriveItem> {
    const endpoint =
      !parentFolderId || parentFolderId === 'root'
        ? '/me/drive/root/children'
        : `/me/drive/items/${parentFolderId}/children`;

    const body = {
      name: folderName,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'rename',
    };

    const res = await this.request(endpoint, accessToken, {
      method: 'POST',
      body,
      account,
    });

    return this.mapGraphItem(res, account);
  }

  /**
   * Delete an item (moves to OneDrive recycle bin)
   */
  static async deleteItem(
    accessToken: string,
    itemId: string,
    account?: DriveAccount
  ): Promise<boolean> {
    await this.request(`/me/drive/items/${itemId}`, accessToken, {
      method: 'DELETE',
      account,
    });
    return true;
  }

  /**
   * Rename an item
   */
  static async renameItem(
    accessToken: string,
    account: DriveAccount,
    itemId: string,
    newName: string
  ): Promise<DriveItem> {
    const res = await this.request(`/me/drive/items/${itemId}`, accessToken, {
      method: 'PATCH',
      body: { name: newName },
      account,
    });
    return this.mapGraphItem(res, account);
  }

  /**
   * Create sharing link for an item
   */
  static async createSharingLink(
    accessToken: string,
    itemId: string,
    type: 'view' | 'edit' = 'view',
    account?: DriveAccount
  ): Promise<string> {
    const res = await this.request(`/me/drive/items/${itemId}/createLink`, accessToken, {
      method: 'POST',
      body: {
        type,
        scope: 'organization',
      },
      account,
    });
    return res.link?.webUrl || '';
  }

  /**
   * Helper to perform an XMLHttpRequest upload with byte-level upload.onprogress telemetry
   */
  private static xhrUpload(
    url: string,
    method: 'PUT' | 'POST',
    headers: Record<string, string>,
    body: Document | XMLHttpRequestBodyInit | null,
    onByteProgress?: (loaded: number, total: number) => void
  ): Promise<{ ok: boolean; status: number; data: any }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
      for (const [k, v] of Object.entries(headers)) {
        xhr.setRequestHeader(k, v);
      }

      if (xhr.upload && onByteProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            onByteProgress(event.loaded, event.total);
          }
        };
      }

      xhr.onload = () => {
        let parsed: any = null;
        try {
          parsed = JSON.parse(xhr.responseText);
        } catch {
          parsed = null;
        }
        resolve({
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          data: parsed,
        });
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(body);
    });
  }

  /**
   * Upload file directly to OneDrive with proactive background token refresh,
   * real-time byte progress telemetry, resumable upload session support for large files (> 4MB),
   * automatic root fallback when folder belongs to another drive, and server proxy fallback.
   */
  static async uploadFile(
    accessToken: string,
    account: DriveAccount,
    parentFolderId: string | null,
    file: File,
    onProgress?: (loadedBytes: number, totalBytes: number) => void
  ): Promise<DriveItem> {
    const totalSize = Math.max(1, file.size);
    onProgress?.(0, totalSize);

    const safeFileName = this.sanitizeOneDriveFileName(file.name);

    // 1. Proactively ensure the access token is refreshed BEFORE starting the upload
    let activeToken = await this.ensureValidToken(account, accessToken || account.accessToken || (account as any).access_token || '');

    const isRootOrLocalFolder =
      !parentFolderId ||
      parentFolderId === 'root' ||
      parentFolderId.startsWith('fold-') ||
      parentFolderId.startsWith('upload-') ||
      parentFolderId.startsWith('copy-');

    const rootPath = `/me/drive/root:/${encodeURIComponent(safeFileName)}`;
    const targetPath = isRootOrLocalFolder
      ? rootPath
      : `/me/drive/items/${parentFolderId}:/${encodeURIComponent(safeFileName)}`;

    // 2. For files > 4 MB, try Microsoft Graph Resumable Upload Session directly to OneDrive
    const FOUR_MB = 4 * 1024 * 1024;
    if (file.size > FOUR_MB) {
      try {
        let sessionData: any = null;
        try {
          sessionData = await this.request(`${targetPath}:/createUploadSession`, activeToken, {
            method: 'POST',
            body: {
              item: {
                '@microsoft.graph.conflictBehavior': 'rename',
                name: safeFileName,
              },
            },
            account,
          });
        } catch {
          if (targetPath !== rootPath) {
            sessionData = await this.request(`${rootPath}:/createUploadSession`, activeToken, {
              method: 'POST',
              body: {
                item: {
                  '@microsoft.graph.conflictBehavior': 'rename',
                  name: safeFileName,
                },
              },
              account,
            });
          }
        }

        if (sessionData?.uploadUrl) {
          const chunkSize = 327680 * 10; // ~3.2 MB chunks (multiple of 320 KiB as required by OneDrive)
          let offset = 0;
          let finalItem: any = null;

          while (offset < file.size) {
            const chunkEnd = Math.min(offset + chunkSize, file.size);
            const chunkBlob = file.slice(offset, chunkEnd);
            const currentOffset = offset;

            const chunkRes = await this.xhrUpload(
              sessionData.uploadUrl,
              'PUT',
              {
                'Content-Range': `bytes ${offset}-${chunkEnd - 1}/${file.size}`,
              },
              chunkBlob,
              (loaded) => {
                onProgress?.(Math.min(file.size, currentOffset + loaded), totalSize);
              }
            );

            if (!chunkRes.ok && chunkRes.status !== 202) {
              throw new Error(`OneDrive chunk upload failed with status ${chunkRes.status}`);
            }

            if (chunkRes.status === 200 || chunkRes.status === 201) {
              finalItem = chunkRes.data;
            }

            offset = chunkEnd;
            onProgress?.(offset, totalSize);
          }

          if (finalItem) {
            onProgress?.(totalSize, totalSize);
            return this.mapGraphItem(finalItem, account);
          }
        }
      } catch (sessionErr) {
        console.warn('Browser chunked session fallback to server upload proxy:', sessionErr);
      }
    }

    // 3. Direct PUT upload to OneDrive for files <= 4 MB with XMLHttpRequest progress
    if (file.size <= FOUR_MB && activeToken) {
      const executeDirectPut = async (pathToUse: string, tokenToUse: string) => {
        const directUploadUrl = `https://graph.microsoft.com/v1.0${pathToUse}:/content?@microsoft.graph.conflictBehavior=rename`;
        return this.xhrUpload(
          directUploadUrl,
          'PUT',
          {
            Authorization: `Bearer ${tokenToUse}`,
            'Content-Type': file.type || 'application/octet-stream',
          },
          file,
          (loaded) => {
            onProgress?.(Math.min(totalSize, loaded), totalSize);
          }
        );
      };

      try {
        let res = await executeDirectPut(targetPath, activeToken);

        // If 401 occurs, refresh token immediately and retry direct PUT to OneDrive
        if (res.status === 401) {
          const freshToken = await this.refreshAccountToken(account);
          if (freshToken) {
            activeToken = freshToken;
            res = await executeDirectPut(targetPath, activeToken);
          }
        }

        // If 404 or 400 occurs on subfolder (e.g. folder belongs to another drive during load balancing), retry at root
        if ((res.status === 404 || res.status === 400) && targetPath !== rootPath) {
          res = await executeDirectPut(rootPath, activeToken);
        }

        if (res.ok && res.data && res.data.id) {
          onProgress?.(totalSize, totalSize);
          account.syncStatus = 'synced';
          account.needsReauth = false;
          account.authError = undefined;
          return this.mapGraphItem(res.data, account);
        }
      } catch {
        // Fall through to server-proxied OneDrive upload
      }
    }

    // 4. Server Proxy Upload (handles confidential client token refresh, resumable sessions, and root fallback)
    const base64Content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file for upload'));
      reader.readAsDataURL(file);
    });

    let savedClientId = '';
    let savedClientSecret = '';
    let savedTenantId = '';
    try {
      savedClientId = localStorage.getItem('multidrive_oauth_client_id') || '';
      savedClientSecret = localStorage.getItem('multidrive_oauth_client_secret') || '';
      savedTenantId = localStorage.getItem('multidrive_oauth_tenant_id') || '';
    } catch {}

    const jwtClaims = this.extractJwtClaims(activeToken || account.accessToken || (account as any).access_token);

    const payloadStr = JSON.stringify({
      fileName: safeFileName,
      parentFolderId: isRootOrLocalFolder ? null : parentFolderId,
      mimeType: file.type || 'application/octet-stream',
      base64Content,
      accessToken: activeToken || account.accessToken || (account as any).access_token,
      accountId: account.id,
      refreshToken: account.refreshToken || (account as any).refresh_token,
      clientId:
        account.clientId ||
        (account as any).client_id ||
        jwtClaims.appId ||
        savedClientId ||
        undefined,
      clientSecret:
        account.clientSecret || (account as any).client_secret || savedClientSecret || undefined,
      tenant:
        account.tenantId ||
        (account as any).tenant_id ||
        jwtClaims.tenantId ||
        savedTenantId ||
        'common',
    });

    const proxyRes = await this.xhrUpload(
      '/api/graph/upload',
      'POST',
      { 'Content-Type': 'application/json' },
      payloadStr,
      (loaded, total) => {
        const ratio = total > 0 ? loaded / total : 0;
        onProgress?.(Math.round(ratio * totalSize), totalSize);
      }
    );

    const proxyData = proxyRes.data;
    if (proxyData?._refreshedAuth) {
      account.accessToken = proxyData._refreshedAuth.accessToken;
      if (proxyData._refreshedAuth.refreshToken) {
        account.refreshToken = proxyData._refreshedAuth.refreshToken;
      }
      if (proxyData._refreshedAuth.expiresAt) {
        account.expiresAt = proxyData._refreshedAuth.expiresAt;
      }
      account.syncStatus = 'synced';
      account.needsReauth = false;
      account.authError = undefined;
    }

    if (proxyData?.success && proxyData.item) {
      onProgress?.(totalSize, totalSize);
      return this.mapGraphItem(proxyData.item, account);
    }

    throw new Error(proxyData?.error || 'Could not upload file to Microsoft OneDrive');
  }
}
