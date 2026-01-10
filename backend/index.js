import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import { google } from "googleapis";

const app = express();
const upload = multer({ dest: "tmp/" });
const PORT = 3000;

app.use(cors());
app.use(express.json());

// --- CONFIGURATION ---
// IMPORTANT: Replace with your actual credentials and folder ID
const QUOTA_FILE = "./quota.json";
const USERS_FILE = "./users.json";
const MAX_USERS = 3;
const USER_QUOTA_LIMIT = 5 * 1024 * 1024 * 1024; // 5 GB
const SYSTEM_ROOT_NAME = "MYCloud_Storage"; // Name of the main folder

// --- AUTHENTICATION STRATEGY ---
// Priority: OAuth2 (User) -> Service Account (Legacy)
let drive;

async function setupDrive() {
  if (fs.existsSync("token.json") && fs.existsSync("client_secret.json")) {
    console.log("Using OAuth2 (Personal Account) Authentication...");
    const credentials = JSON.parse(fs.readFileSync("client_secret.json"));
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    const token = JSON.parse(fs.readFileSync("token.json"));
    auth.setCredentials(token);
    drive = google.drive({ version: "v3", auth });

  } else if (fs.existsSync("credentials.json") && readJson("credentials.json").private_key) {
    console.log("Using Service Account Authentication (Warning: Quota limits may apply)...");
    const auth = new google.auth.GoogleAuth({
      keyFile: "credentials.json",
      scopes: ["https://www.googleapis.com/auth/drive"]
    });
    drive = google.drive({ version: "v3", auth });
  } else {
    console.error("NO CREDENTIALS FOUND! Please set up 'client_secret.json' & 'token.json'.");
  }
}
setupDrive();
// -------------------------------

// --- HELPERS ---
const readJson = (file) => {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file));
  } catch (e) { return []; }
};
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

const readQuota = () => {
  if (!fs.existsSync(QUOTA_FILE)) return {};
  return JSON.parse(fs.readFileSync(QUOTA_FILE));
};
const writeQuota = (d) => fs.writeFileSync(QUOTA_FILE, JSON.stringify(d, null, 2));

// Simple "token" verification (username as token for simplicity in this demo)
const getUser = req => {
  let u = null;
  const h = req.headers.authorization;

  if (h) {
    u = h.replace("Bearer ", "");
  } else if (req.query.token) {
    // Fallback for direct browser links/images
    u = req.query.token.replace("Bearer ", "");
  }

  // Debug Log
  if (req.path.includes("download")) {
    console.log(`[AUTH CHECK] Path: ${req.path}, Resolved User: ${u}`);
  }

  if (!u) return null;

  const users = readJson(USERS_FILE);
  const userExists = users.find(user => user.username === u);

  return userExists ? u : null;
};

// --- AUTH ENDPOINTS ---

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Username and password required" });

  const users = readJson(USERS_FILE);

  if (users.length >= MAX_USERS) {
    return res.status(403).json({ error: "Registration closed. Max 3 users reached." });
  }

  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: "Username already exists" });
  }

  // In a real app, hash the password!
  users.push({ username, password });
  writeJson(USERS_FILE, users);

  // Initialize Quota
  const quota = readQuota();
  quota[username] = { used: 0, limit: USER_QUOTA_LIMIT };
  writeQuota(quota);

  res.json({ message: "Registration successful" });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const users = readJson(USERS_FILE);

  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  res.json({ token: "Bearer " + username, username });
});


// --- DRIVE FUNCTIONS ---

let cachedRootId = null;

