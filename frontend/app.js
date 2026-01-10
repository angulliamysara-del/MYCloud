// Detect if running locally or on cloud
const API = window.location.origin === "file://" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:3000"
  : window.location.origin + "/api";

// DOM Elements
const authSection = document.getElementById('authSection');
const dashboardSection = document.getElementById('dashboardSection');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const authMessage = document.getElementById('authMessage');
const currentUserDisplay = document.getElementById('currentUserDisplay');

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const notification = document.getElementById('notification');

// State
let TOKEN = localStorage.getItem("mycloud_token");
let USERNAME = localStorage.getItem("mycloud_user");

// ---- INIT ----
function init() {
  if (TOKEN && USERNAME) {
    showDashboard();
  } else {
    showAuth();
  }
}

// ---- AUTH LOGIC ----

function switchAuth(mode) {
  authMessage.textContent = "";
  if (mode === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
  } else {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    tabLogin.classList.remove('active');
    tabRegister.classList.add('active');
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('loginUser').value;
  const password = document.getElementById('loginPass').value;

  try {
    const res = await fetch(API + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (res.ok) {
      TOKEN = data.token;
      USERNAME = data.username;
      localStorage.setItem("mycloud_token", TOKEN);
      localStorage.setItem("mycloud_user", USERNAME);
      showDashboard();
    } else {
      authMessage.textContent = data.error || "Login Failed";
      authMessage.style.color = "var(--danger)";
    }
  } catch (error) {
    console.error("Login Error:", error);
    authMessage.textContent = "Network Error: " + error.message;
    authMessage.style.color = "var(--danger)";
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('regUser').value;
  const password = document.getElementById('regPass').value;

  try {
    const res = await fetch(API + "/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (res.ok) {
      authMessage.textContent = "Registration Successful! Please Login.";
      authMessage.style.color = "#2ed573";
      setTimeout(() => switchAuth('login'), 1500);
    } else {
      authMessage.textContent = data.error || "Registration Failed";
      authMessage.style.color = "var(--danger)";
    }
  } catch (error) {
    authMessage.textContent = "Network Error";
  }
});

function showDashboard() {
  authSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');
  currentUserDisplay.textContent = USERNAME;
  loadFiles();
  updateStorage();
}

function showAuth() {
  dashboardSection.classList.add('hidden');
  authSection.classList.remove('hidden');
  TOKEN = null;
  USERNAME = null;
  localStorage.removeItem("mycloud_token");
  localStorage.removeItem("mycloud_user");
}

function logout() {
  showAuth();
}

async function deleteAccount() {
  const confirmDelete = confirm("PERINGATAN: Apakah Anda yakin ingin menghapus akun ini? Semua file Anda di Cloud dan folder di Cloud Storage akan DIHAPUS PERMANEN!");

  if (!confirmDelete) return;

  const secondConfirm = confirm("TEKALI LAGI: Ini tidak bisa dibatalkan. Hapus akun sekarang?");
  if (!secondConfirm) return;

  try {
    const res = await fetch(`${API}/delete-account`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });

    if (res.ok) {
      alert("Akun Anda telah berhasil dihapus.");
      logout();
    } else {
      const data = await res.json();
      alert("Gagal menghapus akun: " + (data.error || "Unknown Error"));
    }
  } catch (error) {
    console.error("Delete Account Error:", error);
    alert("Gagal menghubungi server.");
  }
}

window.logout = logout;
window.deleteAccount = deleteAccount;
window.switchAuth = switchAuth;

// ---- DRAG & DROP ----
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files.length > 0) uploadFile(files[0]);
});

fileInput.addEventListener('change', () => {
  // DEBUG: Alert to confirm event fired
  // alert("File selected: " + (fileInput.files.length > 0 ? fileInput.files[0].name : "None"));
  if (fileInput.files.length > 0) uploadFile(fileInput.files[0]);
});

