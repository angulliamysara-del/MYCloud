# Panduan Troubleshooting Vercel (PENTING!)

Jika masih muncul "Network Error", ikuti langkah ini untuk melihat apa yang salah di "BALIK LAYAR" Vercel:

## 1. Cek Apakah Server "Bernapas" (Ping Test)
Buka link website Anda dan tambahkan `/api/ping` di belakangnya.
> Contoh: `https://mycloud-sara.vercel.app/api/ping`
*   Jika muncul tulisan **"pong"**, artinya server sudah **HIDUP** dan masalahnya ada di database/koneksi.
*   Jika muncul **"Internal Server Error"** atau **"404"**, artinya server **MATI** atau salah konfigurasi.

## 2. Cara Melihat Log (Catatan Error)
1.  Buka Dashboard [vercel.com](https://vercel.com/dashboard).
2.  Klik Project **`MYCloud`**.
3.  Klik tab **Logs** di bagian atas.
4.  Biarkan halaman Logs terbuka, lalu di tab lain, coba **Login** di website Anda sampai muncul error.
5.  Lihat kembali ke halaman Logs. Cari baris berwarna **MERAH**.
    *   Jika ada tulisan `CORS Error`, berarti keamanan browser memblokir.
    *   Jika ada `MONGO_URI undefined`, berarti variabel rahasia belum terisi.
    *   Jika ada `IP not whitelisted`, berarti Anda lupa Langkah 5.

## 3. Pastikan MongoDB Whitelist (Wajib!)
Aplikasi cloud tidak punya "Alamat IP" tetap. Jadi Anda harus mengizinkan SEMUA IP masuk ke database.
1.  Buka [MongoDB Atlas](https://cloud.mongodb.com/).
2.  Klik **Network Access** (Menu kiri).
3.  Pastikan ada baris: **`0.0.0.0/0`** (Status: Active).
4.  Jika belum ada, klik **Add IP Address** -> **Allow Access From Anywhere** -> **Confirm**.

## 4. Pastikan Environment Variables di Vercel
1.  Di Dashboard Vercel, masuk ke **Settings** -> **Environment Variables**.
2.  Pastikan 3 kunci ini ada:
    *   `MONGO_URI`
    *   `GOOGLE_CLIENT_SECRET`
    *   `GOOGLE_TOKEN`
3.  Jika Anda baru menambahkan/mengubah variabel, Anda harus **Redeploy** (Klik tab **Deployments** -> Klik titik tiga di deployment terakhir -> **Redeploy**).
