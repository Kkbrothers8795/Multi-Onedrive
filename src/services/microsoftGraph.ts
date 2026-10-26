import { DriveAccount, DriveItem } from '../types/drive';
import { getFileCategory } from '../utils/driveLogic';

/**
 * Microsoft Graph API Client for OneDrive for Business
 */
export class MicrosoftGraphService {
  /**
   * Safe fetch with proxy fallback if browser CORS blocks
   */
  private static async request(
    endpoint: string,
    accessToken: string,
    options: {
      method?: string;
      body?: any;
      headers?: Record<string, string>;
      isBinary?: boolean;
    } = {}
  ): Promise<any> {
    const { method = 'GET', body, headers = {}, isBinary = false } = options;
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const directUrl = `https://graph.microsoft.com/v1.0${cleanEndpoint}`;

    try {
      const directHeaders: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        ...headers,
      };

      if (body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob)) {
        directHeaders['Content-Type'] = 'application/json';
      }

      const res = await fetch(directUrl, {
        method,
        headers: directHeaders,
        body: body ? (typeof body === 'string' || body instanceof Blob || body instanceof FormData ? body : JSON.stringify(body)) : undefined,
      });

      if (!res.ok) {
        // Try server proxy fallback if 401/403 or network error
        throw new Error(`Graph API returned ${res.status}: ${res.statusText}`);
      }

      if (isBinary) {
        return await res.blob();
      }

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return await res.json();
      }
      return await res.text();
    } catch (err: any) {
      // Fallback via server proxy
      console.warn('Direct Graph call failed, attempting via server proxy:', err.message);
      const proxyRes = await fetch('/api/graph/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: cleanEndpoint,
          method,
          accessToken,
          body,
          headers,
        }),
      });

      if (!proxyRes.ok) {
        const errorData = await proxyRes.json().catch(() => ({ error: 'Proxy request failed' }));
        throw new Error(errorData.error || `Graph request failed with status ${proxyRes.status}`);
      }

      return await proxyRes.json().catch(() => ({ status: 'ok' }));
    }
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
  static async getDriveQuota(accessToken: string): Promise<{
    total: number;
    used: number;
    remaining: number;
    state: 'normal' | 'nearing' | 'critical' | 'exceeded';
    driveId: string;
  }> {
    const data = await this.request('/me/drive', accessToken);
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
      parentId: item.parentReference?.id && item.parentReference.id !== 'root' ? item.parentReference.id : null,
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
    const endpoint = folderId === 'root' || !folderId
      ? '/me/drive/root/children?$top=200&$expand=thumbnails'
      : `/me/drive/items/${folderId}/children?$top=200&$expand=thumbnails`;

    const data = await this.request(endpoint, accessToken);
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
    const data = await this.request(endpoint, accessToken);
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
    const endpoint = !parentFolderId || parentFolderId === 'root'
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
    });

    return this.mapGraphItem(res, account);
  }

  /**
   * Delete an item (moves to OneDrive recycle bin)
   */
  static async deleteItem(accessToken: string, itemId: string): Promise<boolean> {
    await this.request(`/me/drive/items/${itemId}`, accessToken, {
      method: 'DELETE',
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
    });
    return this.mapGraphItem(res, account);
  }

  /**
   * Create sharing link for an item
   */
  static async createSharingLink(
    accessToken: string,
    itemId: string,
    type: 'view' | 'edit' = 'view'
  ): Promise<string> {
    const res = await this.request(`/me/drive/items/${itemId}/createLink`, accessToken, {
      method: 'POST',
      body: {
        type,
        scope: 'organization', // Business standard
      },
    });
    return res.link?.webUrl || '';
  }

  /**
   * Upload file to OneDrive (simple direct upload)
   */
  static async uploadFile(
    accessToken: string,
    account: DriveAccount,
    parentFolderId: string | null,
    file: File
  ): Promise<DriveItem> {
    const parentPath = !parentFolderId || parentFolderId === 'root'
      ? `/me/drive/root:/${encodeURIComponent(file.name)}:/content`
      : `/me/drive/items/${parentFolderId}:/${encodeURIComponent(file.name)}:/content`;

    const fileBuffer = await file.arrayBuffer();

    const res = await fetch(`https://graph.microsoft.com/v1.0${parentPath}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: fileBuffer,
    });

    if (!res.ok) {
      throw new Error(`Upload failed with status: ${res.statusText}`);
    }

    const item = await res.json();
    return this.mapGraphItem(item, account);
  }
}
