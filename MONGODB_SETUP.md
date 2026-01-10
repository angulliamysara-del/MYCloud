# Panduan Lengkap: Membuat Database MongoDB Atlas Gratis

Ikuti langkah ini pelan-pelan untuk mendapatkan **Connection String** (Link Database) Anda.

## Langkah 1: Daftar Akun
1. Buka [mongodb.com/try](https://www.mongodb.com/try).
2. Di bagian "MongoDB Atlas", pilih **Sign Up**.
3. Bisa daftar pakai **Email** atau **Google Account** (lebih cepat).

## Langkah 2: Buat Cluster (Server Database)
1. Setelah login, Anda akan diminta mengisi survei. Isi asal saja atau skip.
2. Pilih paket **M0 FREE** (Kolom paling kiri, gratis selamanya).
3. **Provider**: Pilih **AWS**.
4. **Region**: Pilih **Singapore** (agar dekat dengan Indonesia).
5. Beri nama Cluster (biarkan default `Cluster0` juga tidak apa-apa).
6. Klik tombol hijau **Create Deployment** atau **Create**.

## Langkah 3: Buat User Database (PENTING!)
*Anda akan melihat menu "Security Quickstart".*
1. **Username**: Ketik `admin` (atau nama lain yang mudah diingat).
2. **Password**: Ketik password yang KUAT tapi MUDAH diingat (misal: `kucing123`). **CATAT PASSWORD INI!**
3. Klik **Create Database User**.

## Langkah 4: Izinkan Akses Internet
*Masih di halaman Security Quickstart.*
1. Cari bagian "IP Access List".
2. Klik **Add My Current IP Address** (untuk akses dari rumah).
3. **PENTING UNTUK CLOUD**: Klik lagi **Allow Access from Anywhere** (kotak isian `0.0.0.0/0`). Ini agar server hosting gratisan nanti bisa masuk.
4. Klik **Finish and Close**.

## Langkah 5: Dapatkan Link (Connection String)
1. Di halaman Dashboard (Overview), cari tombol **Connect** (biasanya tombol putih di dekat nama Cluster).
2. Pilih **Drivers** (Node.js, Python, dll).
3. Anda akan melihat kode panjang seperti ini:
   `mongodb+srv://admin:<db_password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority`
4. **COPY kode tersebut.**

## Langkah 6: Simpan Link
1. Paste kode tadi di Notepad.
2. Ganti `<db_password>` dengan password asli yang Anda buat di Langkah 3 (contoh menjadi: `...admin:kucing123@cluster...`).
3. **SELESAI!** Link inilah yang akan kita pakai nanti.
