# MultiDrive for OneDrive for Business

> Enterprise multi-tenant OneDrive for Business file management, real-time sync, and multi-modal preview hub.

MultiDrive federates multiple Microsoft 365 and Azure Active Directory (Entra ID) OneDrive accounts into a unified, secure dashboard. It provides enterprise access control, storage aggregation, batch file operations, and native in-browser previews for images, video, audio, PDFs, text, and spreadsheets, while keeping public share links open for seamless recipient downloads.

---

## Key Features

- **Multi-Tenant Federation**: Connect and manage multiple independent Microsoft 365 / OneDrive for Business tenants simultaneously (Business Basic, Standard, Premium, E3, E5, and Educational).
- **Admin Access Control**: Zero-trust administrative login protects account configuration, management operations, and internal file browsing.
- **Public Share Links (No Login Required)**: Generate direct download and preview URLs (`/?download=<FILE_ID>` or `/api/public/download/<FILE_ID>`) that anyone can access without an account.
- **Multi-Modal File Previews**:
  - **Videos**: HTML5 player with playback speed selector (0.5x – 2.0x), 10-second skip buttons, scrubbable progress bar, volume controls, and fullscreen mode.
  - **Audio**: Custom player with interactive progress bar, waveform visualizer, ±10s skip controls, playback speed selection, and volume controls.
  - **Images**: High-resolution viewer with zoom in/out, 100% reset, 90° clockwise rotation, and view reset.
  - **PDF Documents**: Embedded document viewer with metadata summary, new-tab view link, and direct download option.
  - **Text, Code & Markdown**: Line numbers gutter, in-document keyword search, word-wrap toggle, syntax copy button, and formatted markdown vs. raw view toggle.
  - **Spreadsheets / CSV**: Table viewer with row numbers, column headers, zebra striping, and real-time in-table text filtering.
- **Persistent Storage**: Accounts, connected tenants, and files are saved to `server-store.json` (with `/tmp/server-store.json` fallback for Vercel/serverless environments), preventing demo data resurrection.
- **Batch Operations**: Multi-select files for batch download (zipped via JSZip), batch move across folders, star/unstar, and soft delete with Recycle Bin restore.
- **Storage Analytics**: Unified quota meters, aggregated storage distribution charts, and file category breakdowns powered by Recharts.
- **Live Microsoft Graph Sync**: Delta token synchronization simulates or connects directly to Microsoft Graph API for real-time change detection.

---

## Quick Start

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/your-username/multidrive-onedrive.git
cd multidrive-onedrive

# Install dependencies
npm install
```

### 2. Development Mode

```bash
# Start local development server (Express + Vite)
npm run dev
```

The app will start on `http://localhost:3000`.

### 3. Build & Production

```bash
# Build frontend assets
npm run build

# Start production server
npm start
```

---

## Configuration & Environment Variables

Create a `.env` file in the project root (see `.env.example`):

```bash
# Server Port
PORT=3000

# Administrator Password (used to unlock the management dashboard)
# Default if not set: admin123
ADMIN_PASSWORD=your_secure_admin_password

# Public URL of the deployed application (used for share link generation)
APP_URL=https://your-domain.com

# Optional: Microsoft Entra ID / Azure App Registration for live OAuth
# VITE_MS_CLIENT_ID=your-azure-app-client-id
# VITE_MS_TENANT_ID=common
```

---

## Deployment Guides

### Deploying to Vercel

MultiDrive is pre-configured for full out-of-the-box compatibility with Vercel serverless functions:

1. **Self-Contained Serverless Function**: The build script (`npm run build`) automatically builds the frontend and uses `esbuild` to bundle `server.ts` into a dedicated ESM serverless package at `api/server.js`, eliminating ESM module resolution issues (`ERR_MODULE_NOT_FOUND`).
2. **Environment Variables**: In your Vercel Project Dashboard (**Settings** > **Environment Variables**):
   - `ADMIN_PASSWORD`: Your administrator password (e.g., `mysecretpass`). The login handler accepts your environment variable password, saved password, or `admin123`.
   - `APP_URL`: Your Vercel production URL (e.g. `https://your-project.vercel.app`).
