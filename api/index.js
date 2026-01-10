import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import mongoose from "mongoose";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: "tmp/" });
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION ---
const SYSTEM_ROOT_NAME = "MYCloud_Storage"; // Name of the main folder
const DEFAULT_QUOTA = 5 * 1024 * 1024 * 1024; // 5 GB

// Database Models
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

const quotaSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  used: { type: Number, default: 0 },
  limit: { type: Number, default: DEFAULT_QUOTA }
});

const User = mongoose.model("User", userSchema);
const Quota = mongoose.model("Quota", quotaSchema);

app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION ---
let isConnected = false;
const connectDB = async () => {
  if (isConnected) return;
  const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/mycloud_local";
  await mongoose.connect(MONGO_URI);
  isConnected = true;
  console.log("✅ Connected to MongoDB");
};

// Middleware to ensure DB and Drive connection
app.use(async (req, res, next) => {
  // Normalize path for Vercel (strip /api if present)
  if (req.url.startsWith('/api')) {
    req.url = req.url.replace('/api', '');
  }

  try {
    await connectDB();
    if (!drive) await setupDrive();
    next();
  } catch (err) {
    console.error("Initialization Error:", err);
    res.status(500).json({ error: "Server Initialization Error" });
  }
});

// --- AUTHENTICATION STRATEGY ---
let drive;

async function setupDrive() {
  let client_id, client_secret, redirect_uris, token_data;

  // Try loading from Environment Variables (Best for Cloud)
  if (process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_TOKEN) {
    console.log("Using Credentials from Environment Variables...");
    const creds = JSON.parse(process.env.GOOGLE_CLIENT_SECRET);
    ({ client_id, client_secret, redirect_uris } = creds.installed || creds.web);
    token_data = JSON.parse(process.env.GOOGLE_TOKEN);
  }
  // Fallback to Local Files (Best for Local Dev)
  else if (fs.existsSync("client_secret.json") && fs.existsSync("token.json")) {
    console.log("Using Local credential files...");
    const creds = JSON.parse(fs.readFileSync("client_secret.json"));
    ({ client_id, client_secret, redirect_uris } = creds.installed || creds.web);
    token_data = JSON.parse(fs.readFileSync("token.json"));
  } else {
    console.error("❌ NO GOOGLE CREDENTIALS FOUND! Please set Env Vars or local files.");
    return;
  }

  const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  auth.setCredentials(token_data);
  drive = google.drive({ version: "v3", auth });
  console.log("✅ Google Drive API Ready");
}
setupDrive();

// --- HELPERS ---
const getUser = async (req) => {
  let u = null;
  const h = req.headers.authorization;

  if (h) {
    u = h.replace("Bearer ", "");
  } else if (req.query.token) {
    u = req.query.token.replace("Bearer ", "");
  }

  if (req.path.includes("download")) {
    console.log(`[AUTH CHECK] Path: ${req.path}, Resolved User: ${u}`);
  }

  if (!u) return null;

  const user = await User.findOne({ username: u });
  return user ? user.username : null;
};

async function getSystemRootFolder() {
  if (!drive) return null;
  try {
    const res = await drive.files.list({
      q: `mimeType = 'application/vnd.google-apps.folder' and name = '${SYSTEM_ROOT_NAME}' and trashed = false`,
      fields: "files(id, name)",
    });
    if (res.data.files.length > 0) return res.data.files[0].id;

    // Create if not exists
    const fileMetadata = {
      name: SYSTEM_ROOT_NAME,
      mimeType: "application/vnd.google-apps.folder",
    };
    const file = await drive.files.create({
      resource: fileMetadata,
      fields: "id",
    });
    return file.data.id;
  } catch (error) {
    console.error("Error finding Root Folder:", error.message);
    return null;
  }
}

async function getUserFolder(username) {
  const rootId = await getSystemRootFolder();
  if (!rootId) throw new Error("System Root Folder not found");

  try {
    const res = await drive.files.list({
      q: `mimeType = 'application/vnd.google-apps.folder' and name = '${username}' and parents in '${rootId}' and trashed = false`,
      fields: "files(id, name)",
    });

    if (res.data.files.length > 0) return res.data.files[0].id;

    const fileMetadata = {
      name: username,
      mimeType: "application/vnd.google-apps.folder",
      parents: [rootId],
    };
    const file = await drive.files.create({
      resource: fileMetadata,
      fields: "id",
    });
    return file.data.id;
  } catch (error) {
    console.error("Error finding User Folder:", error.message);
    throw error;
  }
}

