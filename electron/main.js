const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const path = require('path')
const fs   = require('fs')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// ── Paths ──────────────────────────────────────────────────────────────────
const userDataPath = app.getPath('userData')
const dbPath       = path.join(userDataPath, 'sim_ijazah.db')
const outputPath   = path.join(userDataPath, 'output')
if (!fs.existsSync(outputPath)) fs.mkdirSync(outputPath, { recursive: true })

let db

// ── DB init ────────────────────────────────────────────────────────────────
function initDB() {
  const Database = require('better-sqlite3')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT, email TEXT UNIQUE, password TEXT, role TEXT
    );
    CREATE TABLE IF NOT EXISTS sekolah (
      id INTEGER PRIMARY KEY,
      nama TEXT, nss TEXT, npsn TEXT, kepala TEXT, nip TEXT,
      alamat TEXT, kota TEXT, provinsi TEXT, kode_pos TEXT,
      telp TEXT, email_sekolah TEXT, website TEXT,
      tahun_ajaran TEXT, tgl_lulus TEXT,
      bobot_raport REAL DEFAULT 60, bobot_ujian REAL DEFAULT 40,
      jenjang TEXT DEFAULT 'MI',
      logo_sekolah TEXT,
      logo_kemdikbud TEXT,
      logo_garuda TEXT,
      program_keahlian TEXT,
      kompetensi_keahlian TEXT,
      keputusan_kepala TEXT,
      no_sk TEXT,
      kabupaten TEXT,
      tgl_rapat TEXT,
      jenis_kekhususan TEXT,
      nama_singkat TEXT,
      yayasan TEXT,
      jenis_sekolah TEXT,
      alamat2 TEXT,
      no_skkb TEXT
    );
    CREATE TABLE IF NOT EXISTS semester_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL, urutan INTEGER NOT NULL, is_ujian INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS siswa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      no_urut INTEGER, nism TEXT, nisn TEXT, nama TEXT, jk TEXT,
      tempat_lahir TEXT, tgl_lahir TEXT,
      ortu TEXT, nama_ibu TEXT,
      agama TEXT DEFAULT 'Islam', kewarganegaraan TEXT DEFAULT 'Indonesia',
      anak_ke TEXT, asal_sekolah TEXT, tahun_masuk TEXT, kelas TEXT,
      no_hp_ortu TEXT, alamat TEXT,
      peserta_am TEXT, no_peserta TEXT, blanko TEXT,
      no_skl TEXT, no_skkb TEXT, jenis_kekhususan TEXT, foto TEXT
    );
    CREATE TABLE IF NOT EXISTS mapel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT, kelompok TEXT, urutan INTEGER, is_mulok INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS nilai (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      siswa_id INTEGER, mapel_id INTEGER, semester_id INTEGER,
      nilai_p REAL, nilai_k REAL, nilai_ujian REAL,
      UNIQUE(siswa_id, mapel_id, semester_id)
    );
    CREATE TABLE IF NOT EXISTS nomor_surat (
      id INTEGER PRIMARY KEY DEFAULT 1,
      no_sk TEXT,
      no_sk_dkn TEXT,
      no_skkb TEXT,
      no_nilai_ijazah TEXT,
      no_transkrip TEXT
    );
    INSERT OR IGNORE INTO nomor_surat(id) VALUES(1);

    CREATE TABLE IF NOT EXISTS angkatan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL, tahun_lulus TEXT, keterangan TEXT, is_aktif INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS angkatan_siswa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      angkatan_id INTEGER NOT NULL, siswa_id INTEGER NOT NULL,
      UNIQUE(angkatan_id, siswa_id)
    );

    -- ── MODUL KEPEGAWAIAN ───────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS guru (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nip TEXT, nama TEXT NOT NULL, jk TEXT DEFAULT 'L',
      tempat_lahir TEXT, tgl_lahir TEXT, agama TEXT DEFAULT 'Islam',
      pendidikan TEXT, jurusan TEXT,
      status_kepegawaian TEXT DEFAULT 'PNS',
      sk_pertama TEXT, tmt_pertama TEXT,
      golongan TEXT, jabatan TEXT DEFAULT 'Guru',
      mapel TEXT, no_hp TEXT, alamat TEXT, email TEXT, foto TEXT,
      tahun_masuk TEXT, keterangan TEXT
    );
    CREATE TABLE IF NOT EXISTS absensi_guru (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guru_id INTEGER NOT NULL, tanggal TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'H', keterangan TEXT,
      UNIQUE(guru_id, tanggal)
    );
    CREATE TABLE IF NOT EXISTS jam_mengajar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guru_id INTEGER NOT NULL, mapel TEXT, kelas TEXT,
      jumlah_jam INTEGER DEFAULT 0, tahun_ajaran TEXT
    );
    CREATE TABLE IF NOT EXISTS sk_tugas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guru_id INTEGER NOT NULL, jenis_tugas TEXT,
      kelas TEXT, no_sk TEXT, tgl_sk TEXT,
      tahun_ajaran TEXT, keterangan TEXT
    );
    -- ── MODUL RAPORT ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS raport_periode (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      tahun_ajaran TEXT NOT NULL,
      semester TEXT NOT NULL DEFAULT 'Ganjil',
      angkatan_id INTEGER,
      is_aktif INTEGER DEFAULT 0,
      tgl_mulai TEXT, tgl_selesai TEXT,
      bobot_uh REAL DEFAULT 40,
      bobot_uts REAL DEFAULT 25,
      bobot_pas REAL DEFAULT 30,
      bobot_hadir REAL DEFAULT 5,
      jumlah_hari_efektif INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS raport_mapel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      periode_id INTEGER NOT NULL,
      nama TEXT NOT NULL,
      kelompok TEXT DEFAULT 'A',
      urutan INTEGER DEFAULT 99,
      guru TEXT,
      kkm INTEGER DEFAULT 75,
      jumlah_bab INTEGER DEFAULT 3
    );

    CREATE TABLE IF NOT EXISTS raport_siswa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      periode_id INTEGER NOT NULL,
      siswa_id INTEGER NOT NULL,
      kelas TEXT,
      no_absen INTEGER,
      hadir INTEGER DEFAULT 0,
      sakit INTEGER DEFAULT 0,
      izin INTEGER DEFAULT 0,
      alpha INTEGER DEFAULT 0,
      catatan_wali TEXT,
      UNIQUE(periode_id, siswa_id)
    );

    CREATE TABLE IF NOT EXISTS raport_nilai (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      periode_id INTEGER NOT NULL,
      siswa_id INTEGER NOT NULL,
      mapel_id INTEGER NOT NULL,
      uh1 REAL, uh2 REAL, uh3 REAL, uh4 REAL, uh5 REAL, uh6 REAL,
      uts REAL,
      pas REAL,
      nilai_akhir REAL,
      predikat TEXT,
      deskripsi TEXT,
      UNIQUE(periode_id, siswa_id, mapel_id)
    );

    CREATE TABLE IF NOT EXISTS kartu_ujian_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama_ujian TEXT NOT NULL,
      jenis_ujian TEXT DEFAULT 'PAS',
      tahun_ajaran TEXT,
      semester TEXT,
      tgl_mulai TEXT,
      tgl_selesai TEXT,
      lokasi TEXT,
      keterangan TEXT,
      angkatan_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS rekap_bos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tahun TEXT NOT NULL,
      semester TEXT NOT NULL DEFAULT 'Ganjil',
      komponen TEXT NOT NULL,
      sub_komponen TEXT,
      anggaran REAL DEFAULT 0,
      realisasi REAL DEFAULT 0,
      keterangan TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS ppdb (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      no_pendaftaran TEXT,
      nama TEXT NOT NULL,
      jk TEXT DEFAULT 'L',
      tempat_lahir TEXT,
      tgl_lahir TEXT,
      agama TEXT DEFAULT 'Islam',
      asal_sekolah TEXT,
      nisn TEXT,
      nik TEXT,
      alamat TEXT,
      no_hp TEXT,
      nama_ayah TEXT,
      nama_ibu TEXT,
      pekerjaan_ayah TEXT,
      pekerjaan_ibu TEXT,
      no_hp_ortu TEXT,
      nilai_un REAL,
      nilai_mtk REAL,
      nilai_ipa REAL,
      nilai_bindo REAL,
      nilai_bing REAL,
      status TEXT DEFAULT 'Daftar',
      gelombang TEXT,
      tgl_daftar TEXT DEFAULT (date('now','localtime')),
      keterangan TEXT,
      foto TEXT
    );

    CREATE TABLE IF NOT EXISTS surat_keluar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jenis TEXT, siswa_id INTEGER, no_surat TEXT,
      perihal TEXT, tanggal TEXT, keterangan TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- ── MODUL WALI KELAS ────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS kelas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      tingkat TEXT,
      tahun_ajaran TEXT,
      wali_kelas TEXT,
      angkatan_id INTEGER,
      kapasitas INTEGER DEFAULT 32
    );

    CREATE TABLE IF NOT EXISTS denah_tempat_duduk (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kelas_id INTEGER NOT NULL,
      baris INTEGER NOT NULL,
      kolom INTEGER NOT NULL,
      siswa_id INTEGER,
      label TEXT,
      UNIQUE(kelas_id, baris, kolom)
    );

    CREATE TABLE IF NOT EXISTS jadwal_pelajaran (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kelas_id INTEGER NOT NULL,
      hari TEXT NOT NULL,
      jam_ke INTEGER NOT NULL,
      jam_mulai TEXT,
      jam_selesai TEXT,
      mapel_id INTEGER,
      nama_mapel TEXT,
      guru TEXT,
      ruangan TEXT
    );

    -- Master pengaturan jam pelajaran per hari (jam ke berapa, mulai-selesai, tipe slot)
    CREATE TABLE IF NOT EXISTS pengaturan_jam (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hari TEXT NOT NULL,
      jam_ke INTEGER NOT NULL,
      jam_mulai TEXT NOT NULL,
      jam_selesai TEXT NOT NULL,
      tipe TEXT NOT NULL DEFAULT 'mengajar', -- mengajar | upacara | pembiasaan | istirahat | lainnya
      label TEXT,
      UNIQUE(hari, jam_ke)
    );

    -- Jadwal piket harian (terpisah dari jam mengajar, dipakai di cetak jadwal lengkap)
    CREATE TABLE IF NOT EXISTS piket_harian (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hari TEXT NOT NULL,
      guru_id INTEGER NOT NULL,
      urutan INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS jurnal_kelas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kelas_id INTEGER NOT NULL,
      tanggal TEXT NOT NULL,
      jam_ke INTEGER,
      mapel_id INTEGER,
      nama_mapel TEXT,
      guru TEXT,
      materi TEXT,
      catatan TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS absensi_harian (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kelas_id INTEGER NOT NULL,
      siswa_id INTEGER NOT NULL,
      tanggal TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'H',
      keterangan TEXT,
      UNIQUE(kelas_id, siswa_id, tanggal)
    );
  `)

  // Migrasi kolom lama jika belum ada
  try { db.prepare('ALTER TABLE nomor_surat ADD COLUMN no_transkrip TEXT').run() } catch(e) {}

  const crypto = require('crypto')
  const hash = pw => crypto.createHash('sha256').update(pw).digest('hex')

  if (!db.prepare('SELECT id FROM users LIMIT 1').get())
    db.prepare('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)').run('Administrator','admin@sekolah.id',hash('admin123'),'admin')

  // ── Migrasi kolom sekolah ──
  const sekolahCols = db.prepare("PRAGMA table_info(sekolah)").all().map(c => c.name)
  const newSekolahCols = {
    logo_sekolah: 'TEXT', logo_kemdikbud: 'TEXT', logo_garuda: 'TEXT',
    program_keahlian: 'TEXT', kompetensi_keahlian: 'TEXT',
    keputusan_kepala: 'TEXT', no_sk: 'TEXT',
    kabupaten: 'TEXT', tgl_rapat: 'TEXT', jenis_kekhususan: 'TEXT',
    nama_singkat: 'TEXT', yayasan: 'TEXT', jenis_sekolah: 'TEXT',
    judul_skl: 'TEXT', paragraf_pembuka_skl: 'TEXT', paragraf_penutup_skl: 'TEXT',
    kop_font_nama: 'REAL', kop_font_yayasan: 'REAL', kop_font_jenis: 'REAL',
    kop_show_logo_kanan: 'INTEGER', kop_font_family: 'TEXT',
    pdf_margin_left: 'REAL', pdf_margin_right: 'REAL',
    pdf_margin_top: 'REAL', pdf_margin_bottom: 'REAL',
    pdf_ukuran: 'TEXT', kop_image: 'TEXT',
    judul_sk_kelulusan: 'TEXT', paragraf_pembuka_sk: 'TEXT', paragraf_penutup_sk: 'TEXT',
    alamat2: 'TEXT', no_skkb: 'TEXT', tgl_ttd_kepsek: 'TEXT'
  }
  Object.entries(newSekolahCols).forEach(([col, type]) => {
    if (!sekolahCols.includes(col))
      db.prepare(`ALTER TABLE sekolah ADD COLUMN ${col} ${type}`).run()
  })

  // ── Migrasi kolom siswa ──
  const siswaCols = db.prepare("PRAGMA table_info(siswa)").all().map(c => c.name)
  const newSiswaCols = {
    no_skl: 'TEXT', foto: 'TEXT',
    no_peserta: 'TEXT', alamat: 'TEXT', no_skkb: 'TEXT', jenis_kekhususan: 'TEXT',
    // Field baru v6
    nama_ibu: 'TEXT', agama: "TEXT DEFAULT 'Islam'",
    kewarganegaraan: "TEXT DEFAULT 'Indonesia'",
    anak_ke: 'TEXT', asal_sekolah: 'TEXT', tahun_masuk: 'TEXT',
    kelas: 'TEXT', no_hp_ortu: 'TEXT',
    no_transkrip: 'TEXT'
  }
  Object.entries(newSiswaCols).forEach(([col, type]) => {
    if (!siswaCols.includes(col))
      db.prepare(`ALTER TABLE siswa ADD COLUMN ${col} ${type}`).run()
  })

  // ── Migrasi kolom untuk modul Jadwal Pelajaran (guru, jam_mengajar, jadwal_pelajaran) ──
  const guruCols = db.prepare("PRAGMA table_info(guru)").all().map(c => c.name)
  const newGuruCols = { hari_tersedia: 'TEXT', maks_jam_per_hari: 'INTEGER' }
  Object.entries(newGuruCols).forEach(([col, type]) => {
    if (!guruCols.includes(col)) db.prepare(`ALTER TABLE guru ADD COLUMN ${col} ${type}`).run()
  })

  const jamMengajarCols = db.prepare("PRAGMA table_info(jam_mengajar)").all().map(c => c.name)
  const newJamMengajarCols = { kelas_id: 'INTEGER', mapel_id: 'INTEGER', semester: 'TEXT' }
  Object.entries(newJamMengajarCols).forEach(([col, type]) => {
    if (!jamMengajarCols.includes(col)) db.prepare(`ALTER TABLE jam_mengajar ADD COLUMN ${col} ${type}`).run()
  })

  const jadwalPelajaranCols = db.prepare("PRAGMA table_info(jadwal_pelajaran)").all().map(c => c.name)
  const newJadwalPelajaranCols = { guru_id: 'INTEGER', jam_mengajar_id: 'INTEGER', blok_id: 'TEXT', semester: 'TEXT' }
  Object.entries(newJadwalPelajaranCols).forEach(([col, type]) => {
    if (!jadwalPelajaranCols.includes(col)) db.prepare(`ALTER TABLE jadwal_pelajaran ADD COLUMN ${col} ${type}`).run()
  })

  if (!db.prepare('SELECT id FROM sekolah LIMIT 1').get())
    db.prepare(`INSERT INTO sekolah(id,nama,nss,npsn,kepala,nip,alamat,kota,provinsi,kode_pos,telp,tahun_ajaran,tgl_lulus,bobot_raport,bobot_ujian,jenjang)
      VALUES(1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('MI Contoh','111233040001','10100001','Nama Kepala Sekolah','196001011980011001',
      'Jl. Contoh No.1','Kota','Provinsi','12345','021-000000','2024/2025',new Date().toISOString().split('T')[0],60,40,'MI')

  if (!db.prepare('SELECT id FROM semester_config LIMIT 1').get()) {
    const ins = db.prepare('INSERT INTO semester_config(label,urutan,is_ujian) VALUES(?,?,?)')
    ;[['Semester 1 (Ganjil)',1,0],['Semester 2 (Genap)',2,0],['Semester 3 (Ganjil)',3,0],
      ['Semester 4 (Genap)',4,0],['Semester 5 (Ganjil)',5,0],['Semester 6 (Genap)',6,0],
      ['Ujian Sekolah (US)',7,1]].forEach(s => ins.run(...s))
  }

  if (!db.prepare('SELECT id FROM mapel LIMIT 1').get()) {
    const ins = db.prepare('INSERT INTO mapel(nama,kelompok,urutan,is_mulok) VALUES(?,?,?,?)')
    ;[["Al-Qur'an Hadis",'A',1,0],['Akidah Akhlak','A',2,0],['Fikih','A',3,0],['SKI','A',4,0],
      ['Pendidikan Pancasila','A',5,0],['Bahasa Indonesia','A',6,0],['Matematika','A',7,0],
      ['IPAS','A',8,0],['Bahasa Arab','A',9,0],['PJOK','B',10,0],
      ['Seni Budaya dan Prakarya','B',11,0]].forEach(m => ins.run(...m))
  }
}

// ── Helper: get semua nilai siswa ─────────────────────────────────────────
function getAllNilai() {
  const rows = db.prepare('SELECT * FROM nilai').all()
  const s    = db.prepare('SELECT bobot_raport,bobot_ujian FROM sekolah WHERE id=1').get()
  const map  = { _br: s?.bobot_raport ?? 60, _bu: s?.bobot_ujian ?? 40 }
  rows.forEach(r => {
    if (!map[r.siswa_id]) map[r.siswa_id] = []
    map[r.siswa_id].push(r)
  })
  return map
}

// ── IPC ────────────────────────────────────────────────────────────────────
// Helper: pastikan return value bisa di-clone lewat IPC (plain JSON)
function safeReturn(val) {
  try { return JSON.parse(JSON.stringify(val)) } 
  catch { return { ok: false, error: 'Internal error: response not serializable' } }
}

function registerIPC() {
  const crypto = require('crypto')
  const hash = pw => crypto.createHash('sha256').update(pw).digest('hex')

  // Auth
  ipcMain.handle('auth:login', (_, email, password) =>
    db.prepare('SELECT id,name,email,role FROM users WHERE email=? AND password=?').get(email, hash(password)) || null)

  // Sekolah
  ipcMain.handle('sekolah:get', () => db.prepare('SELECT * FROM sekolah WHERE id=1').get())
  ipcMain.handle('sekolah:save', (_, data) => {
    const keys = Object.keys(data).filter(k => k !== 'id')
    db.prepare(`UPDATE sekolah SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=1`).run(...keys.map(k => data[k]))
    return true
  })

  // Semester
  ipcMain.handle('semester:list', () => db.prepare('SELECT * FROM semester_config ORDER BY urutan').all())
  ipcMain.handle('semester:add', (_, d) => db.prepare('INSERT INTO semester_config(label,urutan,is_ujian) VALUES(?,?,?)').run(d.label,d.urutan,d.is_ujian||0).lastInsertRowid)
  ipcMain.handle('semester:update', (_, id, d) => { db.prepare('UPDATE semester_config SET label=?,urutan=?,is_ujian=? WHERE id=?').run(d.label,d.urutan,d.is_ujian||0,id); return true })
  ipcMain.handle('semester:delete', (_, id) => { db.prepare('DELETE FROM nilai WHERE semester_id=?').run(id); db.prepare('DELETE FROM semester_config WHERE id=?').run(id); return true })
  ipcMain.handle('semester:reorder', (_, ids) => {
    const tx = db.transaction(list => list.forEach((id,i) => db.prepare('UPDATE semester_config SET urutan=? WHERE id=?').run(i+1,id)))
    tx(ids); return true
  })

  // Siswa
  ipcMain.handle('siswa:list', (_, q) => {
    const base = 'SELECT s.*, (SELECT COUNT(*) FROM nilai n WHERE n.siswa_id=s.id) jml_nilai FROM siswa s'
    return q
      ? db.prepare(`${base} WHERE s.nama LIKE ? OR s.nisn LIKE ? OR s.nism LIKE ? OR s.peserta_am LIKE ? ORDER BY COALESCE(s.no_urut,99999),s.nama`).all(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`)
      : db.prepare(`${base} ORDER BY COALESCE(s.no_urut,99999),s.nama`).all()
  })
  ipcMain.handle('siswa:get', (_, id) => db.prepare('SELECT * FROM siswa WHERE id=?').get(id))
  ipcMain.handle('siswa:add', (_, d) => db.prepare(
    'INSERT INTO siswa(no_urut,nism,nisn,nama,jk,tempat_lahir,tgl_lahir,ortu,nama_ibu,agama,kewarganegaraan,anak_ke,asal_sekolah,tahun_masuk,kelas,no_hp_ortu,alamat,peserta_am,no_peserta,blanko,no_skl,no_skkb,jenis_kekhususan,foto) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(d.no_urut,d.nism||null,d.nisn||null,d.nama,d.jk,d.tempat_lahir||null,d.tgl_lahir||null,
    d.ortu||null,d.nama_ibu||null,d.agama||'Islam',d.kewarganegaraan||'Indonesia',
    d.anak_ke||null,d.asal_sekolah||null,d.tahun_masuk||null,d.kelas||null,d.no_hp_ortu||null,
    d.alamat||null,d.peserta_am||null,d.no_peserta||null,d.blanko||null,
    d.no_skl||null,d.no_skkb||null,d.jenis_kekhususan||null,d.foto||null
  ).lastInsertRowid)
  ipcMain.handle('siswa:update', (_, id, d) => {
    db.prepare(`UPDATE siswa SET
      no_urut=?,nism=?,nisn=?,nama=?,jk=?,tempat_lahir=?,tgl_lahir=?,
      ortu=?,nama_ibu=?,agama=?,kewarganegaraan=?,anak_ke=?,asal_sekolah=?,
      tahun_masuk=?,kelas=?,no_hp_ortu=?,alamat=?,
      peserta_am=?,no_peserta=?,blanko=?,no_skl=?,no_skkb=?,jenis_kekhususan=?,foto=?
      WHERE id=?`)
      .run(d.no_urut,d.nism||null,d.nisn||null,d.nama,d.jk,d.tempat_lahir||null,d.tgl_lahir||null,
        d.ortu||null,d.nama_ibu||null,d.agama||'Islam',d.kewarganegaraan||'Indonesia',
        d.anak_ke||null,d.asal_sekolah||null,d.tahun_masuk||null,d.kelas||null,d.no_hp_ortu||null,
        d.alamat||null,d.peserta_am||null,d.no_peserta||null,d.blanko||null,
        d.no_skl||null,d.no_skkb||null,d.jenis_kekhususan||null,d.foto||null,id)
    return true
  })
  ipcMain.handle('siswa:delete', (_, id) => { db.prepare('DELETE FROM nilai WHERE siswa_id=?').run(id); db.prepare('DELETE FROM angkatan_siswa WHERE siswa_id=?').run(id); db.prepare('DELETE FROM siswa WHERE id=?').run(id); return true })
  ipcMain.handle('siswa:stats', () => ({ total: db.prepare('SELECT COUNT(*) c FROM siswa').get().c, dengan_nilai: db.prepare('SELECT COUNT(DISTINCT siswa_id) c FROM nilai').get().c }))

  // Mapel
  ipcMain.handle('mapel:list', () => db.prepare('SELECT m.*, (SELECT COUNT(*) FROM nilai n WHERE n.mapel_id=m.id) jml_nilai FROM mapel m ORDER BY COALESCE(m.urutan,999),m.nama').all())
  ipcMain.handle('mapel:add', (_, d) => db.prepare('INSERT INTO mapel(nama,kelompok,urutan,is_mulok) VALUES(?,?,?,?)').run(d.nama,d.kelompok,d.urutan,d.is_mulok).lastInsertRowid)
  ipcMain.handle('mapel:update', (_, id, d) => { db.prepare('UPDATE mapel SET nama=?,kelompok=?,urutan=?,is_mulok=? WHERE id=?').run(d.nama,d.kelompok,d.urutan,d.is_mulok,id); return true })
  ipcMain.handle('mapel:delete', (_, id) => { db.prepare('DELETE FROM nilai WHERE mapel_id=?').run(id); db.prepare('DELETE FROM mapel WHERE id=?').run(id); return true })
  ipcMain.handle('mapel:reorder', (_, ids) => { const tx = db.transaction(list => list.forEach((id,i) => db.prepare('UPDATE mapel SET urutan=? WHERE id=?').run(i+1,id))); tx(ids); return true })
  ipcMain.handle('mapel:seed_default', () => {
    const existing = new Set(db.prepare('SELECT lower(trim(nama)) n FROM mapel').all().map(r => r.n))
    const defaults = [["Al-Qur'an Hadis",'A',1,0],['Akidah Akhlak','A',2,0],['Fikih','A',3,0],['SKI','A',4,0],['Pendidikan Pancasila','A',5,0],['Bahasa Indonesia','A',6,0],['Matematika','A',7,0],['IPAS','A',8,0],['Bahasa Arab','A',9,0],['PJOK','B',10,0],['Seni Budaya dan Prakarya','B',11,0]]
    const ins = db.prepare('INSERT INTO mapel(nama,kelompok,urutan,is_mulok) VALUES(?,?,?,?)')
    let added = 0
    defaults.forEach(([nama,...r]) => { if (!existing.has(nama.toLowerCase().trim())) { ins.run(nama,...r); added++ } })
    return added
  })

  // Nilai
  ipcMain.handle('nilai:get_siswa', (_, id) => db.prepare('SELECT * FROM nilai WHERE siswa_id=?').all(id))
  ipcMain.handle('nilai:save_batch', (_, rows) => {
    const ins = db.prepare('INSERT INTO nilai(siswa_id,mapel_id,semester_id,nilai_p,nilai_k,nilai_ujian) VALUES(?,?,?,?,?,?) ON CONFLICT(siswa_id,mapel_id,semester_id) DO UPDATE SET nilai_p=excluded.nilai_p,nilai_k=excluded.nilai_k,nilai_ujian=excluded.nilai_ujian')
    const tx = db.transaction(list => list.forEach(r => ins.run(r.siswa_id,r.mapel_id,r.semester_id,r.nilai_p,r.nilai_k,r.nilai_ujian)))
    tx(rows); return true
  })
  ipcMain.handle('nilai:rekap', () => {
    const siswa      = db.prepare('SELECT id,no_urut,nama,nisn FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
    const mapels     = db.prepare('SELECT id FROM mapel').all()
    const s          = db.prepare('SELECT bobot_raport,bobot_ujian FROM sekolah WHERE id=1').get()
    const semList    = db.prepare('SELECT * FROM semester_config ORDER BY urutan').all()
    const ujianSem   = semList.find(s => s.is_ujian)
    const raportSems = semList.filter(s => !s.is_ujian)
    if (!s || s.bobot_raport == null || s.bobot_ujian == null || (s.bobot_raport + s.bobot_ujian) === 0) {
      return { error: 'Bobot nilai belum dikonfigurasi. Silakan atur bobot di menu Data Sekolah.' }
    }
    const br = s.bobot_raport, bu = s.bobot_ujian, tb = br + bu
    const mapelIds   = mapels.map(m => m.id)
    const totalMapel = mapelIds.length

    // Satu query ambil SEMUA nilai sekaligus
    const allNilai = db.prepare('SELECT siswa_id,mapel_id,semester_id,nilai_p,nilai_ujian FROM nilai').all()
    // Index: nilaiIdx[siswa_id][mapel_id][semester_id]
    const nilaiIdx = {}
    for (const n of allNilai) {
      if (!nilaiIdx[n.siswa_id]) nilaiIdx[n.siswa_id] = {}
      if (!nilaiIdx[n.siswa_id][n.mapel_id]) nilaiIdx[n.siswa_id][n.mapel_id] = {}
      nilaiIdx[n.siswa_id][n.mapel_id][n.semester_id] = n
    }
    // Hitung jumlah nilai per siswa dari allNilai
    const jmlMap = {}
    for (const n of allNilai) { jmlMap[n.siswa_id] = (jmlMap[n.siswa_id] || 0) + 1 }

    return siswa.map(sw => {
      const swNilai = nilaiIdx[sw.id] || {}

      // Cek kelengkapan per semester (batch)
      const detail_kelengkapan = semList.map(sem => {
        let kurang = 0
        for (const m of mapels) {
          const n = (swNilai[m.id] || {})[sem.id]
          if (sem.is_ujian) { if (!n || n.nilai_ujian == null) kurang++ }
          else              { if (!n || n.nilai_p == null) kurang++ }
        }
        return { semester_id: sem.id, label: sem.label, lengkap: kurang === 0, kurang }
      })
      const semua_lengkap = detail_kelengkapan.every(d => d.lengkap)

      // Hitung nilai ijazah (batch)
      let sum = 0, cnt = 0
      for (const mid of mapelIds) {
        const mNilai = swNilai[mid] || {}
        const raps = raportSems.map(sem => {
          const n = mNilai[sem.id]
          return n && n.nilai_p != null ? parseFloat(n.nilai_p) : null
        })
        if (raps.some(v => v === null)) continue
        const raport = raps.reduce((a,b)=>a+b,0)/raps.length
        const usN = ujianSem ? mNilai[ujianSem.id] : null
        if (!usN || usN.nilai_ujian == null) continue
        sum += (raport*br + parseFloat(usN.nilai_ujian)*bu)/tb
        cnt++
      }
      const nij = semua_lengkap && cnt === totalMapel && totalMapel > 0 ? Math.round(sum/cnt*100)/100 : null
      return { ...sw, nilai_ijazah: nij, jml_nilai: jmlMap[sw.id] || 0, lengkap: semua_lengkap, detail_kelengkapan }
    })
  })

  // ── Upload Kop Image ─────────────────────────────────────────────────────
  ipcMain.handle('sekolah:upload_kop', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Pilih Gambar Kop Surat',
        filters: [{ name: 'Gambar', extensions: ['png','jpg','jpeg','webp'] }],
        properties: ['openFile']
      })
      if (result.canceled || !result.filePaths.length) return { ok: false }
      const src  = result.filePaths[0]
      const ext  = path.extname(src)
      const dest = path.join(userDataPath, `kop_custom${ext}`)
      fs.copyFileSync(src, dest)
      db.prepare("UPDATE sekolah SET kop_image=? WHERE id=1").run(dest)
      return { ok: true, path: dest }
    } catch(e) { return { ok: false, error: String(e instanceof Error ? e.message : e) } }
  })

  ipcMain.handle('sekolah:hapus_kop', () => {
    try {
      const row = db.prepare("SELECT kop_image FROM sekolah WHERE id=1").get()
      if (row?.kop_image) { try { fs.unlinkSync(row.kop_image) } catch {} }
      db.prepare("UPDATE sekolah SET kop_image=NULL WHERE id=1").run()
      return { ok: true }
    } catch(e) { return { ok: false, error: String(e instanceof Error ? e.message : e) } }
  })

  // ── Ranking Siswa ────────────────────────────────────────────────────────
  ipcMain.handle('nilai:ranking', (_, angkatan_id) => {
    const siswa      = angkatan_id
      ? db.prepare('SELECT s.id,s.no_urut,s.nama,s.nisn,s.kelas FROM angkatan_siswa a JOIN siswa s ON s.id=a.siswa_id WHERE a.angkatan_id=? ORDER BY COALESCE(s.no_urut,99999),s.nama').all(angkatan_id)
      : db.prepare('SELECT id,no_urut,nama,nisn,kelas FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
    const mapels     = db.prepare('SELECT id,nama FROM mapel ORDER BY COALESCE(urutan,999),nama').all()
    const s          = db.prepare('SELECT bobot_raport,bobot_ujian FROM sekolah WHERE id=1').get()
    const semList    = db.prepare('SELECT * FROM semester_config ORDER BY urutan').all()
    const ujianSem   = semList.find(s => s.is_ujian)
    const raportSems = semList.filter(s => !s.is_ujian)
    if (!s || !s.bobot_raport) return []
    const br = s.bobot_raport, bu = s.bobot_ujian, tb = br + bu
    const mapelIds = mapels.map(m => m.id)

    const allNilai = db.prepare('SELECT siswa_id,mapel_id,semester_id,nilai_p,nilai_ujian FROM nilai').all()
    const nilaiIdx = {}
    for (const n of allNilai) {
      if (!nilaiIdx[n.siswa_id]) nilaiIdx[n.siswa_id] = {}
      if (!nilaiIdx[n.siswa_id][n.mapel_id]) nilaiIdx[n.siswa_id][n.mapel_id] = {}
      nilaiIdx[n.siswa_id][n.mapel_id][n.semester_id] = n
    }

    const rows = siswa.map(sw => {
      const swNilai = nilaiIdx[sw.id] || {}
      let sumRap = 0, sumUji = 0, sumNij = 0, cntNij = 0
      const perMapel = mapels.map(m => {
        const mNilai = swNilai[m.id] || {}
        const raps   = raportSems.map(sem => {
          const n = mNilai[sem.id]
          return n && n.nilai_p != null ? parseFloat(n.nilai_p) : null
        })
        const rataR = raps.every(v => v !== null) && raps.length > 0
          ? raps.reduce((a,b)=>a+b,0)/raps.length : null
        const usN   = ujianSem ? mNilai[ujianSem.id] : null
        const ujVal = usN?.nilai_ujian != null ? parseFloat(usN.nilai_ujian) : null
        const nij   = rataR != null && ujVal != null
          ? Math.round((rataR*br + ujVal*bu)/tb*100)/100 : null
        if (nij != null) { sumRap += rataR; sumUji += ujVal; sumNij += nij; cntNij++ }
        return { mapel_id: m.id, nama: m.nama, rata_raport: rataR, nilai_ujian: ujVal, nilai_ijazah: nij }
      })
      const cnt = cntNij
      const totalMapel = mapelIds.length
      return {
        id:          sw.id,
        nama:        sw.nama || '',
        nisn:        sw.nisn || '',
        kelas:       sw.kelas || '',
        rata_raport: cnt > 0 ? Math.round(sumRap/cnt*100)/100 : null,
        nilai_ujian: cnt > 0 ? Math.round(sumUji/cnt*100)/100 : null,
        // Nilai ijazah ditampilkan meski tidak semua mapel lengkap (pakai yg ada)
        nilai_ijazah: cnt > 0 ? Math.round(sumNij/cnt*100)/100 : null,
        lengkap:     cnt === totalMapel && totalMapel > 0,
        mapel_isi:   cnt,
        mapel_total: totalMapel,
        per_mapel:   perMapel,
      }
    })
    // Sort by nilai_ijazah DESC, null di bawah
    rows.sort((a,b) => {
      if (a.nilai_ijazah == null && b.nilai_ijazah == null) return 0
      if (a.nilai_ijazah == null) return 1
      if (b.nilai_ijazah == null) return -1
      return b.nilai_ijazah - a.nilai_ijazah
    })
    // Tambah ranking
    let rank = 1
    rows.forEach((r, i) => {
      if (r.nilai_ijazah == null) { r.ranking = null; return }
      if (i > 0 && rows[i-1].nilai_ijazah === r.nilai_ijazah) r.ranking = rows[i-1].ranking
      else r.ranking = rank
      rank++
    })
    return rows
  })

  // ── Export Excel Ranking ──────────────────────────────────────────────────
  ipcMain.handle('export:excel_ranking', async () => {
    try {
      const { Workbook } = require('./excel-builder')
      const siswa      = db.prepare('SELECT id,no_urut,nama,nisn,kelas FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
      const mapels     = db.prepare('SELECT id,nama FROM mapel ORDER BY COALESCE(urutan,999),nama').all()
      const s          = db.prepare('SELECT bobot_raport,bobot_ujian FROM sekolah WHERE id=1').get()
      const semList    = db.prepare('SELECT * FROM semester_config ORDER BY urutan').all()
      const ujianSem   = semList.find(s => s.is_ujian)
      const raportSems = semList.filter(s => !s.is_ujian)
      const br = s?.bobot_raport ?? 60, bu = s?.bobot_ujian ?? 40, tb = br+bu
      const allNilai   = db.prepare('SELECT siswa_id,mapel_id,semester_id,nilai_p,nilai_ujian FROM nilai').all()
      const nilaiIdx   = {}
      for (const n of allNilai) {
        if (!nilaiIdx[n.siswa_id]) nilaiIdx[n.siswa_id] = {}
        if (!nilaiIdx[n.siswa_id][n.mapel_id]) nilaiIdx[n.siswa_id][n.mapel_id] = {}
        nilaiIdx[n.siswa_id][n.mapel_id][n.semester_id] = n
      }
      const mapelIds = mapels.map(m => m.id)

      const rows = siswa.map(sw => {
        const swNilai = nilaiIdx[sw.id] || {}
        let sumRap=0, sumUji=0, sumNij=0, cntNij=0
        mapels.forEach(m => {
          const mNilai = swNilai[m.id] || {}
          const raps   = raportSems.map(sem => { const n=mNilai[sem.id]; return n&&n.nilai_p!=null?parseFloat(n.nilai_p):null })
          const rataR  = raps.every(v=>v!==null)&&raps.length>0 ? raps.reduce((a,b)=>a+b,0)/raps.length : null
          const usN    = ujianSem ? mNilai[ujianSem.id] : null
          const ujVal  = usN?.nilai_ujian!=null ? parseFloat(usN.nilai_ujian) : null
          const nij    = rataR!=null&&ujVal!=null ? (rataR*br+ujVal*bu)/tb : null
          if (nij!=null){sumRap+=rataR;sumUji+=ujVal;sumNij+=nij;cntNij++}
        })
        const cnt = cntNij
        return {
          nama: sw.nama||'', nisn: sw.nisn||'', kelas: sw.kelas||'',
          rata_raport:  cnt>0 ? Math.round(sumRap/cnt*100)/100 : null,
          nilai_ujian:  cnt>0 ? Math.round(sumUji/cnt*100)/100 : null,
          nilai_ijazah: cnt>0 && cnt===mapelIds.length ? Math.round(sumNij/cnt*100)/100 : null,
        }
      })
      rows.sort((a,b)=>{ if(a.nilai_ijazah==null&&b.nilai_ijazah==null)return 0; if(a.nilai_ijazah==null)return 1; if(b.nilai_ijazah==null)return -1; return b.nilai_ijazah-a.nilai_ijazah })
      let rank=1; rows.forEach((r,i)=>{ if(r.nilai_ijazah==null){r.ranking='-';return}; if(i>0&&rows[i-1].nilai_ijazah===r.nilai_ijazah)r.ranking=rows[i-1].ranking; else r.ranking=rank; rank++ })

      const wb = new Workbook()
      const ws = wb.addSheet('Ranking')
      ws.setColWidths([8, 34, 16, 14, 15, 15, 16])
      ws.addRow(['Ranking','Nama Siswa','NISN','Kelas',`Rata Raport`,`Nilai Ujian`,`Nilai Ijazah`], 'header', 28)
      rows.forEach((r,i) => {
        ws.addRow(
          [r.ranking, r.nama, r.nisn, r.kelas||'-',
           r.rata_raport??'-', r.nilai_ujian??'-', r.nilai_ijazah??'-'],
          ['data','data_l','data','data','data','data','data'], 16, i
        )
      })
      const filePath = path.join(outputPath, `Ranking_${Date.now()}.xlsx`)
      await wb.writeFile(filePath)
      shell.openPath(filePath)
      return safeReturn({ ok: true })
    } catch(e) { return safeReturn({ ok:false, error: String(e instanceof Error?e.message:e) }) }
  })

  // ── Export Excel Rekap Nilai — main process ambil langsung dari DB ────────
  ipcMain.handle('export:excel_rekap', async () => {
    try {
      const { Workbook } = require('./excel-builder')

      // Ambil data langsung dari DB (tidak ada IPC serialization issue)
      const siswa    = db.prepare('SELECT id,no_urut,nama,nisn FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
      const mapels   = db.prepare('SELECT id FROM mapel').all()
      const seo      = db.prepare('SELECT bobot_raport,bobot_ujian FROM sekolah WHERE id=1').get()
      const semList  = db.prepare('SELECT * FROM semester_config ORDER BY urutan').all()
      const ujianSem = semList.find(s => s.is_ujian)
      const raportSems = semList.filter(s => !s.is_ujian)
      const br = seo?.bobot_raport ?? 60, bu = seo?.bobot_ujian ?? 40, tb = br + bu

      const rows = siswa.map((sw, i) => {
        let sum = 0, cnt = 0, allOk = true
        for (const m of mapels) {
          const raps = raportSems.map(sem => {
            const n = db.prepare('SELECT nilai_p FROM nilai WHERE siswa_id=? AND mapel_id=? AND semester_id=?').get(sw.id, m.id, sem.id)
            return n && n.nilai_p != null ? parseFloat(n.nilai_p) : null
          })
          if (raps.some(v => v === null)) { allOk = false; continue }
          const raport = raps.reduce((a,b)=>a+b,0)/raps.length
          const us = ujianSem ? db.prepare('SELECT nilai_ujian FROM nilai WHERE siswa_id=? AND mapel_id=? AND semester_id=?').get(sw.id, m.id, ujianSem.id) : null
          if (!us || us.nilai_ujian == null) { allOk = false; continue }
          sum += (raport*br + parseFloat(us.nilai_ujian)*bu)/tb
          cnt++
        }
        const nij = allOk && cnt === mapels.length && cnt > 0 ? parseFloat((sum/cnt).toFixed(2)) : null
        const jml = db.prepare('SELECT COUNT(*) c FROM nilai WHERE siswa_id=?').get(sw.id).c
        return { idx: i+1, nama: sw.nama||'', nisn: sw.nisn||'-', jml, nij, lengkap: allOk && cnt===mapels.length }
      })

      const wb = new Workbook()
      const ws = wb.addSheet('Rekap Nilai')
      ws.setColWidths([6, 32, 16, 12, 14, 16])
      ws.addRow(['No', 'Nama Siswa', 'NISN', 'Jumlah Nilai', 'Nilai Ijazah', 'Status'], 'header', 26)
      rows.forEach((r, i) => {
        ws.addRow(
          [r.idx, r.nama, r.nisn, r.jml, r.nij ?? '-', r.lengkap ? 'Lengkap' : 'Belum Lengkap'],
          ['data_l','data_l','data','data','data','data'],
          16, i
        )
      })

      const fname = `Rekap_Nilai_${Date.now()}.xlsx`
      const filePath = path.join(outputPath, fname)
      await wb.writeFile(filePath)
      shell.openPath(filePath)
      return safeReturn({ ok: true })
    } catch (e) { return safeReturn({ ok: false, message: String(e instanceof Error ? e.message : e) }) }
  })

  ipcMain.handle('nilai:rekap_siswa', (_, siswaId) => {
    try {
      const sems    = db.prepare('SELECT * FROM semester_config ORDER BY urutan').all()
      const mapels  = db.prepare('SELECT * FROM mapel ORDER BY COALESCE(urutan,999),nama').all()
      const nils    = db.prepare('SELECT * FROM nilai WHERE siswa_id=?').all(siswaId)
      const ujianSem   = sems.find(s => s.is_ujian)
      const raportSems = sems.filter(s => !s.is_ujian)
      const seo    = db.prepare('SELECT bobot_raport,bobot_ujian FROM sekolah WHERE id=1').get()
      const br = seo?.bobot_raport ?? 60, bu = seo?.bobot_ujian ?? 40, tb = br + bu
      return mapels.map(m => {
        const rapVals = raportSems.map(s => nils.find(n => n.mapel_id===m.id && n.semester_id===s.id)?.nilai_p).filter(v => v!=null)
        const rataRap = rapVals.length === raportSems.length ? rapVals.reduce((a,b)=>a+b,0)/rapVals.length : null
        const ujN = ujianSem ? nils.find(n => n.mapel_id===m.id && n.semester_id===ujianSem.id) : null
        const ujVal = ujN?.nilai_ujian ?? null
        const nij = rataRap!=null && ujVal!=null ? (rataRap*br + ujVal*bu)/tb : null
        return { mapel_id: m.id, nama: m.nama, rataRaport: rataRap, nilaiUS: ujVal, nilaiIjazah: nij }
      })
    } catch(e) { return [] }
  })

  ipcMain.handle('nilai:rekap_angkatan', (_, angkatanId) => {
    try {
      const siswaList = db.prepare('SELECT s.* FROM angkatan_siswa a JOIN siswa s ON s.id=a.siswa_id WHERE a.angkatan_id=?').all(angkatanId)
      return siswaList.map(sw => ({ siswa_id: sw.id, nama: sw.nama }))
    } catch(e) { return [] }
  })

  // Angkatan
  ipcMain.handle('angkatan:list', () => db.prepare('SELECT a.*, (SELECT COUNT(*) FROM angkatan_siswa x WHERE x.angkatan_id=a.id) jml_siswa FROM angkatan a ORDER BY a.id DESC').all())
  ipcMain.handle('angkatan:add', (_, d) => db.prepare('INSERT INTO angkatan(nama,tahun_lulus,keterangan,is_aktif) VALUES(?,?,?,?)').run(d.nama,d.tahun_lulus,d.keterangan,d.is_aktif).lastInsertRowid)
  ipcMain.handle('angkatan:update', (_, id, d) => { db.prepare('UPDATE angkatan SET nama=?,tahun_lulus=?,keterangan=?,is_aktif=? WHERE id=?').run(d.nama,d.tahun_lulus,d.keterangan,d.is_aktif,id); return true })
  ipcMain.handle('angkatan:delete', (_, id) => { db.prepare('DELETE FROM angkatan_siswa WHERE angkatan_id=?').run(id); db.prepare('DELETE FROM angkatan WHERE id=?').run(id); return true })
  ipcMain.handle('angkatan:siswa', (_, id) => db.prepare('SELECT s.*, (SELECT COUNT(*) FROM nilai n WHERE n.siswa_id=s.id) jml_nilai FROM angkatan_siswa a JOIN siswa s ON s.id=a.siswa_id WHERE a.angkatan_id=? ORDER BY COALESCE(s.no_urut,99999),s.nama').all(id))

  // ── KELAS ─────────────────────────────────────────────────────────────
  ipcMain.handle('kelas:list', () => db.prepare('SELECT * FROM kelas ORDER BY tingkat, nama').all())
  ipcMain.handle('kelas:get', (_, id) => db.prepare('SELECT * FROM kelas WHERE id=?').get(id))
  ipcMain.handle('kelas:add', (_, d) => {
    const r = db.prepare('INSERT INTO kelas(nama,tingkat,tahun_ajaran,wali_kelas,angkatan_id,kapasitas) VALUES(?,?,?,?,?,?)').run(d.nama,d.tingkat||'',d.tahun_ajaran||'',d.wali_kelas||'',d.angkatan_id||null,d.kapasitas||32)
    return { ok: true, id: r.lastInsertRowid }
  })
  ipcMain.handle('kelas:update', (_, id, d) => {
    db.prepare('UPDATE kelas SET nama=?,tingkat=?,tahun_ajaran=?,wali_kelas=?,angkatan_id=?,kapasitas=? WHERE id=?').run(d.nama,d.tingkat||'',d.tahun_ajaran||'',d.wali_kelas||'',d.angkatan_id||null,d.kapasitas||32,id)
    return { ok: true }
  })
  ipcMain.handle('kelas:delete', (_, id) => {
    db.prepare('DELETE FROM denah_tempat_duduk WHERE kelas_id=?').run(id)
    db.prepare('DELETE FROM jadwal_pelajaran WHERE kelas_id=?').run(id)
    db.prepare('DELETE FROM jurnal_kelas WHERE kelas_id=?').run(id)
    db.prepare('DELETE FROM absensi_harian WHERE kelas_id=?').run(id)
    db.prepare('DELETE FROM kelas WHERE id=?').run(id)
    return { ok: true }
  })
  ipcMain.handle('kelas:siswa', (_, kelas_id) => {
    const k = db.prepare('SELECT * FROM kelas WHERE id=?').get(kelas_id)
    if (!k) return []
    if (k.angkatan_id) {
      return db.prepare('SELECT s.* FROM angkatan_siswa a JOIN siswa s ON s.id=a.siswa_id WHERE a.angkatan_id=? ORDER BY COALESCE(s.no_urut,99999),s.nama').all(k.angkatan_id)
    }
    return db.prepare('SELECT * FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
  })

  // ── DENAH TEMPAT DUDUK ────────────────────────────────────────────────
  ipcMain.handle('denah:get', (_, kelas_id) => db.prepare('SELECT d.*,s.nama as nama_siswa,s.jk FROM denah_tempat_duduk d LEFT JOIN siswa s ON s.id=d.siswa_id WHERE d.kelas_id=? ORDER BY d.baris,d.kolom').all(kelas_id))
  ipcMain.handle('denah:save', (_, kelas_id, seats) => {
    const del = db.prepare('DELETE FROM denah_tempat_duduk WHERE kelas_id=?')
    const ins = db.prepare('INSERT INTO denah_tempat_duduk(kelas_id,baris,kolom,siswa_id,label) VALUES(?,?,?,?,?)')
    const tx = db.transaction(() => {
      del.run(kelas_id)
      for (const s of seats) ins.run(kelas_id, s.baris, s.kolom, s.siswa_id||null, s.label||null)
    })
    tx()
    return { ok: true }
  })
  ipcMain.handle('denah:auto', (_, kelas_id) => {
    const k = db.prepare('SELECT * FROM kelas WHERE id=?').get(kelas_id)
    if (!k) return { ok: false }
    let siswa = []
    if (k.angkatan_id) {
      siswa = db.prepare('SELECT s.* FROM angkatan_siswa a JOIN siswa s ON s.id=a.siswa_id WHERE a.angkatan_id=? ORDER BY s.nama').all(k.angkatan_id)
    } else {
      siswa = db.prepare('SELECT * FROM siswa ORDER BY nama').all()
    }
    const kap = k.kapasitas || 32
    const cols = 6
    const rows = Math.ceil(kap / cols)
    const del = db.prepare('DELETE FROM denah_tempat_duduk WHERE kelas_id=?')
    const ins = db.prepare('INSERT INTO denah_tempat_duduk(kelas_id,baris,kolom,siswa_id) VALUES(?,?,?,?)')
    const tx = db.transaction(() => {
      del.run(kelas_id)
      let i = 0
      for (let r = 1; r <= rows; r++) {
        for (let c = 1; c <= cols; c++) {
          if ((r-1)*cols + c > kap) break
          ins.run(kelas_id, r, c, siswa[i]?.id || null)
          i++
        }
      }
    })
    tx()
    return { ok: true }
  })

  // ── JADWAL PELAJARAN ─────────────────────────────────────────────────
  ipcMain.handle('jadwal:get', (_, kelas_id) => db.prepare('SELECT * FROM jadwal_pelajaran WHERE kelas_id=? ORDER BY CASE hari WHEN "Senin" THEN 1 WHEN "Selasa" THEN 2 WHEN "Rabu" THEN 3 WHEN "Kamis" THEN 4 WHEN "Jumat" THEN 5 WHEN "Sabtu" THEN 6 ELSE 7 END, jam_ke').all(kelas_id))
  ipcMain.handle('jadwal:save', (_, kelas_id, rows) => {
    const del = db.prepare('DELETE FROM jadwal_pelajaran WHERE kelas_id=?')
    const ins = db.prepare('INSERT INTO jadwal_pelajaran(kelas_id,hari,jam_ke,jam_mulai,jam_selesai,mapel_id,nama_mapel,guru,ruangan) VALUES(?,?,?,?,?,?,?,?,?)')
    const tx = db.transaction(() => {
      del.run(kelas_id)
      for (const r of rows) ins.run(kelas_id,r.hari,r.jam_ke,r.jam_mulai||'',r.jam_selesai||'',r.mapel_id||null,r.nama_mapel||'',r.guru||'',r.ruangan||'')
    })
    tx()
    return { ok: true }
  })

  // ── JURNAL KELAS ──────────────────────────────────────────────────────
  ipcMain.handle('jurnal:list', (_, kelas_id, bulan) => {
    if (bulan) return db.prepare("SELECT * FROM jurnal_kelas WHERE kelas_id=? AND strftime('%Y-%m',tanggal)=? ORDER BY tanggal,jam_ke").all(kelas_id, bulan)
    return db.prepare('SELECT * FROM jurnal_kelas WHERE kelas_id=? ORDER BY tanggal DESC,jam_ke').all(kelas_id)
  })
  ipcMain.handle('jurnal:add', (_, d) => {
    const r = db.prepare('INSERT INTO jurnal_kelas(kelas_id,tanggal,jam_ke,mapel_id,nama_mapel,guru,materi,catatan) VALUES(?,?,?,?,?,?,?,?)').run(d.kelas_id,d.tanggal,d.jam_ke||null,d.mapel_id||null,d.nama_mapel||'',d.guru||'',d.materi||'',d.catatan||'')
    return { ok: true, id: r.lastInsertRowid }
  })
  ipcMain.handle('jurnal:update', (_, id, d) => {
    db.prepare('UPDATE jurnal_kelas SET tanggal=?,jam_ke=?,mapel_id=?,nama_mapel=?,guru=?,materi=?,catatan=? WHERE id=?').run(d.tanggal,d.jam_ke||null,d.mapel_id||null,d.nama_mapel||'',d.guru||'',d.materi||'',d.catatan||'',id)
    return { ok: true }
  })
  ipcMain.handle('jurnal:delete', (_, id) => { db.prepare('DELETE FROM jurnal_kelas WHERE id=?').run(id); return { ok: true } })

  // ── ABSENSI HARIAN ────────────────────────────────────────────────────
  ipcMain.handle('absensi:get', (_, kelas_id, tanggal) => {
    const siswa = []
    const k = db.prepare('SELECT * FROM kelas WHERE id=?').get(kelas_id)
    if (!k) return []
    let sw = []
    if (k.angkatan_id) {
      sw = db.prepare('SELECT s.* FROM angkatan_siswa a JOIN siswa s ON s.id=a.siswa_id WHERE a.angkatan_id=? ORDER BY COALESCE(s.no_urut,99999),s.nama').all(k.angkatan_id)
    } else {
      sw = db.prepare('SELECT * FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
    }
    for (const s of sw) {
      const abs = db.prepare('SELECT * FROM absensi_harian WHERE kelas_id=? AND siswa_id=? AND tanggal=?').get(kelas_id, s.id, tanggal)
      siswa.push({ ...s, status: abs?.status || 'H', keterangan: abs?.keterangan || '' })
    }
    return siswa
  })
  ipcMain.handle('absensi:save', (_, kelas_id, tanggal, rows) => {
    const upsert = db.prepare('INSERT INTO absensi_harian(kelas_id,siswa_id,tanggal,status,keterangan) VALUES(?,?,?,?,?) ON CONFLICT(kelas_id,siswa_id,tanggal) DO UPDATE SET status=excluded.status,keterangan=excluded.keterangan')
    const tx = db.transaction(() => { for (const r of rows) upsert.run(kelas_id,r.siswa_id,tanggal,r.status,r.keterangan||'') })
    tx()
    return { ok: true }
  })
  // ── RAPORT ───────────────────────────────────────────────────────────────
  // Periode
  ipcMain.handle('raport:periode_list', () =>
    db.prepare('SELECT r.*,a.nama as nama_angkatan FROM raport_periode r LEFT JOIN angkatan a ON a.id=r.angkatan_id ORDER BY r.tahun_ajaran DESC,r.semester').all()
  )
  ipcMain.handle('raport:periode_add', (_, d) => {
    const r = db.prepare('INSERT INTO raport_periode(label,tahun_ajaran,semester,angkatan_id,is_aktif,tgl_mulai,tgl_selesai,bobot_uh,bobot_uts,bobot_pas,bobot_hadir,jumlah_hari_efektif) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(d.label||'',d.tahun_ajaran||'',d.semester||'Ganjil',d.angkatan_id||null,d.is_aktif?1:0,d.tgl_mulai||'',d.tgl_selesai||'',d.bobot_uh??40,d.bobot_uts??25,d.bobot_pas??30,d.bobot_hadir??5,d.jumlah_hari_efektif||0)
    return { ok:true, id:r.lastInsertRowid }
  })
  ipcMain.handle('raport:periode_update', (_, id, d) => {
    db.prepare('UPDATE raport_periode SET label=?,tahun_ajaran=?,semester=?,angkatan_id=?,is_aktif=?,tgl_mulai=?,tgl_selesai=?,bobot_uh=?,bobot_uts=?,bobot_pas=?,bobot_hadir=?,jumlah_hari_efektif=? WHERE id=?').run(d.label||'',d.tahun_ajaran||'',d.semester||'Ganjil',d.angkatan_id||null,d.is_aktif?1:0,d.tgl_mulai||'',d.tgl_selesai||'',d.bobot_uh??40,d.bobot_uts??25,d.bobot_pas??30,d.bobot_hadir??5,d.jumlah_hari_efektif||0,id)
    return { ok:true }
  })
  ipcMain.handle('raport:periode_delete', (_, id) => {
    db.prepare('DELETE FROM raport_nilai WHERE periode_id=?').run(id)
    db.prepare('DELETE FROM raport_siswa WHERE periode_id=?').run(id)
    db.prepare('DELETE FROM raport_mapel WHERE periode_id=?').run(id)
    db.prepare('DELETE FROM raport_periode WHERE id=?').run(id)
    return { ok:true }
  })

  // Mapel raport
  ipcMain.handle('raport:mapel_list', (_, periode_id) =>
    db.prepare('SELECT * FROM raport_mapel WHERE periode_id=? ORDER BY COALESCE(urutan,99),nama').all(periode_id)
  )
  ipcMain.handle('raport:mapel_save', (_, d) => {
    if (d.id) {
      db.prepare('UPDATE raport_mapel SET nama=?,kelompok=?,urutan=?,guru=?,kkm=?,jumlah_bab=? WHERE id=?').run(d.nama||'',d.kelompok||'A',d.urutan||99,d.guru||'',d.kkm||75,d.jumlah_bab||3,d.id)
    } else {
      db.prepare('INSERT INTO raport_mapel(periode_id,nama,kelompok,urutan,guru,kkm,jumlah_bab) VALUES(?,?,?,?,?,?,?)').run(d.periode_id,d.nama||'',d.kelompok||'A',d.urutan||99,d.guru||'',d.kkm||75,d.jumlah_bab||3)
    }
    return { ok:true }
  })
  ipcMain.handle('raport:mapel_delete', (_, id) => {
    db.prepare('DELETE FROM raport_nilai WHERE mapel_id=?').run(id)
    db.prepare('DELETE FROM raport_mapel WHERE id=?').run(id)
    return { ok:true }
  })

  // Siswa raport (dari angkatan terhubung)
  ipcMain.handle('raport:siswa_list', (_, periode_id) => {
    const p = db.prepare('SELECT * FROM raport_periode WHERE id=?').get(periode_id)
    if (!p) return []
    let siswa = []
    if (p.angkatan_id) {
      siswa = db.prepare('SELECT s.* FROM angkatan_siswa a JOIN siswa s ON s.id=a.siswa_id WHERE a.angkatan_id=? ORDER BY COALESCE(s.no_urut,99999),s.nama').all(p.angkatan_id)
    } else {
      siswa = db.prepare('SELECT * FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
    }
    return siswa.map((s, i) => {
      const rs = db.prepare('SELECT * FROM raport_siswa WHERE periode_id=? AND siswa_id=?').get(periode_id, s.id)
      return { ...s, rs_id: rs?.id||null, kelas: rs?.kelas||s.kelas||'', no_absen: rs?.no_absen||(i+1), hadir: rs?.hadir||0, sakit: rs?.sakit||0, izin: rs?.izin||0, alpha: rs?.alpha||0, catatan_wali: rs?.catatan_wali||'' }
    })
  })
  ipcMain.handle('raport:siswa_save', (_, periode_id, siswa_id, d) => {
    const exists = db.prepare('SELECT id FROM raport_siswa WHERE periode_id=? AND siswa_id=?').get(periode_id, siswa_id)
    if (exists) {
      db.prepare('UPDATE raport_siswa SET kelas=?,no_absen=?,hadir=?,sakit=?,izin=?,alpha=?,catatan_wali=? WHERE id=?').run(d.kelas||'',d.no_absen||0,d.hadir||0,d.sakit||0,d.izin||0,d.alpha||0,d.catatan_wali||'',exists.id)
    } else {
      db.prepare('INSERT INTO raport_siswa(periode_id,siswa_id,kelas,no_absen,hadir,sakit,izin,alpha,catatan_wali) VALUES(?,?,?,?,?,?,?,?,?)').run(periode_id,siswa_id,d.kelas||'',d.no_absen||0,d.hadir||0,d.sakit||0,d.izin||0,d.alpha||0,d.catatan_wali||'')
    }
    return { ok:true }
  })

  // Nilai raport
  ipcMain.handle('raport:nilai_get', (_, periode_id, siswa_id) =>
    db.prepare('SELECT * FROM raport_nilai WHERE periode_id=? AND siswa_id=?').all(periode_id, siswa_id)
  )
  ipcMain.handle('raport:nilai_save', (_, periode_id, siswa_id, mapel_id, d) => {
    const p = db.prepare('SELECT * FROM raport_periode WHERE id=?').get(periode_id)
    if (!p) return { ok:false }
    // Hitung nilai akhir
    const uhs = [d.uh1,d.uh2,d.uh3,d.uh4,d.uh5,d.uh6].filter(v => v !== null && v !== undefined && v !== '')
    const avg_uh = uhs.length ? uhs.reduce((a,b) => a + parseFloat(b), 0) / uhs.length : null
    const uts = d.uts !== '' && d.uts !== null && d.uts !== undefined ? parseFloat(d.uts) : null
    const pas = d.pas !== '' && d.pas !== null && d.pas !== undefined ? parseFloat(d.pas) : null
    // Kehadiran: (hadir / hari_efektif) * 100
    const rs = db.prepare('SELECT * FROM raport_siswa WHERE periode_id=? AND siswa_id=?').get(periode_id, siswa_id)
    const hariEfektif = p.jumlah_hari_efektif || 1
    const hadirPct = rs ? ((rs.hadir / hariEfektif) * 100) : 0
    let nilai_akhir = null
    if (avg_uh !== null || uts !== null || pas !== null) {
      const vh = avg_uh ?? 0, vuts = uts ?? 0, vpas = pas ?? 0
      nilai_akhir = Math.round(
        (vh * (p.bobot_uh/100) + vuts * (p.bobot_uts/100) + vpas * (p.bobot_pas/100) + hadirPct * (p.bobot_hadir/100)) * 10
      ) / 10
    }
    let predikat = ''
    if (nilai_akhir !== null) {
      if (nilai_akhir >= 93) predikat = 'A'
      else if (nilai_akhir >= 84) predikat = 'B+'
      else if (nilai_akhir >= 75) predikat = 'B'
      else if (nilai_akhir >= 65) predikat = 'C+'
      else if (nilai_akhir >= 55) predikat = 'C'
      else predikat = 'D'
    }
    db.prepare('INSERT INTO raport_nilai(periode_id,siswa_id,mapel_id,uh1,uh2,uh3,uh4,uh5,uh6,uts,pas,nilai_akhir,predikat,deskripsi) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(periode_id,siswa_id,mapel_id) DO UPDATE SET uh1=excluded.uh1,uh2=excluded.uh2,uh3=excluded.uh3,uh4=excluded.uh4,uh5=excluded.uh5,uh6=excluded.uh6,uts=excluded.uts,pas=excluded.pas,nilai_akhir=excluded.nilai_akhir,predikat=excluded.predikat,deskripsi=excluded.deskripsi').run(periode_id,siswa_id,mapel_id,d.uh1??null,d.uh2??null,d.uh3??null,d.uh4??null,d.uh5??null,d.uh6??null,d.uts??null,d.pas??null,nilai_akhir,predikat,d.deskripsi||'')
    return { ok:true, nilai_akhir, predikat }
  })
  ipcMain.handle('raport:nilai_bulk', (_, periode_id, mapel_id, rows) => {
    const p = db.prepare('SELECT * FROM raport_periode WHERE id=?').get(periode_id)
    if (!p) return { ok:false }
    const upsert = db.prepare('INSERT INTO raport_nilai(periode_id,siswa_id,mapel_id,uh1,uh2,uh3,uh4,uh5,uh6,uts,pas,nilai_akhir,predikat,deskripsi) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(periode_id,siswa_id,mapel_id) DO UPDATE SET uh1=excluded.uh1,uh2=excluded.uh2,uh3=excluded.uh3,uh4=excluded.uh4,uh5=excluded.uh5,uh6=excluded.uh6,uts=excluded.uts,pas=excluded.pas,nilai_akhir=excluded.nilai_akhir,predikat=excluded.predikat,deskripsi=excluded.deskripsi')
    const tx = db.transaction(() => {
      for (const r of rows) {
        const uhs = [r.uh1,r.uh2,r.uh3,r.uh4,r.uh5,r.uh6].filter(v=>v!==null&&v!==undefined&&v!=='')
        const avg_uh = uhs.length ? uhs.reduce((a,b)=>a+parseFloat(b),0)/uhs.length : null
        const uts = r.uts!==''&&r.uts!=null ? parseFloat(r.uts) : null
        const pas = r.pas!==''&&r.pas!=null ? parseFloat(r.pas) : null
        const rs = db.prepare('SELECT * FROM raport_siswa WHERE periode_id=? AND siswa_id=?').get(periode_id, r.siswa_id)
        const hariEfektif = p.jumlah_hari_efektif || 1
        const hadirPct = rs ? ((rs.hadir/hariEfektif)*100) : 0
        let na = null
        if (avg_uh!==null||uts!==null||pas!==null) {
          na = Math.round(((avg_uh??0)*(p.bobot_uh/100)+(uts??0)*(p.bobot_uts/100)+(pas??0)*(p.bobot_pas/100)+hadirPct*(p.bobot_hadir/100))*10)/10
        }
        let pr = ''
        if (na!==null) { if(na>=93)pr='A'; else if(na>=84)pr='B+'; else if(na>=75)pr='B'; else if(na>=65)pr='C+'; else if(na>=55)pr='C'; else pr='D' }
        upsert.run(periode_id,r.siswa_id,mapel_id,r.uh1??null,r.uh2??null,r.uh3??null,r.uh4??null,r.uh5??null,r.uh6??null,r.uts??null,r.pas??null,na,pr,r.deskripsi||'')
      }
    })
    tx()
    return { ok:true }
  })
  ipcMain.handle('raport:rekap', (_, periode_id) => {
    const p = db.prepare('SELECT * FROM raport_periode WHERE id=?').get(periode_id)
    if (!p) return { siswa:[], mapel:[], nilai:[] }
    let siswa = []
    if (p.angkatan_id) {
      siswa = db.prepare('SELECT s.* FROM angkatan_siswa a JOIN siswa s ON s.id=a.siswa_id WHERE a.angkatan_id=? ORDER BY COALESCE(s.no_urut,99999),s.nama').all(p.angkatan_id)
    } else {
      siswa = db.prepare('SELECT * FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
    }
    const mapel = db.prepare('SELECT * FROM raport_mapel WHERE periode_id=? ORDER BY COALESCE(urutan,99),nama').all(periode_id)
    const nilaiAll = db.prepare('SELECT * FROM raport_nilai WHERE periode_id=?').all(periode_id)
    const siswaRs = db.prepare('SELECT * FROM raport_siswa WHERE periode_id=?').all(periode_id)
    return { siswa, mapel, nilai: nilaiAll, siswaData: siswaRs, periode: p }
  })

  // Export Excel raport
  ipcMain.handle('raport:export_excel', async (_, periode_id) => {
    try {
      const XLSX = require('xlsx')
      const p = db.prepare('SELECT * FROM raport_periode WHERE id=?').get(periode_id)
      if (!p) return { ok:false, error:'Periode tidak ditemukan' }
      let siswa = []
      if (p.angkatan_id) {
        siswa = db.prepare('SELECT s.* FROM angkatan_siswa a JOIN siswa s ON s.id=a.siswa_id WHERE a.angkatan_id=? ORDER BY COALESCE(s.no_urut,99999),s.nama').all(p.angkatan_id)
      } else {
        siswa = db.prepare('SELECT * FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
      }
      const mapelList = db.prepare('SELECT * FROM raport_mapel WHERE periode_id=? ORDER BY COALESCE(urutan,99),nama').all(periode_id)
      const nilaiAll = db.prepare('SELECT * FROM raport_nilai WHERE periode_id=?').all(periode_id)
      const siswaRs = db.prepare('SELECT * FROM raport_siswa WHERE periode_id=?').all(periode_id)
      const nilaiMap = {}
      for (const n of nilaiAll) { nilaiMap[`${n.siswa_id}_${n.mapel_id}`] = n }
      const rsMap = {}
      for (const rs of siswaRs) { rsMap[rs.siswa_id] = rs }

      const wb = XLSX.utils.book_new()

      // Sheet 1: Rekap Nilai
      const header1 = ['No','NISN','Nama Siswa','Kelas',...mapelList.map(m=>m.nama),'Rata-rata']
      const rows1 = siswa.map((s,i) => {
        const vals = mapelList.map(m => { const n = nilaiMap[`${s.id}_${m.id}`]; return n?.nilai_akhir??'' })
        const filled = vals.filter(v=>v!=='')
        const avg = filled.length ? Math.round(filled.reduce((a,b)=>a+b,0)/filled.length*10)/10 : ''
        const rs = rsMap[s.id]
        return [i+1, s.nisn||'', s.nama, rs?.kelas||s.kelas||'', ...vals, avg]
      })
      const ws1 = XLSX.utils.aoa_to_sheet([header1,...rows1])
      XLSX.utils.book_append_sheet(wb, ws1, 'Rekap Nilai')

      // Sheet 2: Absensi
      const header2 = ['No','NISN','Nama Siswa','Hadir','Sakit','Izin','Alpha','Total Absen','% Hadir']
      const rows2 = siswa.map((s,i) => {
        const rs = rsMap[s.id]
        const hadir = rs?.hadir||0, sakit = rs?.sakit||0, izin = rs?.izin||0, alpha = rs?.alpha||0
        const totalAbsen = sakit+izin+alpha
        const hariEfektif = p.jumlah_hari_efektif||1
        const pct = Math.round((hadir/hariEfektif)*100)
        return [i+1, s.nisn||'', s.nama, hadir, sakit, izin, alpha, totalAbsen, `${pct}%`]
      })
      const ws2 = XLSX.utils.aoa_to_sheet([header2,...rows2])
      XLSX.utils.book_append_sheet(wb, ws2, 'Absensi')

      // Per-mapel sheets
      for (const m of mapelList) {
        const headerM = ['No','NISN','Nama Siswa','UH1','UH2','UH3','UH4','UH5','UH6','Avg UH','UTS','PAS','Nilai Akhir','Predikat']
        const rowsM = siswa.map((s,i) => {
          const n = nilaiMap[`${s.id}_${m.id}`]
          const uhs = [n?.uh1,n?.uh2,n?.uh3,n?.uh4,n?.uh5,n?.uh6].filter(v=>v!=null)
          const avg_uh = uhs.length ? Math.round(uhs.reduce((a,b)=>a+b,0)/uhs.length*10)/10 : ''
          return [i+1,s.nisn||'',s.nama,n?.uh1??'',n?.uh2??'',n?.uh3??'',n?.uh4??'',n?.uh5??'',n?.uh6??'',avg_uh,n?.uts??'',n?.pas??'',n?.nilai_akhir??'',n?.predikat??'']
        })
        const wsM = XLSX.utils.aoa_to_sheet([headerM,...rowsM])
        const sheetName = m.nama.slice(0,28)
        XLSX.utils.book_append_sheet(wb, wsM, sheetName)
      }

      const filePath = path.join(outputPath, `Raport_${p.label?.replace(/\s/g,'_')}_${Date.now()}.xlsx`)
      XLSX.writeFile(wb, filePath)
      await shell.openPath(filePath)
      return { ok:true, path:filePath }
    } catch(e) { return { ok:false, error:e.message } }
  })

  // ── PDF RAPORT ────────────────────────────────────────────────────────────
  ipcMain.handle('pdf:raport_siswa', async (_, periode_id, siswa_id) => {
    try {
      const { generateRaportSiswa } = require('./pdf-generator')
      const sekolah   = db.prepare('SELECT * FROM sekolah WHERE id=1').get()
      const periode   = db.prepare('SELECT * FROM raport_periode WHERE id=?').get(periode_id)
      if (!periode) return { ok:false, error:'Periode tidak ditemukan' }
      const siswa     = db.prepare('SELECT * FROM siswa WHERE id=?').get(siswa_id)
      if (!siswa) return { ok:false, error:'Siswa tidak ditemukan' }
      const rsSiswa   = db.prepare('SELECT * FROM raport_siswa WHERE periode_id=? AND siswa_id=?').get(periode_id, siswa_id)
      const mapelList = db.prepare('SELECT * FROM raport_mapel WHERE periode_id=? ORDER BY COALESCE(urutan,99),nama').all(periode_id)
      const nilaiList = db.prepare('SELECT * FROM raport_nilai WHERE periode_id=? AND siswa_id=?').all(periode_id, siswa_id)
      const nilaiMap  = {}
      for (const n of nilaiList) nilaiMap[n.mapel_id] = n
      const fn = generateRaportSiswa(outputPath, { sekolah, periode, siswa, rsSiswa, mapelList, nilaiMap })
      await shell.openPath(fn)
      return { ok:true, path:fn }
    } catch(e) { return { ok:false, error:e.message } }
  })

  ipcMain.handle('pdf:raport_all', async (_, periode_id) => {
    try {
      const { generateRaportAll } = require('./pdf-generator')
      const sekolah   = db.prepare('SELECT * FROM sekolah WHERE id=1').get()
      const periode   = db.prepare('SELECT * FROM raport_periode WHERE id=?').get(periode_id)
      if (!periode) return { ok:false, error:'Periode tidak ditemukan' }
      let siswaList   = []
      if (periode.angkatan_id) {
        siswaList = db.prepare('SELECT s.* FROM angkatan_siswa a JOIN siswa s ON s.id=a.siswa_id WHERE a.angkatan_id=? ORDER BY COALESCE(s.no_urut,99999),s.nama').all(periode.angkatan_id)
      } else {
        siswaList = db.prepare('SELECT * FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
      }
      const mapelList = db.prepare('SELECT * FROM raport_mapel WHERE periode_id=? ORDER BY COALESCE(urutan,99),nama').all(periode_id)
      const nilaiAll  = db.prepare('SELECT * FROM raport_nilai WHERE periode_id=?').all(periode_id)
      const rsAll     = db.prepare('SELECT * FROM raport_siswa WHERE periode_id=?').all(periode_id)
      const fn = generateRaportAll(outputPath, { sekolah, periode, siswaList, mapelList, nilaiAll, rsAll })
      await shell.openPath(fn)
      return { ok:true, path:fn }
    } catch(e) { return { ok:false, error:e.message } }
  })

  // ── KARTU UJIAN ──────────────────────────────────────────────────────────
  // Add ttd_kepsek column if not exists
  try { db.prepare('ALTER TABLE sekolah ADD COLUMN ttd_kepsek TEXT').run() } catch {}
  // Add ruang_per_siswa to kartu_ujian_config if not exists
  try { db.prepare('ALTER TABLE kartu_ujian_config ADD COLUMN ruang_default TEXT').run() } catch {}

  // Peserta ujian table (assign ruang per siswa per config)
  db.prepare(`CREATE TABLE IF NOT EXISTS peserta_ujian (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_id INTEGER NOT NULL,
    siswa_id INTEGER NOT NULL,
    no_peserta TEXT,
    ruang TEXT,
    kursi TEXT,
    keterangan TEXT,
    UNIQUE(config_id, siswa_id)
  )`).run()

  ipcMain.handle('kartu_ujian:list', () => db.prepare('SELECT k.*,a.nama as nama_angkatan FROM kartu_ujian_config k LEFT JOIN angkatan a ON a.id=k.angkatan_id ORDER BY k.created_at DESC').all())
  ipcMain.handle('kartu_ujian:add', (_, d) => {
    const r = db.prepare('INSERT INTO kartu_ujian_config(nama_ujian,jenis_ujian,tahun_ajaran,semester,tgl_mulai,tgl_selesai,lokasi,keterangan,angkatan_id,ruang_default) VALUES(?,?,?,?,?,?,?,?,?,?)').run(d.nama_ujian||'',d.jenis_ujian||'PAS',d.tahun_ajaran||'',d.semester||'',d.tgl_mulai||'',d.tgl_selesai||'',d.lokasi||'',d.keterangan||'',d.angkatan_id||null,d.ruang_default||'')
    return { ok:true, id:r.lastInsertRowid }
  })
  ipcMain.handle('kartu_ujian:update', (_, id, d) => {
    db.prepare('UPDATE kartu_ujian_config SET nama_ujian=?,jenis_ujian=?,tahun_ajaran=?,semester=?,tgl_mulai=?,tgl_selesai=?,lokasi=?,keterangan=?,angkatan_id=?,ruang_default=? WHERE id=?').run(d.nama_ujian||'',d.jenis_ujian||'PAS',d.tahun_ajaran||'',d.semester||'',d.tgl_mulai||'',d.tgl_selesai||'',d.lokasi||'',d.keterangan||'',d.angkatan_id||null,d.ruang_default||'',id)
    return { ok:true }
  })
  ipcMain.handle('kartu_ujian:delete', (_, id) => { db.prepare('DELETE FROM kartu_ujian_config WHERE id=?').run(id); return {ok:true} })
  ipcMain.handle('kartu_ujian:get_siswa', (_, config_id, kelas_id) => {
    const cfg = db.prepare('SELECT * FROM kartu_ujian_config WHERE id=?').get(config_id)
    if (!cfg) return []
    if (kelas_id) {
      const k = db.prepare('SELECT * FROM kelas WHERE id=?').get(kelas_id)
      if (!k) return []
      if (k.angkatan_id) return db.prepare('SELECT s.* FROM angkatan_siswa a JOIN siswa s ON s.id=a.siswa_id WHERE a.angkatan_id=? ORDER BY COALESCE(s.no_urut,99999),s.nama').all(k.angkatan_id)
      return db.prepare('SELECT * FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
    }
    if (cfg.angkatan_id) return db.prepare('SELECT s.* FROM angkatan_siswa a JOIN siswa s ON s.id=a.siswa_id WHERE a.angkatan_id=? ORDER BY COALESCE(s.no_urut,99999),s.nama').all(cfg.angkatan_id)
    return db.prepare('SELECT * FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
  })

  // ── PESERTA UJIAN ────────────────────────────────────────────────────────
  ipcMain.handle('peserta:list', (_, config_id) => {
    const cfg = db.prepare('SELECT * FROM kartu_ujian_config WHERE id=?').get(config_id)
    if (!cfg) return []
    let siswa = []
    if (cfg.angkatan_id) {
      siswa = db.prepare('SELECT s.* FROM angkatan_siswa a JOIN siswa s ON s.id=a.siswa_id WHERE a.angkatan_id=? ORDER BY COALESCE(s.no_urut,99999),s.nama').all(cfg.angkatan_id)
    } else {
      siswa = db.prepare('SELECT * FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
    }
    return siswa.map((s, i) => {
      const p = db.prepare('SELECT * FROM peserta_ujian WHERE config_id=? AND siswa_id=?').get(config_id, s.id)
      const noPeserta = p?.no_peserta || `${new Date().getFullYear().toString().slice(2)}-920-${String(i+1).padStart(3,'0')}-${cfg.semester==='Ganjil'?'1':'2'}`
      return { ...s, no_peserta: noPeserta, ruang: p?.ruang || cfg.ruang_default || '', kursi: p?.kursi || String(i+1), keterangan: p?.keterangan || '', peserta_id: p?.id || null }
    })
  })
  ipcMain.handle('peserta:save_bulk', (_, config_id, rows) => {
    const upsert = db.prepare('INSERT INTO peserta_ujian(config_id,siswa_id,no_peserta,ruang,kursi,keterangan) VALUES(?,?,?,?,?,?) ON CONFLICT(config_id,siswa_id) DO UPDATE SET no_peserta=excluded.no_peserta,ruang=excluded.ruang,kursi=excluded.kursi,keterangan=excluded.keterangan')
    db.transaction(() => { for (const r of rows) upsert.run(config_id, r.siswa_id, r.no_peserta||'', r.ruang||'', r.kursi||'', r.keterangan||'') })()
    return { ok: true }
  })
  ipcMain.handle('peserta:auto_no', (_, config_id) => {
    const cfg = db.prepare('SELECT * FROM kartu_ujian_config WHERE id=?').get(config_id)
    if (!cfg) return { ok: false }
    let siswa = []
    if (cfg.angkatan_id) {
      siswa = db.prepare('SELECT s.* FROM angkatan_siswa a JOIN siswa s ON s.id=a.siswa_id WHERE a.angkatan_id=? ORDER BY COALESCE(s.no_urut,99999),s.nama').all(cfg.angkatan_id)
    } else {
      siswa = db.prepare('SELECT * FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
    }
    const yr = new Date().getFullYear().toString().slice(2)
    const sem = cfg.semester === 'Ganjil' ? '1' : '2'
    const upsert = db.prepare('INSERT INTO peserta_ujian(config_id,siswa_id,no_peserta,ruang,kursi) VALUES(?,?,?,?,?) ON CONFLICT(config_id,siswa_id) DO UPDATE SET no_peserta=excluded.no_peserta')
    db.transaction(() => {
      siswa.forEach((s, i) => {
        const no = `${yr}-920-${String(i+1).padStart(3,'0')}-${sem}`
        const existing = db.prepare('SELECT * FROM peserta_ujian WHERE config_id=? AND siswa_id=?').get(config_id, s.id)
        upsert.run(config_id, s.id, no, existing?.ruang||cfg.ruang_default||'', existing?.kursi||String(i+1))
      })
    })()
    return { ok: true }
  })
  ipcMain.handle('sekolah:upload_ttd', async () => {
    const result = await dialog.showOpenDialog({ title:'Pilih Gambar TTD Kepala Sekolah', filters:[{name:'Gambar',extensions:['png','jpg','jpeg']}], properties:['openFile'] })
    if (result.canceled || !result.filePaths[0]) return null
    const src = result.filePaths[0]
    const ext = path.extname(src)
    const dest = path.join(outputPath, '..', 'data', `ttd_kepsek${ext}`)
    const fs = require('fs')
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(src, dest)
    db.prepare('UPDATE sekolah SET ttd_kepsek=? WHERE id=1').run(dest)
    return { ok: true, path: dest }
  })
  ipcMain.handle('sekolah:hapus_ttd', () => {
    const row = db.prepare('SELECT ttd_kepsek FROM sekolah WHERE id=1').get()
    if (row?.ttd_kepsek) { try { require('fs').unlinkSync(row.ttd_kepsek) } catch {} }
    db.prepare('UPDATE sekolah SET ttd_kepsek=NULL WHERE id=1').run()
    return { ok: true }
  })

  // ── REKAP BOS ────────────────────────────────────────────────────────────
  ipcMain.handle('bos:list', (_, tahun, semester) => {
    let sql = 'SELECT * FROM rekap_bos WHERE 1=1'
    const params = []
    if (tahun) { sql += ' AND tahun=?'; params.push(tahun) }
    if (semester) { sql += ' AND semester=?'; params.push(semester) }
    sql += ' ORDER BY komponen,sub_komponen'
    return db.prepare(sql).all(...params)
  })
  ipcMain.handle('bos:save', (_, d) => {
    if (d.id) {
      db.prepare('UPDATE rekap_bos SET tahun=?,semester=?,komponen=?,sub_komponen=?,anggaran=?,realisasi=?,keterangan=? WHERE id=?').run(d.tahun||'',d.semester||'Ganjil',d.komponen||'',d.sub_komponen||'',d.anggaran||0,d.realisasi||0,d.keterangan||'',d.id)
    } else {
      db.prepare('INSERT INTO rekap_bos(tahun,semester,komponen,sub_komponen,anggaran,realisasi,keterangan) VALUES(?,?,?,?,?,?,?)').run(d.tahun||'',d.semester||'Ganjil',d.komponen||'',d.sub_komponen||'',d.anggaran||0,d.realisasi||0,d.keterangan||'')
    }
    return { ok:true }
  })
  ipcMain.handle('bos:delete', (_, id) => { db.prepare('DELETE FROM rekap_bos WHERE id=?').run(id); return {ok:true} })
  ipcMain.handle('bos:summary', (_, tahun, semester) => {
    let sql = 'SELECT komponen, SUM(anggaran) as total_anggaran, SUM(realisasi) as total_realisasi FROM rekap_bos WHERE 1=1'
    const params = []
    if (tahun) { sql += ' AND tahun=?'; params.push(tahun) }
    if (semester) { sql += ' AND semester=?'; params.push(semester) }
    sql += ' GROUP BY komponen ORDER BY komponen'
    return db.prepare(sql).all(...params)
  })

  // ── PPDB ─────────────────────────────────────────────────────────────────
  ipcMain.handle('ppdb:list', (_, q, status) => {
    let sql = 'SELECT * FROM ppdb WHERE 1=1'
    const params = []
    if (q) { sql += ' AND (nama LIKE ? OR no_pendaftaran LIKE ? OR nisn LIKE ?)'; params.push(`%${q}%`,`%${q}%`,`%${q}%`) }
    if (status) { sql += ' AND status=?'; params.push(status) }
    sql += ' ORDER BY tgl_daftar DESC,nama'
    return db.prepare(sql).all(...params)
  })
  ipcMain.handle('ppdb:add', (_, d) => {
    const r = db.prepare('INSERT INTO ppdb(no_pendaftaran,nama,jk,tempat_lahir,tgl_lahir,agama,asal_sekolah,nisn,nik,alamat,no_hp,nama_ayah,nama_ibu,pekerjaan_ayah,pekerjaan_ibu,no_hp_ortu,nilai_un,nilai_mtk,nilai_ipa,nilai_bindo,nilai_bing,status,gelombang,keterangan) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(d.no_pendaftaran||'',d.nama||'',d.jk||'L',d.tempat_lahir||'',d.tgl_lahir||'',d.agama||'Islam',d.asal_sekolah||'',d.nisn||'',d.nik||'',d.alamat||'',d.no_hp||'',d.nama_ayah||'',d.nama_ibu||'',d.pekerjaan_ayah||'',d.pekerjaan_ibu||'',d.no_hp_ortu||'',d.nilai_un||null,d.nilai_mtk||null,d.nilai_ipa||null,d.nilai_bindo||null,d.nilai_bing||null,d.status||'Daftar',d.gelombang||'',d.keterangan||'')
    return { ok:true, id:r.lastInsertRowid }
  })
  ipcMain.handle('ppdb:update', (_, id, d) => {
    db.prepare('UPDATE ppdb SET no_pendaftaran=?,nama=?,jk=?,tempat_lahir=?,tgl_lahir=?,agama=?,asal_sekolah=?,nisn=?,nik=?,alamat=?,no_hp=?,nama_ayah=?,nama_ibu=?,pekerjaan_ayah=?,pekerjaan_ibu=?,no_hp_ortu=?,nilai_un=?,nilai_mtk=?,nilai_ipa=?,nilai_bindo=?,nilai_bing=?,status=?,gelombang=?,keterangan=? WHERE id=?').run(d.no_pendaftaran||'',d.nama||'',d.jk||'L',d.tempat_lahir||'',d.tgl_lahir||'',d.agama||'Islam',d.asal_sekolah||'',d.nisn||'',d.nik||'',d.alamat||'',d.no_hp||'',d.nama_ayah||'',d.nama_ibu||'',d.pekerjaan_ayah||'',d.pekerjaan_ibu||'',d.no_hp_ortu||'',d.nilai_un||null,d.nilai_mtk||null,d.nilai_ipa||null,d.nilai_bindo||null,d.nilai_bing||null,d.status||'Daftar',d.gelombang||'',d.keterangan||'',id)
    return { ok:true }
  })
  ipcMain.handle('ppdb:delete', (_, id) => { db.prepare('DELETE FROM ppdb WHERE id=?').run(id); return {ok:true} })
  ipcMain.handle('ppdb:update_status', (_, id, status) => { db.prepare('UPDATE ppdb SET status=? WHERE id=?').run(status,id); return {ok:true} })
  ipcMain.handle('ppdb:terima_jadi_siswa', (_, id) => {
    const p = db.prepare('SELECT * FROM ppdb WHERE id=?').get(id)
    if (!p) return { ok:false, error:'Data tidak ditemukan' }
    const r = db.prepare('INSERT INTO siswa(nama,jk,tempat_lahir,tgl_lahir,agama,asal_sekolah,nisn,nik,alamat,no_hp_ortu,nama_ayah,nama_ibu) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(p.nama,p.jk,p.tempat_lahir,p.tgl_lahir,p.agama,p.asal_sekolah,p.nisn,p.nik,p.alamat,p.no_hp_ortu,p.nama_ayah,p.nama_ibu)
    db.prepare('UPDATE ppdb SET status=? WHERE id=?').run('Diterima',id)
    return { ok:true, siswa_id:r.lastInsertRowid }
  })
  ipcMain.handle('ppdb:stats', () => {
    const total = db.prepare('SELECT COUNT(*) as n FROM ppdb').get()?.n || 0
    const daftar = db.prepare("SELECT COUNT(*) as n FROM ppdb WHERE status='Daftar'").get()?.n || 0
    const diterima = db.prepare("SELECT COUNT(*) as n FROM ppdb WHERE status='Diterima'").get()?.n || 0
    const ditolak = db.prepare("SELECT COUNT(*) as n FROM ppdb WHERE status='Ditolak'").get()?.n || 0
    const cadangan = db.prepare("SELECT COUNT(*) as n FROM ppdb WHERE status='Cadangan'").get()?.n || 0
    return { total, daftar, diterima, ditolak, cadangan }
  })
  ipcMain.handle('ppdb:generate_no', () => {
    const year = new Date().getFullYear()
    const last = db.prepare("SELECT no_pendaftaran FROM ppdb WHERE no_pendaftaran LIKE ? ORDER BY id DESC LIMIT 1").get(`${year}%`)
    let seq = 1
    if (last?.no_pendaftaran) {
      const parts = last.no_pendaftaran.split('/')
      seq = (parseInt(parts[parts.length-1]) || 0) + 1
    }
    return `${year}/PPDB/${String(seq).padStart(3,'0')}`
  })

  // ── BUKU KLEPER ──────────────────────────────────────────────────────────
  ipcMain.handle('kleper:list', (_, q) => {
    let sql = 'SELECT * FROM siswa'
    const params = []
    if (q) { sql += ' WHERE nama LIKE ? OR nisn LIKE ? OR nism LIKE ?'; params.push(`%${q}%`,`%${q}%`,`%${q}%`) }
    sql += ' ORDER BY nama'
    return db.prepare(sql).all(...params)
  })
  ipcMain.handle('kleper:by_huruf', (_, huruf) => {
    return db.prepare("SELECT * FROM siswa WHERE UPPER(SUBSTR(nama,1,1))=? ORDER BY nama").all(huruf.toUpperCase())
  })

  // ── GURU ─────────────────────────────────────────────────────────────────
  ipcMain.handle('guru:list', (_, q) => {
    let sql = 'SELECT * FROM guru'
    const params = []
    if (q) { sql += ' WHERE nama LIKE ? OR nip LIKE ?'; params.push(`%${q}%`,`%${q}%`) }
    sql += ' ORDER BY nama'
    return db.prepare(sql).all(...params)
  })
  ipcMain.handle('guru:get', (_, id) => db.prepare('SELECT * FROM guru WHERE id=?').get(id))
  ipcMain.handle('guru:add', (_, d) => {
    const r = db.prepare(`INSERT INTO guru(nip,nama,jk,tempat_lahir,tgl_lahir,agama,pendidikan,jurusan,status_kepegawaian,sk_pertama,tmt_pertama,golongan,jabatan,mapel,no_hp,alamat,email,foto,tahun_masuk,keterangan,hari_tersedia,maks_jam_per_hari) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(d.nip||'',d.nama||'',d.jk||'',d.tempat_lahir||'',d.tgl_lahir||'',d.agama||'Islam',d.pendidikan||'',d.jurusan||'',d.status_kepegawaian||'PNS',d.sk_pertama||'',d.tmt_pertama||'',d.golongan||'',d.jabatan||'Guru',d.mapel||'',d.no_hp||'',d.alamat||'',d.email||'',d.foto||'',d.tahun_masuk||'',d.keterangan||'',d.hari_tersedia||'',d.maks_jam_per_hari||null)
    return { ok: true, id: r.lastInsertRowid }
  })
  ipcMain.handle('guru:update', (_, id, d) => {
    db.prepare(`UPDATE guru SET nip=?,nama=?,jk=?,tempat_lahir=?,tgl_lahir=?,agama=?,pendidikan=?,jurusan=?,status_kepegawaian=?,sk_pertama=?,tmt_pertama=?,golongan=?,jabatan=?,mapel=?,no_hp=?,alamat=?,email=?,tahun_masuk=?,keterangan=?,hari_tersedia=?,maks_jam_per_hari=? WHERE id=?`).run(d.nip||'',d.nama||'',d.jk||'',d.tempat_lahir||'',d.tgl_lahir||'',d.agama||'Islam',d.pendidikan||'',d.jurusan||'',d.status_kepegawaian||'PNS',d.sk_pertama||'',d.tmt_pertama||'',d.golongan||'',d.jabatan||'Guru',d.mapel||'',d.no_hp||'',d.alamat||'',d.email||'',d.tahun_masuk||'',d.keterangan||'',d.hari_tersedia||'',d.maks_jam_per_hari||null,id)
    return { ok: true }
  })
  // Update ringan khusus utk field ketersediaan (dipakai dari modul Jadwal Pelajaran, tanpa perlu kirim semua field guru)
  ipcMain.handle('guru:update_ketersediaan', (_, id, d) => {
    db.prepare('UPDATE guru SET hari_tersedia=?, maks_jam_per_hari=? WHERE id=?').run(d.hari_tersedia||'', d.maks_jam_per_hari||null, id)
    return { ok: true }
  })
  ipcMain.handle('guru:delete', (_, id) => { db.prepare('DELETE FROM guru WHERE id=?').run(id); return { ok: true } })
  ipcMain.handle('guru:upload_foto', async (_, id) => {
    const result = await dialog.showOpenDialog({ title:'Pilih Foto Guru', filters:[{name:'Gambar',extensions:['jpg','jpeg','png']}], properties:['openFile'] })
    if (result.canceled || !result.filePaths[0]) return null
    const src = result.filePaths[0]; const ext = path.extname(src)
    const dest = path.join(outputPath,'..','data','foto_guru',`guru_${id}${ext}`)
    const fs = require('fs'); fs.mkdirSync(path.dirname(dest),{recursive:true}); fs.copyFileSync(src,dest)
    db.prepare('UPDATE guru SET foto=? WHERE id=?').run(dest,id)
    return dest
  })

  // ── ABSENSI GURU ──────────────────────────────────────────────────────────
  ipcMain.handle('absensi_guru:get', (_, tanggal) => {
    const all = db.prepare('SELECT * FROM guru ORDER BY nama').all()
    return all.map(g => {
      const abs = db.prepare('SELECT * FROM absensi_guru WHERE guru_id=? AND tanggal=?').get(g.id, tanggal)
      return { ...g, status: abs?.status||'H', keterangan: abs?.keterangan||'' }
    })
  })
  ipcMain.handle('absensi_guru:save', (_, tanggal, rows) => {
    const upsert = db.prepare('INSERT INTO absensi_guru(guru_id,tanggal,status,keterangan) VALUES(?,?,?,?) ON CONFLICT(guru_id,tanggal) DO UPDATE SET status=excluded.status,keterangan=excluded.keterangan')
    db.transaction(()=>{ for(const r of rows) upsert.run(r.guru_id,tanggal,r.status,r.keterangan||'') })()
    return { ok: true }
  })
  ipcMain.handle('absensi_guru:rekap', (_, bulan) => {
    const all = db.prepare('SELECT * FROM guru ORDER BY nama').all()
    return all.map(g => {
      let q = "SELECT status,COUNT(*) jml FROM absensi_guru WHERE guru_id=?"
      const params = [g.id]
      if (bulan) { q += " AND strftime('%Y-%m',tanggal)=?"; params.push(bulan) }
      q += " GROUP BY status"
      const rows = db.prepare(q).all(...params)
      const r = {H:0,S:0,I:0,A:0,DL:0}
      for(const row of rows) r[row.status]=(r[row.status]||0)+row.jml
      return { ...g, ...r, total: r.H+r.S+r.I+r.A+r.DL }
    })
  })

  // ── JAM MENGAJAR ──────────────────────────────────────────────────────────
  ipcMain.handle('jam_mengajar:list', (_, tahun_ajaran) => {
    const base = `
      SELECT j.*, g.nama as nama_guru, k.nama as nama_kelas_master, m.nama as nama_mapel_master,
        COALESCE((SELECT COUNT(*) FROM jadwal_pelajaran jp WHERE jp.jam_mengajar_id = j.id), 0) as terjadwal
      FROM jam_mengajar j
      LEFT JOIN guru g ON g.id = j.guru_id
      LEFT JOIN kelas k ON k.id = j.kelas_id
      LEFT JOIN mapel m ON m.id = j.mapel_id
    `
    const rows = tahun_ajaran
      ? db.prepare(base + ' WHERE j.tahun_ajaran=? ORDER BY g.nama').all(tahun_ajaran)
      : db.prepare(base + ' ORDER BY g.nama').all()
    return rows.map(r => ({
      ...r,
      mapel: r.nama_mapel_master || r.mapel || '',
      kelas: r.nama_kelas_master || r.kelas || '',
      sisa: Math.max(0, (r.jumlah_jam || 0) - (r.terjadwal || 0)),
    }))
  })
  ipcMain.handle('jam_mengajar:save', (_, d) => {
    let mapelText = d.mapel || '', kelasText = d.kelas || ''
    if (d.mapel_id) { const m = db.prepare('SELECT nama FROM mapel WHERE id=?').get(d.mapel_id); if (m) mapelText = m.nama }
    if (d.kelas_id) { const k = db.prepare('SELECT nama FROM kelas WHERE id=?').get(d.kelas_id); if (k) kelasText = k.nama }
    if (d.id) {
      db.prepare('UPDATE jam_mengajar SET guru_id=?,mapel=?,kelas=?,jumlah_jam=?,tahun_ajaran=?,kelas_id=?,mapel_id=?,semester=? WHERE id=?')
        .run(d.guru_id,mapelText,kelasText,d.jumlah_jam||0,d.tahun_ajaran||'',d.kelas_id||null,d.mapel_id||null,d.semester||'',d.id)
    } else {
      db.prepare('INSERT INTO jam_mengajar(guru_id,mapel,kelas,jumlah_jam,tahun_ajaran,kelas_id,mapel_id,semester) VALUES(?,?,?,?,?,?,?,?)')
        .run(d.guru_id,mapelText,kelasText,d.jumlah_jam||0,d.tahun_ajaran||'',d.kelas_id||null,d.mapel_id||null,d.semester||'')
    }
    return { ok: true }
  })
  ipcMain.handle('jam_mengajar:delete', (_, id) => {
    db.prepare('DELETE FROM jadwal_pelajaran WHERE jam_mengajar_id=?').run(id)
    db.prepare('DELETE FROM jam_mengajar WHERE id=?').run(id)
    return { ok: true }
  })

  // ── PENGATURAN JAM PELAJARAN (master jam per hari) ──────────────────────
  const hariCase = (col) => `CASE ${col} WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2 WHEN 'Rabu' THEN 3 WHEN 'Kamis' THEN 4 WHEN 'Jumat' THEN 5 WHEN 'Sabtu' THEN 6 ELSE 7 END`
  const getPengaturanJamHari = (hari) => db.prepare('SELECT * FROM pengaturan_jam WHERE hari=? ORDER BY jam_ke').all(hari)

  // Urutan tingkat yang benar (VII, VIII, IX, ...) — bukan alfabetis (yg akan salah urut jadi IX, VII, VIII)
  const TINGKAT_URUT = { VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 }
  function sortKelasByTingkat(list) {
    return [...list].sort((a, b) => {
      const ta = TINGKAT_URUT[a.tingkat] || 999, tb = TINGKAT_URUT[b.tingkat] || 999
      if (ta !== tb) return ta - tb
      return String(a.nama).localeCompare(String(b.nama))
    })
  }

  ipcMain.handle('pengaturan_jam:list', () => db.prepare(`SELECT * FROM pengaturan_jam ORDER BY ${hariCase('hari')}, jam_ke`).all())

  ipcMain.handle('pengaturan_jam:save_hari', (_, hari, rows) => {
    const del = db.prepare('DELETE FROM pengaturan_jam WHERE hari=?')
    const ins = db.prepare('INSERT INTO pengaturan_jam(hari,jam_ke,jam_mulai,jam_selesai,tipe,label) VALUES(?,?,?,?,?,?)')
    const tx = db.transaction(() => {
      del.run(hari)
      rows.forEach((r, i) => ins.run(hari, i + 1, r.jam_mulai || '', r.jam_selesai || '', r.tipe || 'mengajar', r.label || ''))
    })
    tx()
    return { ok: true }
  })

  ipcMain.handle('pengaturan_jam:copy_hari', (_, dariHari, keHariList) => {
    const rows = db.prepare('SELECT * FROM pengaturan_jam WHERE hari=? ORDER BY jam_ke').all(dariHari)
    if (rows.length === 0) return { ok: false, error: `Hari ${dariHari} belum punya pengaturan jam.` }
    const del = db.prepare('DELETE FROM pengaturan_jam WHERE hari=?')
    const ins = db.prepare('INSERT INTO pengaturan_jam(hari,jam_ke,jam_mulai,jam_selesai,tipe,label) VALUES(?,?,?,?,?,?)')
    const tx = db.transaction(() => {
      for (const keHari of keHariList) {
        del.run(keHari)
        rows.forEach(r => ins.run(keHari, r.jam_ke, r.jam_mulai, r.jam_selesai, r.tipe, r.label || ''))
      }
    })
    tx()
    return { ok: true }
  })

  ipcMain.handle('pengaturan_jam:seed_contoh', () => {
    // Contoh awal (bisa langsung diubah bebas) — mengikuti pola umum SMP 6 hari kerja
    const CONTOH = {
      Senin:  [['07.00','07.30','upacara','Upacara'],['07.30','08.00','mengajar',''],['08.00','08.30','mengajar',''],['08.30','09.00','mengajar',''],['09.00','09.30','mengajar',''],['09.30','10.00','mengajar',''],['10.00','10.30','istirahat','Istirahat'],['10.30','11.00','mengajar',''],['11.00','11.30','mengajar',''],['11.30','12.00','mengajar','']],
      Selasa: [['07.00','07.30','pembiasaan','Pembiasaan'],['07.30','08.00','mengajar',''],['08.00','08.30','mengajar',''],['08.30','09.00','mengajar',''],['09.00','09.30','mengajar',''],['09.30','10.00','mengajar',''],['10.00','10.30','istirahat','Istirahat'],['10.30','11.00','mengajar',''],['11.00','11.30','mengajar',''],['11.30','12.00','mengajar',''],['12.00','12.30','mengajar','']],
      Rabu:   [['07.00','07.30','pembiasaan','Pembiasaan'],['07.30','08.00','mengajar',''],['08.00','08.30','mengajar',''],['08.30','09.00','mengajar',''],['09.00','09.30','mengajar',''],['09.30','10.00','mengajar',''],['10.00','10.30','istirahat','Istirahat'],['10.30','11.00','mengajar',''],['11.00','11.30','mengajar',''],['11.30','12.00','mengajar',''],['12.00','12.30','mengajar','']],
      Kamis:  [['07.00','07.30','pembiasaan','Pembiasaan'],['07.30','08.00','mengajar',''],['08.00','08.30','mengajar',''],['08.30','09.00','mengajar',''],['09.00','09.30','mengajar',''],['09.30','10.00','mengajar',''],['10.00','10.30','istirahat','Istirahat'],['10.30','11.00','mengajar',''],['11.00','11.30','mengajar',''],['11.30','12.00','mengajar','']],
      Jumat:  [['07.00','07.30','pembiasaan','Pembiasaan'],['07.30','08.00','mengajar',''],['08.00','08.30','mengajar',''],['08.30','09.00','mengajar',''],['09.00','09.30','mengajar',''],['09.30','10.00','mengajar',''],['10.00','10.30','mengajar','']],
      Sabtu:  [['07.00','07.30','pembiasaan','Pembiasaan'],['07.30','08.00','mengajar',''],['08.00','08.30','mengajar',''],['08.30','09.00','mengajar',''],['09.00','09.30','mengajar',''],['09.30','10.00','istirahat','Istirahat'],['10.00','10.30','mengajar',''],['10.30','11.00','mengajar',''],['11.00','11.30','mengajar','']],
    }
    const del = db.prepare('DELETE FROM pengaturan_jam WHERE hari=?')
    const ins = db.prepare('INSERT INTO pengaturan_jam(hari,jam_ke,jam_mulai,jam_selesai,tipe,label) VALUES(?,?,?,?,?,?)')
    const tx = db.transaction(() => {
      Object.entries(CONTOH).forEach(([hari, rows]) => {
        del.run(hari)
        rows.forEach((r, i) => ins.run(hari, i + 1, r[0], r[1], r[2], r[3] || ''))
      })
    })
    tx()
    return { ok: true }
  })

  // ── JADWAL PELAJARAN: SUSUN, CEK TABRAKAN, REKOMENDASI, ANALISIS BEBAN ──
  ipcMain.handle('jadwal_pelajaran:get_by_kelas', (_, kelas_id) => {
    return db.prepare(`
      SELECT jp.*, g.nama as nama_guru
      FROM jadwal_pelajaran jp LEFT JOIN guru g ON g.id = jp.guru_id
      WHERE jp.kelas_id=? ORDER BY ${hariCase('jp.hari')}, jp.jam_ke
    `).all(kelas_id)
  })

  ipcMain.handle('jadwal_pelajaran:kuota_guru', (_, guru_id) => {
    return db.prepare(`
      SELECT j.*, COALESCE((SELECT COUNT(*) FROM jadwal_pelajaran jp WHERE jp.jam_mengajar_id=j.id),0) as terjadwal
      FROM jam_mengajar j WHERE j.guru_id=? ORDER BY j.mapel
    `).all(guru_id).map(r => ({ ...r, sisa: Math.max(0, (r.jumlah_jam || 0) - (r.terjadwal || 0)) }))
  })

  function validasiBlok(d) {
    const durasi = Number(d.durasi) || 0
    if (durasi < 1 || durasi > 3) return { ok: false, error: 'Durasi harus antara 1–3 JP (maksimal 3 jam mapel yang sama di kelas yang sama per hari).' }
    if (!d.kelas_id || !d.guru_id || !d.hari || !d.mulai_jam_ke) return { ok: false, error: 'Data belum lengkap (kelas, guru, hari, atau jam mulai kosong).' }

    const jamHari = getPengaturanJamHari(d.hari)
    if (jamHari.length === 0) return { ok: false, error: `Belum ada pengaturan jam untuk hari ${d.hari}. Atur dulu di tab Pengaturan Jam.` }

    const mulai = Number(d.mulai_jam_ke)
    const targetJamKe = Array.from({ length: durasi }, (_, i) => mulai + i)
    const inPlaceholders = targetJamKe.map(() => '?').join(',')

    for (const jk of targetJamKe) {
      const slot = jamHari.find(j => j.jam_ke === jk)
      if (!slot) return { ok: false, error: `Jam ke-${jk} tidak ada dalam pengaturan jam hari ${d.hari}.` }
      if (slot.tipe !== 'mengajar') return { ok: false, error: `Jam ke-${jk} adalah slot "${slot.label || slot.tipe}", bukan slot mengajar.` }
    }

    const existingKelas = db.prepare(`SELECT jam_ke, nama_mapel FROM jadwal_pelajaran WHERE kelas_id=? AND hari=? AND jam_ke IN (${inPlaceholders})`).all(d.kelas_id, d.hari, ...targetJamKe)
    if (existingKelas.length > 0) {
      return { ok: false, error: `Kelas sudah ada pelajaran "${existingKelas[0].nama_mapel || '-'}" di jam ke-${existingKelas[0].jam_ke} hari ${d.hari}.`, conflict: 'kelas' }
    }

    const guruRow = db.prepare('SELECT * FROM guru WHERE id=?').get(d.guru_id)
    const existingGuru = db.prepare(`
      SELECT jp.jam_ke, jp.nama_mapel, k.nama as nama_kelas FROM jadwal_pelajaran jp
      LEFT JOIN kelas k ON k.id = jp.kelas_id
      WHERE jp.guru_id=? AND jp.hari=? AND jp.jam_ke IN (${inPlaceholders})
    `).all(d.guru_id, d.hari, ...targetJamKe)
    if (existingGuru.length > 0) {
      const g = existingGuru[0]
      return { ok: false, error: `${guruRow?.nama || 'Guru'} sudah mengajar kelas ${g.nama_kelas || '-'} (${g.nama_mapel || '-'}) di jam ke-${g.jam_ke} hari ${d.hari}.`, conflict: 'guru' }
    }

    if (guruRow?.hari_tersedia) {
      const hariList = guruRow.hari_tersedia.split(',').map(s => s.trim()).filter(Boolean)
      if (hariList.length > 0 && !hariList.includes(d.hari)) {
        return { ok: false, error: `${guruRow.nama} tidak tersedia hari ${d.hari} (hari tersedia: ${hariList.join(', ')}).`, conflict: 'hari_tersedia' }
      }
    }

    if (guruRow?.maks_jam_per_hari) {
      const totalHariIni = db.prepare('SELECT COUNT(*) c FROM jadwal_pelajaran WHERE guru_id=? AND hari=?').get(d.guru_id, d.hari).c
      if (totalHariIni + durasi > guruRow.maks_jam_per_hari) {
        return { ok: false, error: `${guruRow.nama} sudah dijadwalkan ${totalHariIni} JP hari ${d.hari} (maks ${guruRow.maks_jam_per_hari} JP/hari).`, conflict: 'maks_jam_guru' }
      }
    }

    if (d.jam_mengajar_id) {
      const totalMapelHariIni = db.prepare('SELECT COUNT(*) c FROM jadwal_pelajaran WHERE jam_mengajar_id=? AND hari=?').get(d.jam_mengajar_id, d.hari).c
      if (totalMapelHariIni + durasi > 3) {
        return { ok: false, error: `Maksimal 3 JP untuk mapel yang sama di kelas yang sama per hari (sudah ${totalMapelHariIni} JP hari ${d.hari}).`, conflict: 'maks_mapel_harian' }
      }
      const km = db.prepare('SELECT * FROM jam_mengajar WHERE id=?').get(d.jam_mengajar_id)
      if (km) {
        const sudahTerjadwal = db.prepare('SELECT COUNT(*) c FROM jadwal_pelajaran WHERE jam_mengajar_id=?').get(d.jam_mengajar_id).c
        if (sudahTerjadwal + durasi > km.jumlah_jam) {
          return { ok: false, error: `Melebihi kuota. Sisa kuota ${km.mapel} di kelas ${km.kelas} hanya ${km.jumlah_jam - sudahTerjadwal} JP.`, conflict: 'kuota' }
        }
      }
    }

    return { ok: true, jamHari, targetJamKe, guruRow }
  }

  // Insert murni (asumsi sudah lolos validasiBlok) — TIDAK membuka transaksi sendiri,
  // supaya pemanggilnya (tambahBlokInternal / editBlokInternal) bebas membungkus dg transaksi masing-masing
  // tanpa risiko transaksi bersarang.
  function insertBlokRows(d, ctx) {
    const blokId = `blok_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const ins = db.prepare('INSERT INTO jadwal_pelajaran(kelas_id,hari,jam_ke,jam_mulai,jam_selesai,mapel_id,nama_mapel,guru,guru_id,ruangan,jam_mengajar_id,blok_id,semester) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
    for (const jk of ctx.targetJamKe) {
      const slot = ctx.jamHari.find(j => j.jam_ke === jk)
      ins.run(d.kelas_id, d.hari, jk, slot.jam_mulai, slot.jam_selesai, d.mapel_id || null, d.nama_mapel || '', ctx.guruRow?.nama || '', d.guru_id, d.ruangan || '', d.jam_mengajar_id || null, blokId, d.semester || '')
    }
    return blokId
  }

  function tambahBlokInternal(d) {
    const v = validasiBlok(d)
    if (!v.ok) return v
    let blokId
    const tx = db.transaction(() => { blokId = insertBlokRows(d, v) })
    tx()
    return { ok: true, blok_id: blokId, jam_ke: v.targetJamKe }
  }
  ipcMain.handle('jadwal_pelajaran:add_blok', (_, d) => tambahBlokInternal(d))

  // Edit blok yang sudah ada: hapus dulu barisnya, coba tempatkan versi baru (validasi lengkap sama seperti tambah),
  // kalau gagal otomatis rollback (baris lama balik utuh) — jadi gak pernah kehilangan data walau edit-nya invalid.
  function editBlokInternal(d) {
    if (!d.blok_id) return { ok: false, error: 'blok_id wajib diisi.' }
    const oldRows = db.prepare('SELECT * FROM jadwal_pelajaran WHERE blok_id=?').all(d.blok_id)
    if (oldRows.length === 0) return { ok: false, error: 'Blok tidak ditemukan (mungkin sudah dihapus/diubah).' }

    let hasil = null
    try {
      const tx = db.transaction(() => {
        db.prepare('DELETE FROM jadwal_pelajaran WHERE blok_id=?').run(d.blok_id)
        const v = validasiBlok(d)
        if (!v.ok) { hasil = v; throw new Error('__ROLLBACK_VALIDASI__') }
        const blokId = insertBlokRows(d, v)
        hasil = { ok: true, blok_id: blokId, jam_ke: v.targetJamKe }
      })
      tx()
    } catch (e) {
      if (e.message !== '__ROLLBACK_VALIDASI__') throw e
      // sudah di-rollback otomatis oleh db.transaction (baris lama balik utuh); `hasil` tetap berisi objek error utk dikembalikan ke UI
    }
    return hasil
  }
  ipcMain.handle('jadwal_pelajaran:edit_blok', (_, d) => editBlokInternal(d))

  ipcMain.handle('jadwal_pelajaran:hapus_blok', (_, blok_id) => { db.prepare('DELETE FROM jadwal_pelajaran WHERE blok_id=?').run(blok_id); return { ok: true } })
  ipcMain.handle('jadwal_pelajaran:hapus_satu', (_, id) => { db.prepare('DELETE FROM jadwal_pelajaran WHERE id=?').run(id); return { ok: true } })

  // ── GENERATE OTOMATIS: taruh semua sisa kuota ke jadwal, hindari tabrakan ──
  ipcMain.handle('jadwal_pelajaran:generate_otomatis', (_, opts) => {
    const kelasFilter = opts?.kelas_id || null
    const reset = !!opts?.reset
    const HARI6LOCAL = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

    if (reset) {
      if (kelasFilter) db.prepare('DELETE FROM jadwal_pelajaran WHERE kelas_id=? AND jam_mengajar_id IS NOT NULL').run(kelasFilter)
      else db.prepare('DELETE FROM jadwal_pelajaran WHERE jam_mengajar_id IS NOT NULL').run()
    }

    const kelasScope = kelasFilter
      ? sortKelasByTingkat(db.prepare('SELECT * FROM kelas WHERE id=?').all(kelasFilter))
      : sortKelasByTingkat(db.prepare('SELECT * FROM kelas').all())

    function ambilKuotaRows() {
      let rows = db.prepare(`
        SELECT j.*, g.nama as nama_guru, g.hari_tersedia, g.maks_jam_per_hari,
          COALESCE((SELECT COUNT(*) FROM jadwal_pelajaran jp WHERE jp.jam_mengajar_id=j.id),0) as terjadwal
        FROM jam_mengajar j LEFT JOIN guru g ON g.id=j.guru_id
        WHERE j.kelas_id IS NOT NULL AND j.guru_id IS NOT NULL
      `).all()
      if (kelasFilter) rows = rows.filter(k => k.kelas_id === kelasFilter)
      return rows.map(k => ({ ...k, sisa: Math.max(0, (k.jumlah_jam || 0) - (k.terjadwal || 0)) })).filter(k => k.sisa > 0)
    }

    function hitungSlotKosong() {
      const slotKosong = []
      let totalKosong = 0
      for (const kls of kelasScope) {
        let kosong = 0
        for (const hari of HARI6LOCAL) {
          const jamHari = getPengaturanJamHari(hari).filter(j => j.tipe === 'mengajar')
          for (const slot of jamHari) {
            const ada = db.prepare('SELECT id FROM jadwal_pelajaran WHERE kelas_id=? AND hari=? AND jam_ke=?').get(kls.id, hari, slot.jam_ke)
            if (!ada) kosong++
          }
        }
        if (kosong > 0) slotKosong.push({ kelas: kls.nama, jumlah_kosong: kosong })
        totalKosong += kosong
      }
      return { slotKosong, totalKosong }
    }

    function hapusBlokList(blokIds) {
      if (!blokIds || blokIds.length === 0) return
      const placeholders = blokIds.map(() => '?').join(',')
      db.prepare(`DELETE FROM jadwal_pelajaran WHERE blok_id IN (${placeholders})`).run(...blokIds)
    }

    const jumlahHariTersedia = (k) => k.hari_tersedia ? (k.hari_tersedia.split(',').map(s => s.trim()).filter(Boolean).length || 6) : 6
    const bebanGuruHari = (guru_id, hari) => db.prepare('SELECT COUNT(*) c FROM jadwal_pelajaran WHERE guru_id=? AND hari=?').get(guru_id, hari).c

    function shuffle(arr) {
      const a = [...arr]
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = a[i]; a[i] = a[j]; a[j] = tmp
      }
      return a
    }

    const sortDeterministik = (rows) => [...rows].sort((a, b) => {
      const diffHari = jumlahHariTersedia(a) - jumlahHariTersedia(b)
      if (diffHari !== 0) return diffHari
      return b.sisa - a.sisa
    })

    // Jalankan 1x percobaan penuh (pass 1: penempatan blok per-guru + pass 2: tambal lubang tersisa).
    // Semua blok baru yg tercipta selama percobaan ini dicatat blok_id-nya (blokIdsBaru), supaya
    // kalau percobaan ini bukan yg terbaik, HANYA baris-baris ini yg dihapus sebelum percobaan
    // berikutnya — baseline (data sebelum handler ini dipanggil) tidak pernah ikut terhapus.
    function jalankanSatuPercobaan(kuotaRowsSorted) {
      const berhasil = []
      const blokIdsBaru = []

      for (const k of kuotaRowsSorted) {
        const hariAvail = k.hari_tersedia ? k.hari_tersedia.split(',').map(s => s.trim()).filter(Boolean) : HARI6LOCAL
        const validHariAvail = hariAvail.length > 0 ? hariAvail : HARI6LOCAL
        const maxChunkBase = validHariAvail.length <= 2 ? 3 : 2
        let sisa = k.sisa
        while (sisa > 0) {
          let placed = false
          for (let chunk = Math.min(maxChunkBase, sisa); chunk >= 1 && !placed; chunk--) {
            const hariSorted = [...validHariAvail].sort((h1, h2) => bebanGuruHari(k.guru_id, h1) - bebanGuruHari(k.guru_id, h2))
            for (const hari of hariSorted) {
              if (placed) break
              const jamHari = getPengaturanJamHari(hari)
              const slotMengajar = jamHari.filter(j => j.tipe === 'mengajar')
              for (const startSlot of slotMengajar) {
                const targetJamKe = Array.from({ length: chunk }, (_, i) => startSlot.jam_ke + i)
                const rangeOk = targetJamKe.every(jk => jamHari.find(j => j.jam_ke === jk && j.tipe === 'mengajar'))
                if (!rangeOk) continue
                const hasil = tambahBlokInternal({ kelas_id: k.kelas_id, hari, mulai_jam_ke: startSlot.jam_ke, durasi: chunk, guru_id: k.guru_id, mapel_id: k.mapel_id, nama_mapel: k.mapel, jam_mengajar_id: k.id, semester: k.semester })
                if (hasil.ok) {
                  berhasil.push({ guru: k.nama_guru, mapel: k.mapel, kelas: k.kelas, hari, jam: chunk })
                  blokIdsBaru.push(hasil.blok_id)
                  sisa -= chunk; placed = true; break
                }
              }
            }
          }
          if (!placed) break
        }
      }

      let tambahanGapFill = 0
      for (let iterasi = 0; iterasi < 6; iterasi++) {
        let progressIterasiIni = 0
        for (const kls of kelasScope) {
          for (const hari of HARI6LOCAL) {
            const jamHari = getPengaturanJamHari(hari).filter(j => j.tipe === 'mengajar')
            for (const slot of jamHari) {
              const sudahAda = db.prepare('SELECT id FROM jadwal_pelajaran WHERE kelas_id=? AND hari=? AND jam_ke=?').get(kls.id, hari, slot.jam_ke)
              if (sudahAda) continue
              const kandidat = db.prepare(`
                SELECT j.*, g.nama as nama_guru,
                  COALESCE((SELECT COUNT(*) FROM jadwal_pelajaran jp WHERE jp.jam_mengajar_id=j.id),0) as terjadwal
                FROM jam_mengajar j LEFT JOIN guru g ON g.id=j.guru_id
                WHERE j.kelas_id=? AND j.guru_id IS NOT NULL
              `).all(kls.id).map(k => ({ ...k, sisa: (k.jumlah_jam || 0) - (k.terjadwal || 0) }))
                .filter(k => k.sisa > 0).sort((a, b) => b.sisa - a.sisa)
              for (const k of kandidat) {
                const hasil = tambahBlokInternal({ kelas_id: kls.id, hari, mulai_jam_ke: slot.jam_ke, durasi: 1, guru_id: k.guru_id, mapel_id: k.mapel_id, nama_mapel: k.mapel, jam_mengajar_id: k.id, semester: k.semester })
                if (hasil.ok) {
                  berhasil.push({ guru: k.nama_guru, mapel: k.mapel, kelas: k.kelas, hari, jam: 1 })
                  blokIdsBaru.push(hasil.blok_id)
                  tambahanGapFill++; progressIterasiIni++
                  break
                }
              }
            }
          }
        }
        if (progressIterasiIni === 0) break
      }

      return { berhasil, tambahanGapFill, blokIdsBaru }
    }

    // ── Multi-attempt: urutan deterministik dulu, lalu beberapa percobaan dg urutan acak
    //    (di antara kuota yg prioritasnya sama) — simpan & pakai hasil paling penuh (paling sedikit
    //    slot kosong). Ini bin-packing NP-hard, jadi gak ada jaminan matematis 100% penuh untuk
    //    SEMUA kemungkinan data, tapi percobaan berulang ini terbukti signifikan mengurangi lubang. ──
    const baseRows = ambilKuotaRows()
    const MAX_PERCOBAAN = 8
    let terbaik = null
    let terbaikIdx = -1
    let blokIdsPercobaanTerakhir = []

    for (let percobaan = 0; percobaan < MAX_PERCOBAAN; percobaan++) {
      hapusBlokList(blokIdsPercobaanTerakhir) // bersihkan HANYA punya percobaan sebelumnya, baseline aman
      const urutan = percobaan === 0 ? sortDeterministik(baseRows) : sortDeterministik(shuffle(baseRows))
      const { berhasil, tambahanGapFill, blokIdsBaru } = jalankanSatuPercobaan(urutan)
      const { slotKosong, totalKosong } = hitungSlotKosong()
      if (!terbaik || totalKosong < terbaik.totalKosong) {
        terbaik = { berhasil, tambahanGapFill, totalKosong, slotKosong, urutan }
        terbaikIdx = percobaan
      }
      blokIdsPercobaanTerakhir = blokIdsBaru
      if (totalKosong === 0) break
    }

    if (terbaikIdx !== MAX_PERCOBAAN - 1 && terbaik.totalKosong > 0) {
      // percobaan terakhir (state DB saat ini) bukan yg terbaik -> bersihkan, ulang pakai urutan terbaik
      hapusBlokList(blokIdsPercobaanTerakhir)
      const ulang = jalankanSatuPercobaan(terbaik.urutan)
      terbaik.berhasil = ulang.berhasil
      terbaik.tambahanGapFill = ulang.tambahanGapFill
    }

    const gagalFinal = []
    const kuotaSisaAkhir = db.prepare(`
      SELECT j.*, g.nama as nama_guru, COALESCE((SELECT COUNT(*) FROM jadwal_pelajaran jp WHERE jp.jam_mengajar_id=j.id),0) as terjadwal
      FROM jam_mengajar j LEFT JOIN guru g ON g.id=j.guru_id WHERE j.kelas_id IS NOT NULL AND j.guru_id IS NOT NULL
    `).all().filter(k => !kelasFilter || k.kelas_id === kelasFilter)
    kuotaSisaAkhir.forEach(k => {
      const sisaAkhir = (k.jumlah_jam || 0) - (k.terjadwal || 0)
      if (sisaAkhir > 0) gagalFinal.push({ guru: k.nama_guru, mapel: k.mapel, kelas: k.kelas, kurang: sisaAkhir })
    })

    return { ok: true, jumlah_berhasil: terbaik.berhasil.reduce((a, b) => a + b.jam, 0), jumlah_blok: terbaik.berhasil.length, gap_fill: terbaik.tambahanGapFill, gagal: gagalFinal, slot_kosong: terbaik.slotKosong }
  })



  ipcMain.handle('jadwal_pelajaran:rekomendasi_hari', (_, params) => {
    const durasi = Number(params.durasi) || 1
    const guruRow = db.prepare('SELECT * FROM guru WHERE id=?').get(params.guru_id)
    if (!guruRow) return []
    const hariSemua = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
    const hariAvail = guruRow.hari_tersedia
      ? guruRow.hari_tersedia.split(',').map(s => s.trim()).filter(Boolean)
      : hariSemua

    const hasil = []
    for (const hari of hariAvail) {
      const jamHari = getPengaturanJamHari(hari)
      const slotMengajar = jamHari.filter(j => j.tipe === 'mengajar')
      for (const startSlot of slotMengajar) {
        const mulai = startSlot.jam_ke
        const targetJamKe = Array.from({ length: durasi }, (_, i) => mulai + i)
        const rangeOk = targetJamKe.every(jk => jamHari.find(j => j.jam_ke === jk && j.tipe === 'mengajar'))
        if (!rangeOk) continue
        const inPlaceholders = targetJamKe.map(() => '?').join(',')
        const bentrokGuru = db.prepare(`SELECT COUNT(*) c FROM jadwal_pelajaran WHERE guru_id=? AND hari=? AND jam_ke IN (${inPlaceholders})`).get(params.guru_id, hari, ...targetJamKe).c
        if (bentrokGuru > 0) continue
        if (guruRow.maks_jam_per_hari) {
          const totalHariIni = db.prepare('SELECT COUNT(*) c FROM jadwal_pelajaran WHERE guru_id=? AND hari=?').get(params.guru_id, hari).c
          if (totalHariIni + durasi > guruRow.maks_jam_per_hari) continue
        }
        if (params.jam_mengajar_id) {
          const totalMapelHariIni = db.prepare('SELECT COUNT(*) c FROM jadwal_pelajaran WHERE jam_mengajar_id=? AND hari=?').get(params.jam_mengajar_id, hari).c
          if (totalMapelHariIni + durasi > 3) continue
        }
        hasil.push({ hari, mulai_jam_ke: mulai, jam_mulai: startSlot.jam_mulai, jam_selesai: jamHari.find(j=>j.jam_ke===mulai+durasi-1)?.jam_selesai })
        break
      }
      if (hasil.length >= 6) break
    }
    return hasil
  })

  ipcMain.handle('jadwal_pelajaran:workload', () => {
    const guruList = db.prepare('SELECT * FROM guru ORDER BY nama').all()
    return guruList.map(g => {
      const target = db.prepare('SELECT COALESCE(SUM(jumlah_jam),0) t FROM jam_mengajar WHERE guru_id=?').get(g.id).t
      const aktual = db.prepare('SELECT COUNT(*) c FROM jadwal_pelajaran WHERE guru_id=?').get(g.id).c
      return { guru_id: g.id, nama_guru: g.nama, hari_tersedia: g.hari_tersedia || '', maks_jam_per_hari: g.maks_jam_per_hari || null, target_jam: target, aktual_terjadwal: aktual, selisih: target - aktual }
    }).filter(r => r.target_jam > 0)
  })

  ipcMain.handle('jadwal_pelajaran:matrix_hari', (_, hari) => {
    const kelasList = sortKelasByTingkat(db.prepare('SELECT * FROM kelas').all())
    const jamHari = getPengaturanJamHari(hari)
    const isi = db.prepare(`
      SELECT jp.*, g.nama as nama_guru FROM jadwal_pelajaran jp
      LEFT JOIN guru g ON g.id = jp.guru_id WHERE jp.hari=?
    `).all(hari)
    return { kelas: kelasList, jam: jamHari, isi }
  })

  // ── PIKET HARIAN ──────────────────────────────────────────────────────────
  ipcMain.handle('piket:list', () => {
    return db.prepare(`
      SELECT p.*, g.nama as nama_guru FROM piket_harian p
      LEFT JOIN guru g ON g.id = p.guru_id ORDER BY ${hariCase('p.hari')}, p.urutan
    `).all()
  })
  ipcMain.handle('piket:save_hari', (_, hari, guru_ids) => {
    const del = db.prepare('DELETE FROM piket_harian WHERE hari=?')
    const ins = db.prepare('INSERT INTO piket_harian(hari,guru_id,urutan) VALUES(?,?,?)')
    const tx = db.transaction(() => {
      del.run(hari)
      guru_ids.forEach((gid, i) => ins.run(hari, gid, i))
    })
    tx()
    return { ok: true }
  })

  // ── Kode & warna guru dipakai export (1 guru = 1 warna, suffix a/b/c kalau ngajar >1 mapel) ──
  function buildKodeGuruMap() {
    const pairs = db.prepare(`
      SELECT DISTINCT jp.guru_id, jp.nama_mapel, g.nama as nama_guru
      FROM jadwal_pelajaran jp LEFT JOIN guru g ON g.id = jp.guru_id
      WHERE jp.guru_id IS NOT NULL
      ORDER BY g.nama, jp.nama_mapel
    `).all()
    const map = {}
    const guruBase = {}, guruCount = {}, guruWarnaIdx = {}
    let nextNum = 1, nextWarna = 0
    const SUFFIX = ['', 'a', 'b', 'c', 'd', 'e', 'f']
    for (const p of pairs) {
      if (!(p.guru_id in guruBase)) {
        guruBase[p.guru_id] = nextNum++
        guruWarnaIdx[p.guru_id] = nextWarna++
        guruCount[p.guru_id] = 0
      }
      const idx = guruCount[p.guru_id]
      const suf = idx < SUFFIX.length ? SUFFIX[idx] : String(idx)
      guruCount[p.guru_id]++
      map[`${p.guru_id}|${p.nama_mapel}`] = {
        kode: `${guruBase[p.guru_id]}${suf}`,
        warnaIdx: guruWarnaIdx[p.guru_id] % 12,
        nama_guru: p.nama_guru, nama_mapel: p.nama_mapel,
      }
    }
    return map
  }

  const HARI6 = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  function getDataJadwalLengkap() {
    const kelasList = sortKelasByTingkat(db.prepare('SELECT * FROM kelas').all())
    const jamByHari = {}, isiByHari = {}
    for (const hari of HARI6) {
      jamByHari[hari] = getPengaturanJamHari(hari)
      isiByHari[hari] = db.prepare('SELECT * FROM jadwal_pelajaran WHERE hari=?').all(hari)
    }
    const kodeGuruMap = buildKodeGuruMap()
    const piketRows = db.prepare(`SELECT p.*, g.nama as nama_guru FROM piket_harian p LEFT JOIN guru g ON g.id=p.guru_id ORDER BY ${hariCase('p.hari')}, p.urutan`).all()
    const piket = {}
    HARI6.forEach(h => { piket[h] = piketRows.filter(p => p.hari === h).map(p => p.nama_guru).filter(Boolean) })
    return { kelasList, hariList: HARI6, jamByHari, isiByHari, kodeGuruMap, piket }
  }
  ipcMain.handle('jadwal_pelajaran:preview_lengkap', () => getDataJadwalLengkap())

  // ── Cek kapasitas: bandingkan total slot mengajar/minggu tiap kelas vs total kuota yg sudah diisi ──
  // Dipakai UI supaya ketahuan SEBELUM generate kalau kuota kurang/lebih dari slot yg tersedia (penyebab paling umum jam bolong).
  ipcMain.handle('jadwal_pelajaran:cek_kapasitas', () => {
    const kelasList = sortKelasByTingkat(db.prepare('SELECT * FROM kelas').all())
    const semuaJam = HARI6.flatMap(h => getPengaturanJamHari(h))
    const totalSlotMinggu = semuaJam.filter(j => j.tipe === 'mengajar').length
    return kelasList.map(k => {
      const totalKuota = db.prepare('SELECT COALESCE(SUM(jumlah_jam),0) t FROM jam_mengajar WHERE kelas_id=?').get(k.id).t
      const totalTerisi = db.prepare('SELECT COUNT(*) c FROM jadwal_pelajaran WHERE kelas_id=?').get(k.id).c
      return {
        kelas_id: k.id, nama_kelas: k.nama,
        slot_tersedia: totalSlotMinggu, total_kuota: totalKuota, total_terisi: totalTerisi,
        selisih_kuota: totalSlotMinggu - totalKuota, // >0 = kuota kurang dari slot (pasti akan ada jam kosong), <0 = kuota kelebihan (gak akan pernah muat semua)
      }
    })
  })

  ipcMain.handle('jadwal_pelajaran:export_excel', async () => {
    try {
      const { Workbook, S } = require('./excel-builder')
      const s = db.prepare('SELECT * FROM sekolah WHERE id=1').get() || {}
      const { kelasList, hariList, jamByHari, isiByHari, kodeGuruMap, piket } = getDataJadwalLengkap()
      const N = Math.max(kelasList.length, 1)
      const zoneCols = 2 + N // Jam, Waktu, + tiap kelas

      const wb = new Workbook()
      const ws = wb.addSheet('Jadwal Pelajaran')
      ws.setPrintSetup({ landscape: false, paperSize: 8, fitToPage: true }) // A3 portrait, 1 halaman

      const col1 = 1
      const col2 = zoneCols + 2       // 1 kolom jarak
      const col3 = col2 + zoneCols + 1
      const totalCols = col3 + zoneCols - 1
      const widths = []
      for (let c = 1; c <= totalCols; c++) {
        if (c === zoneCols + 1 || c === col3 - 1) { widths.push(2); continue } // kolom jarak antar zona
        if (c >= col1 && c < col1 + zoneCols) {
          const rel = c - col1
          widths.push(rel === 0 ? 6 : 11) // Jam sempit, sisanya (Waktu + kelas) lebar normal
        } else if (c >= col2 && c < col2 + zoneCols) {
          const rel = c - col2
          widths.push(rel === 0 ? 6 : 11)
        } else {
          widths.push(11) // zona 3, kolom Kode & Nama di-override di bawah
        }
      }
      widths[col3 - 1] = 6  // kolom "Kode" zona 3 (legenda/piket)
      widths[col3] = 30     // kolom "Nama Guru — Mapel" zona 3
      ws.setColWidths(widths)

      ws.putRow(1, 1, [`JADWAL PELAJARAN — ${s.nama_sekolah || ''}${s.tahun_ajaran ? '  |  Tahun Ajaran ' + s.tahun_ajaran : ''}`], 'title', 22)
      ws.mergeCell(1, 1, 1, totalCols)
      const topRow = 3

      function drawHariTableExcel(startCol, startRow, hari) {
        let r = startRow
        const jamRows = (jamByHari[hari] || []).slice().sort((a, b) => a.jam_ke - b.jam_ke)
        if (jamRows.length === 0) return r

        ws.putRow(r, startCol, [hari.toUpperCase()], 'subheader', 18)
        ws.mergeCell(r, startCol, r, startCol + zoneCols - 1)
        r++
        ws.putRow(r, startCol, ['Jam Ke', 'Waktu', ...kelasList.map(k => k.nama)], 'header', 18)
        r++

        jamRows.forEach(j => {
          if (j.tipe !== 'mengajar') {
            ws.putRow(r, startCol, [j.jam_ke, `${j.jam_mulai}-${j.jam_selesai}`, j.label || j.tipe, ...kelasList.slice(1).map(() => '')], S.NONMENGAJAR, 16)
            if (kelasList.length > 1) ws.mergeCell(r, startCol + 2, r, startCol + zoneCols - 1)
          } else {
            const cells = [j.jam_ke, `${j.jam_mulai}-${j.jam_selesai}`]
            const styles = [S.DEFAULT, S.DEFAULT]
            kelasList.forEach(k => {
              const isi = (isiByHari[hari] || []).find(x => x.kelas_id === k.id && x.jam_ke === j.jam_ke)
              if (isi && isi.guru_id) {
                const kg = kodeGuruMap[`${isi.guru_id}|${isi.nama_mapel}`]
                cells.push(kg ? kg.kode : '?')
                styles.push(kg ? S.GURU[kg.warnaIdx % 12] : S.KOSONG)
              } else { cells.push(''); styles.push(S.KOSONG) }
            })
            ws.putRow(r, startCol, cells, styles, 16)
          }
          r++
        })
        return r + 1 // spasi kecil
      }

      const kolom1Hari = hariList.filter(h => ['Senin', 'Selasa', 'Rabu'].includes(h))
      const kolom2Hari = hariList.filter(h => ['Kamis', 'Jumat', 'Sabtu'].includes(h))
      const hariLain = hariList.filter(h => !kolom1Hari.includes(h) && !kolom2Hari.includes(h))

      let r1 = topRow
      kolom1Hari.concat(hariLain).forEach(hari => { r1 = drawHariTableExcel(col1, r1, hari) })

      let r2 = topRow
      kolom2Hari.forEach(hari => { r2 = drawHariTableExcel(col2, r2, hari) })

      let r3 = topRow
      const legendPairs = Object.values(kodeGuruMap).sort((a, b) => {
        const na = parseInt(a.kode, 10), nb = parseInt(b.kode, 10)
        return na !== nb ? na - nb : String(a.kode).localeCompare(String(b.kode))
      })
      if (legendPairs.length > 0) {
        ws.putRow(r3, col3, ['KETERANGAN KODE GURU'], 'title', 20)
        ws.mergeCell(r3, col3, r3, col3 + zoneCols - 1)
        r3++
        legendPairs.forEach(lg => {
          ws.putRow(r3, col3, [lg.kode, `${lg.nama_guru || '-'} — ${lg.nama_mapel || '-'}`, ...Array(zoneCols - 2).fill('')], [S.GURU[lg.warnaIdx % 12], 'data_l', ...Array(zoneCols - 2).fill('data_l')], 16)
          ws.mergeCell(r3, col3 + 1, r3, col3 + zoneCols - 1)
          r3++
        })
        r3++
      }

      const piketHari = hariList.filter(h => (piket[h] || []).length > 0)
      if (piketHari.length > 0) {
        ws.putRow(r3, col3, ['JADWAL PIKET'], 'title', 20)
        ws.mergeCell(r3, col3, r3, col3 + zoneCols - 1)
        r3++
        piketHari.forEach((hari, i) => {
          ws.putRow(r3, col3, [hari, (piket[hari] || []).join(', '), ...Array(zoneCols - 2).fill('')], 'data_l', 16, i)
          ws.mergeCell(r3, col3 + 1, r3, col3 + zoneCols - 1)
          r3++
        })
      }

      const filePath = path.join(outputPath, `Jadwal_Pelajaran_${Date.now()}.xlsx`)
      await wb.writeFile(filePath)
      shell.openPath(filePath)
      return safeReturn({ ok: true })
    } catch (e) { return safeReturn({ ok: false, error: String(e instanceof Error ? e.message : e) }) }
  })


  ipcMain.handle('jadwal_pelajaran:export_pdf', async () => {
    try {
      const { generateJadwalLengkap } = require('./pdf-generator')
      const s = db.prepare('SELECT * FROM sekolah WHERE id=1').get() || {}
      const data = getDataJadwalLengkap()
      const fn = generateJadwalLengkap(outputPath, { sekolah: s, ...data })
      await shell.openPath(fn)
      return safeReturn({ ok: true })
    } catch (e) { return safeReturn({ ok: false, error: String(e instanceof Error ? e.message : e) }) }
  })

  // ── Jadwal & cetak per guru (jadwal mengajar pribadi 1 guru) ────────────
  ipcMain.handle('jadwal_pelajaran:get_by_guru', (_, guru_id) => {
    return db.prepare(`
      SELECT jp.*, k.nama as nama_kelas, k.tingkat as tingkat_kelas
      FROM jadwal_pelajaran jp LEFT JOIN kelas k ON k.id = jp.kelas_id
      WHERE jp.guru_id=? ORDER BY ${hariCase('jp.hari')}, jp.jam_ke
    `).all(guru_id)
  })

  ipcMain.handle('jadwal_pelajaran:export_pdf_guru', async (_, guru_id) => {
    try {
      const { generateJadwalGuru } = require('./pdf-generator')
      const s = db.prepare('SELECT * FROM sekolah WHERE id=1').get() || {}
      const guru = db.prepare('SELECT * FROM guru WHERE id=?').get(guru_id)
      if (!guru) return safeReturn({ ok: false, error: 'Guru tidak ditemukan.' })
      const rows = db.prepare(`
        SELECT jp.*, k.nama as nama_kelas FROM jadwal_pelajaran jp
        LEFT JOIN kelas k ON k.id = jp.kelas_id
        WHERE jp.guru_id=? ORDER BY ${hariCase('jp.hari')}, jp.jam_ke
      `).all(guru_id)
      const fn = generateJadwalGuru(outputPath, { sekolah: s, guru, rows })
      await shell.openPath(fn)
      return safeReturn({ ok: true })
    } catch (e) { return safeReturn({ ok: false, error: String(e instanceof Error ? e.message : e) }) }
  })

  // ── SK TUGAS TAMBAHAN ────────────────────────────────────────────────────
  ipcMain.handle('sk_tugas:list', () => db.prepare('SELECT s.*,g.nama as nama_guru FROM sk_tugas s LEFT JOIN guru g ON g.id=s.guru_id ORDER BY s.tahun_ajaran DESC,g.nama').all())
  ipcMain.handle('sk_tugas:save', (_, d) => {
    if (d.id) {
      db.prepare('UPDATE sk_tugas SET guru_id=?,jenis_tugas=?,kelas=?,no_sk=?,tgl_sk=?,tahun_ajaran=?,keterangan=? WHERE id=?').run(d.guru_id,d.jenis_tugas||'',d.kelas||'',d.no_sk||'',d.tgl_sk||'',d.tahun_ajaran||'',d.keterangan||'',d.id)
    } else {
      db.prepare('INSERT INTO sk_tugas(guru_id,jenis_tugas,kelas,no_sk,tgl_sk,tahun_ajaran,keterangan) VALUES(?,?,?,?,?,?,?)').run(d.guru_id,d.jenis_tugas||'',d.kelas||'',d.no_sk||'',d.tgl_sk||'',d.tahun_ajaran||'',d.keterangan||'')
    }
    return { ok: true }
  })
  ipcMain.handle('sk_tugas:delete', (_, id) => { db.prepare('DELETE FROM sk_tugas WHERE id=?').run(id); return { ok: true } })

  // ── LEGER NILAI KELAS ────────────────────────────────────────────────────
  ipcMain.handle('leger:get', (_, kelas_id) => {
    const k = db.prepare('SELECT * FROM kelas WHERE id=?').get(kelas_id)
    if (!k) return { siswa:[], mapel:[], nilai:{} }
    let siswas = []
    if (k.angkatan_id) {
      siswas = db.prepare('SELECT s.* FROM angkatan_siswa a JOIN siswa s ON s.id=a.siswa_id WHERE a.angkatan_id=? ORDER BY COALESCE(s.no_urut,99999),s.nama').all(k.angkatan_id)
    } else {
      siswas = db.prepare('SELECT * FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
    }
    const mapels = db.prepare('SELECT * FROM mapel ORDER BY COALESCE(urutan,999)').all()
    const sems = db.prepare('SELECT * FROM semester_config ORDER BY urutan').all()
    const allNilai = db.prepare('SELECT * FROM nilai').all()
    const nilaiMap = {}
    for (const n of allNilai) {
      const key = `${n.siswa_id}_${n.mapel_id}_${n.semester_id}`
      nilaiMap[key] = n
    }
    const sekolah = db.prepare('SELECT * FROM sekolah WHERE id=1').get()
    const br = sekolah?.bobot_raport ?? 60, bu = sekolah?.bobot_ujian ?? 40, totalB = br+bu
    const ujianSem = sems.find(s=>s.is_ujian) || sems[sems.length-1]
    const raportSems = sems.filter(s=>!s.is_ujian)
    return { siswa:siswas, mapel:mapels, sems, nilaiMap, ujianSem, raportSems, br, bu, totalB, kelas:k }
  })

  // ── SURAT-SURAT ───────────────────────────────────────────────────────────
  ipcMain.handle('surat:get_siswa', (_, siswa_id) => {
    const s = db.prepare('SELECT * FROM siswa WHERE id=?').get(siswa_id)
    const sk = db.prepare('SELECT * FROM sekolah WHERE id=1').get()
    const ang = db.prepare('SELECT a.* FROM angkatan_siswa asa JOIN angkatan a ON a.id=asa.angkatan_id WHERE asa.siswa_id=? LIMIT 1').get(siswa_id)
    return { siswa:s, sekolah:sk, angkatan:ang }
  })
  ipcMain.handle('surat:list', () => {
    return db.prepare('SELECT su.*,s.nama as nama_siswa FROM surat_keluar su LEFT JOIN siswa s ON s.id=su.siswa_id ORDER BY su.created_at DESC').all()
  })
  ipcMain.handle('surat:save_log', (_, d) => {
    db.prepare('INSERT INTO surat_keluar(jenis,siswa_id,no_surat,perihal,tanggal,keterangan) VALUES(?,?,?,?,?,?)').run(d.jenis||'',d.siswa_id||null,d.no_surat||'',d.perihal||'',d.tanggal||'',d.keterangan||'')
    return { ok: true }
  })

  ipcMain.handle('absensi:rekap', (_, kelas_id, bulan) => {
    const k = db.prepare('SELECT * FROM kelas WHERE id=?').get(kelas_id)
    if (!k) return []
    let sw = []
    if (k.angkatan_id) {
      sw = db.prepare('SELECT s.* FROM angkatan_siswa a JOIN siswa s ON s.id=a.siswa_id WHERE a.angkatan_id=? ORDER BY COALESCE(s.no_urut,99999),s.nama').all(k.angkatan_id)
    } else {
      sw = db.prepare('SELECT * FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
    }
    const result = []
    for (const s of sw) {
      let q = "SELECT status, COUNT(*) as jml FROM absensi_harian WHERE kelas_id=? AND siswa_id=?"
      const params = [kelas_id, s.id]
      if (bulan) { q += " AND strftime('%Y-%m',tanggal)=?"; params.push(bulan) }
      q += " GROUP BY status"
      const rows = db.prepare(q).all(...params)
      const r = { H:0, S:0, I:0, A:0 }
      for (const row of rows) r[row.status] = (r[row.status]||0) + row.jml
      result.push({ ...s, ...r, total: r.H+r.S+r.I+r.A })
    }
    return result
  })
  ipcMain.handle('angkatan:tambah_siswa', (_, id, ids) => { const ins=db.prepare('INSERT OR IGNORE INTO angkatan_siswa(angkatan_id,siswa_id) VALUES(?,?)'); const tx=db.transaction(list=>list.forEach(sid=>ins.run(id,sid))); tx(ids); return true })
  ipcMain.handle('angkatan:hapus_siswa', (_, id, ids) => { const del=db.prepare('DELETE FROM angkatan_siswa WHERE angkatan_id=? AND siswa_id=?'); const tx=db.transaction(list=>list.forEach(sid=>del.run(id,sid))); tx(ids); return true })

  // ── PDF Handlers ──────────────────────────────────────────────────────
  const { generateSKL, generateDKN, generateNilaiIjazah, generateIjazah, generateTranskrip, generateSKKelulusan, generateSKKB, generateBukuKleper, generateBukuInduk, generateLeger, generateBukuIndukGuru, generateAbsensiGuru, generateJadwal, generateJurnal, generateAbsensiSiswa, generateSurat } = require('./pdf-generator')

  function getPDFData(angkatan_id) {
    const sekolah  = db.prepare('SELECT * FROM sekolah WHERE id=1').get()
    const siswaList = angkatan_id
      ? db.prepare(`SELECT s.* FROM angkatan_siswa a JOIN siswa s ON s.id=a.siswa_id WHERE a.angkatan_id=? ORDER BY COALESCE(s.no_urut,99999),s.nama`).all(angkatan_id)
      : db.prepare('SELECT * FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
    const mapelList = db.prepare('SELECT * FROM mapel ORDER BY COALESCE(urutan,999),nama').all()
    const sems     = db.prepare('SELECT * FROM semester_config ORDER BY urutan').all()
    const ujianSem = sems.find(s => s.is_ujian) || sems[sems.length - 1]
    const raportSems = sems.filter(s => !s.is_ujian)
    const nilaiData = getAllNilai()
    const br = sekolah?.bobot_raport ?? 60
    const bu = sekolah?.bobot_ujian  ?? 40
    if (!br && !bu) throw new Error('Bobot nilai belum dikonfigurasi. Atur di menu Data Sekolah.')
    const nomorSurat = db.prepare('SELECT * FROM nomor_surat WHERE id=1').get() || {}
    // Merge nomor surat ke sekolah agar pdf-generator bisa akses via s.no_sk, s.no_skkb, dll
    const sekolahWithNomor = {
      ...sekolah,
      no_sk:          nomorSurat.no_sk          || sekolah?.no_sk  || '',
      no_skkb:        nomorSurat.no_skkb        || sekolah?.no_skkb || '',
      no_sk_dkn:      nomorSurat.no_sk_dkn      || '',
      no_nilai_ijazah: nomorSurat.no_nilai_ijazah || '',
      no_transkrip:    nomorSurat.no_transkrip    || '',
    }
    return { sekolah: sekolahWithNomor, siswaList, mapelList, ujianSemId: ujianSem?.id, raportSemIds: raportSems.map(s=>s.id), nilaiData, br, bu, totalB: br+bu }
  }

  // Helper: jika angkatan_id diberikan, override tahun_ajaran dari data angkatan
  function getSekolahWithAngkatan(sekolah, angkatan_id) {
    if (!angkatan_id) return sekolah
    const angkatan = db.prepare('SELECT * FROM angkatan WHERE id=?').get(angkatan_id)
    if (!angkatan) return sekolah
    return {
      ...sekolah,
      tahun_ajaran: angkatan.tahun_lulus || sekolah.tahun_ajaran,
      _angkatan_nama: angkatan.nama
    }
  }

  ipcMain.handle('pdf:skl', async (_, angkatan_id) => {
    try {
      const data = getPDFData(angkatan_id || null)
      if (angkatan_id) data.sekolah = getSekolahWithAngkatan(data.sekolah, angkatan_id)
      const filePath = generateSKL(outputPath, data)
      await shell.openPath(filePath)
      return { ok: true, path: filePath }
    } catch (e) { return { ok: false, error: e.message } }
  })

  ipcMain.handle('pdf:dkn', async (_, angkatan_id) => {
    try {
      const data = getPDFData(angkatan_id || null)
      if (angkatan_id) data.sekolah = getSekolahWithAngkatan(data.sekolah, angkatan_id)
      const filePath = generateDKN(outputPath, data)
      await shell.openPath(filePath)
      return { ok: true, path: filePath }
    } catch (e) { return { ok: false, error: e.message } }
  })

  // export:excel_angkatan — baca angkatan_id dari DB via flag is_aktif atau parameter
  ipcMain.handle('export:excel_angkatan', async (_, angkatan_id) => {
    try {
      const { exportExcelAngkatan } = require('./pdf-generator')
      const aid = (angkatan_id && typeof angkatan_id === 'number') ? angkatan_id : null
      const angkatan   = aid
        ? db.prepare('SELECT * FROM angkatan WHERE id=?').get(aid)
        : db.prepare('SELECT * FROM angkatan WHERE is_aktif=1 ORDER BY id DESC').get() || null
      const siswaList  = aid
        ? db.prepare('SELECT s.* FROM angkatan_siswa a JOIN siswa s ON s.id=a.siswa_id WHERE a.angkatan_id=? ORDER BY COALESCE(s.no_urut,99999),s.nama').all(aid)
        : db.prepare('SELECT * FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
      const mapelList  = db.prepare('SELECT * FROM mapel ORDER BY COALESCE(urutan,999),nama').all()
      const semList    = db.prepare('SELECT * FROM semester_config ORDER BY urutan').all()
      const seo        = db.prepare('SELECT * FROM sekolah WHERE id=1').get()
      const ujianSem   = semList.find(s => s.is_ujian) || semList[semList.length - 1]
      const raportSems = semList.filter(s => !s.is_ujian)
      const nilaiData  = getAllNilai()
      const br = seo?.bobot_raport ?? 60, bu = seo?.bobot_ujian ?? 40, totalB = br + bu
      const filePath = await exportExcelAngkatan(outputPath, {
        sekolah: seo, angkatan, siswaList, mapelList, semList,
        nilaiData, ujianSemId: ujianSem?.id, raportSemIds: raportSems.map(s => s.id),
        br, bu, totalB
      })
      shell.openPath(String(filePath))
      return safeReturn({ ok: true })
    } catch (e) {
      return safeReturn({ ok: false, error: String(e instanceof Error ? e.message : e) })
    }
  })

  ipcMain.handle('pdf:nilai_ijazah', async (_, angkatan_id) => {
    try {
      const data = getPDFData(angkatan_id || null)
      if (angkatan_id) data.sekolah = getSekolahWithAngkatan(data.sekolah, angkatan_id)
      const filePath = generateNilaiIjazah(outputPath, data)
      await shell.openPath(filePath)
      return { ok: true, path: filePath }
    } catch (e) { return { ok: false, error: e.message } }
  })

  ipcMain.handle('pdf:ijazah', async (_, angkatan_id) => {
    try {
      const data = getPDFData(angkatan_id || null)
      if (angkatan_id) data.sekolah = getSekolahWithAngkatan(data.sekolah, angkatan_id)
      const filePath = generateIjazah(outputPath, data)
      await shell.openPath(filePath)
      return { ok: true, path: filePath }
    } catch (e) { return { ok: false, error: e.message } }
  })

  ipcMain.handle('pdf:transkrip', async (_, angkatan_id) => {
    try {
      const data = getPDFData(angkatan_id || null)
      if (angkatan_id) data.sekolah = getSekolahWithAngkatan(data.sekolah, angkatan_id)
      const filePath = generateTranskrip(outputPath, data)
      await shell.openPath(filePath)
      return { ok: true, path: filePath }
    } catch (e) { return { ok: false, error: e.message } }
  })

  ipcMain.handle('pdf:sk_kelulusan', async (_, angkatan_id) => {
    try {
      const data = getPDFData(angkatan_id || null)
      if (angkatan_id) data.sekolah = getSekolahWithAngkatan(data.sekolah, angkatan_id)
      const filePath = generateSKKelulusan(outputPath, data)
      await shell.openPath(filePath)
      return { ok: true, path: filePath }
    } catch (e) { return { ok: false, error: e.message } }
  })

  // ── SKKB ──────────────────────────────────────────────────────────────
  ipcMain.handle('pdf:skkb', async (_, angkatan_id) => {
    try {
      const data = getPDFData(angkatan_id || null)
      if (angkatan_id) data.sekolah = getSekolahWithAngkatan(data.sekolah, angkatan_id)
      const filePath = generateSKKB(outputPath, data)
      await shell.openPath(filePath)
      return { ok: true, path: filePath }
    } catch (e) { return { ok: false, error: e.message } }
  })

  // Upload logo
  ipcMain.handle('sekolah:upload_logo', async (_, field) => {
    const result = await dialog.showOpenDialog({
      title: 'Pilih Logo',
      filters: [{ name: 'Gambar', extensions: ['png', 'jpg', 'jpeg', 'bmp'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths.length) return null
    const buf = fs.readFileSync(result.filePaths[0])
    const ext = path.extname(result.filePaths[0]).slice(1).toLowerCase()
    const mime = ext === 'jpg' ? 'jpeg' : ext
    const base64 = `data:image/${mime};base64,${buf.toString('base64')}`
    db.prepare(`UPDATE sekolah SET ${field}=? WHERE id=1`).run(base64)
    return base64
  })

  ipcMain.handle('sekolah:remove_logo', (_, field) => {
    db.prepare(`UPDATE sekolah SET ${field}=NULL WHERE id=1`).run()
    return true
  })

  // Generate No SKL otomatis
  ipcMain.handle('siswa:generate_no_skl', (_, { pola, mulai_dari }) => {
    // pola: string bebas dengan variabel {no_urut}, {bulan}, {tahun}
    // Contoh: "422/{no_urut}/SKL-MI.BADRUSSALAM/{bulan}/{tahun}"
    const BULAN_ROM = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII']
    const now = new Date()
    const bulanDefault = BULAN_ROM[now.getMonth()]
    const tahunDefault = String(now.getFullYear())
    const polaParsed = (pola || '422/{no_urut}/SKL/{bulan}/{tahun}')
      .replace(/{bulan}/g,  bulanDefault)
      .replace(/{tahun}/g,  tahunDefault)

    const siswaList = db.prepare('SELECT id, no_urut FROM siswa ORDER BY COALESCE(no_urut,99999), id ASC').all()
    let nomor = parseInt(mulai_dari) || 1
    const stmt = db.prepare('UPDATE siswa SET no_skl=? WHERE id=?')
    const run = db.transaction(() => {
      siswaList.forEach(s => {
        const noUrut = String(nomor).padStart(3, '0')
        const noSkl = polaParsed.replace(/{no_urut}/g, noUrut)
        stmt.run(noSkl, s.id)
        nomor++
      })
    })
    run()
    return { ok: true, generated: siswaList.length }
  })

  ipcMain.handle('siswa:update_no_skl', (_, id, no_skl) => {
    db.prepare('UPDATE siswa SET no_skl=? WHERE id=?').run(no_skl, id)
    return true
  })

  // Generate No Transkrip otomatis — per siswa, sama seperti No SKL
  ipcMain.handle('siswa:generate_no_transkrip', (_, { pola, mulai_dari }) => {
    // pola: string bebas dengan variabel {no_urut}, {bulan}, {tahun}
    // Contoh: "421.2/{no_urut}/TRN/{bulan}/{tahun}"
    const BULAN_ROM = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII']
    const now = new Date()
    const bulanDefault = BULAN_ROM[now.getMonth()]
    const tahunDefault = String(now.getFullYear())
    const polaParsed = (pola || '421.2/{no_urut}/TRN/{bulan}/{tahun}')
      .replace(/{bulan}/g,  bulanDefault)
      .replace(/{tahun}/g,  tahunDefault)

    const siswaList = db.prepare('SELECT id, no_urut FROM siswa ORDER BY COALESCE(no_urut,99999), id ASC').all()
    let nomor = parseInt(mulai_dari) || 1
    const stmt = db.prepare('UPDATE siswa SET no_transkrip=? WHERE id=?')
    const run = db.transaction(() => {
      siswaList.forEach(s => {
        const noUrut = String(nomor).padStart(3, '0')
        const noTranskrip = polaParsed.replace(/{no_urut}/g, noUrut)
        stmt.run(noTranskrip, s.id)
        nomor++
      })
    })
    run()
    return { ok: true, generated: siswaList.length }
  })

  ipcMain.handle('siswa:update_no_transkrip', (_, id, no_transkrip) => {
    db.prepare('UPDATE siswa SET no_transkrip=? WHERE id=?').run(no_transkrip, id)
    return true
  })

  // Upload foto siswa
  ipcMain.handle('siswa:upload_foto', async (_, siswaId) => {
    const result = await dialog.showOpenDialog({
      title: 'Pilih Foto Siswa',
      filters: [{ name: 'Gambar', extensions: ['png','jpg','jpeg'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths.length) return null
    const buf  = fs.readFileSync(result.filePaths[0])
    const ext  = path.extname(result.filePaths[0]).slice(1).toLowerCase()
    const mime = ext === 'jpg' ? 'jpeg' : ext
    const base64 = `data:image/${mime};base64,${buf.toString('base64')}`
    db.prepare('UPDATE siswa SET foto=? WHERE id=?').run(base64, siswaId)
    return base64
  })

  ipcMain.handle('siswa:remove_foto', (_, siswaId) => {
    db.prepare('UPDATE siswa SET foto=NULL WHERE id=?').run(siswaId)
    return true
  })

  // Import Excel siswa
  ipcMain.handle('siswa:import_excel', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Pilih File Excel Data Siswa',
      filters: [{ name: 'Excel', extensions: ['xlsx','xls'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths.length) return { ok: false, message: 'Dibatalkan' }
    try {
      const XLSX = require('xlsx')
      const wb   = XLSX.readFile(result.filePaths[0])
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
      if (!rows.length) return { ok: false, message: 'File kosong atau format tidak dikenal' }
      const normalize = s => String(s).toLowerCase().replace(/\s+/g,'_')
      const normalizedRows = rows.map(r => {
        const n = {}
        Object.keys(r).forEach(k => { n[normalize(k)] = r[k] })
        return n
      })
      const mapField = (row, ...keys) => {
        for (const k of keys) {
          const v = row[normalize(k)] ?? row[k]
          if (v !== undefined && v !== '') return String(v).trim()
        }
        return ''
      }
      const stmtInsert = db.prepare(`INSERT INTO siswa(
        no_urut,nism,nisn,nama,jk,tempat_lahir,tgl_lahir,
        ortu,nama_ibu,agama,kewarganegaraan,anak_ke,
        asal_sekolah,tahun_masuk,kelas,no_hp_ortu,alamat,
        peserta_am,no_peserta,blanko,no_skl,no_skkb,jenis_kekhususan
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      // UPDATE pakai COALESCE(?,kolom): kalau sel di Excel KOSONG (nilai jadi NULL), data lama di kolom itu
      // TETAP DIPERTAHANKAN (tidak ditimpa jadi kosong). Cuma kolom yg ADA isinya di file yg benar-benar diganti.
      const stmtUpdate = db.prepare(`UPDATE siswa SET
        no_urut=?,nism=COALESCE(?,nism),nama=COALESCE(?,nama),jk=COALESCE(?,jk),
        tempat_lahir=COALESCE(?,tempat_lahir),tgl_lahir=COALESCE(?,tgl_lahir),
        ortu=COALESCE(?,ortu),nama_ibu=COALESCE(?,nama_ibu),agama=COALESCE(?,agama),
        kewarganegaraan=COALESCE(?,kewarganegaraan),anak_ke=COALESCE(?,anak_ke),
        asal_sekolah=COALESCE(?,asal_sekolah),tahun_masuk=COALESCE(?,tahun_masuk),kelas=COALESCE(?,kelas),
        no_hp_ortu=COALESCE(?,no_hp_ortu),alamat=COALESCE(?,alamat),
        peserta_am=COALESCE(?,peserta_am),no_peserta=COALESCE(?,no_peserta),blanko=COALESCE(?,blanko),
        no_skl=COALESCE(?,no_skl),no_skkb=COALESCE(?,no_skkb),jenis_kekhususan=COALESCE(?,jenis_kekhususan)
        WHERE nisn=?`)
      const stmtFind = db.prepare('SELECT id FROM siswa WHERE nisn=?')
      let inserted = 0, updated = 0, skipped = 0
      const tx = db.transaction(() => {
        normalizedRows.forEach((row, i) => {
          const nama = mapField(row,'nama','nama_lengkap','name')
          if (!nama) { skipped++; return }
          const no    = parseInt(mapField(row,'no','no_urut','nomor')) || (i + 1)
          const nisn  = mapField(row,'nisn') || null
          const jkRaw = mapField(row,'jenis_kelamin','jk','gender')
          // Kosong -> null (biar UPDATE gak maksa ganti jenis kelamin yg sudah benar di data lama)
          const jk    = jkRaw ? (/^p/i.test(jkRaw) ? 'Perempuan' : 'Laki-laki') : null
          // Nilai "mentah" apa adanya dari file (null kalau kosong) — dipakai utk UPDATE (via COALESCE, aman)
          const raw = {
            nism: mapField(row,'nism','nis','no_induk','no_nism') || null,
            tempat_lahir: mapField(row,'tempat_lahir','tempat_lahir_(yyyy-mm-dd)','tempat') || null,
            tgl_lahir: mapField(row,'tanggal_lahir_(yyyy-mm-dd)','tgl_lahir','tanggal_lahir') || null,
            ortu: mapField(row,'nama_ayah/wali','nama_ayah_wali','ortu','nama_ortu','orang_tua') || null,
            nama_ibu: mapField(row,'nama_ibu') || null,
            agama: mapField(row,'agama') || null,
            kewarganegaraan: mapField(row,'kewarganegaraan') || null,
            anak_ke: mapField(row,'anak_ke-','anak_ke') || null,
            asal_sekolah: mapField(row,'asal_sekolah') || null,
            tahun_masuk: mapField(row,'tahun_masuk') || null,
            kelas: mapField(row,'kelas') || null,
            no_hp_ortu: mapField(row,'no_hp_ortu','no_hp') || null,
            alamat: mapField(row,'alamat') || null,
            peserta_am: mapField(row,'no_peserta_am','peserta_am','no_peserta_am') || null,
            no_peserta: mapField(row,'no_peserta_ujian_sekolah','no_peserta') || null,
            blanko: mapField(row,'no_blanko_ijazah','blanko','no_blanko') || null,
            no_skl: mapField(row,'no_skl','nomor_skl') || null,
            no_skkb: mapField(row,'no_skkb') || null,
            jenis_kekhususan: mapField(row,'jenis_kekhususan') || null,
          }
          // Kalau NISN ada dan sudah exist -> UPDATE (kolom kosong di file dilewati/dipertahankan),
          // kalau tidak ketemu -> INSERT baru (di sini baru pantas pakai nilai default)
          const existing = nisn ? stmtFind.get(nisn) : null
          if (existing) {
            stmtUpdate.run(
              no, raw.nism, nama, jk, raw.tempat_lahir, raw.tgl_lahir, raw.ortu, raw.nama_ibu,
              raw.agama, raw.kewarganegaraan, raw.anak_ke, raw.asal_sekolah, raw.tahun_masuk, raw.kelas,
              raw.no_hp_ortu, raw.alamat, raw.peserta_am, raw.no_peserta, raw.blanko, raw.no_skl,
              raw.no_skkb, raw.jenis_kekhususan, nisn
            )
            updated++
          } else {
            stmtInsert.run(
              no, raw.nism, nisn, nama, jk || 'Laki-laki',
              raw.tempat_lahir, raw.tgl_lahir, raw.ortu, raw.nama_ibu,
              raw.agama || 'Islam', raw.kewarganegaraan || 'Indonesia', raw.anak_ke,
              raw.asal_sekolah, raw.tahun_masuk, raw.kelas, raw.no_hp_ortu, raw.alamat,
              raw.peserta_am, raw.no_peserta, raw.blanko, raw.no_skl, raw.no_skkb, raw.jenis_kekhususan
            )
            inserted++
          }
        })
      })
      tx()
      return {
        ok: true, inserted, updated, skipped, imported: inserted + updated,
        message: `${inserted} siswa baru ditambahkan, ${updated} data lama diperbarui${skipped ? ', ' + skipped + ' dilewati (tidak ada nama)' : ''}`
      }
    } catch (e) {
      return { ok: false, message: 'Gagal membaca file: ' + e.message }
    }
  })

  // Backup & Restore
  // ── Siswa: Download Template Import ──────────────────────────────────────
  ipcMain.handle('siswa:download_template', async () => {
    try {
      const { Workbook } = require('./excel-builder')
      const wb = new Workbook()
      const ws = wb.addSheet('Template Siswa')
      const headers = ['No','Nama Lengkap','NISN','NISM','Jenis Kelamin','Tempat Lahir','Tanggal Lahir (YYYY-MM-DD)','Agama','Kewarganegaraan','Anak ke-','Kelas','Tahun Masuk','Asal Sekolah','Nama Ayah/Wali','Nama Ibu','No HP Ortu','Alamat','No Peserta Ujian Sekolah','No Peserta AM','No Blanko Ijazah','No SKL','No SKKB','Jenis Kekhususan']
      const contoh  = ['1','Nama Siswa','1234567890','1234/001','Laki-laki','Bandung','2012-01-15','Islam','Indonesia','1','VI A','2019','SDN Contoh','Nama Ayah','Nama Ibu','08123456789','Jl. Contoh No.1','-','-','-','-','-','-']
      ws.setColWidths(headers.map(() => 20))
      ws.addRow(headers, 'header', 30)
      ws.addRow(contoh,  headers.map(() => 'data_l'), 18, 0)
      const filePath = path.join(outputPath, 'template_import_siswa.xlsx')
      await wb.writeFile(filePath)
      shell.openPath(filePath)
      return { ok: true }
    } catch (e) { return { ok: false, message: e.message } }
  })

  // ── Nilai: Download Template Import ──────────────────────────────────────
  ipcMain.handle('nilai:import_template', async () => {
    try {
      const { Workbook } = require('./excel-builder')
      const siswaList = db.prepare('SELECT id,no_urut,nisn,nama FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
      const mapelList = db.prepare('SELECT id,nama,kelompok FROM mapel ORDER BY COALESCE(urutan,999),nama').all()
      const semList   = db.prepare('SELECT * FROM semester_config ORDER BY urutan').all()
      const raportSems = semList.filter(s => !s.is_ujian)
      const ujianSems  = semList.filter(s => s.is_ujian)

      const wb = new Workbook()

      // Sheet 1: Petunjuk
      const wsPetunjuk = wb.addSheet('Petunjuk')
      wsPetunjuk.setColWidths([70])
      const petunjukRows = [
        ['TEMPLATE IMPORT NILAI - SIM IJAZAH'],
        [''],
        ['PETUNJUK PENGISIAN:'],
        ['1. Jangan ubah kolom NISN, Nama Siswa, dan Mata Pelajaran'],
        ['2. Untuk semester raport: isi kolom Nilai_P (Nilai Pengetahuan) saja (0-100)'],
        ['3. Untuk semester ujian: isi kolom Nilai_Ujian (0-100)'],
        ['4. Kosongkan sel jika nilai belum ada, JANGAN isi 0'],
        ['5. Jangan ubah struktur kolom'],
        ['6. Simpan file, lalu import melalui menu Import Nilai'],
      ]
      petunjukRows.forEach((r, i) => {
        wsPetunjuk.addRow(r, i === 0 ? 'title' : 'data_l', i === 0 ? 24 : 18, i)
      })

      // Sheet 2: Nilai
      const colHeaders = ['NISN','Nama Siswa','Kode Mapel','Mata Pelajaran','Kelompok']
      raportSems.forEach(s => colHeaders.push(`${s.label}__P`))
      ujianSems.forEach(s  => colHeaders.push(`${s.label}__Ujian`))

      const wsNilai = wb.addSheet('Nilai')
      wsNilai.setColWidths(colHeaders.map((_,i) => i < 5 ? 24 : 14))
      wsNilai.freezePane(1, 2)
      // Header baris 1: identitas biru gelap, kolom nilai biru sedang
      wsNilai.addRow(colHeaders, colHeaders.map((_,i) => i < 5 ? 'header' : 'subheader'), 30)
      // Data rows
      siswaList.forEach(sw => {
        mapelList.forEach((m, ri) => {
          const row = [sw.nisn||'', sw.nama, m.id, m.nama, m.kelompok||'']
          raportSems.forEach(() => row.push(''))
          ujianSems.forEach(()  => row.push(''))
          wsNilai.addRow(row, ['data_l','data_l','data','data_l','data_l', ...raportSems.map(()=>'data'), ...ujianSems.map(()=>'data')], 16, ri)
        })
      })

      const filePath = path.join(outputPath, 'template_import_nilai.xlsx')
      await wb.writeFile(filePath)
      shell.openPath(filePath)
      return { ok: true }
    } catch (e) { return { ok: false, message: e.message } }
  })

  // ── Nilai: Import dari Excel ──────────────────────────────────────────────
  ipcMain.handle('nilai:import_nilai', async () => {
    const result = await dialog.showOpenDialog({ title: 'Pilih File Template Nilai', filters: [{ name: 'Excel', extensions: ['xlsx','xls'] }], properties: ['openFile'] })
    if (result.canceled || !result.filePaths.length) return { ok: false, message: 'Dibatalkan' }
    try {
      const XLSX = require('xlsx')
      const wb   = XLSX.readFile(result.filePaths[0])
      const ws   = wb.Sheets['Nilai'] || wb.Sheets[wb.SheetNames.find(n => n !== 'Petunjuk') || wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
      if (!rows.length) return { ok: false, message: 'Sheet Nilai kosong atau tidak ditemukan' }

      const semList   = db.prepare('SELECT * FROM semester_config ORDER BY urutan').all()
      const raportSems = semList.filter(s => !s.is_ujian)
      const ujianSems  = semList.filter(s => s.is_ujian)
      const siswaMap  = {}
      const siswaMapNama = {}
      db.prepare('SELECT id,nisn,nama FROM siswa').all().forEach(s => {
        if (s.nisn) siswaMap[String(s.nisn).trim()] = s.id
        if (s.nama) siswaMapNama[String(s.nama).trim().toLowerCase()] = s.id
      })

      const ins = db.prepare('INSERT INTO nilai(siswa_id,mapel_id,semester_id,nilai_p,nilai_k,nilai_ujian) VALUES(?,?,?,?,?,?) ON CONFLICT(siswa_id,mapel_id,semester_id) DO UPDATE SET nilai_p=excluded.nilai_p,nilai_k=excluded.nilai_k,nilai_ujian=excluded.nilai_ujian')
      let imported = 0, skipped = 0, errors = 0

      const parseVal = v => { const n = parseFloat(String(v)); return isNaN(n) || String(v).trim()==='' ? null : Math.min(100,Math.max(0,n)) }

      const tx = db.transaction(() => {
        rows.forEach(row => {
          const nisn    = String(row['NISN']||'').trim()
          const namaSiswa = String(row['Nama Siswa']||'').trim()
          const mapelId = parseInt(row['Kode Mapel'])
          // Cari siswa by NISN dulu, fallback by nama
          let siswaId = (nisn ? siswaMap[nisn] : null) || siswaMapNama[namaSiswa.toLowerCase()]
          // Jika tidak ditemukan, skip (jangan auto-insert)
          if (!siswaId || !mapelId) { skipped++; return }

          raportSems.forEach(sem => {
            const p = parseVal(row[`${sem.label}__P`])
            if (p === null) { skipped++; return }
            try { ins.run(siswaId, mapelId, sem.id, p, null, null); imported++ }
            catch { errors++ }
          })
          ujianSems.forEach(sem => {
            const u = parseVal(row[`${sem.label}__Ujian`])
            if (u === null) { skipped++; return }
            try { ins.run(siswaId, mapelId, sem.id, null, null, u); imported++ }
            catch { errors++ }
          })
        })
      })
      tx()
      return { ok: true, imported, skipped, errors, message: `${imported} nilai berhasil diimport` }
    } catch (e) { return { ok: false, message: 'Gagal membaca file: ' + e.message } }
  })

  // ── Export Excel per siswa ────────────────────────────────────────────────
  ipcMain.handle('export:excel_siswa', async (_, siswaId) => {
    try {
      const { Workbook } = require('./excel-builder')
      const siswa   = db.prepare('SELECT * FROM siswa WHERE id=?').get(siswaId)
      if (!siswa) return { ok: false, message: 'Siswa tidak ditemukan' }
      const mapels  = db.prepare('SELECT * FROM mapel ORDER BY COALESCE(urutan,999),nama').all()
      const semList = db.prepare('SELECT * FROM semester_config ORDER BY urutan').all()
      const nilaiRows = db.prepare('SELECT * FROM nilai WHERE siswa_id=?').all(siswaId)
      const getNilai = (mId, sId) => nilaiRows.find(n => n.mapel_id===mId && n.semester_id===sId)
      const seo = db.prepare('SELECT bobot_raport,bobot_ujian FROM sekolah WHERE id=1').get()
      const br = seo?.bobot_raport ?? 60, bu = seo?.bobot_ujian ?? 40, tb = br+bu
      const raportSems = semList.filter(s => !s.is_ujian)
      const ujianSem   = semList.find(s => s.is_ujian)

      const wb = new Workbook()

      // ── Sheet 1: Biodata ──────────────────────────────────────────────
      const ws1 = wb.addSheet('Biodata')
      ws1.setColWidths([22, 40])
      ws1.mergeCell(1, 1, 1, 2)
      ws1.addRow(['DATA SISWA', ''], 'title', 20)
      const biodataRows = [
        ['Nama Lengkap', siswa.nama],
        ['NISN', siswa.nisn||'-'], ['NISM', siswa.nism||'-'],
        ['Jenis Kelamin', siswa.jk],
        ['Tempat, Tgl Lahir', `${siswa.tempat_lahir||'-'}, ${siswa.tgl_lahir||'-'}`],
        ['Agama', siswa.agama||'-'], ['Kewarganegaraan', siswa.kewarganegaraan||'Indonesia'],
        ['Kelas', siswa.kelas||'-'], ['Tahun Masuk', siswa.tahun_masuk||'-'],
        ['Asal Sekolah', siswa.asal_sekolah||'-'],
        ['Nama Ayah/Wali', siswa.ortu||'-'], ['Nama Ibu', siswa.nama_ibu||'-'],
        ['No HP Ortu', siswa.no_hp_ortu||'-'], ['Alamat', siswa.alamat||'-'],
        ['No Blanko Ijazah', siswa.blanko||'-'], ['No Peserta', siswa.no_peserta||'-'],
      ]
      biodataRows.forEach((r, i) => {
        ws1.addRow([r[0], r[1]], ['label', i%2===0?'val':'val_l'], 16, i)
      })

      // ── Sheet 2: Nilai ────────────────────────────────────────────────
      const ws2 = wb.addSheet('Nilai')
      ws2.setColWidths([5, 35, ...raportSems.map(()=>10), 10, 13, 13])
      ws2.freezePane(1, 2)
      ws2.addRow(
        ['No', 'Mata Pelajaran', ...raportSems.map(s=>s.label), 'Nilai US', 'Rata Raport', 'Nilai Ijazah'],
        'header', 30
      )
      mapels.forEach((m, i) => {
        const rapVals = []
        raportSems.forEach(s => {
          const n = getNilai(m.id, s.id)
          if (n?.nilai_p != null) rapVals.push(parseFloat(n.nilai_p))
        })
        const ujN   = ujianSem ? getNilai(m.id, ujianSem.id) : null
        const ujVal = ujN?.nilai_ujian != null ? parseFloat(ujN.nilai_ujian) : null
        const rataR = rapVals.length===raportSems.length ? rapVals.reduce((a,b)=>a+b,0)/rapVals.length : null
        const nij   = rataR!=null && ujVal!=null ? (rataR*br+ujVal*bu)/tb : null
        ws2.addRow(
          [
            i+1, m.nama,
            ...raportSems.map(s => { const n=getNilai(m.id,s.id); return n?.nilai_p!=null?parseFloat(n.nilai_p):'' }),
            ujVal!=null ? parseFloat(ujVal.toFixed(2)) : '',
            rataR!=null ? parseFloat(rataR.toFixed(2)) : '',
            nij!=null   ? parseFloat(nij.toFixed(2))   : ''
          ],
          ['data_l','data_l', ...raportSems.map(()=>'data'), 'data','data','data'],
          16, i
        )
      })

      const fname = `Rekap_${(siswa.nama||'Siswa').replace(/[^a-zA-Z0-9_]/g,'_')}.xlsx`
      const filePath = path.join(outputPath, fname)
      await wb.writeFile(filePath)
      shell.openPath(filePath)
      return safeReturn({ ok: true })
    } catch (e) { return safeReturn({ ok: false, message: String(e instanceof Error ? e.message : e) }) }
  })

  // ── PDF per siswa ─────────────────────────────────────────────────────────
  function getPDFDataSiswa(siswaId) {
    const data = getPDFData(null)
    data.siswaList = data.siswaList.filter(s => s.id === siswaId)
    if (!data.siswaList.length) throw new Error('Siswa tidak ditemukan')
    return data
  }
  ipcMain.handle('pdf:skl_siswa',         async (_, id) => { try { const data=getPDFDataSiswa(id); const f=generateSKL(outputPath,data); await shell.openPath(f); return {ok:true} } catch(e){return{ok:false,error:e.message}} })

  // ── PDF: KARTU UJIAN ─────────────────────────────────────────────────────
  ipcMain.handle('pdf:kartu_ujian', async (_, config_id, kelas_id) => {
    try {
      const { generateKartuUjian } = require('./pdf-generator')
      const sekolah = db.prepare('SELECT * FROM sekolah WHERE id=1').get()
      const cfg = db.prepare('SELECT k.*,a.nama as nama_angkatan FROM kartu_ujian_config k LEFT JOIN angkatan a ON a.id=k.angkatan_id WHERE k.id=?').get(config_id)
      if (!cfg) return { ok:false, error:'Konfigurasi ujian tidak ditemukan' }
      // Get peserta with no_peserta and ruang from peserta_ujian table
      let baseSiswa = []
      if (kelas_id) {
        const k = db.prepare('SELECT * FROM kelas WHERE id=?').get(kelas_id)
        if (k?.angkatan_id) baseSiswa = db.prepare('SELECT s.* FROM angkatan_siswa a JOIN siswa s ON s.id=a.siswa_id WHERE a.angkatan_id=? ORDER BY COALESCE(s.no_urut,99999),s.nama').all(k.angkatan_id)
        else baseSiswa = db.prepare('SELECT * FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
      } else if (cfg.angkatan_id) {
        baseSiswa = db.prepare('SELECT s.* FROM angkatan_siswa a JOIN siswa s ON s.id=a.siswa_id WHERE a.angkatan_id=? ORDER BY COALESCE(s.no_urut,99999),s.nama').all(cfg.angkatan_id)
      } else {
        baseSiswa = db.prepare('SELECT * FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
      }
      const siswaList = baseSiswa.map((s, i) => {
        const p = db.prepare('SELECT * FROM peserta_ujian WHERE config_id=? AND siswa_id=?').get(config_id, s.id)
        return { ...s, no_peserta: p?.no_peserta || `${i+1}`, ruang: p?.ruang || cfg.ruang_default || '', kursi: p?.kursi || '' }
      })
      const fn = generateKartuUjian(outputPath, { sekolah, cfg, siswaList })
      await shell.openPath(fn)
      return { ok:true, path:fn }
    } catch(e) { return { ok:false, error:e.message } }
  })

  ipcMain.handle('pdf:kartu_ujian_peserta', async (_, config_id) => {
    // Same as pdf:kartu_ujian but uses peserta table only (sorted by no_peserta)
    try {
      const { generateKartuUjian } = require('./pdf-generator')
      const sekolah = db.prepare('SELECT * FROM sekolah WHERE id=1').get()
      const cfg = db.prepare('SELECT k.*,a.nama as nama_angkatan FROM kartu_ujian_config k LEFT JOIN angkatan a ON a.id=k.angkatan_id WHERE k.id=?').get(config_id)
      if (!cfg) return { ok:false, error:'Konfigurasi tidak ditemukan' }
      let baseSiswa = []
      if (cfg.angkatan_id) {
        baseSiswa = db.prepare('SELECT s.* FROM angkatan_siswa a JOIN siswa s ON s.id=a.siswa_id WHERE a.angkatan_id=? ORDER BY COALESCE(s.no_urut,99999),s.nama').all(cfg.angkatan_id)
      } else {
        baseSiswa = db.prepare('SELECT * FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
      }
      const siswaList = baseSiswa.map((s, i) => {
        const p = db.prepare('SELECT * FROM peserta_ujian WHERE config_id=? AND siswa_id=?').get(config_id, s.id)
        return { ...s, no_peserta: p?.no_peserta || `${i+1}`, ruang: p?.ruang || cfg.ruang_default || '', kursi: p?.kursi || '' }
      }).sort((a, b) => (a.no_peserta||'').localeCompare(b.no_peserta||''))
      const fn = generateKartuUjian(outputPath, { sekolah, cfg, siswaList })
      await shell.openPath(fn)
      return { ok:true, path:fn }
    } catch(e) { return { ok:false, error:e.message } }
  })

  // ── PDF: REKAP BOS ────────────────────────────────────────────────────────
  ipcMain.handle('pdf:rekap_bos', async (_, tahun, semester) => {
    try {
      const { generateRekapBOS } = require('./pdf-generator')
      const sekolah = db.prepare('SELECT * FROM sekolah WHERE id=1').get()
      const jumlah_siswa = db.prepare('SELECT COUNT(*) as n FROM siswa').get()?.n || 0
      let sql = 'SELECT * FROM rekap_bos WHERE 1=1'
      const params = []
      if (tahun) { sql += ' AND tahun=?'; params.push(tahun) }
      if (semester) { sql += ' AND semester=?'; params.push(semester) }
      sql += ' ORDER BY komponen,sub_komponen'
      const items = db.prepare(sql).all(...params)
      const fn = generateRekapBOS(outputPath, { sekolah, items, tahun, semester, jumlah_siswa })
      await shell.openPath(fn)
      return { ok:true, path:fn }
    } catch(e) { return { ok:false, error:e.message } }
  })

  // ── PDF: BUKU KLEPER ──────────────────────────────────────────────────────
  ipcMain.handle('pdf:buku_kleper', async () => {
    try {
      const sekolah = db.prepare('SELECT * FROM sekolah WHERE id=1').get()
      const siswaList = db.prepare('SELECT * FROM siswa ORDER BY nama').all()
      const fn = generateBukuKleper(outputPath, { sekolah, siswaList })
      await shell.openPath(fn)
      return { ok: true, path: fn }
    } catch(e) { return { ok: false, error: e.message } }
  })

  // ── PDF: BUKU INDUK SISWA ────────────────────────────────────────────────
  ipcMain.handle('pdf:buku_induk_siswa', async (_, angkatan_id) => {
    try {
      const sekolah = db.prepare('SELECT * FROM sekolah WHERE id=1').get()
      let siswaList
      if (angkatan_id) {
        siswaList = db.prepare('SELECT s.* FROM angkatan_siswa a JOIN siswa s ON s.id=a.siswa_id WHERE a.angkatan_id=? ORDER BY COALESCE(s.no_urut,99999),s.nama').all(angkatan_id)
      } else {
        siswaList = db.prepare('SELECT * FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
      }
      const fn = generateBukuInduk(outputPath, { sekolah, siswaList })
      await shell.openPath(fn)
      return { ok: true, path: fn }
    } catch(e) { return { ok: false, error: e.message } }
  })

  // ── PDF: LEGER NILAI ──────────────────────────────────────────────────────
  ipcMain.handle('pdf:leger', async (_, kelas_id) => {
    try {
      const sekolah = db.prepare('SELECT * FROM sekolah WHERE id=1').get()
      const kelas = db.prepare('SELECT * FROM kelas WHERE id=?').get(kelas_id)
      if (!kelas) return { ok: false, error: 'Kelas tidak ditemukan' }
      let siswaList
      if (kelas.angkatan_id) {
        siswaList = db.prepare('SELECT s.* FROM angkatan_siswa a JOIN siswa s ON s.id=a.siswa_id WHERE a.angkatan_id=? ORDER BY COALESCE(s.no_urut,99999),s.nama').all(kelas.angkatan_id)
      } else {
        siswaList = db.prepare('SELECT * FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
      }
      const mapelList = db.prepare('SELECT * FROM mapel ORDER BY COALESCE(urutan,999),nama').all()
      const sems = db.prepare('SELECT * FROM semester_config ORDER BY urutan').all()
      const ujianSem = sems.find(s => s.is_ujian) || sems[sems.length-1]
      const raportSems = sems.filter(s => !s.is_ujian)
      const allNilai = db.prepare('SELECT * FROM nilai').all()
      const nilaiMap = {}
      for (const n of allNilai) { nilaiMap[`${n.siswa_id}_${n.mapel_id}_${n.semester_id}`] = n }
      const br = sekolah?.bobot_raport ?? 60, bu = sekolah?.bobot_ujian ?? 40, totalB = br + bu
      const fn = generateLeger(outputPath, { sekolah, kelas, siswaList, mapelList, nilaiMap, ujianSem, raportSems, br, bu, totalB })
      await shell.openPath(fn)
      return { ok: true, path: fn }
    } catch(e) { return { ok: false, error: e.message } }
  })

  // ── PDF: BUKU INDUK GURU ──────────────────────────────────────────────────
  ipcMain.handle('pdf:buku_induk_guru', async () => {
    try {
      const sekolah = db.prepare('SELECT * FROM sekolah WHERE id=1').get()
      const guruList = db.prepare('SELECT * FROM guru ORDER BY nama').all()
      const fn = generateBukuIndukGuru(outputPath, { sekolah, guruList })
      await shell.openPath(fn)
      return { ok: true, path: fn }
    } catch(e) { return { ok: false, error: e.message } }
  })

  // ── PDF: ABSENSI GURU ─────────────────────────────────────────────────────
  ipcMain.handle('pdf:absensi_guru', async (_, bulan) => {
    try {
      const sekolah = db.prepare('SELECT * FROM sekolah WHERE id=1').get()
      const all = db.prepare('SELECT * FROM guru ORDER BY nama').all()
      const rekapList = all.map(g => {
        let q = "SELECT status,COUNT(*) jml FROM absensi_guru WHERE guru_id=?"
        const params = [g.id]
        if (bulan) { q += " AND strftime('%Y-%m',tanggal)=?"; params.push(bulan) }
        q += " GROUP BY status"
        const rows = db.prepare(q).all(...params)
        const r = {H:0,S:0,I:0,A:0,DL:0}
        for(const row of rows) r[row.status]=(r[row.status]||0)+row.jml
        return { ...g, ...r, total: r.H+r.S+r.I+r.A+r.DL }
      })
      const fn = generateAbsensiGuru(outputPath, { sekolah, rekapList, bulan })
      await shell.openPath(fn)
      return { ok: true, path: fn }
    } catch(e) { return { ok: false, error: e.message } }
  })

  // ── PDF: JADWAL PELAJARAN ─────────────────────────────────────────────────
  ipcMain.handle('pdf:jadwal', async (_, kelas_id) => {
    try {
      const sekolah = db.prepare('SELECT * FROM sekolah WHERE id=1').get()
      const kelas = db.prepare('SELECT * FROM kelas WHERE id=?').get(kelas_id)
      if (!kelas) return { ok: false, error: 'Kelas tidak ditemukan' }
      const jadwalList = db.prepare("SELECT * FROM jadwal_pelajaran WHERE kelas_id=? ORDER BY CASE hari WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2 WHEN 'Rabu' THEN 3 WHEN 'Kamis' THEN 4 WHEN 'Jumat' THEN 5 WHEN 'Sabtu' THEN 6 ELSE 7 END, jam_ke").all(kelas_id)
      const fn = generateJadwal(outputPath, { sekolah, kelas, jadwalList })
      await shell.openPath(fn)
      return { ok: true, path: fn }
    } catch(e) { return { ok: false, error: e.message } }
  })

  // ── PDF: JURNAL KELAS ─────────────────────────────────────────────────────
  ipcMain.handle('pdf:jurnal', async (_, kelas_id, bulan) => {
    try {
      const sekolah = db.prepare('SELECT * FROM sekolah WHERE id=1').get()
      const kelas = db.prepare('SELECT * FROM kelas WHERE id=?').get(kelas_id)
      if (!kelas) return { ok: false, error: 'Kelas tidak ditemukan' }
      let q = 'SELECT * FROM jurnal_kelas WHERE kelas_id=?'
      const params = [kelas_id]
      if (bulan) { q += " AND strftime('%Y-%m',tanggal)=?"; params.push(bulan) }
      q += ' ORDER BY tanggal,jam_ke'
      const jurnalList = db.prepare(q).all(...params)
      const fn = generateJurnal(outputPath, { sekolah, kelas, jurnalList, bulan })
      await shell.openPath(fn)
      return { ok: true, path: fn }
    } catch(e) { return { ok: false, error: e.message } }
  })

  // ── PDF: ABSENSI SISWA ────────────────────────────────────────────────────
  ipcMain.handle('pdf:absensi_siswa', async (_, kelas_id, bulan) => {
    try {
      const sekolah = db.prepare('SELECT * FROM sekolah WHERE id=1').get()
      const kelas = db.prepare('SELECT * FROM kelas WHERE id=?').get(kelas_id)
      if (!kelas) return { ok: false, error: 'Kelas tidak ditemukan' }
      let sw
      if (kelas.angkatan_id) {
        sw = db.prepare('SELECT s.* FROM angkatan_siswa a JOIN siswa s ON s.id=a.siswa_id WHERE a.angkatan_id=? ORDER BY COALESCE(s.no_urut,99999),s.nama').all(kelas.angkatan_id)
      } else {
        sw = db.prepare('SELECT * FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
      }
      const rekapList = sw.map(s => {
        let q = "SELECT status,COUNT(*) jml FROM absensi_harian WHERE kelas_id=? AND siswa_id=?"
        const params = [kelas_id, s.id]
        if (bulan) { q += " AND strftime('%Y-%m',tanggal)=?"; params.push(bulan) }
        q += " GROUP BY status"
        const rows = db.prepare(q).all(...params)
        const r = {H:0,S:0,I:0,A:0}
        for(const row of rows) r[row.status]=(r[row.status]||0)+row.jml
        return { ...s, ...r, total: r.H+r.S+r.I+r.A }
      })
      const fn = generateAbsensiSiswa(outputPath, { sekolah, kelas, rekapList, bulan })
      await shell.openPath(fn)
      return { ok: true, path: fn }
    } catch(e) { return { ok: false, error: e.message } }
  })

  // ── PDF: SURAT ────────────────────────────────────────────────────────────
  ipcMain.handle('pdf:surat', async (_, params) => {
    try {
      const { siswa_id, jenis, noSurat, keperluan } = params
      const sekolah = db.prepare('SELECT * FROM sekolah WHERE id=1').get()
      const siswa = db.prepare('SELECT * FROM siswa WHERE id=?').get(siswa_id)
      const angkatan = db.prepare('SELECT a.* FROM angkatan_siswa asa JOIN angkatan a ON a.id=asa.angkatan_id WHERE asa.siswa_id=? LIMIT 1').get(siswa_id)
      const fn = generateSurat(outputPath, { sekolah, siswa, jenis, noSurat, keperluan, angkatan })
      // Log surat
      db.prepare('INSERT INTO surat_keluar(jenis,siswa_id,no_surat,perihal,tanggal,keterangan) VALUES(?,?,?,?,?,?)').run(jenis, siswa_id, noSurat || '', jenis, new Date().toISOString().slice(0,10), keperluan || '')
      await shell.openPath(fn)
      return { ok: true, path: fn }
    } catch(e) { return { ok: false, error: e.message } }
  })
  ipcMain.handle('pdf:transkrip_siswa',   async (_, id) => { try { const data=getPDFDataSiswa(id); const f=generateTranskrip(outputPath,data); await shell.openPath(f); return {ok:true} } catch(e){return{ok:false,error:e.message}} })
  ipcMain.handle('pdf:nilai_ijazah_siswa',async (_, id) => { try { const data=getPDFDataSiswa(id); const f=generateNilaiIjazah(outputPath,data); await shell.openPath(f); return {ok:true} } catch(e){return{ok:false,error:e.message}} })
  ipcMain.handle('pdf:ijazah_siswa',      async (_, id) => { try { const data=getPDFDataSiswa(id); const f=generateIjazah(outputPath,data); await shell.openPath(f); return {ok:true} } catch(e){return{ok:false,error:e.message}} })
  ipcMain.handle('pdf:skkb_siswa',        async (_, id) => { try { const data=getPDFDataSiswa(id); const f=generateSKKB(outputPath,data); await shell.openPath(f); return {ok:true} } catch(e){return{ok:false,error:e.message}} })

  // ── Nomor Surat ──────────────────────────────────────────────────────────
  ipcMain.handle('nomor_surat:get_all', () => {
    return db.prepare('SELECT * FROM nomor_surat WHERE id=1').get() || {}
  })
  ipcMain.handle('nomor_surat:save', (_, field, value) => {
    const allowed = ['no_sk','no_skkb','no_nilai_ijazah','no_transkrip']
    if (!allowed.includes(field)) return { ok: false, message: 'Field tidak valid' }
    db.prepare(`UPDATE nomor_surat SET ${field}=? WHERE id=1`).run(value)
    return { ok: true }
  })
  ipcMain.handle('nomor_surat:save_all', (_, data) => {
    db.prepare('UPDATE nomor_surat SET no_sk=?,no_skkb=?,no_nilai_ijazah=?,no_transkrip=? WHERE id=1')
      .run(data.no_sk||null, data.no_skkb||null, data.no_nilai_ijazah||null, data.no_transkrip||null)
    return { ok: true }
  })

  ipcMain.handle('db:backup', async () => {
    const now   = new Date()
    const stamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`
    try {
      const zlib = require('zlib')
      // Backup DB ke file sementara
      const tmpDb = path.join(app.getPath('temp'), `sim_backup_${stamp}.db`)
      await db.backup(tmpDb)
      const dbBuf = fs.readFileSync(tmpDb)
      fs.unlinkSync(tmpDb)

      // Export JSON
      const exportData = {
        exported_at: new Date().toISOString(),
        sekolah:     db.prepare('SELECT * FROM sekolah').all(),
        siswa:       db.prepare('SELECT * FROM siswa').all(),
        mapel:       db.prepare('SELECT * FROM mapel ORDER BY urutan').all(),
        semester:    db.prepare('SELECT * FROM semester_config ORDER BY urutan').all(),
        nilai:       db.prepare('SELECT * FROM nilai').all(),
        angkatan:    db.prepare('SELECT * FROM angkatan').all(),
        nomor_surat: db.prepare('SELECT * FROM nomor_surat').all(),
      }
      const jsonBuf  = Buffer.from(JSON.stringify(exportData, null, 2), 'utf8')
      const txtBuf   = Buffer.from(
        'Cara Restore Backup SIM Ijazah:\n' +
        '1. Buka aplikasi SIM Ijazah\n' +
        '2. Klik tombol Restore di menu Rekap & Cetak\n' +
        '3. Pilih file ZIP ini\n' +
        '4. Aplikasi akan otomatis merestore data\n\n' +
        'File SIM_Ijazah.db adalah database utama.\n' +
        'File data_export.json adalah export JSON untuk keperluan lain.\n',
        'utf8'
      )

      // Buat ZIP pakai Node.js built-in (tanpa library tambahan)
      const deflate = (buf) => new Promise((res, rej) =>
        zlib.deflateRaw(buf, (err, out) => err ? rej(err) : res(out))
      )
      const w16 = (b,v,o) => { b[o]=v&0xFF; b[o+1]=(v>>8)&0xFF }
      const w32 = (b,v,o) => { b[o]=v&0xFF; b[o+1]=(v>>8)&0xFF; b[o+2]=(v>>16)&0xFF; b[o+3]=(v>>24)&0xFF }
      const crc = (buf) => {
        const t = new Uint32Array(256)
        for (let i=0;i<256;i++){let c=i; for(let j=0;j<8;j++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1); t[i]=c}
        let c=0xFFFFFFFF
        for (let i=0;i<buf.length;i++) c=t[(c^buf[i])&0xFF]^(c>>>8)
        return (c^0xFFFFFFFF)>>>0
      }
      const mkEntry = async (name, raw) => {
        const nameBuf = Buffer.from(name,'utf8')
        const comp    = await deflate(raw)
        const data    = comp.length < raw.length ? comp : raw
        const meth    = comp.length < raw.length ? 8 : 0
        const lh = Buffer.alloc(30 + nameBuf.length)
        w32(lh,0x04034b50,0); w16(lh,20,4); w16(lh,0,6); w16(lh,meth,8)
        w16(lh,0,10); w16(lh,0,12); w32(lh,crc(raw),14)
        w32(lh,data.length,18); w32(lh,raw.length,22)
        w16(lh,nameBuf.length,26); w16(lh,0,28); nameBuf.copy(lh,30)
        return { name: nameBuf, raw, data, meth, crc: crc(raw), lh }
      }
      const entries = await Promise.all([
        mkEntry('SIM_Ijazah.db',      dbBuf),
        mkEntry('data_export.json',   jsonBuf),
        mkEntry('CARA_RESTORE.txt',   txtBuf),
      ])
      const parts = []; const cds = []; let offset = 0
      for (const e of entries) {
        cds.push({ e, offset })
        parts.push(e.lh, e.data)
        offset += e.lh.length + e.data.length
      }
      const cdStart = offset
      for (const {e, offset: loff} of cds) {
        const cd = Buffer.alloc(46 + e.name.length)
        w32(cd,0x02014b50,0); w16(cd,20,4); w16(cd,20,6); w16(cd,0,8)
        w16(cd,e.meth,10); w16(cd,0,12); w16(cd,0,14); w32(cd,e.crc,16)
        w32(cd,e.data.length,20); w32(cd,e.raw.length,24)
        w16(cd,e.name.length,28); w16(cd,0,30); w16(cd,0,32)
        w16(cd,0,34); w16(cd,0,36); w32(cd,0,38); w32(cd,loff,42)
        e.name.copy(cd,46); parts.push(cd); offset += cd.length
      }
      const eocd = Buffer.alloc(22)
      w32(eocd,0x06054b50,0); w16(eocd,0,4); w16(eocd,0,6)
      w16(eocd,entries.length,8); w16(eocd,entries.length,10)
      w32(eocd,offset-cdStart,12); w32(eocd,cdStart,16); w16(eocd,0,20)
      parts.push(eocd)

      const zipBuf     = Buffer.concat(parts)
      const zipName    = `SIM_Ijazah_Backup_${stamp}.zip`
      const zipPath    = path.join(outputPath, zipName)
      fs.writeFileSync(zipPath, zipBuf)
      shell.openPath(outputPath) // buka folder output
      return safeReturn({ ok: true, path: zipPath, name: zipName })
    } catch (e) { return safeReturn({ ok: false, message: String(e instanceof Error ? e.message : e) }) }
  })

  ipcMain.handle('db:restore', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Pilih File Backup (ZIP atau DB)',
      filters: [
        { name: 'Backup SIM Ijazah', extensions: ['zip','db'] },
        { name: 'File ZIP', extensions: ['zip'] },
        { name: 'Database', extensions: ['db'] },
      ],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths.length) return { ok: false, message: 'Dibatalkan' }
    try {
      let backupPath = result.filePaths[0]
      // Jika ZIP, extract file .db terlebih dahulu
      if (backupPath.endsWith('.zip')) {
        // Baca ZIP pakai native Node.js - extract file .db
        const zlib    = require('zlib')
        const zipBuf  = fs.readFileSync(backupPath)
        // Cari EOCD
        let eocdOff = -1
        for (let i = zipBuf.length - 22; i >= 0; i--) {
          if (zipBuf.readUInt32LE(i) === 0x06054b50) { eocdOff = i; break }
        }
        if (eocdOff < 0) return { ok: false, message: 'File ZIP tidak valid' }
        const cdCount  = zipBuf.readUInt16LE(eocdOff + 8)
        let   cdOffset = zipBuf.readUInt32LE(eocdOff + 16)
        let   dbBuf    = null
        for (let i = 0; i < cdCount; i++) {
          if (zipBuf.readUInt32LE(cdOffset) !== 0x02014b50) break
          const nameLen  = zipBuf.readUInt16LE(cdOffset + 28)
          const extraLen = zipBuf.readUInt16LE(cdOffset + 30)
          const commLen  = zipBuf.readUInt16LE(cdOffset + 32)
          const entryName = zipBuf.slice(cdOffset + 46, cdOffset + 46 + nameLen).toString('utf8')
          const lhOffset  = zipBuf.readUInt32LE(cdOffset + 42)
          const compSize  = zipBuf.readUInt32LE(cdOffset + 20)
          const uncompSize = zipBuf.readUInt32LE(cdOffset + 24)
          const method    = zipBuf.readUInt16LE(cdOffset + 10)
          if (entryName.endsWith('.db')) {
            // Baca dari local file header
            const lhNameLen  = zipBuf.readUInt16LE(lhOffset + 26)
            const lhExtraLen = zipBuf.readUInt16LE(lhOffset + 28)
            const dataStart  = lhOffset + 30 + lhNameLen + lhExtraLen
            const compData   = zipBuf.slice(dataStart, dataStart + compSize)
            dbBuf = method === 8
              ? zlib.inflateRawSync(compData)
              : compData
            break
          }
          cdOffset += 46 + nameLen + extraLen + commLen
        }
        if (!dbBuf) return { ok: false, message: 'File ZIP tidak mengandung database (.db)' }
        const tmpRestore = path.join(app.getPath('temp'), 'sim_restore_tmp.db')
        fs.writeFileSync(tmpRestore, dbBuf)
        backupPath = tmpRestore
      }
      db.close()
      fs.copyFileSync(backupPath, dbPath)
      if (backupPath.includes('sim_restore_tmp')) {
        try { fs.unlinkSync(backupPath) } catch {}
      }
      const Database = require('better-sqlite3')
      db = new Database(dbPath)
      db.pragma('journal_mode = WAL')
      db.pragma('foreign_keys = ON')
      return { ok: true }
    } catch (e) { return { ok: false, message: String(e instanceof Error ? e.message : e) } }
  })

  // Misc
  ipcMain.handle('app:get_paths', () => ({ dbPath, outputPath }))
  ipcMain.handle('app:open_output', () => shell.openPath(outputPath))
  ipcMain.handle('stats:dashboard', () => ({
    siswa:    db.prepare('SELECT COUNT(*) c FROM siswa').get().c,
    mapel:    db.prepare('SELECT COUNT(*) c FROM mapel').get().c,
    nilai:    db.prepare('SELECT COUNT(*) c FROM nilai').get().c,
    angkatan: db.prepare('SELECT COUNT(*) c FROM angkatan').get().c,
  }))
}

// ── Window ─────────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1366, height: 860, minWidth: 1100, minHeight: 680,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#18181b', symbolColor: '#a1a1aa', height: 36 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#f9fafb',
    show: false,
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.once('ready-to-show', () => win.show())
}

app.whenReady().then(() => {
  initDB(); registerIPC(); createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