// ---- UPLOAD ----
function uploadFile(file) {
  const formData = new FormData();
  formData.append("file", file);

  // UI Elements
  const uploadModal = document.getElementById('uploadModal');
  const uploadTitle = document.getElementById('uploadTitle');
  const progressContainer = document.getElementById('progressContainer');
  const progressBar = document.getElementById('uploadProgressBar');
  const percentText = document.getElementById('uploadPercent');
  const uploadMessage = document.getElementById('uploadMessage');
  const closeBtn = document.getElementById('closeUploadBtn');

  // Reset UI State
  uploadModal.classList.remove('hidden');
  uploadModal.style.display = 'flex';

  uploadTitle.innerText = "Uploading...";
  uploadTitle.style.color = "var(--primary)";

  progressContainer.style.display = "block";
  progressBar.style.width = '0%';
  percentText.innerText = '0%';

  uploadMessage.style.display = "none";
  uploadMessage.innerText = "";

  closeBtn.style.display = "none";

  const xhr = new XMLHttpRequest();

  xhr.upload.addEventListener("progress", (e) => {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      progressBar.style.width = percent + "%";
      percentText.innerText = percent + "%";
    }
  });

  xhr.addEventListener("load", () => {
    // Don't hide modal. Update it.
    progressContainer.style.display = "none"; // Hide progress bar on finish
    uploadMessage.style.display = "block";
    closeBtn.style.display = "block";

    if (xhr.status >= 200 && xhr.status < 300) {
      uploadTitle.innerText = "Upload Success!";
      uploadTitle.style.color = "#2ed573";
      uploadMessage.innerText = "File has been successfully uploaded to Cloud Storage.";

      loadFiles();
      updateStorage();
    } else {
      let errMsg = "Unknown Error";
      try {
        const res = JSON.parse(xhr.responseText);
        errMsg = res.error || errMsg;
      } catch (e) {
        errMsg = xhr.responseText || "Server Error";
      }

      uploadTitle.innerText = "Upload Failed";
      uploadTitle.style.color = "#ff4757";
      uploadMessage.innerText = errMsg + ` (Code: ${xhr.status})`;
      console.error("Upload Error:", errMsg);
    }
  });

  xhr.addEventListener("error", () => {
    progressContainer.style.display = "none";
    uploadTitle.innerText = "Network Error";
    uploadTitle.style.color = "#ff4757";
    uploadMessage.style.display = "block";
    uploadMessage.innerText = "Connection failed. Please check if backend is running.";
    closeBtn.style.display = "block";
  });

  xhr.open("POST", API + "/upload");
  xhr.setRequestHeader("Authorization", TOKEN);
  xhr.send(formData);
}

function closeUploadModal() {
  const uploadModal = document.getElementById('uploadModal');
  uploadModal.classList.add('hidden');
  uploadModal.style.display = 'none';
}
window.closeUploadModal = closeUploadModal;