3. **Data Persistence**: In Vercel serverless environments, accounts, settings, and file structures automatically persist to `/tmp/server-store.json`.

---

## Advanced Capabilities

### 1. Custom Password Protection & Expiration for Shared Links
- In the **Share Modal**, switch to the **"PIN & Expiration"** tab.
- **PIN / Password Protection**: Require recipients to enter a 4-8 digit PIN or passphrase before previewing or downloading. Files cannot be accessed via direct stream without this PIN.
- **Auto-Expiration**: Set expiration dates (24 Hours, 7 Days, 30 Days, or custom calendar timestamp). Once expired, public download attempts immediately return `410 Expired`.

### 2. Automatic Multi-Account Load Balancing
- Toggle the **"Auto Balancing"** switch in the Action Bar header.
- When uploading files, MultiDrive calculates the remaining storage capacity across all connected OneDrive accounts and **automatically routes the file to the drive with the highest free space**.
- Prevents individual OneDrive accounts from hitting their storage quotas while other accounts sit idle.

### 3. Direct Cloud-to-Cloud Account Migration
- Select one or more files in the explorer and click **"Migrate"** in the action bar.
- Choose any target OneDrive account and select **"Move"** (reassign drive and reclaim source space) or **"Copy"** (duplicate to target drive).
- The file is transferred server-side directly across cloud drives **without downloading anything to your local device**.

### 4. Bandwidth & Access Analytics
- Navigate to **"Traffic & Analytics"** in the sidebar or navbar.
- Inspect **14-day daily bandwidth volume (MB/GB)** and file download counts.
- **Top Downloaded Files**: Ranked leaderboard showing total downloads and bandwidth consumption.
- **Visitor Geolocation**: Origin countries and city breakdown with country flags.
- **Live Event Stream**: Real-time log of download requests with IP, timestamp, device user-agent, and status codes.

### 5. Backup & Restore (Full `server-store.json` Import & Export)
- Click **"Backup"** in the top navbar or sidebar to open the **Backup & Migration Gateway**.
- **One-Click Export**: Download a timestamped snapshot of your active configuration and file repository (`multidrive-server-store-backup-YYYY-MM-DD.json` or direct `/api/backup/export`).
- **Flexible Import**:
  - Drag-and-drop or upload any `server-store.json` from previous installations, local servers, or Vercel instances.
  - **Clean Replace Mode**: Completely resets and overwrites state to mirror the backup snapshot.
  - **Merge & Append Mode**: Intelligently combines accounts and items from the backup with current data, deduplicating IDs.
  - **Admin Password Restoration**: Checkbox option to restore or preserve the administrator password.
  - Automatic validation preview before applying any changes.

### Deploying to a VPS / Cloud VM (Ubuntu / Debian / Docker)

1. **Install Node.js 20+** and PM2:
   ```bash
   npm install -g pm2
   ```

2. **Clone and Build**:
   ```bash
   git clone <repo-url> /opt/multidrive
   cd /opt/multidrive
   npm install
   npm run build
   ```

3. **Start with PM2**:
   ```bash
   pm2 start "npm start" --name multidrive
   pm2 save
   pm2 startup
   ```

4. **Nginx Reverse Proxy** (recommended):
   ```nginx
   server {
       listen 80;
       server_name multidrive.yourcompany.com;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           client_max_body_size 50M;
       }
   }
   ```

---

## Security Model

| Feature | Unauthenticated Public | Administrator |
|---|:---:|:---:|
| Direct Download via Share URL | Yes | Yes |
| Media Preview (Image, Audio, Video, PDF, Text) via Share URL | Yes | Yes |
| Browse All Drives & Folders | No | Yes |
| Connect / Disconnect OneDrive Accounts | No | Yes |
| Upload, Rename, Move, or Delete Files | No | Yes |
| View Account Quota & Analytics | No | Yes |
| Change Admin Password | No | Yes |

