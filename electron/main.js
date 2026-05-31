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
    judul_sk_kelulusan: 'TEXT', paragraf_pembuka_sk: 'TEXT', paragraf_penutup_sk: 'TEXT',
    alamat2: 'TEXT', no_skkb: 'TEXT'
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
    kelas: 'TEXT', no_hp_ortu: 'TEXT'
  }
  Object.entries(newSiswaCols).forEach(([col, type]) => {
    if (!siswaCols.includes(col))
      db.prepare(`ALTER TABLE siswa ADD COLUMN ${col} ${type}`).run()
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
  const map = {}
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

  // ── Ranking Siswa ────────────────────────────────────────────────────────
  ipcMain.handle('nilai:ranking', () => {
    const siswa      = db.prepare('SELECT id,no_urut,nama,nisn,kelas FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
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
      return {
        id:          sw.id,
        nama:        sw.nama,
        nisn:        sw.nisn,
        kelas:       sw.kelas,
        rata_raport: cnt > 0 ? Math.round(sumRap/cnt*100)/100 : null,
        nilai_ujian: cnt > 0 ? Math.round(sumUji/cnt*100)/100 : null,
        nilai_ijazah:cnt > 0 ? Math.round(sumNij/cnt*100)/100 : null,
        lengkap:     cnt === mapelIds.length && mapelIds.length > 0,
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
  ipcMain.handle('angkatan:siswa', (_, id) => db.prepare('SELECT s.* FROM angkatan_siswa a JOIN siswa s ON s.id=a.siswa_id WHERE a.angkatan_id=? ORDER BY COALESCE(s.no_urut,99999),s.nama').all(id))
  ipcMain.handle('angkatan:tambah_siswa', (_, id, ids) => { const ins=db.prepare('INSERT OR IGNORE INTO angkatan_siswa(angkatan_id,siswa_id) VALUES(?,?)'); const tx=db.transaction(list=>list.forEach(sid=>ins.run(id,sid))); tx(ids); return true })
  ipcMain.handle('angkatan:hapus_siswa', (_, id, ids) => { const del=db.prepare('DELETE FROM angkatan_siswa WHERE angkatan_id=? AND siswa_id=?'); const tx=db.transaction(list=>list.forEach(sid=>del.run(id,sid))); tx(ids); return true })

  // ── PDF Handlers ──────────────────────────────────────────────────────
  const { generateSKL, generateDKN, generateNilaiIjazah, generateIjazah, generateTranskrip, generateSKKelulusan, generateSKKB } = require('./pdf-generator')

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

  // export:excel_angkatan — tidak menerima parameter dari renderer
  // angkatan aktif dibaca langsung dari DB (angkatan is_aktif=1)
  // Sehingga tidak ada data yang dikirim renderer -> main (eliminasi clone error)
  ipcMain.handle('export:excel_angkatan', async () => {
    try {
      const { exportExcelAngkatan } = require('./pdf-generator')
      // Baca semua data dari DB sendiri
      const angkatan   = db.prepare('SELECT * FROM angkatan WHERE is_aktif=1 ORDER BY id DESC').get() || null
      const siswaList  = db.prepare('SELECT * FROM siswa ORDER BY COALESCE(no_urut,99999),nama').all()
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
      const stmtUpdate = db.prepare(`UPDATE siswa SET
        no_urut=?,nism=?,nama=?,jk=?,tempat_lahir=?,tgl_lahir=?,
        ortu=?,nama_ibu=?,agama=?,kewarganegaraan=?,anak_ke=?,
        asal_sekolah=?,tahun_masuk=?,kelas=?,no_hp_ortu=?,alamat=?,
        peserta_am=?,no_peserta=?,blanko=?,no_skl=?,no_skkb=?,jenis_kekhususan=?
        WHERE nisn=?`)
      const stmtFind = db.prepare('SELECT id FROM siswa WHERE nisn=?')
      let imported = 0, skipped = 0
      const tx = db.transaction(() => {
        normalizedRows.forEach((row, i) => {
          const nama = mapField(row,'nama','nama_lengkap','name')
          if (!nama) { skipped++; return }
          const no    = parseInt(mapField(row,'no','no_urut','nomor')) || (i + 1)
          const nisn  = mapField(row,'nisn') || null
          const jkRaw = mapField(row,'jenis_kelamin','jk','gender')
          const jk    = /^p/i.test(jkRaw) ? 'Perempuan' : 'Laki-laki'
          const vals = [
            no,
            mapField(row,'nism','nis','no_induk','no_nism') || null,
            nisn, nama, jk,
            mapField(row,'tempat_lahir','tempat_lahir_(yyyy-mm-dd)','tempat') || null,
            mapField(row,'tanggal_lahir_(yyyy-mm-dd)','tgl_lahir','tanggal_lahir') || null,
            mapField(row,'nama_ayah/wali','nama_ayah_wali','ortu','nama_ortu','orang_tua') || null,
            mapField(row,'nama_ibu') || null,
            mapField(row,'agama') || 'Islam',
            mapField(row,'kewarganegaraan') || 'Indonesia',
            mapField(row,'anak_ke-','anak_ke') || null,
            mapField(row,'asal_sekolah') || null,
            mapField(row,'tahun_masuk') || null,
            mapField(row,'kelas') || null,
            mapField(row,'no_hp_ortu','no_hp') || null,
            mapField(row,'alamat') || null,
            mapField(row,'no_peserta_am','peserta_am','no_peserta_am') || null,
            mapField(row,'no_peserta_ujian_sekolah','no_peserta') || null,
            mapField(row,'no_blanko_ijazah','blanko','no_blanko') || null,
            mapField(row,'no_skl','nomor_skl') || null,
            mapField(row,'no_skkb') || null,
            mapField(row,'jenis_kekhususan') || null
          ]
          // Kalau NISN ada dan sudah exist -> UPDATE, kalau tidak -> INSERT baru
          const existing = nisn ? stmtFind.get(nisn) : null
          if (existing) {
            // UPDATE: skip no_urut & nism & nisn (sudah di index 0,1,2), append id di akhir
            stmtUpdate.run(vals[0],vals[1],vals[3],vals[4],vals[5],vals[6],vals[7],vals[8],
              vals[9],vals[10],vals[11],vals[12],vals[13],vals[14],vals[15],vals[16],
              vals[17],vals[18],vals[19],vals[20],vals[21],vals[22], nisn)
          } else {
            stmtInsert.run(...vals)
          }
          imported++
        })
      })
      tx()
      return { ok: true, imported, skipped, message: `${imported} siswa berhasil diimport${skipped ? ', '+skipped+' dilewati (tidak ada nama)' : ''}` }
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