// ---- LIST FILES ----
async function loadFiles() {
  if (!TOKEN) return;
  try {
    const res = await fetch(API + "/files", {
      headers: { Authorization: TOKEN }
    });

    if (res.status === 401) {
      logout();
      return;
    }

    const files = await res.json();

    fileList.innerHTML = "";
    files.forEach(f => {
      const li = document.createElement("li");
      li.className = "file-item";
      li.style.animationDelay = `${Math.random() * 0.5}s`;

      li.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; flex: 1; overflow: hidden;">
          ${f.mimeType && f.mimeType.startsWith('image/')
          ? `<div style="width:40px; height:40px; border-radius:8px; overflow:hidden; flex-shrink:0; border:1px solid rgba(0,0,0,0.1);">
                 <img src="${API}/download/${f.id}?token=${TOKEN}" style="width:100%; height:100%; object-fit:cover;" alt="${f.name}">
               </div>`
          : `<i data-feather="file" style="color: var(--primary)"></i>`
        }
          <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight:500;">${f.name}</span>
        </div>
        
        <div style="display:flex; align-items:center; gap: 10px;">
            <span style="color: var(--text-muted); margin-right: 10px;">${formatSize(f.size)}</span>
            
            <!-- VIEW BUTTON -->
            <button onclick="viewFile('${f.id}', '${f.name}', '${f.mimeType}')" class="action-btn" title="View">
                <i data-feather="eye" style="width:16px; height:16px; color: var(--primary);"></i>
            </button>

            <!-- DOWNLOAD BUTTON -->
            <button onclick="initiateDownload('${f.id}')" class="action-btn" title="Download">
                <i data-feather="download" style="width:16px; height:16px; color: var(--primary);"></i>
            </button>

            <button class="delete-btn" onclick="del('${f.name}')" title="Delete">
                <i data-feather="trash-2" style="width:16px; height:16px;"></i>
            </button>
        </div>
      `;
      fileList.appendChild(li);
    });
    feather.replace();
  } catch (error) {
    console.error("Failed to load files", error);
  }
}

// ---- DOWNLOAD ----
// ---- DOWNLOAD ----
async function initiateDownload(fileId) {
  showNotification("Downloading...", "info");

  try {
    const res = await fetch(`${API}/download/${fileId}?token=${TOKEN}`);
    if (!res.ok) throw new Error("Download failed");

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    // Try getting filename from header
    let filename = "downloaded_file";
    const disposition = res.headers.get('Content-Disposition');
    if (disposition && disposition.indexOf('filename=') !== -1) {
      const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
      if (matches != null && matches[1]) {
        filename = matches[1].replace(/['"]/g, '');
      }
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    showNotification("Download Complete!", "success");

  } catch (error) {
    console.error("Download Error:", error);
    showNotification("Download Failed", "error");
  }
}

// ---- PREVIEW ----
function viewFile(id, name, mime) {
  const previewModal = document.getElementById('previewModal');
  const contentDiv = document.getElementById('previewContent');
  const url = `${API}/download/${id}?token=${TOKEN}`;

  previewModal.classList.remove('hidden');
  previewModal.style.display = 'flex';
  contentDiv.innerHTML = '<span style="color:white;">Loading...</span>';

  // Simple MIME type check
  if (mime.startsWith('image/')) {
    contentDiv.innerHTML = `<img src="${url}" style="max-width:100%; max-height:100%; object-fit:contain;">`;
  } else if (mime === 'application/pdf' || mime.startsWith('video/') || mime.startsWith('audio/') || mime.startsWith('text/')) {
    contentDiv.innerHTML = `<iframe src="${url}" style="width:100%; height:100%; border:none;"></iframe>`;
  } else {
    contentDiv.innerHTML = `
            <div style="text-align:center; color:white;">
                <p>Preview not available for this file type.</p>
                <a href="${url}" download class="primary-btn" style="display:inline-block; margin-top:10px;">Download Instead</a>
            </div>
        `;
  }
}

function closePreviewModal() {
  const previewModal = document.getElementById('previewModal');
  const contentDiv = document.getElementById('previewContent');
  previewModal.classList.add('hidden');
  previewModal.style.display = 'none';
  contentDiv.innerHTML = ''; // Clear content to stop video/audio
}
window.closePreviewModal = closePreviewModal;
window.viewFile = viewFile;

// ---- DELETE ----
async function del(name) {
  if (!confirm(`Are you sure you want to delete ${name}?`)) return;

  try {
    const res = await fetch(API + "/delete/" + encodeURIComponent(name), {
      method: "DELETE",
      headers: { Authorization: TOKEN }
    });

    if (res.ok) {
      showNotification("Deleted Successfully");
      loadFiles();
      updateStorage();
    } else {
      showNotification("Delete Failed", "error");
    }
  } catch (error) {
    showNotification("Error deleting file", "error");
  }
}

// ---- STORAGE QUOTA ----
async function updateStorage() {
  if (!TOKEN) return;
  try {
    const res = await fetch(API + "/quota", {
      headers: { Authorization: TOKEN }
    });
    const q = await res.json();

    // Backend returns { used: number, limit: number }
    if (q && q.limit) {
      const percent = Math.min((q.used / q.limit) * 100, 100);
      document.querySelector(".progress").style.width = percent + "%";

      const infoText = document.querySelector(".storage-info span");
      if (infoText) {
        infoText.innerText = `${formatSize(q.used)} / ${formatSize(q.limit)}`;
      }
    }

  } catch (error) {
    console.error("Failed to update storage", error);
  }
}

// ---- UTILS ----
function formatSize(bytes) {
  if (!bytes) return "0 B";
  const k = 1000;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function showNotification(msg, type = "success") {
  notification.textContent = msg;
  notification.style.background = type === "error" ? "#ff4757" : (type === "info" ? "#3742fa" : "#2ed573");
  notification.classList.remove("hidden");
  notification.classList.add("show");

  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.classList.add("hidden"), 300);
  }, 3000);
}

// Expose delete
window.del = del;

// Start
init();
