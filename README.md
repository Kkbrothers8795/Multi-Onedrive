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

MultiDrive is pre-configured for full compatibility with Vercel:

1. **Push your repository** to GitHub or GitLab.
2. **Import the repository** in the Vercel Dashboard.
3. In **Project Settings** > **Environment Variables**, add:
   - `ADMIN_PASSWORD`: Your secret administrator password.
   - `APP_URL`: Your Vercel production URL (e.g. `https://your-project.vercel.app`).
4. **Deploy**: Vercel will build the frontend assets using `npm run build`. Serverless API endpoints automatically utilize `/tmp/server-store.json` for read/write persistence.

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

## Microsoft Graph API Setup (Optional Live Mode)

To connect actual enterprise OneDrive accounts via Microsoft Graph:

1. Go to the [Microsoft Entra Admin Center](https://entra.microsoft.com/) (formerly Azure Active Directory).
2. Navigate to **App registrations** > **New registration**.
3. Set Supported Account Types to **Accounts in any organizational directory (Multitenant)**.
4. Set Redirect URI (Single-page application) to:
   ```
   https://your-domain.com/auth/callback
   ```
5. Under **API Permissions**, add:
   - `Files.ReadWrite.All`
   - `User.Read`
   - `offline_access`
6. Copy the **Application (client) ID** and add it to your environment variables as `VITE_MS_CLIENT_ID`.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Recharts, Motion
- **Backend / API**: Express, Node.js (`tsx`)
- **Archiving**: JSZip (client-side batch ZIP downloads)
- **Persistence**: File-backed storage with `/tmp` serverless fallback

---

## License

Apache-2.0
