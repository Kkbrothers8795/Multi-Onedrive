import JSZip from 'jszip';
import { DriveItem } from '../types/drive';

/**
 * Triggers browser download for a single file item
 */
export async function downloadSingleFile(item: DriveItem): Promise<void> {
  try {
    if (item.downloadUrl && item.downloadUrl.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = item.downloadUrl;
      link.download = item.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Always route through site permanent streaming proxy so the download is handled by the site
    const downloadLink = `/api/public/download/${encodeURIComponent(item.id)}`;
    const link = document.createElement('a');
    link.href = downloadLink;
    link.download = item.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('File download failed:', err);
    throw err;
  }
}

/**
 * Packs multiple items across OneDrive accounts into a single ZIP archive and downloads it
 */
export async function downloadItemsAsZip(
  items: DriveItem[],
  zipFilename: string = 'MultiDrive_Export.zip'
): Promise<void> {
  const zip = new JSZip();

  for (const item of items) {
    if (item.isFolder) continue; // Skip folders

    // Organize folders inside zip by account name to avoid conflicts
    const accountFolder = zip.folder(item.accountName.replace(/[/\\?%*:|"<>]/g, '_')) || zip;

    try {
      if (item.downloadUrl && item.downloadUrl.startsWith('data:')) {
        const base64Data = item.downloadUrl.split(',')[1];
        if (base64Data) {
          accountFolder.file(item.name, base64Data, { base64: true });
          continue;
        }
      }

      // Fetch via site proxy
      const res = await fetch(`/api/public/download/${encodeURIComponent(item.id)}`);
      if (res.ok) {
        const blob = await res.blob();
        accountFolder.file(item.name, blob);
      } else {
        accountFolder.file(item.name, item.content || `MultiDrive File: ${item.name}\nAccount: ${item.accountName}`);
      }
    } catch {
      accountFolder.file(item.name, item.content || `MultiDrive File: ${item.name}\nAccount: ${item.accountName}`);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = zipFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
