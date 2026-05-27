# Cara Deploy ke GitHub & Build .exe Otomatis

## Yang perlu diinstall di komputer kamu
- Node.js LTS → https://nodejs.org (untuk dev lokal)
- Git → https://git-scm.com (untuk push ke GitHub)
- TIDAK perlu VS Build Tools!

---

## Langkah 1 — Buat akun GitHub
Kalau belum punya, daftar di https://github.com

---

## Langkah 2 — Buat repository baru
1. Klik tombol "+" di kanan atas → "New repository"
2. Nama repo: `sim-ijazah`
3. Pilih "Private" (biar tidak publik)
4. Klik "Create repository"

---

## Langkah 3 — Upload kode dari VSCode

Buka folder `sim-ijazah` di VSCode, buka Terminal (Ctrl + `):

```bash
# Inisialisasi git
git init
git add .
git commit -m "Initial commit - SIM Ijazah v2.0"

# Sambungkan ke GitHub (ganti USERNAME dengan username kamu)
git remote add origin https://github.com/USERNAME/sim-ijazah.git
git branch -M main
git push -u origin main
```

Saat diminta login, masukkan username & password GitHub.
(Kalau pakai 2FA, buat Personal Access Token dulu di GitHub Settings)

---

## Langkah 4 — Tunggu GitHub Actions build

Setelah push berhasil:
1. Buka repo di GitHub
2. Klik tab **"Actions"**
3. Akan ada workflow "Build SIM Ijazah" yang sedang berjalan
4. Tunggu ± 5-10 menit
5. Setelah selesai (centang hijau), klik workflow tersebut
6. Scroll ke bawah → bagian **"Artifacts"**
7. Download **"SIM-Ijazah-Windows-Installer"**
8. Extract → jalankan file `.exe`

---

## Setiap update kode

Cukup push lagi:
```bash
git add .
git commit -m "Update fitur X"
git push
```
GitHub Actions otomatis build ulang!

---

## Kalau mau dev/preview di lokal (tanpa build .exe)

Install Node.js saja, lalu:
```bash
npm install
npm run vite
```
Buka browser ke http://localhost:5173
(tanpa Electron, tapi bisa preview tampilan React-nya)

---

## Troubleshoot

### Push ditolak (authentication)
Buat Personal Access Token di:
GitHub → Settings → Developer settings → Personal access tokens → Generate new token
Centang: repo, workflow
Pakai token ini sebagai password saat git push.

### Build gagal di Actions
Klik workflow yang failed → klik step yang merah → baca errornya
Screenshot dan kirim untuk dibantu debug.
