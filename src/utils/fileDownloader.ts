import JSZip from 'jszip';
import { DriveItem } from '../types/drive';

/**
 * Triggers browser download for a single file item
 */
export async function downloadSingleFile(item: DriveItem): Promise<void> {
  try {
    if (item.downloadUrl) {
      // Direct Microsoft Graph download URL
      const link = document.createElement('a');
      link.href = item.downloadUrl;
      link.download = item.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Blob fallback (e.g. content or sample text)
    const content = item.content || `MultiDrive OneDrive for Business Item: ${item.name}\nSize: ${item.size} bytes\nAccount: ${item.accountName}`;
    const blob = new Blob([content], { type: item.mimeType || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = item.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
    if (item.isFolder) continue; // Skip folders or create sub-folders if needed

    // Organize folders inside zip by account name to avoid conflicts
    const accountFolder = zip.folder(item.accountName.replace(/[/\\?%*:|"<>]/g, '_')) || zip;

    if (item.downloadUrl) {
      try {
        const res = await fetch(item.downloadUrl);
        const blob = await res.blob();
        accountFolder.file(item.name, blob);
      } catch {
        accountFolder.file(item.name, item.content || `File content placeholder for ${item.name}`);
      }
    } else {
      const content = item.content || `OneDrive for Business Item: ${item.name}\nSource Drive: ${item.accountName}\nSize: ${item.size} bytes`;
      accountFolder.file(item.name, content);
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
