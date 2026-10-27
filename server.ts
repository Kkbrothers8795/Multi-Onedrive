import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const isProd = process.env.NODE_ENV === 'production';
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : (isProd ? 8080 : 3000);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper to determine the public app URL
function getAppUrl(req: Request): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  const host = req.get('host') || `localhost:${port}`;
  const protocol = req.protocol || 'http';
  return `${protocol}://${host}`;
}

// ==========================================
// PERSISTENT DATA & AUTHENTICATION STORE
// ==========================================
interface ServerStore {
  accounts: any[];
  items: any[];
  adminPassword: string;
  isDemoDismissed: boolean;
}

const STORE_FILE = process.env.VERCEL
  ? path.resolve('/tmp', 'server-store.json')
  : path.resolve(__dirname, 'server-store.json');

// In-memory cache + filesystem persistence (fallback gracefully in serverless/Vercel)
let serverStore: ServerStore = {
  accounts: [],
  items: [],
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  isDemoDismissed: false,
};

// Valid admin session tokens
const validSessions = new Set<string>();

function loadStore() {
  try {
    let target = STORE_FILE;
    if (!fs.existsSync(target) && fs.existsSync('/tmp/server-store.json')) {
      target = '/tmp/server-store.json';
    }
    const bundledStore = path.resolve(__dirname, 'server-store.json');
    if (!fs.existsSync(target) && fs.existsSync(bundledStore)) {
      target = bundledStore;
    }
    if (fs.existsSync(target)) {
      const raw = fs.readFileSync(target, 'utf-8');
      const parsed = JSON.parse(raw);
      serverStore = {
        accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
        items: Array.isArray(parsed.items) ? parsed.items : [],
        adminPassword: parsed.adminPassword || process.env.ADMIN_PASSWORD || 'admin123',
        isDemoDismissed: !!parsed.isDemoDismissed,
      };
    }
  } catch (err) {
    console.warn('Could not read server-store.json, using in-memory store:', err);
  }
}

function saveStore() {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(serverStore, null, 2), 'utf-8');
  } catch (err) {
    try {
      fs.writeFileSync('/tmp/server-store.json', JSON.stringify(serverStore, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Server storage write skipped:', e);
    }
  }
}

loadStore();

// Middleware: Check Admin Authorization for protected management routes
function requireAdmin(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token || !validSessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized: Admin authentication required' });
  }
  next();
}

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'MultiDrive OneDrive for Business',
    accountsCount: serverStore.accounts.length,
    itemsCount: serverStore.items.length,
    adminProtected: true,
  });
});