// --- ENDPOINTS ---

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Username and password required" });

  try {
    const userCount = await User.countDocuments();
    if (userCount >= 3) {
      return res.status(403).json({ error: "Registration closed. Max 3 users reached." });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const newUser = new User({ username, password });
    await newUser.save();

    // Initialize Quota
    const newQuota = new Quota({ username, used: 0, limit: DEFAULT_QUOTA });
    await newQuota.save();

    res.json({ message: "Registration successful" });
  } catch (err) {
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username, password });
    if (user) {
      res.json({ token: user.username, username: user.username });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

app.get("/quota", async (req, res) => {
  const username = await getUser(req);
  if (!username) return res.status(401).json({ error: "Unauthorized" });

  try {
    const q = await Quota.findOne({ username });
    if (!q) {
      // Create if missing
      const newQ = new Quota({ username, used: 0, limit: DEFAULT_QUOTA });
      await newQ.save();
      return res.json({ used: 0, limit: DEFAULT_QUOTA });
    }
    res.json({ used: q.used, limit: q.limit });
  } catch (err) {
    res.status(500).json({ error: "Error fetching quota" });
  }
});

// GET Files
app.get("/files", async (req, res) => {
  const username = await getUser(req);
  if (!username) return res.status(401).json({ error: "Unauthorized" });

  if (!drive) return res.status(500).json({ error: "Drive not connected" });

  try {
    const folderId = await getUserFolder(username);
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id, name, size, mimeType)",
    });
    res.json(response.data.files || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPLOAD
app.post("/upload", upload.single("file"), async (req, res) => {
  const username = await getUser(req);
  if (!username) return res.status(401).json({ error: "Unauthorized" });

  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const fileSize = req.file.size;

    // Check quota
    let quota = await Quota.findOne({ username });
    if (!quota) {
      quota = new Quota({ username, used: 0, limit: DEFAULT_QUOTA });
    }

    if (quota.used + fileSize > quota.limit) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: "Quota exceeded" });
    }

    const folderId = await getUserFolder(username);
    const fileMetadata = {
      name: req.file.originalname,
      parents: [folderId],
    };
    const media = {
      mimeType: req.file.mimetype,
      body: fs.createReadStream(req.file.path),
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id, size",
    });

    // Update Quota DB
    quota.used += parseInt(file.data.size || fileSize); // API might return diff size
    await quota.save();

    // Cleanup
    fs.unlinkSync(req.file.path);

    res.json({ message: "Upload success", fileId: file.data.id });

  } catch (error) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error("Upload Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// STREAM DOWNLOAD (Proxy)
app.get("/download/:fileId", async (req, res) => {
  const username = await getUser(req);
  if (!username) return res.status(401).json({ error: "Unauthorized" });

  const fileId = req.params.fileId;

  try {
    const file = await drive.files.get({
      fileId: fileId,
      fields: 'name, mimeType'
    });

    res.setHeader('Content-Disposition', `attachment; filename="${file.data.name}"`);
    res.setHeader('Content-Type', file.data.mimeType);

    const dest = res;
    const result = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    result.data.pipe(dest);

  } catch (error) {
    console.error("Download Error", error);
    res.status(500).send("Error downloading file");
  }
});

// DELETE
app.delete("/delete/:name", async (req, res) => {
  const username = await getUser(req);
  if (!username) return res.status(401).json({ error: "Unauthorized" });

  const fileName = req.params.name;

  try {
    const folderId = await getUserFolder(username);

    // Find file ID by name
    const listRes = await drive.files.list({
      q: `'${folderId}' in parents and name = '${fileName}' and trashed = false`,
      fields: "files(id, size)",
    });

    if (listRes.data.files.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    const fileId = listRes.data.files[0].id;
    const fileSize = parseInt(listRes.data.files[0].size);

    // Delete from Drive
    await drive.files.delete({ fileId: fileId });

    // Update Quota DB
    await Quota.updateOne(
      { username },
      { $inc: { used: -fileSize } }
    );

    res.json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start Server (Only for local dev)
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

// Export for Vercel
export default app;
