# Cara Membuat & Menginstal File APK Joytify lewat GitHub

Repositori ini sudah dilengkapi **Capacitor** (`capacitor.config.json`) dan workflow otomatis **GitHub Actions** (`.github/workflows/build-apk.yml`) untuk mengompilasi file `Joytify-Android.apk` langsung di cloud tanpa perlu menginstal Android Studio di laptop/HP.

## Langkah 1: Simpan Proyek ke GitHub
1. Di halaman AI Studio, klik tombol **Save to GitHub** (atau ikon GitHub di pojok kanan atas) untuk membuat repositori baru di akun GitHub Anda.
2. Pastikan aplikasi juga sudah di-**Share / Deploy** agar server API publik (`VITE_API_BASE_URL`) bisa diakses dari HP Anda.

## Langkah 2: Jalankan Build APK di GitHub
1. Buka repositori GitHub Anda di browser (bisa langsung dari HP).
2. Ketuk tab **Actions**.
3. Pilih workflow **Build Joytify Android APK** di daftar sebelah kiri.
4. Ketuk **Run workflow** → **Run workflow** (atau workflow juga otomatis berjalan setiap kali ada `push` ke branch `main`).
5. Tunggu sekitar **2–4 menit** hingga tanda centang hijau muncul.

## Langkah 3: Unduh & Instal APK di HP Android
1. Buka hasil workflow yang sudah bercentang hijau tersebut.
2. Gulir ke paling bawah ke bagian **Artifacts**.
3. Ketuk **Joytify-Android-APK** untuk mengunduh file zip berisi `Joytify-Android.apk`.
4. Ekstrak file zip tersebut di File Manager HP Anda, lalu ketuk **`Joytify-Android.apk`**.
5. Jika HP meminta izin **Instal aplikasi dari sumber tidak dikenal**, pilih **Izinkan / Setelan → Izinkan dari sumber ini**, lalu ketuk **Instal**.