// ==========================================
// ADMIN AUTHENTICATION ENDPOINTS
// ==========================================
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { password } = req.body;
  const currentPassword = serverStore.adminPassword || process.env.ADMIN_PASSWORD || 'admin123';

  if (!password || password !== currentPassword) {
    return res.status(401).json({ error: 'Incorrect administrator password' });
  }

  const token = `token_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  validSessions.add(token);

  res.json({
    success: true,
    token,
    message: 'Authenticated successfully',
  });
});

app.get('/api/auth/session', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const isValid = token ? validSessions.has(token) : false;

  res.json({
    authenticated: isValid,
    hasCustomPassword: serverStore.adminPassword !== 'admin123',
  });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (token) {
    validSessions.delete(token);
  }
  res.json({ success: true });
});

app.post('/api/auth/change-password', requireAdmin, (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters long' });
  }

  if (currentPassword !== serverStore.adminPassword) {
    return res.status(400).json({ error: 'Current password does not match' });
  }

  serverStore.adminPassword = newPassword;
  saveStore();
  res.json({ success: true, message: 'Administrator password updated successfully' });
});

// ==========================================
// PUBLIC DOWNLOADS (NO LOGIN REQUIRED)
// ==========================================
// Returns public file metadata without requiring any login
app.get('/api/public/file/:id', (req: Request, res: Response) => {
  loadStore();
  const fileId = req.params.id;
  const item = serverStore.items.find((i) => i.id === fileId && !i.deleted);

  if (!item) {
    return res.status(404).json({ error: 'File not found or has been removed' });
  }

  // Provide public metadata for download view
  res.json({
    id: item.id,
    name: item.name,
    size: item.size,
    mimeType: item.mimeType || 'application/octet-stream',
    fileType: item.fileType,
    lastModifiedDateTime: item.lastModifiedDateTime,
    accountName: item.accountName,
    accountColor: item.accountColor,
    webUrl: item.webUrl,
    downloadUrl: item.downloadUrl,
    content: item.content,
    isPublic: true,
  });
});

// Direct public download link (streams file or content without login)
app.get('/api/public/download/:id', (req: Request, res: Response) => {
  loadStore();
  const fileId = req.params.id;
  const item = serverStore.items.find((i) => i.id === fileId && !i.deleted);

  if (!item) {
    return res.status(404).send('File not found or link has expired');
  }

  // If item has a direct download URL, redirect to it
  if (item.downloadUrl) {
    return res.redirect(item.downloadUrl);
  }

  // Otherwise send the stored content as a downloadable file attachment
  const filename = item.name || 'download';
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.setHeader('Content-Type', item.mimeType || 'application/octet-stream');
  res.send(item.content || `MultiDrive OneDrive for Business File: ${item.name}`);
});

// ==========================================
// SERVER STORAGE SYNC (PERSISTS ACCOUNTS)
// ==========================================
app.get('/api/storage/data', (req: Request, res: Response) => {
  loadStore();
  res.json({
    accounts: serverStore.accounts,
    items: serverStore.items,
    isDemoDismissed: serverStore.isDemoDismissed,
  });
});

app.post('/api/storage/accounts', (req: Request, res: Response) => {
  const { accounts, isDemoDismissed } = req.body;
  if (Array.isArray(accounts)) {
    serverStore.accounts = accounts;
    if (typeof isDemoDismissed === 'boolean') {
      serverStore.isDemoDismissed = isDemoDismissed;
    }
    saveStore();
  }
  res.json({ success: true, count: serverStore.accounts.length });
});

app.post('/api/storage/items', (req: Request, res: Response) => {
  const { items } = req.body;
  if (Array.isArray(items)) {
    serverStore.items = items;
    saveStore();
  }
  res.json({ success: true, count: serverStore.items.length });
});

app.post('/api/storage/clear-demo', (req: Request, res: Response) => {
  serverStore.accounts = [];
  serverStore.items = [];
  serverStore.isDemoDismissed = true;
  saveStore();
  res.json({ success: true, message: 'Demo data cleared permanently' });
});

// ==========================================
// OAUTH & GRAPH PROXY ENDPOINTS
// ==========================================
app.get('/api/auth/url', (req: Request, res: Response) => {
  const appUrl = getAppUrl(req);
  const redirectUri = (req.query.redirect_uri as string) || `${appUrl}/auth/callback`;
  const clientId = (req.query.client_id as string) || process.env.CLIENT_ID || 'common-multidrive-client';
  const tenant = (req.query.tenant as string) || process.env.TENANT_ID || 'common';
  const state = (req.query.state as string) || `state_${Date.now()}`;
  const scopes = (req.query.scope as string) || 'User.Read Files.ReadWrite.All offline_access Sites.ReadWrite.All';

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: scopes,
    state: state,
    prompt: 'select_account',
  });

  const authUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
  res.json({ url: authUrl, redirectUri, clientId, tenant, state });
});

const callbackHandler = (req: Request, res: Response) => {
  const code = (req.query.code as string) || '';
  const state = (req.query.state as string) || '';
  const error = (req.query.error as string) || '';
  const errorDescription = (req.query.error_description as string) || '';

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Microsoft Authentication</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background-color: #0f172a;
      color: #f8fafc;
      text-align: center;
      padding: 24px;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 32px;
      max-width: 440px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.4);
    }
    .spinner {
      border: 3px solid #334155;
      border-top: 3px solid #0284c7;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    h2 { font-size: 1.25rem; margin-bottom: 8px; color: #38bdf8; }
    p { font-size: 0.9rem; color: #94a3b8; line-height: 1.5; }
    .error { color: #f87171; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner" id="spinner"></div>
    <h2 id="title">${error ? 'Authentication Error' : 'Authenticating with Microsoft...'}</h2>
    <p id="desc">${error ? errorDescription || 'Failed to authenticate with Microsoft Graph.' : 'Completing sign-in. This window will close automatically.'}</p>
  </div>
  <script>
    const payload = {
      type: '${error ? 'OAUTH_AUTH_ERROR' : 'OAUTH_AUTH_SUCCESS'}',
      code: ${JSON.stringify(code)},
      state: ${JSON.stringify(state)},
      error: ${JSON.stringify(error)},
      errorDescription: ${JSON.stringify(errorDescription)}
    };

    if (window.opener) {
      window.opener.postMessage(payload, '*');
      setTimeout(() => {
        window.close();
      }, 1000);
    } else {
      setTimeout(() => {
        window.location.href = '/?auth_code=' + encodeURIComponent(payload.code) + '&state=' + encodeURIComponent(payload.state);
      }, 1500);
    }
  </script>
</body>
</html>`);
};