---

- **FTP & SFTP Access Gateway**: Access, browse, and transfer OneDrive files using any standard SFTP or FTP client (FileZilla, Cyberduck, WinSCP, Rclone, or CLI) with live virtual command console.
- **WebDAV Network Drive**: Mount your multi-tenant OneDrive accounts directly as a native network drive in Windows File Explorer (`\\your-host@SSL\webdav`) or macOS Finder (`https://your-host/webdav`) without any third-party software.
- **Lifetime Direct Download Links (Site Streaming)**: All public download links (`/api/public/download/<FILE_ID>`) stream file bytes directly through the application server with `Content-Disposition: attachment`. They never redirect to temporary Microsoft URLs and remain valid for the lifetime of the file.
- **Intelligent Error Diagnosis**: No cryptic `[object Object]` errors anywhere. Microsoft Graph, Entra ID, and network errors are caught, parsed into plain English with solution suggestions, and feature expandable technical diagnostic drawers.

---

## FTP, SFTP & WebDAV Remote Access

### Connecting via SFTP / FTP Clients (FileZilla, WinSCP, Cyberduck)
- **Protocol**: SFTP (SSH File Transfer Protocol) or FTP/FTPS
- **Host**: Your domain (e.g., `one.nextcloud.serv00.net` or `your-domain.com`)
- **Port**: `22` (SFTP) or `21` (FTP)
- **Username**: `admin`
- **Password**: Your configured `ADMIN_PASSWORD` (default: `admin123`)
- **Remote Directory**: `/onedrive/`

*Tip: You can export pre-configured `.xml` profiles for FileZilla or `rclone.conf` directly from the dashboard via the **FTP / SFTP** button.*

### Mounting as Native Network Drive (WebDAV)
- **Windows File Explorer**: In "This PC", click **Map network drive** and enter:
  `https://your-domain.com/webdav`
- **macOS Finder**: Press `Cmd + K` (Connect to Server) and enter:
  `https://your-domain.com/webdav`
- **Linux**: Mount via `davfs2` or in Files/Nautilus under **Other Locations** > **Connect to Server**.

---

## Public Lifetime Downloads vs. Temporary Links

Unlike standard Microsoft Graph download URLs which expire after 60 minutes to 24 hours, MultiDrive download links are **permanent**:
1. **Permanent URL**: `https://your-domain.com/api/public/download/<FILE_ID>`
2. **Streaming Engine**: Files are dynamically streamed directly through the site proxy using the connected account's active access token, returning binary streams with `Content-Disposition: attachment; filename="..."`.
3. **Embed Options**: Supports direct links, HTML download anchors, and Markdown snippets.

---

## Microsoft Graph API & Entra ID Troubleshooting

MultiDrive automatically decodes and presents solutions for common Entra ID and Graph errors:
- **`AADSTS50011`**: The redirect URI in Entra ID does not match your app's callback URL. Add `https://<YOUR_DOMAIN>/auth/callback` to the Azure App Registration.
- **`AADSTS7000215` / `InvalidAuthenticationToken`**: Invalid client secret or expired token. Generate a new secret or reconnect the account.
- **`accessDenied` / `403 Forbidden`**: Missing admin consent or restricted by conditional access. Ensure `Files.ReadWrite.All` is granted.
- **`quotaLimitReached`**: OneDrive storage quota exceeded on the target tenant. MultiDrive highlights which account is full and routes new files to available drives.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Recharts, Motion
- **Backend / API**: Express, Node.js (`tsx`)
- **Archiving**: JSZip (client-side batch ZIP downloads)
- **Persistence**: File-backed storage with `/tmp` serverless fallback

---

## License

Apache-2.0
