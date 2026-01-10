# PANDUAN FILE MYCLOUD
Jangan hapus file sembarangan agar aplikasi tidak rusak.

## 📁 FOLDER BACKEND (Jantung Aplikasi)
Lokasi: ./backend

[PENTING - DILARANG HAPUS]
- index.js           : Otak utama server. Mengatur semua logika.
- client_secret.json : KTP Aplikasi ke Google Drive.
- token.json         : Kunci akses yang sedang aktif.
- users.json         : Data username & password pengguna.
- quota.json         : Data sisa penyimpanan pengguna.
- package.json       : Daftar pustaka/library yang dipakai.
- node_modules/      : Folder berisi ribuan kode pustaka (JANGAN DISENTUH).

[BOLEH DIHAPUS / UTILITIES]
- setup_auth.js      : Alat bantu untuk bikin token baru jika yang lama rusak.
- start_server.bat   : Tombol cepat untuk menyalakan server.

[SYSTEM]
- tmp/               : Folder sementara untuk upload. Isinya boleh dihapus, foldernya biarkan.

---------------------------------------------------------

## 📁 FOLDER FRONTEND (Wajah Aplikasi)
Lokasi: ./frontend

[PENTING - DILARANG HAPUS]
- index.html         : Kerangka halaman website.
- style.css          : Hiasan/Warna website.
- app.js             : Logika website (tombol, animasi, koneksi ke backend).

---------------------------------------------------------
Dibuat oleh AI Assistant.
