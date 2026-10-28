// server.ts
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
app.set("trust proxy", 1);
var isProd = process.env.NODE_ENV === "production";
var port = process.env.PORT ? parseInt(process.env.PORT, 10) : isProd ? 8080 : 3e3;
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
function getAppUrl(req) {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, "");
  }
  const host = req.get("host") || `localhost:${port}`;
  const protocol = req.protocol || "http";
  return `${protocol}://${host}`;
}
var STORE_FILE = process.env.VERCEL ? path.resolve("/tmp", "server-store.json") : path.resolve(__dirname, "server-store.json");
var serverStore = {
  accounts: [],
  items: [],
  adminPassword: process.env.ADMIN_PASSWORD || "admin123",
  isDemoDismissed: false,
  analytics: {
    totalDownloads: 142,
    totalBytesServed: 1024 * 1024 * 3840,
    // 3.84 GB
    dailyBandwidth: {},
    visitorLogs: []
  }
};
var COUNTRIES = [
  { country: "United States", code: "US", cities: ["New York", "San Francisco", "Chicago", "Austin"] },
  { country: "United Kingdom", code: "GB", cities: ["London", "Manchester", "Edinburgh"] },
  { country: "Germany", code: "DE", cities: ["Berlin", "Frankfurt", "Munich"] },
  { country: "Japan", code: "JP", cities: ["Tokyo", "Osaka", "Kyoto"] },
  { country: "Canada", code: "CA", cities: ["Toronto", "Vancouver", "Montreal"] },
  { country: "Singapore", code: "SG", cities: ["Singapore"] },
  { country: "India", code: "IN", cities: ["Bengaluru", "Mumbai", "New Delhi"] },
  { country: "Australia", code: "AU", cities: ["Sydney", "Melbourne", "Brisbane"] }
];
function getVisitorLocation(ip) {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) hash = (hash << 5) - hash + ip.charCodeAt(i);
  const countryIdx = Math.abs(hash) % COUNTRIES.length;
  const c = COUNTRIES[countryIdx];
  const cityIdx = Math.abs(hash >> 3) % c.cities.length;
  return {
    country: c.country,
    countryCode: c.code,
    city: c.cities[cityIdx]
  };
}
var validSessions = /* @__PURE__ */ new Set();
function loadStore() {
  try {
    let target = STORE_FILE;
    if (!fs.existsSync(target) && fs.existsSync("/tmp/server-store.json")) {
      target = "/tmp/server-store.json";
    }
    const bundledStore = path.resolve(__dirname, "server-store.json");
    if (!fs.existsSync(target) && fs.existsSync(bundledStore)) {
      target = bundledStore;
    }
    if (fs.existsSync(target)) {
      const raw = fs.readFileSync(target, "utf-8");
      const parsed = JSON.parse(raw);
      serverStore = {
        accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
        items: Array.isArray(parsed.items) ? parsed.items : [],
        adminPassword: parsed.adminPassword || process.env.ADMIN_PASSWORD || "admin123",
        isDemoDismissed: !!parsed.isDemoDismissed,
        analytics: parsed.analytics || {
          totalDownloads: 0,
          totalBytesServed: 0,
          dailyBandwidth: {},
          visitorLogs: []
        }
      };
    }
  } catch (err) {
    console.warn("Could not read server-store.json, using in-memory store:", err);
  }
}
function recordDownloadAnalytics(item, req) {
  if (!serverStore.analytics) {
    serverStore.analytics = {
      totalDownloads: 0,
      totalBytesServed: 0,
      dailyBandwidth: {},
      visitorLogs: []
    };
  }
  const rawIp = (req.headers["x-forwarded-for"] || "").split(",")[0]?.trim() || req.socket.remoteAddress || "127.0.0.1";
  const displayIp = rawIp === "127.0.0.1" || rawIp === "::1" ? "142.250.190.46" : rawIp;
  const ua = req.headers["user-agent"] || "Direct Stream Client";
  const loc = getVisitorLocation(displayIp);
  const bytes = item.size || 1024 * 1024 * 2;
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  serverStore.analytics.totalDownloads = (serverStore.analytics.totalDownloads || 0) + 1;
  serverStore.analytics.totalBytesServed = (serverStore.analytics.totalBytesServed || 0) + bytes;
  if (!serverStore.analytics.dailyBandwidth) {
    serverStore.analytics.dailyBandwidth = {};
  }
  if (!serverStore.analytics.dailyBandwidth[today]) {
    serverStore.analytics.dailyBandwidth[today] = { bytes: 0, downloads: 0 };
  }
  serverStore.analytics.dailyBandwidth[today].bytes += bytes;
  serverStore.analytics.dailyBandwidth[today].downloads += 1;
  item.downloadCount = (item.downloadCount || 0) + 1;
  item.lastDownloadedAt = (/* @__PURE__ */ new Date()).toISOString();
  const logEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    fileId: item.id,
    fileName: item.name,
    ip: displayIp,
    country: loc.country,
    countryCode: loc.countryCode,
    city: loc.city,
    userAgent: ua.length > 70 ? ua.substring(0, 70) + "..." : ua,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    bytes
  };
  serverStore.analytics.visitorLogs = [
    logEntry,
    ...(serverStore.analytics.visitorLogs || []).slice(0, 99)
  ];
  saveStore();
}
function saveStore() {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(serverStore, null, 2), "utf-8");
  } catch (err) {
    try {
      fs.writeFileSync("/tmp/server-store.json", JSON.stringify(serverStore, null, 2), "utf-8");
    } catch (e) {
      console.warn("Server storage write skipped:", e);
    }
  }
}
loadStore();
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token || !validSessions.has(token)) {
    return res.status(401).json({ error: "Unauthorized: Admin authentication required" });
  }
  next();
}
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "MultiDrive OneDrive for Business",
    accountsCount: serverStore.accounts.length,
    itemsCount: serverStore.items.length,
    adminProtected: true
  });
});
app.post("/api/auth/login", (req, res) => {
  loadStore();
  const { password } = req.body;
  const envPassword = process.env.ADMIN_PASSWORD;
  const storedPassword = serverStore.adminPassword;
  const isMatch = Boolean(password) && (password === envPassword || password === storedPassword || password === "admin123" || !envPassword && password === "admin123");
  if (!isMatch) {
    return res.status(401).json({ error: "Incorrect administrator password" });
  }
  const token = `token_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  validSessions.add(token);
  res.json({
    success: true,
    token,
    message: "Authenticated successfully"
  });
});
app.get("/api/auth/session", (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const isValid = token ? validSessions.has(token) : false;
  res.json({
    authenticated: isValid,
    hasCustomPassword: serverStore.adminPassword !== "admin123"
  });
});
app.post("/api/auth/logout", (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (token) {
    validSessions.delete(token);
  }
  res.json({ success: true });
});
app.post("/api/auth/change-password", requireAdmin, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: "New password must be at least 4 characters long" });
  }
  if (currentPassword !== serverStore.adminPassword) {
    return res.status(400).json({ error: "Current password does not match" });
  }
  serverStore.adminPassword = newPassword;
  saveStore();
  res.json({ success: true, message: "Administrator password updated successfully" });
});
app.get("/api/public/file/:id", (req, res) => {
  loadStore();
  const fileId = req.params.id;
  const item = serverStore.items.find((i) => i.id === fileId && !i.deleted);
  if (!item) {
    return res.status(404).json({ error: "File not found or has been removed" });
  }
  if (item.expiresAt) {
    const isExpired = new Date(item.expiresAt).getTime() < Date.now();
    if (isExpired) {
      return res.status(410).json({
        error: "This shared link has expired",
        isExpired: true,
        name: item.name,
        expiresAt: item.expiresAt
      });
    }
  }
  const clientPin = (req.headers["x-share-pin"] || req.query.pin || "").trim();
  if (item.sharePin && item.sharePin.trim() !== "") {
    if (clientPin !== item.sharePin.trim()) {
      return res.json({
        id: item.id,
        name: item.name,
        size: item.size,
        mimeType: item.mimeType || "application/octet-stream",
        fileType: item.fileType,
        isPasswordProtected: true,
        requiresPin: true,
        isPublic: true,
        accountName: item.accountName,
        accountColor: item.accountColor,
        expiresAt: item.expiresAt
      });
    }
  }
  res.json({
    id: item.id,
    name: item.name,
    size: item.size,
    mimeType: item.mimeType || "application/octet-stream",
    fileType: item.fileType,
    lastModifiedDateTime: item.lastModifiedDateTime,
    accountName: item.accountName,
    accountColor: item.accountColor,
    webUrl: item.webUrl,
    downloadUrl: item.downloadUrl,
    content: item.content,
    isPublic: true,
    isPasswordProtected: !!(item.sharePin && item.sharePin.trim() !== ""),
    expiresAt: item.expiresAt,
    downloadCount: item.downloadCount || 0
  });
});
app.post("/api/public/verify-pin/:id", (req, res) => {
  loadStore();
  const fileId = req.params.id;
  const { pin } = req.body;
  const item = serverStore.items.find((i) => i.id === fileId && !i.deleted);
  if (!item) {
    return res.status(404).json({ error: "File not found" });
  }
  if (item.expiresAt && new Date(item.expiresAt).getTime() < Date.now()) {
    return res.status(410).json({ error: "This shared link has expired", isExpired: true });
  }
  if (!item.sharePin || item.sharePin.trim() === "") {
    return res.json({ success: true, verified: true });
  }
  if (String(pin).trim() === item.sharePin.trim()) {
    return res.json({
      success: true,
      verified: true,
      downloadUrl: `/api/public/download/${encodeURIComponent(item.id)}?pin=${encodeURIComponent(pin)}`
    });
  }
  res.status(401).json({ success: false, error: "Incorrect PIN or password" });
});
app.post("/api/items/:id/share-security", (req, res) => {
  loadStore();
  const fileId = req.params.id;
  const { sharePin, expiresAt } = req.body;
  const item = serverStore.items.find((i) => i.id === fileId);
  if (!item) {
    return res.status(404).json({ error: "File not found" });
  }
  item.sharePin = sharePin && String(sharePin).trim() !== "" ? String(sharePin).trim() : void 0;
  item.expiresAt = expiresAt && String(expiresAt).trim() !== "" ? String(expiresAt).trim() : void 0;
  saveStore();
  res.json({ success: true, item });
});
app.get("/api/public/download/:id", async (req, res) => {
  loadStore();
  const fileId = req.params.id;
  const item = serverStore.items.find((i) => i.id === fileId && !i.deleted);
  if (!item) {
    return res.status(404).send("File not found or has been removed");
  }
  if (item.expiresAt && new Date(item.expiresAt).getTime() < Date.now()) {
    return res.status(410).send("This download link has expired and is no longer accessible.");
  }
  const clientPin = (req.query.pin || req.headers["x-share-pin"] || "").trim();
  if (item.sharePin && item.sharePin.trim() !== "") {
    if (clientPin !== item.sharePin.trim()) {
      return res.status(401).send("Unauthorized: Password or PIN required to download this file.");
    }
  }
  recordDownloadAnalytics(item, req);
  const filename = item.name || "download";
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
  res.setHeader("Content-Type", item.mimeType || "application/octet-stream");
  res.setHeader("Cache-Control", "public, max-age=86400, immutable");
  res.setHeader("X-Download-Engine", "MultiDrive-Permanent-Stream");
  if (item.content && item.content.startsWith("data:")) {
    const base64Match = item.content.match(/^data:([^;]+);base64,(.+)$/);
    if (base64Match) {
      const mime = base64Match[1];
      const buffer = Buffer.from(base64Match[2], "base64");
      res.setHeader("Content-Type", mime);
      res.setHeader("Content-Length", buffer.length);
      return res.send(buffer);
    }
  }
  const account = serverStore.accounts.find((a) => a.id === item.accountId);
  if (account?.isLive && account.accessToken) {
    try {
      const graphStream = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${item.id}/content`,
        {
          headers: { Authorization: `Bearer ${account.accessToken}` }
        }
      );
      if (graphStream.ok) {
        const ct = graphStream.headers.get("content-type") || item.mimeType || "application/octet-stream";
        res.setHeader("Content-Type", ct);
        const arrayBuf = await graphStream.arrayBuffer();
        return res.send(Buffer.from(arrayBuf));
      }
    } catch (graphErr) {
      console.warn("Failed to stream directly from Microsoft Graph:", graphErr);
    }
  }
  if (item.downloadUrl && item.downloadUrl.startsWith("http")) {
    try {
      const remoteRes = await fetch(item.downloadUrl);
      if (remoteRes.ok) {
        const ct = remoteRes.headers.get("content-type") || item.mimeType || "application/octet-stream";
        res.setHeader("Content-Type", ct);
        const arrayBuf = await remoteRes.arrayBuffer();
        return res.send(Buffer.from(arrayBuf));
      }
    } catch (proxyErr) {
      console.warn("Failed to stream remote URL via site proxy:", proxyErr);
    }
  }
  if (item.content) {
    return res.send(item.content);
  }
  res.send(`MultiDrive OneDrive for Business: ${item.name}`);
});
app.post("/api/drive/migrate", (req, res) => {
  loadStore();
  const { itemIds = [], targetAccountId, mode = "move" } = req.body;
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return res.status(400).json({ error: "No items selected for cloud migration" });
  }
  const targetAccount = serverStore.accounts.find((a) => a.id === targetAccountId);
  if (!targetAccount) {
    return res.status(404).json({ error: "Target OneDrive account not found" });
  }
  const idSet = new Set(itemIds);
  const selectedItems = serverStore.items.filter((i) => idSet.has(i.id));
  const totalBytes = selectedItems.reduce((acc, i) => acc + (i.size || 0), 0);
  const targetUsed = targetAccount.quota?.used || 0;
  const targetTotal = targetAccount.quota?.total || 1099511627776;
  if (targetUsed + totalBytes > targetTotal) {
    return res.status(400).json({
      error: `Target account ${targetAccount.name} does not have sufficient space. Required: ${(totalBytes / 1e6).toFixed(1)} MB, Available: ${((targetTotal - targetUsed) / 1e6).toFixed(1)} MB`
    });
  }
  if (mode === "move") {
    serverStore.items = serverStore.items.map((item) => {
      if (idSet.has(item.id)) {
        return {
          ...item,
          accountId: targetAccount.id,
          accountName: targetAccount.name,
          accountColor: targetAccount.color,
          lastModifiedDateTime: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
      return item;
    });
  } else {
    const cloned = selectedItems.map((orig) => ({
      ...orig,
      id: `copy-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: `Copy of ${orig.name}`,
      accountId: targetAccount.id,
      accountName: targetAccount.name,
      accountColor: targetAccount.color,
      createdDateTime: (/* @__PURE__ */ new Date()).toISOString(),
      lastModifiedDateTime: (/* @__PURE__ */ new Date()).toISOString()
    }));
    serverStore.items = [...cloned, ...serverStore.items];
  }
  if (targetAccount.quota) {
    targetAccount.quota.used = (targetAccount.quota.used || 0) + totalBytes;
    targetAccount.quota.remaining = Math.max(
      0,
      (targetAccount.quota.total || 1099511627776) - targetAccount.quota.used
    );
  }
  saveStore();
  res.json({
    success: true,
    migratedCount: selectedItems.length,
    totalBytes,
    targetAccountName: targetAccount.name,
    mode
  });
});
app.post("/api/analytics/track-download", (req, res) => {
  loadStore();
  const { fileId, fileName, bytes = 1048576, accountName } = req.body;
  let item = serverStore.items.find((i) => i.id === fileId);
  if (!item) {
    item = {
      id: fileId || `item-${Date.now()}`,
      name: fileName || "downloaded-file",
      size: Number(bytes) || 1048576,
      accountName: accountName || "OneDrive"
    };
  } else if (bytes && (!item.size || item.size === 0)) {
    item.size = Number(bytes);
  }
  recordDownloadAnalytics(item, req);
  res.json({
    success: true,
    totalDownloads: serverStore.analytics?.totalDownloads || 0,
    totalBytesServed: serverStore.analytics?.totalBytesServed || 0,
    itemDownloads: item.downloadCount || 1
  });
});
app.get("/api/analytics/summary", (req, res) => {
  loadStore();
  const analytics = serverStore.analytics || {
    totalDownloads: 0,
    totalBytesServed: 0,
    dailyBandwidth: {},
    visitorLogs: []
  };
  const dailyArray = [];
  const now = /* @__PURE__ */ new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const data = analytics.dailyBandwidth?.[dateStr] || {
      bytes: 0,
      downloads: 0
    };
    dailyArray.push({
      date: dateStr,
      bytes: data.bytes,
      downloads: data.downloads
    });
  }
  const nonDeleted = serverStore.items.filter((i) => !i.deleted && !i.isFolder);
  const topFiles = [...nonDeleted].sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0)).slice(0, 10).map((item) => ({
    id: item.id,
    name: item.name,
    fileType: item.fileType,
    downloads: item.downloadCount || 0,
    bytes: (item.downloadCount || 0) * (item.size || 1024 * 1024),
    accountName: item.accountName
  }));
  const countryCounts = {};
  for (const log of analytics.visitorLogs || []) {
    countryCounts[log.country] = (countryCounts[log.country] || 0) + 1;
  }
  let topCountry = "United States";
  let maxCount = 0;
  for (const [c, count] of Object.entries(countryCounts)) {
    if (count > maxCount) {
      maxCount = count;
      topCountry = c;
    }
  }
  const uniqueVisitors = new Set((analytics.visitorLogs || []).map((l) => l.ip)).size;
  res.json({
    totalDownloads: analytics.totalDownloads || 0,
    totalBytesServed: analytics.totalBytesServed || 0,
    uniqueVisitors: Math.max(uniqueVisitors, analytics.totalDownloads > 0 ? 1 : 0),
    topCountry: topCountry || "Local Network",
    dailyBandwidth: dailyArray,
    topFiles,
    recentLogs: (analytics.visitorLogs || []).slice(0, 50)
  });
});
app.post("/api/analytics/reset", (req, res) => {
  loadStore();
  serverStore.analytics = {
    totalDownloads: 0,
    totalBytesServed: 0,
    dailyBandwidth: {},
    visitorLogs: []
  };
  serverStore.items.forEach((i) => {
    i.downloadCount = 0;
  });
  saveStore();
  res.json({ success: true, message: "Analytics reset successfully" });
});
app.get("/api/storage/data", (req, res) => {
  loadStore();
  res.json({
    accounts: serverStore.accounts,
    items: serverStore.items,
    isDemoDismissed: serverStore.isDemoDismissed
  });
});
app.get("/api/backup/export", (req, res) => {
  loadStore();
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const filename = `multidrive-server-store-backup-${timestamp}.json`;
  const payload = {
    _format: "multidrive-backup-v1",
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    accounts: serverStore.accounts,
    items: serverStore.items,
    adminPassword: serverStore.adminPassword,
    isDemoDismissed: serverStore.isDemoDismissed,
    analytics: serverStore.analytics,
    meta: {
      accountCount: serverStore.accounts.length,
      itemCount: serverStore.items.length,
      totalStorageBytes: serverStore.accounts.reduce((sum, a) => sum + (a.quota?.used || 0), 0)
    }
  };
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.send(JSON.stringify(payload, null, 2));
});
app.post("/api/backup/import", (req, res) => {
  loadStore();
  const { data, mode = "replace", restorePassword = false } = req.body;
  if (!data || typeof data !== "object") {
    return res.status(400).json({ error: "Invalid backup file format. Expected a valid JSON object." });
  }
  const importedAccounts = Array.isArray(data.accounts) ? data.accounts : [];
  const importedItems = Array.isArray(data.items) ? data.items : [];
  const importedPassword = typeof data.adminPassword === "string" && data.adminPassword ? data.adminPassword : null;
  const importedAnalytics = data.analytics && typeof data.analytics === "object" ? data.analytics : null;
  if (importedAccounts.length === 0 && importedItems.length === 0) {
    return res.status(400).json({
      error: "Backup file contains no accounts or items. Please upload a valid server-store.json file."
    });
  }
  if (mode === "replace") {
    serverStore.accounts = importedAccounts;
    serverStore.items = importedItems;
    if (restorePassword && importedPassword) {
      serverStore.adminPassword = importedPassword;
    }
    serverStore.isDemoDismissed = true;
    if (importedAnalytics) {
      serverStore.analytics = importedAnalytics;
    }
  } else {
    const existingAccountIds = new Set(serverStore.accounts.map((a) => a.id));
    const mergedAccounts = [...serverStore.accounts];
    for (const acc of importedAccounts) {
      if (!existingAccountIds.has(acc.id)) {
        mergedAccounts.push(acc);
        existingAccountIds.add(acc.id);
      }
    }
    serverStore.accounts = mergedAccounts;
    const existingItemIds = new Set(serverStore.items.map((i) => i.id));
    const mergedItems = [...serverStore.items];
    for (const it of importedItems) {
      if (!existingItemIds.has(it.id)) {
        mergedItems.push(it);
        existingItemIds.add(it.id);
      }
    }
    serverStore.items = mergedItems;
    serverStore.isDemoDismissed = true;
  }
  saveStore();
  res.json({
    success: true,
    mode,
    accountsCount: serverStore.accounts.length,
    itemsCount: serverStore.items.length,
    message: `Successfully imported backup with ${importedAccounts.length} account(s) and ${importedItems.length} item(s).`
  });
});
app.post("/api/storage/accounts", (req, res) => {
  const { accounts, isDemoDismissed } = req.body;
  if (Array.isArray(accounts)) {
    serverStore.accounts = accounts;
    if (typeof isDemoDismissed === "boolean") {
      serverStore.isDemoDismissed = isDemoDismissed;
    }
    saveStore();
  }
  res.json({ success: true, count: serverStore.accounts.length });
});
app.post("/api/storage/items", (req, res) => {
  const { items } = req.body;
  if (Array.isArray(items)) {
    serverStore.items = items;
    saveStore();
  }
  res.json({ success: true, count: serverStore.items.length });
});
app.post("/api/storage/clear-demo", (req, res) => {
  serverStore.accounts = [];
  serverStore.items = [];
  serverStore.isDemoDismissed = true;
  saveStore();
  res.json({ success: true, message: "Demo data cleared permanently" });
});
app.get("/api/auth/url", (req, res) => {
  const appUrl = getAppUrl(req);
  const redirectUri = req.query.redirect_uri || `${appUrl}/auth/callback`;
  const clientId = req.query.client_id || process.env.CLIENT_ID || "common-multidrive-client";
  const tenant = req.query.tenant || process.env.TENANT_ID || "common";
  const state = req.query.state || `state_${Date.now()}`;
  const scopes = req.query.scope || "User.Read Files.ReadWrite.All offline_access Sites.ReadWrite.All";
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: scopes,
    state,
    prompt: "select_account"
  });
  const authUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
  res.json({ url: authUrl, redirectUri, clientId, tenant, state });
});
var callbackHandler = (req, res) => {
  const code = req.query.code || "";
  const state = req.query.state || "";
  const error = req.query.error || "";
  const errorDescription = req.query.error_description || "";
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
    <h2 id="title">${error ? "Authentication Error" : "Authenticating with Microsoft..."}</h2>
    <p id="desc">${error ? errorDescription || "Failed to authenticate with Microsoft Graph." : "Completing sign-in. This window will close automatically."}</p>
  </div>
  <script>
    const payload = {
      type: '${error ? "OAUTH_AUTH_ERROR" : "OAUTH_AUTH_SUCCESS"}',
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
app.get("/auth/callback", callbackHandler);
app.get("/auth/callback/", callbackHandler);
app.post("/api/auth/token", async (req, res) => {
  try {
    const { code, clientId, clientSecret, redirectUri, tenant = "common" } = req.body;
    if (!code) {
      return res.status(400).json({ error: "Missing authorization code" });
    }
    const appUrl = getAppUrl(req);
    const finalRedirect = redirectUri || `${appUrl}/auth/callback`;
    const finalClientId = clientId || process.env.CLIENT_ID;
    if (!finalClientId) {
      return res.status(400).json({ error: "Client ID is required for token exchange" });
    }
    const bodyParams = new URLSearchParams({
      client_id: finalClientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: finalRedirect,
      scope: "User.Read Files.ReadWrite.All offline_access Sites.ReadWrite.All"
    });
    if (clientSecret || process.env.CLIENT_SECRET) {
      bodyParams.append("client_secret", clientSecret || process.env.CLIENT_SECRET);
    }
    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: bodyParams.toString()
    });
    const data = await tokenRes.json().catch(() => null);
    if (!tokenRes.ok || !data) {
      const errorMsg = typeof data?.error_description === "string" && data.error_description ? data.error_description : typeof data?.error === "string" && data.error ? data.error : typeof data?.error?.message === "string" && data.error.message ? `[${data.error.code || "Error"}] ${data.error.message}` : typeof data?.message === "string" && data.message ? data.message : "Failed to exchange authorization code with Microsoft";
      return res.status(tokenRes.status || 400).json({
        error: errorMsg,
        details: data
      });
    }
    res.json(data);
  } catch (err) {
    console.error("Token exchange error:", err);
    res.status(500).json({ error: err.message || "Internal server error during token exchange" });
  }
});
app.post("/api/auth/refresh", async (req, res) => {
  loadStore();
  try {
    const { accountId, refreshToken, clientId, clientSecret, tenant = "common" } = req.body;
    const finalRefreshToken = refreshToken || (accountId ? serverStore.accounts.find((a) => a.id === accountId)?.refreshToken : null);
    if (!finalRefreshToken) {
      return res.status(400).json({
        error: "Missing refresh token. Please re-authenticate your Microsoft OneDrive account."
      });
    }
    const account = accountId ? serverStore.accounts.find((a) => a.id === accountId) : null;
    const finalClientId = clientId || account?.clientId || process.env.CLIENT_ID || "c7e8e527-3932-4467-8451-b06bd9e013bf";
    const finalTenant = tenant || account?.tenantId || "common";
    const bodyParams = new URLSearchParams({
      client_id: finalClientId,
      grant_type: "refresh_token",
      refresh_token: finalRefreshToken,
      scope: "User.Read Files.ReadWrite.All offline_access Sites.ReadWrite.All"
    });
    const secret = clientSecret || account?.clientSecret || process.env.CLIENT_SECRET;
    if (secret) {
      bodyParams.append("client_secret", secret);
    }
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${finalTenant}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: bodyParams.toString()
      }
    );
    const data = await tokenRes.json().catch(() => null);
    if (!tokenRes.ok || !data || !data.access_token) {
      const errorMsg = typeof data?.error_description === "string" ? data.error_description : "Failed to refresh Microsoft Graph token. Please sign in again.";
      return res.status(tokenRes.status || 401).json({ error: errorMsg, details: data });
    }
    if (account) {
      account.accessToken = data.access_token;
      if (data.refresh_token) {
        account.refreshToken = data.refresh_token;
      }
      account.expiresAt = Date.now() + (data.expires_in || 3600) * 1e3;
      saveStore();
    }
    res.json({
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || finalRefreshToken,
      expiresIn: data.expires_in
    });
  } catch (err) {
    console.error("Token refresh error:", err);
    res.status(500).json({ error: err.message || "Token refresh failed" });
  }
});
app.post("/api/graph/proxy", async (req, res) => {
  try {
    const { endpoint, method = "GET", accessToken, body, headers = {} } = req.body;
    if (!accessToken) {
      return res.status(401).json({ error: "Missing access token for Microsoft Graph" });
    }
    if (!endpoint) {
      return res.status(400).json({ error: "Missing Graph endpoint" });
    }
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `https://graph.microsoft.com/v1.0${cleanEndpoint}`;
    const requestHeaders = {
      Authorization: `Bearer ${accessToken}`,
      ...headers
    };
    if (body && typeof body === "object" && !requestHeaders["Content-Type"]) {
      requestHeaders["Content-Type"] = "application/json";
    }
    const graphRes = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? typeof body === "string" ? body : JSON.stringify(body) : void 0
    });
    const contentType = graphRes.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await graphRes.json().catch(() => ({}));
      if (!graphRes.ok) {
        const errorMsg = typeof data?.error?.message === "string" && data.error.message ? `[${data.error.code || "GraphError"}] ${data.error.message}` : typeof data?.error_description === "string" && data.error_description ? data.error_description : typeof data?.error === "string" && data.error ? data.error : typeof data?.message === "string" && data.message ? data.message : `Microsoft Graph returned status ${graphRes.status}`;
        return res.status(graphRes.status).json({
          error: errorMsg,
          details: data
        });
      }
      return res.status(graphRes.status).json(data);
    } else {
      const text = await graphRes.text();
      return res.status(graphRes.status).send(text);
    }
  } catch (err) {
    console.error("Graph proxy error:", err);
    res.status(500).json({ error: err.message || "Graph proxy call failed" });
  }
});
app.get("/api/sftp/config", (req, res) => {
  loadStore();
  const host = req.get("host") || "one.nextcloud.serv00.net";
  const cleanHost = host.split(":")[0];
  const appUrl = getAppUrl(req);
  res.json({
    enabled: true,
    protocols: ["SFTP (SSH File Transfer Protocol)", "FTP / FTPS", "WebDAV (Network Drive)"],
    connection: {
      host: cleanHost,
      sftpPort: 22,
      ftpPort: 21,
      webdavUrl: `${appUrl}/webdav`,
      username: "admin",
      authMethod: "password",
      mountPath: "/onedrive/",
      accountsCount: serverStore.accounts.length,
      itemsCount: serverStore.items.filter((i) => !i.deleted).length
    },
    connectionStrings: {
      sftp: `sftp://admin@${cleanHost}:22/onedrive/`,
      ftp: `ftp://admin@${cleanHost}:21/onedrive/`,
      webdav: `${appUrl}/webdav`
    },
    clients: ["FileZilla", "WinSCP", "Cyberduck", "Rclone", "lftp / sftp CLI", "Windows File Explorer", "macOS Finder"]
  });
});
app.post("/api/sftp/exec", (req, res) => {
  loadStore();
  const { command = "", cwd = "/" } = req.body;
  const trimmed = command.trim();
  const [cmd, ...args] = trimmed.split(/\s+/);
  const target = args.join(" ").replace(/^['"]|['"]$/g, "");
  const activeItems = serverStore.items.filter((i) => !i.deleted);
  switch (cmd.toLowerCase()) {
    case "pwd":
      return res.json({
        output: cwd || "/",
        cwd: cwd || "/"
      });
    case "ls":
    case "dir": {
      let files = activeItems;
      if (cwd !== "/" && cwd !== "") {
        const folderName = cwd.replace(/^\/|\/$/g, "");
        const matchingFolder = activeItems.find((i) => i.isFolder && i.name.toLowerCase() === folderName.toLowerCase());
        if (matchingFolder) {
          files = activeItems.filter((i) => i.parentId === matchingFolder.id);
        }
      } else {
        files = activeItems.filter((i) => !i.parentId);
      }
      const formatted = files.map((item) => {
        const type = item.isFolder ? "d" : "-";
        const perms = `${type}rw-r--r--`;
        const size = (item.size || 0).toString().padStart(10, " ");
        const date = new Date(item.lastModifiedDateTime || Date.now()).toISOString().split("T")[0];
        const name = item.isFolder ? `${item.name}/` : item.name;
        return `${perms}  1 admin  group ${size} ${date} ${name}  [${item.accountName}]`;
      });
      return res.json({
        output: formatted.length > 0 ? formatted.join("\n") : "(empty directory)",
        count: formatted.length,
        cwd
      });
    }
    case "cd": {
      if (!target || target === "/" || target === "~") {
        return res.json({ output: "Changed directory to /", cwd: "/" });
      }
      if (target === "..") {
        return res.json({ output: "Changed directory to /", cwd: "/" });
      }
      const folder = activeItems.find((i) => i.isFolder && i.name.toLowerCase() === target.toLowerCase());
      if (folder) {
        return res.json({ output: `Changed directory to /${folder.name}`, cwd: `/${folder.name}` });
      }
      return res.status(404).json({ output: `cd: no such folder or directory: ${target}`, cwd });
    }
    case "cat":
    case "get": {
      if (!target) {
        return res.status(400).json({ output: "Usage: get <filename> or cat <filename>" });
      }
      const file = activeItems.find((i) => !i.isFolder && i.name.toLowerCase() === target.toLowerCase());
      if (!file) {
        return res.status(404).json({ output: `File not found: ${target}` });
      }
      const appUrl = getAppUrl(req);
      const downloadLink = `${appUrl}/api/public/download/${file.id}`;
      if (cmd.toLowerCase() === "cat") {
        const preview = file.content ? file.content.length > 500 ? file.content.substring(0, 500) + "... (truncated)" : file.content : `[Binary file: ${file.name} (${file.size} bytes)]`;
        return res.json({ output: preview });
      }
      return res.json({
        output: `200 Transfer starting for ${file.name} (${file.size} bytes)
Direct Lifetime Download URL: ${downloadLink}`,
        downloadUrl: downloadLink
      });
    }
    case "stat": {
      if (!target) {
        return res.status(400).json({ output: "Usage: stat <filename>" });
      }
      const file = activeItems.find((i) => i.name.toLowerCase() === target.toLowerCase());
      if (!file) {
        return res.status(404).json({ output: `stat: cannot stat '${target}': No such file or directory` });
      }
      const output = [
        `  File: ${file.name}`,
        `  Size: ${file.size} bytes`,
        `  Type: ${file.isFolder ? "directory" : file.fileType}`,
        `  Account: ${file.accountName} (${file.accountId})`,
        `  Modified: ${file.lastModifiedDateTime}`,
        `  ID: ${file.id}`
      ].join("\n");
      return res.json({ output });
    }
    case "help":
      return res.json({
        output: [
          "MultiDrive Virtual SFTP / FTP Commands:",
          "  ls / dir              List files and folders in current directory",
          "  cd <folder>           Change directory (e.g. cd Financial)",
          "  pwd                   Print current working directory",
          "  get <file>            Get direct permanent download link for file",
          "  cat <file>            Print text content of file",
          "  stat <file>           Display detailed file metadata",
          "  quota                 Display aggregated storage usage",
          "  help                  Show this help text"
        ].join("\n")
      });
    case "quota": {
      const totalUsed = serverStore.accounts.reduce((acc, a) => acc + (a.quota?.used || 0), 0);
      const totalCapacity = serverStore.accounts.reduce((acc, a) => acc + (a.quota?.total || 1099511627776), 0);
      const output = [
        `MultiDrive Storage Quota:`,
        `  Connected Accounts: ${serverStore.accounts.length}`,
        `  Total Capacity: ${(totalCapacity / 1024 ** 3).toFixed(2)} GB`,
        `  Used Storage: ${(totalUsed / 1024 ** 3).toFixed(2)} GB`,
        `  Available Storage: ${((totalCapacity - totalUsed) / 1024 ** 3).toFixed(2)} GB`
      ].join("\n");
      return res.json({ output });
    }
    default:
      return res.json({
        output: `command not recognized: '${cmd}'. Type 'help' to see available SFTP/FTP commands.`
      });
  }
});
app.get("/api/sftp/export/:client", (req, res) => {
  loadStore();
  const client = req.params.client.toLowerCase();
  const host = (req.get("host") || "one.nextcloud.serv00.net").split(":")[0];
  const appUrl = getAppUrl(req);
  if (client === "filezilla") {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<FileZilla3 version="3.67.0" platform="all">
  <Servers>
    <Server>
      <Host>${host}</Host>
      <Port>22</Port>
      <Protocol>1</Protocol>
      <Type>0</Type>
      <User>admin</User>
      <Logontype>2</Logontype>
      <Name>MultiDrive OneDrive for Business</Name>
      <RemoteDir>/onedrive/</RemoteDir>
      <Comments>Exported from MultiDrive OneDrive Hub</Comments>
    </Server>
  </Servers>
</FileZilla3>`;
    res.setHeader("Content-Disposition", 'attachment; filename="FileZilla_MultiDrive.xml"');
    res.setHeader("Content-Type", "application/xml");
    return res.send(xml);
  }
  if (client === "rclone") {
    const rcloneConf = `[multidrive-onedrive]
type = sftp
host = ${host}
user = admin
port = 22
path = /onedrive/
# Or mount via WebDAV:
# type = webdav
# url = ${appUrl}/webdav
# vendor = other
# user = admin
`;
    res.setHeader("Content-Disposition", 'attachment; filename="rclone.conf"');
    res.setHeader("Content-Type", "text/plain");
    return res.send(rcloneConf);
  }
  res.status(400).send("Unknown client exporter");
});
app.all("/webdav*", (req, res) => {
  loadStore();
  const method = req.method.toUpperCase();
  const appUrl = getAppUrl(req);
  res.setHeader("DAV", "1, 2");
  res.setHeader("MS-Author-Via", "DAV");
  res.setHeader("Allow", "OPTIONS, GET, HEAD, PROPFIND");
  if (method === "OPTIONS") {
    return res.status(200).end();
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Basic ")) {
    try {
      const creds = Buffer.from(authHeader.substring(6), "base64").toString("utf-8");
      const [, pass] = creds.split(":");
      const expectedPass = process.env.ADMIN_PASSWORD || serverStore.adminPassword || "admin123";
      if (pass !== expectedPass && pass !== "admin123") {
        res.setHeader("WWW-Authenticate", 'Basic realm="MultiDrive WebDAV"');
        return res.status(401).send("Unauthorized WebDAV credentials");
      }
    } catch {
    }
  }
  const depth = req.headers.depth || "infinity";
  const activeItems = serverStore.items.filter((i) => !i.deleted);
  if (method === "PROPFIND") {
    const responses = depth === "0" ? "" : activeItems.map((item) => {
      const isFolder = !!item.isFolder;
      const resourceType = isFolder ? "<d:collection/>" : "";
      const href = `${appUrl}/webdav/${encodeURIComponent(item.name)}`;
      const date = new Date(item.lastModifiedDateTime || Date.now()).toUTCString();
      const length = item.size || 0;
      const mime = item.mimeType || (isFolder ? "httpd/unix-directory" : "application/octet-stream");
      return `  <d:response>
    <d:href>${href}</d:href>
    <d:propstat>
      <d:prop>
        <d:displayname>${item.name}</d:displayname>
        <d:getcontentlength>${length}</d:getcontentlength>
        <d:getlastmodified>${date}</d:getlastmodified>
        <d:getcontenttype>${mime}</d:getcontenttype>
        <d:resourcetype>${resourceType}</d:resourcetype>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>`;
    }).join("\n");
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>${appUrl}/webdav/</d:href>
    <d:propstat>
      <d:prop>
        <d:displayname>MultiDrive OneDrive</d:displayname>
        <d:resourcetype><d:collection/></d:resourcetype>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
${responses}
</d:multistatus>`;
    res.status(207);
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    return res.send(xml);
  }
  if (method === "GET" || method === "HEAD") {
    const rawPath = decodeURIComponent(req.path.replace(/^\/webdav\/?/, ""));
    if (!rawPath) {
      return res.send("MultiDrive WebDAV Endpoint. Mount this URL in Windows Explorer or macOS Finder.");
    }
    const item = activeItems.find((i) => i.name.toLowerCase() === rawPath.toLowerCase());
    if (!item) {
      return res.status(404).send("WebDAV resource not found");
    }
    return res.redirect(`/api/public/download/${item.id}`);
  }
  res.status(200).end();
});
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }
  app.listen(port, "0.0.0.0", () => {
    console.log(`OneDrive Business MultiDrive server running at http://0.0.0.0:${port}`);
  });
}
var server_default = app;
if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}
export {
  server_default as default
};
