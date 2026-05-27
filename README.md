# SIM Ijazah v2.0 — Electron + React + TypeScript

Desktop app modern untuk Sistem Informasi Nilai Ijazah sekolah.

## Tech Stack
- **Electron** — desktop app wrapper
- **React 18 + TypeScript** — UI framework
- **Tailwind CSS** — styling
- **better-sqlite3** — database lokal offline
- **Lucide React** — ikon

## Prerequisites
- Node.js >= 18
- npm atau yarn

## Setup & Jalankan (Development)

```bash
# 1. Install dependencies
npm install

# 2. Rebuild native modules untuk Electron
npm run electron:rebuild   # atau:
./node_modules/.bin/electron-rebuild -f -w better-sqlite3

# 3. Jalankan dev mode (buka 2 terminal)
# Terminal 1:
npm run vite

# Terminal 2 (setelah vite ready):
npm run electron

# Atau pakai concurrently (1 terminal):
npm run dev
```

## Build Installer (.exe)

```bash
# Build untuk Windows
npm run build:win
```

Output ada di folder `dist-electron/`.

## Default Login
- **Email:** admin@sekolah.id
- **Password:** admin123

## Data & Output
- **Database:** `%APPDATA%/sim-ijazah/sim_ijazah.db`
- **Output PDF/Excel:** `%APPDATA%/sim-ijazah/output/`

## Struktur Project

```
sim-ijazah/
├── electron/
│   ├── main.js          # Electron main process + SQLite IPC
│   └── preload.js       # Bridge main ↔ renderer
├── src/
│   ├── components/
│   │   ├── ui/          # Komponen reusable (Button, Table, Modal, dll)
│   │   ├── layout/      # Sidebar, layout
│   │   └── pages/       # Halaman-halaman aplikasi
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # API wrappers
│   └── types/           # TypeScript types
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## Troubleshooting

### Error: better-sqlite3 not compatible
```bash
npm rebuild better-sqlite3
```

### Error: Cannot find module
```bash
npm install
```