async function getSystemRootFolder() {
  if (cachedRootId) return cachedRootId;

  try {
    // Search for the root folder in the user's Drive
    const q = `name='${SYSTEM_ROOT_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const res = await drive.files.list({ q });

    if (res.data.files.length > 0) {
      cachedRootId = res.data.files[0].id;
      return cachedRootId;
    }

    // Create if not exists
    const fileMetadata = {
      name: SYSTEM_ROOT_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id',
    });

    cachedRootId = file.data.id;
    console.log("Created System Root Folder:", cachedRootId);
    return cachedRootId;

  } catch (error) {
    console.error("Error finding/creating system root:", error);
    throw error;
  }
}

async function getUserFolder(user) {
  try {
    const rootId = await getSystemRootFolder();

    const q = `'${rootId}' in parents and name='${user}' and trashed=false`;
    const r = await drive.files.list({ q });
    if (r.data.files.length) return r.data.files[0].id;

    const f = await drive.files.create({
      requestBody: {
        name: user,
        mimeType: "application/vnd.google-apps.folder",
        parents: [rootId]
      }
    });
    return f.data.id;
  } catch (error) {
    console.error("Error getting user folder:", error);
    throw error;
  }
}

// --- FILE ENDPOINTS ---

app.post("/upload", upload.single("file"), async (req, res) => {
  const user = getUser(req);
  if (!user) return res.sendStatus(401);

  const quota = readQuota();
  const file = req.file;

  if (!quota[user]) {
    // Should rely on register, but just in case
    quota[user] = { used: 0, limit: USER_QUOTA_LIMIT };
  }

  if (quota[user].used + file.size > quota[user].limit) {
    fs.unlinkSync(file.path);
    return res.status(400).json({ error: "Storage Quota Exceeded (5GB Limit)" });
  }

  try {
    const folderId = await getUserFolder(user);
    console.log(`[UPLOAD] User: ${user}, FolderID: ${folderId}`);

    console.log(`[UPLOAD] Starting File Create: ${file.originalname}`);

    // Explicitly await the stream creation to catch errors there too if needed
    const media = { body: fs.createReadStream(file.path) };

    const driveFile = await drive.files.create({
      requestBody: { name: file.originalname, parents: [folderId] },
      media: media
    });

    console.log(`[UPLOAD] Success. File ID: ${driveFile.data.id}`);

    if (!quota[user]) quota[user] = { used: 0, limit: USER_QUOTA_LIMIT };
    quota[user].used += file.size || 0;
    writeQuota(quota);

    // Attempt cleanup
    try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (e) { }

    res.json({ message: "Upload success", fileId: driveFile.data.id });
  } catch (error) {
    console.error(`[UPLOAD] CRITICAL ERROR:`, error);

    // cleanup
    try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (e) { }

    // Check for specific Drive errors
    let errorMessage = "Upload failed";
    if (error.errors && error.errors.length > 0) {
      errorMessage += ": " + error.errors[0].message + " (" + error.errors[0].reason + ")";
    } else if (error.message) {
      errorMessage += ": " + error.message;
    }

    return res.status(500).json({ error: errorMessage });
  }
});

app.get("/files", async (req, res) => {
  const user = getUser(req);
  if (!user) return res.sendStatus(401);

  try {
    const folderId = await getUserFolder(user);
    const r = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(id, name, size, mimeType, modifiedTime)"
    });
    res.json(r.data.files);
  } catch (error) {
    console.error("List files error:", error);
    res.status(500).json({ error: "Failed to list files" });
  }
});

app.delete("/delete/:name", async (req, res) => {
  const user = getUser(req);
  if (!user) return res.sendStatus(401);

  try {
    const folderId = await getUserFolder(user);
    const r = await drive.files.list({
      q: `'${folderId}' in parents and name='${req.params.name}' and trashed=false`
    });

    if (!r.data.files.length) return res.sendStatus(404);

    const fileId = r.data.files[0].id;
    // Get file size before delete to update quota
    // drive.files.get can return size, but we already have it in list if we asked or we can just try our best.
    // Ideally we track file IDs in local DB or fetch metadata. 
    // For now, let's just delete. Correct quota decrement requires knowing the size.
    // We will fetch the file metadata first
    const fileMeta = await drive.files.get({ fileId, fields: "size" });
    const size = parseInt(fileMeta.data.size || 0);

    await drive.files.delete({ fileId });

    const quota = readQuota();
    if (quota[user]) {
      quota[user].used = Math.max(0, quota[user].used - size);
      writeQuota(quota);
    }

    res.json({ message: "Deleted" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ error: "Delete failed" });
  }
});

app.get("/download/:fileId", async (req, res) => {
  const user = getUser(req);
  if (!user) return res.sendStatus(401);

  const fileId = req.params.fileId;
  try {
    // Get file metadata for name
    const meta = await drive.files.get({ fileId, fields: "name, mimeType" });
    const fileName = meta.data.name;

    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Type", meta.data.mimeType);

    const dest = res;
    await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    ).then(r => {
      r.data
        .on("end", () => console.log("Done downloading file."))
        .on("error", err => {
          console.error("Error downloading file.");
        })
        .pipe(dest);
    });

  } catch (error) {
    console.error("Download Error:", error);
    res.status(500).send("Error downloading file");
  }
});

app.get("/quota", (req, res) => {
  const user = getUser(req);
  if (!user) return res.sendStatus(401);
  const quota = readQuota();
  res.json(quota[user] || { used: 0, limit: USER_QUOTA_LIMIT });
});

app.listen(PORT, () => console.log("Backend running on", PORT));