app.get('/auth/callback', callbackHandler);
app.get('/auth/callback/', callbackHandler);

// Token exchange endpoint for OAuth authorization code
app.post('/api/auth/token', async (req: Request, res: Response) => {
  try {
    const { code, clientId, clientSecret, redirectUri, tenant = 'common' } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    const appUrl = getAppUrl(req);
    const finalRedirect = redirectUri || `${appUrl}/auth/callback`;
    const finalClientId = clientId || process.env.CLIENT_ID;

    if (!finalClientId) {
      return res.status(400).json({ error: 'Client ID is required for token exchange' });
    }

    const bodyParams = new URLSearchParams({
      client_id: finalClientId,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: finalRedirect,
      scope: 'User.Read Files.ReadWrite.All offline_access Sites.ReadWrite.All',
    });

    if (clientSecret || process.env.CLIENT_SECRET) {
      bodyParams.append('client_secret', clientSecret || process.env.CLIENT_SECRET!);
    }

    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams.toString(),
    });

    const data = await tokenRes.json().catch(() => null);
    if (!tokenRes.ok || !data) {
      const errorMsg =
        typeof data?.error_description === 'string' && data.error_description
          ? data.error_description
          : typeof data?.error === 'string' && data.error
          ? data.error
          : typeof data?.error?.message === 'string' && data.error.message
          ? `[${data.error.code || 'Error'}] ${data.error.message}`
          : typeof data?.message === 'string' && data.message
          ? data.message
          : 'Failed to exchange authorization code with Microsoft';

      return res.status(tokenRes.status || 400).json({
        error: errorMsg,
        details: data,
      });
    }

    res.json(data);
  } catch (err: any) {
    console.error('Token exchange error:', err);
    res.status(500).json({ error: err.message || 'Internal server error during token exchange' });
  }
});

// Microsoft Graph API proxy
app.post('/api/graph/proxy', async (req: Request, res: Response) => {
  try {
    const { endpoint, method = 'GET', accessToken, body, headers = {} } = req.body;
    if (!accessToken) {
      return res.status(401).json({ error: 'Missing access token for Microsoft Graph' });
    }
    if (!endpoint) {
      return res.status(400).json({ error: 'Missing Graph endpoint' });
    }

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `https://graph.microsoft.com/v1.0${cleanEndpoint}`;

    const requestHeaders: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      ...headers,
    };

    if (body && typeof body === 'object' && !requestHeaders['Content-Type']) {
      requestHeaders['Content-Type'] = 'application/json';
    }

    const graphRes = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });

    const contentType = graphRes.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await graphRes.json().catch(() => ({}));
      if (!graphRes.ok) {
        const errorMsg =
          typeof data?.error?.message === 'string' && data.error.message
            ? `[${data.error.code || 'GraphError'}] ${data.error.message}`
            : typeof data?.error_description === 'string' && data.error_description
            ? data.error_description
            : typeof data?.error === 'string' && data.error
            ? data.error
            : typeof data?.message === 'string' && data.message
            ? data.message
            : `Microsoft Graph returned status ${graphRes.status}`;

        return res.status(graphRes.status).json({
          error: errorMsg,
          details: data,
        });
      }
      return res.status(graphRes.status).json(data);
    } else {
      const text = await graphRes.text();
      return res.status(graphRes.status).send(text);
    }
  } catch (err: any) {
    console.error('Graph proxy error:', err);
    res.status(500).json({ error: err.message || 'Graph proxy call failed' });
  }
});

// Vite or static serving
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`OneDrive Business MultiDrive server running at http://0.0.0.0:${port}`);
  });
}

export default app;

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
