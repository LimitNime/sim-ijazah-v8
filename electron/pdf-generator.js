/**
 * PDF Generator — SKL 1 halaman, Nilai Ijazah 1 halaman per siswa
 * Export Excel per angkatan mirip format rekap_nilai.pdf
 */
const path = require('path')
const fs   = require('fs')

function fmtTgl(tgl) {
  if (!tgl) return '-'
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni',
                  'Juli','Agustus','September','Oktober','November','Desember']
  try {
    const d = new Date(tgl)
    if (isNaN(d)) return tgl
    return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`
  } catch { return tgl }
}

function fmtN(v, dec = 2) {
  if (v == null || v === '') return '-'
  const n = parseFloat(v)
  return isNaN(n) ? '-' : dec === 0 ? String(Math.round(n)) : n.toFixed(dec)
}

// ══════════════════════════════════════════════════════════════════════════
//  HELPER UNIVERSAL: KOP sesuai referensi SMPIT Badrussalam
//  Logo kiri (fit proporsional, tidak terpotong), teks kanan bertingkat:
//    Baris 1 : Yayasan (bold kecil)
//    Baris 2 : Jenis sekolah (bold sedang)
//    Baris 3 : Nama singkat / nama BESAR (font ~20pt)
//    Baris 4 : NPSN  NSS  (bold kecil, sejajar)
//    Baris 5 : Alamat baris 1 (italic)
//    Baris 6 : Alamat baris 2 / kecamatan-kabupaten (italic, opsional)
//  Garis bawah: tebal (3pt) + tipis (1pt) selang 4pt
//  Kembalikan y setelah garis (siap untuk konten berikutnya)
// ══════════════════════════════════════════════════════════════════════════
function drawKopBadrussalam(doc, s, ml, cw, yStart) {
  const LOGO_SZ = 72   // ukuran kotak logo — proporsional, tidak terpotong
  const logoPath = s.logo_sekolah
  let y = yStart

  if (logoPath) {
    try {
      // fit: gambar masuk dalam kotak LOGO_SZ x LOGO_SZ, rasio terjaga
      doc.image(logoPath, ml, y, { fit: [LOGO_SZ, LOGO_SZ] })
    } catch (_) {
      // fallback: kotak abu jika gambar gagal
      doc.rect(ml, y, LOGO_SZ, LOGO_SZ).lineWidth(0.3).stroke('#ccc')
    }
  }

  const kopX = ml + LOGO_SZ + 12
  const kopW = cw - LOGO_SZ - 12
  let ky = y + 2  // mulai sedikit lebih rendah agar teks ter-center secara visual

  // Baris 1 — Yayasan
  if (s.yayasan) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#000')
      .text(s.yayasan.toUpperCase(), kopX, ky, { width: kopW, align: 'center' })
    ky += 11
  }

  // Baris 2 — Jenis Sekolah
  if (s.jenis_sekolah) {
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#000')
      .text(s.jenis_sekolah.toUpperCase(), kopX, ky, { width: kopW, align: 'center' })
    ky += 11
  }

  // Baris 3 — Nama singkat BESAR
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#000')
    .text((s.nama_singkat || s.nama || '').toUpperCase(), kopX, ky, { width: kopW, align: 'center' })
  ky += 23

  // Baris 4 — NPSN + NSS sejajar
  const npsn   = s.npsn ? `NPSN: ${s.npsn}` : ''
  const nss    = s.nss  ? `NSS : ${s.nss}`  : ''
  const baris4 = [npsn, nss].filter(Boolean).join('          ')
  if (baris4) {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000')
      .text(baris4, kopX, ky, { width: kopW, align: 'center' })
    ky += 10
  }

  // Baris 5 — Alamat baris 1 (italic)
  if (s.alamat) {
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#000')
      .text(s.alamat, kopX, ky, { width: kopW, align: 'center' })
    ky += 10
  }

  // Baris 6 — Alamat baris 2 / kecamatan (italic, opsional)
  if (s.alamat2) {
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#000')
      .text(s.alamat2, kopX, ky, { width: kopW, align: 'center' })
    ky += 10
  }

  // Garis bawah KOP — tebal + tipis (selang 4pt)
  const kopBottom = Math.max(ky + 4, y + LOGO_SZ + 4)
  doc.moveTo(ml, kopBottom).lineTo(ml + cw, kopBottom).lineWidth(3).stroke('#000')
  doc.moveTo(ml, kopBottom + 4).lineTo(ml + cw, kopBottom + 4).lineWidth(1).stroke('#000')

  return kopBottom + 16  // y siap konten
}

// Alias lama — agar kode lama yang masih pakai drawKopResmi tidak error
function drawKopResmi(doc, s, ml, cw) {
  return drawKopBadrussalam(doc, s, ml, cw, 20)
}

// ══════════════════════════════════════════════════════════════════════════
//  SKL — SURAT KETERANGAN LULUS
//  Desain: KOP + judul centered + biodata + paragraf + tabel nilai + TTD
// ══════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════
//  SKL SMP — KURIKULUM MERDEKA
//  - 2 kolom tabel: Mata Pelajaran | Nilai (pengetahuan saja, tanpa keterampilan)
//  - Tidak ada label "Kelompok A / B" di tabel, tapi Muatan Lokal dipisah
//    dengan baris sub-header italic tipis
//  - Paragraf pembuka gaya SMPIT Badrussalam
//  - Baris "Dinyatakan: LULUS" bold & centered sebelum tabel nilai
// ══════════════════════════════════════════════════════════════════════════
function generateSKL(outputPath, { sekolah: s, siswaList, mapelList, nilaiData, ujianSemId }) {
  const PDFDocument = require('pdfkit')
  const F4skl = [595.28, 841.89]
  const doc = new PDFDocument({ size: F4skl, margin: 0 })
  const filePath = path.join(outputPath, 'SKL_Kelulusan.pdf')
  doc.pipe(fs.createWriteStream(filePath))

  const pw = F4skl[0], ph = F4skl[1]
  const ml = 45, mr = 45, cw = pw - ml - mr

  function dotLine(x, y, w) {
    doc.save().dash(1, { space: 2 }).lineWidth(0.4).stroke('#000')
      .moveTo(x, y).lineTo(x + w, y).stroke().undash().restore()
  }

  const __electronDir = path.dirname(__filename)
  const TUT_WURI_PATH = path.join(__electronDir, 'assets', 'tut_wuri.png')

  // Pisahkan mapel: Muatan Lokal (kelompok === 'B') vs umum (kelompok 'A' atau kosong)
  // Keduanya ditampilkan tanpa label kelompok kecuali sub-header "Muatan Lokal"
  const mapelUmum   = mapelList.filter(m => m.kelompok !== 'B')
  const mapelMulok  = mapelList.filter(m => m.kelompok === 'B')
  const hasMulok    = mapelMulok.length > 0

  siswaList.forEach((siswa, idx) => {
    if (idx > 0) doc.addPage()

    // ════════════════════════════════════════════════════════════════════
    // KOP — sesuai referensi SMPIT Badrussalam (fungsi terpusat)
    // ════════════════════════════════════════════════════════════════════
    let y = drawKopBadrussalam(doc, s, ml, cw, 18)

    // ════════════════════════════════════════════════════════════════════
    // JUDUL
    // ════════════════════════════════════════════════════════════════════
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#000')
      .text('SURAT KETERANGAN LULUS', ml, y, { width: cw, align: 'center', underline: true })
    y += 14
    doc.font('Helvetica').fontSize(9.5)
      .text(`Nomor : ${siswa.no_skl || '...................................................'}`, ml, y, { width: cw, align: 'center' })
    y += 22

    // ════════════════════════════════════════════════════════════════════
    // PARAGRAF PEMBUKA — sesuai template asli SKL SMPIT Badrussalam
    // ════════════════════════════════════════════════════════════════════
    const tglSk    = fmtTgl(s.tgl_lulus)
    const tglRapat = s.tgl_rapat ? fmtTgl(s.tgl_rapat) : (s.tgl_lulus ? tglSk : '.....................')
    const pembukaText = `Berdasarkan hasil rapat Dewan Guru yang dilaksankan tanggal ${tglRapat}, dan setelah dipastikan bahwa seluruh kriteria kelulusan telah terpenuhi sesuai dengan peraturan perundang undangan, Kepala ${s.nama || ''} Kabupaten ${s.kabupaten || 'Cirebon'} menerangkan Bahwa:`
    doc.font('Helvetica').fontSize(10).fillColor('#000')
      .text(pembukaText, ml, y, { width: cw, align: 'justify' })
    y += doc.heightOfString(pembukaText, { width: cw }) + 10

    // ════════════════════════════════════════════════════════════════════
    // BIODATA — sesuai template asli: Nama Lengkap, No Peserta, Tgl Kelulusan
    // ════════════════════════════════════════════════════════════════════
    const lblX = ml + 4
    const sepX = ml + 170
    const valX = sepX + 6
    const valW = cw - 170 - 6

    function bioRow(label, value) {
      doc.font('Helvetica').fontSize(9.5).fillColor('#000')
        .text(label, lblX, y, { width: 165, lineBreak: false })
        .text(':', sepX, y, { width: 5, lineBreak: false })
      if (value) {
        doc.text(value, valX, y, { width: valW, lineBreak: false })
      } else {
        dotLine(valX, y + 10, valW)
      }
      y += 13
    }

    bioRow('Nama Lengkap',               siswa.nama || '')
    bioRow('Tempat, Tanggal Lahir',      siswa.tempat_lahir ? `${siswa.tempat_lahir}, ${fmtTgl(siswa.tgl_lahir)}` : '')
    bioRow('Nomor Induk Siswa',          siswa.nism || '')
    bioRow('Nomor Induk Siswa Nasional', siswa.nisn || '')
    bioRow('Nomor Peserta Ujian Sekolah',siswa.no_peserta || '')
    bioRow('Tanggal Kelulusan',          s.tgl_lulus ? tglSk : '')

    // Dinyatakan — label rata kiri, titik dua sejajar, lalu baris LULUS besar
    doc.font('Helvetica').fontSize(9.5).fillColor('#000')
      .text('Dinyatakan', lblX, y, { width: 165, lineBreak: false })
      .text(':', sepX, y, { width: 5, lineBreak: false })
    y += 10

    // ════════════════════════════════════════════════════════════════════
    // LULUS — heading besar centered
    // ════════════════════════════════════════════════════════════════════
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#000')
      .text('LULUS', ml, y, { width: cw, align: 'center' })
    y += 22

    const subPara = `Dari ${s.nama || ''} Tahun Pelajaran ${s.tahun_ajaran || ''} dengan memperoleh nilai sebagai berikut :`
    doc.font('Helvetica').fontSize(10)
      .text(subPara, ml, y, { width: cw })
    y += doc.heightOfString(subPara, { width: cw }) + 6

    // ════════════════════════════════════════════════════════════════════
    // TABEL NILAI — 2 kolom: NO | MATA PELAJARAN | NILAI
    // Nilai = nilai pengetahuan (nilai_ujian), tanpa keterampilan
    // Muatan Lokal dipisah sub-header italic, tanpa label Kelompok A/B
    // ════════════════════════════════════════════════════════════════════
    const noW    = 28
    const nilW   = 55   // kolom Nilai (pengetahuan)
    const mpW    = cw - noW - nilW
    const hdrH   = 18   // header 1 baris
    const rowH   = 14   // baris data
    const grpH   = 13   // baris sub-header Muatan Lokal
    const tblTop = y

    // ── Header ────────────────────────────────────────────────────────
    doc.rect(ml, y, cw, hdrH).lineWidth(0.7).stroke('#000')
    doc.moveTo(ml + noW,        y).lineTo(ml + noW,        y + hdrH).lineWidth(0.5).stroke('#000')
    doc.moveTo(ml + noW + mpW,  y).lineTo(ml + noW + mpW,  y + hdrH).lineWidth(0.5).stroke('#000')
    const hcy = y + (hdrH - 9) / 2
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#000')
      .text('NO',             ml,             hcy, { width: noW,  align: 'center' })
      .text('MATA PELAJARAN', ml + noW,       hcy, { width: mpW,  align: 'center' })
      .text('NILAI',          ml + noW + mpW, hcy, { width: nilW, align: 'center' })
    y += hdrH

    // ── Helper: satu baris data ────────────────────────────────────────
    function drawDataRow(noStr, namaMapel, nilaiStr) {
      const tY = y + 3
      doc.rect(ml, y, cw, rowH).lineWidth(0.5).stroke('#000')
      doc.moveTo(ml + noW,       y).lineTo(ml + noW,       y + rowH).lineWidth(0.4).stroke('#000')
      doc.moveTo(ml + noW + mpW, y).lineTo(ml + noW + mpW, y + rowH).lineWidth(0.4).stroke('#000')
      doc.font('Helvetica').fontSize(9).fillColor('#000')
        .text(noStr,     ml + 2,        tY, { width: noW - 4,  align: 'center' })
        .text(namaMapel, ml + noW + 3,  tY, { width: mpW - 6 })
      if (nilaiStr) doc.text(nilaiStr, ml + noW + mpW + 2, tY, { width: nilW - 4, align: 'center' })
      y += rowH
    }

    // ── Helper: baris sub-header (Muatan Lokal) ────────────────────────
    function drawSubHeader(label) {
      doc.rect(ml, y, cw, grpH).lineWidth(0.5).stroke('#000')
      doc.moveTo(ml + noW,       y).lineTo(ml + noW,       y + grpH).lineWidth(0.4).stroke('#000')
      doc.moveTo(ml + noW + mpW, y).lineTo(ml + noW + mpW, y + grpH).lineWidth(0.4).stroke('#000')
      doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#000')
        .text(label, ml + noW + 3, y + 2, { width: cw - noW - 6 })
      y += grpH
    }

    // ── Kumpulkan semua nilai ujian untuk rata-rata ────────────────────
    let allNilai = []

    // Mapel Umum (A) — nilai desimal 2 angka sesuai template asli
    let noCounter = 1
    mapelUmum.forEach((m) => {
      const nr  = (nilaiData[siswa.id] || []).find(n => n.mapel_id === m.id && n.semester_id === ujianSemId)
      const val = nr && nr.nilai_ujian != null ? fmtN(nr.nilai_ujian, 2) : ''
      if (val !== '') allNilai.push(parseFloat(val))
      drawDataRow(String(noCounter++), m.nama || '', val)
    })

    // Muatan Lokal (B) — didahului sub-header italic tipis
    if (hasMulok) {
      drawSubHeader('Muatan Lokal')
      mapelMulok.forEach((m) => {
        const nr  = (nilaiData[siswa.id] || []).find(n => n.mapel_id === m.id && n.semester_id === ujianSemId)
        const val = nr && nr.nilai_ujian != null ? fmtN(nr.nilai_ujian, 2) : ''
        if (val !== '') allNilai.push(parseFloat(val))
        drawDataRow(String(noCounter++), m.nama || '', val)
      })
    }

    // ── Baris Rata-rata — desimal 2 angka ─────────────────────────────
    const avg    = allNilai.length ? (allNilai.reduce((a, b) => a + b, 0) / allNilai.length) : null
    const avgStr = avg != null ? avg.toFixed(2) : ''

    doc.rect(ml, y, cw, rowH + 2).lineWidth(0.7).stroke('#000')
    doc.moveTo(ml + noW + mpW, y).lineTo(ml + noW + mpW, y + rowH + 2).lineWidth(0.5).stroke('#000')
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#000')
      .text('Rata-rata', ml + noW + 2, y + 3, { width: mpW - 4, align: 'center' })
    if (avgStr) doc.text(avgStr, ml + noW + mpW + 2, y + 3, { width: nilW - 4, align: 'center' })

    // Border luar tabel
    doc.moveTo(ml,      tblTop).lineTo(ml,      y + rowH + 2).lineWidth(0.7).stroke('#000')
    doc.moveTo(ml + cw, tblTop).lineTo(ml + cw, y + rowH + 2).lineWidth(0.7).stroke('#000')
    y += rowH + 2 + 10

    // ════════════════════════════════════════════════════════════════════
    // PARAGRAF PENUTUP — sesuai template asli
    // ════════════════════════════════════════════════════════════════════
    const penutupText = 'Demikan surat keterangan ini dibuat dengan sebenarnya untuk diketahui dan dipergunakan sebagaimana mestinya, dan bersifat/berlaku sementara sampai dengan diterbitkannya ijazah sebagai bukti kelulusan.'
    doc.font('Helvetica').fontSize(10).fillColor('#000')
      .text(penutupText, ml, y, { width: cw, align: 'justify' })
    y += doc.heightOfString(penutupText, { width: cw }) + 16

    // ════════════════════════════════════════════════════════════════════
    // TTD KEPALA — kanan, garis lebih lebar, nama bold + underline
    // ════════════════════════════════════════════════════════════════════
    const ttdX    = pw / 2 + 10
    const ttdW    = pw - mr - ttdX
    const tglStr  = s.tgl_lulus ? tglSk : '...................'
    const kotaStr = s.kota || '.....................'

    doc.font('Helvetica').fontSize(9.5).fillColor('#000')
      .text(`${kotaStr}, ${tglStr}`, ttdX, y, { width: ttdW, align: 'center' })
    y += 12
    doc.text('Kepala Sekolah,', ttdX, y, { width: ttdW, align: 'center' })
    y += 85  // 3cm ruang tanda tangan

    const namaKepalaSkl = s.kepala ? s.kepala.toUpperCase() : ''
    const garisW = Math.min(ttdW - 10, Math.max(80, namaKepalaSkl.length * 5.8))
    const garisX = ttdX + (ttdW - garisW) / 2
    doc.moveTo(garisX, y).lineTo(garisX + garisW, y).lineWidth(0.7).stroke('#000')
    if (namaKepalaSkl) {
      doc.font('Helvetica-Bold').fontSize(9.5)
        .text(namaKepalaSkl, ttdX, y - 15, { width: ttdW, align: 'center', underline: true })
    }
    y += 4
    doc.font('Helvetica').fontSize(9)
      .text(`NIP. ${s.nip || '-'}`, ttdX, y, { width: ttdW, align: 'center' })
  })

  doc.end()
  return filePath
}


function generateNilaiIjazah(outputPath, { sekolah: s, siswaList, mapelList, nilaiData, ujianSemId, raportSemIds, br, bu, totalB }) {
  const PDFDocument = require('pdfkit')
  const F4ni = [595.28, 841.89]
  const doc = new PDFDocument({ size: F4ni, margin: 0 })
  const filePath = path.join(outputPath, 'Nilai_Ijazah_Semua.pdf')
  doc.pipe(fs.createWriteStream(filePath))

  const pw = F4ni[0], ph = F4ni[1]
  const ml = 45, mr = 45, cw = pw - ml - mr
  const mb = 24

  function dotLineGray(x, y, w) {
    doc.save().dash(1,{space:2}).lineWidth(0.4).stroke('#555')
      .moveTo(x,y).lineTo(x+w,y).stroke().undash().restore()
  }

  function calcNij(siswaId, mapelId) {
    const nils = nilaiData[siswaId] || []
    const raps = nils.filter(n => raportSemIds.includes(n.semester_id)
      && n.nilai_p != null && n.mapel_id === mapelId)
    if (!raps.length) return { raport: null, ujian: null, nij: null }
    const raport = raps.reduce((a,r) => a + parseFloat(r.nilai_p), 0) / raps.length
    const um = nils.find(n => n.mapel_id === mapelId && n.semester_id === ujianSemId && n.nilai_ujian != null)
    const ujian = um ? parseFloat(um.nilai_ujian) : null
    const nij = ujian != null ? (raport * br + ujian * bu) / totalB : null
    return { raport, ujian, nij }
  }

  siswaList.forEach((siswa, idx) => {
    if (idx > 0) doc.addPage()

    // ════════════════════════════════════════════════════════════════════
    // KOP + JUDUL — sesuai referensi SMPIT Badrussalam
    // ════════════════════════════════════════════════════════════════════
    let y = drawKopBadrussalam(doc, s, ml, cw, 18)
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#000')
      .text('DAFTAR NILAI', ml, y, { width: cw, align: 'center' })
    y += 14
    doc.font('Helvetica-Bold').fontSize(10)
      .text(`TAHUN PELAJARAN ${s.tahun_ajaran || ''}`, ml, y, { width: cw, align: 'center' })
    y += 18

    // ════════════════════════════════════════════════════════════════════
    // BIODATA — 4 baris, label kiri, titik dua, garis titik kanan
    // ════════════════════════════════════════════════════════════════════
    const sepX = ml + 148
    const valX = sepX + 6
    const valW = cw - 148 - 6

    function bioRow(label, value) {
      doc.font('Helvetica').fontSize(10).fillColor('#000')
        .text(label, ml, y, { width: 144, lineBreak: false })
        .text(':', sepX, y, { width: 5, lineBreak: false })
      dotLineGray(valX, y + 11, valW)
      if (value) doc.text(value, valX + 2, y, { width: valW - 4, lineBreak: false })
      y += 15
    }

    bioRow('Nama',                       siswa.nama || '')
    bioRow('Tempat dan Tanggal Lahir',   siswa.tempat_lahir ? `${siswa.tempat_lahir}, ${fmtTgl(siswa.tgl_lahir)}` : '')
    bioRow('Nomor Induk Siswa',          siswa.nism || '')
    bioRow('Nomor Induk Siswa Nasional', siswa.nisn || '')
    y += 8

    // ════════════════════════════════════════════════════════════════════
    // TABEL NILAI — 4 kolom:
    // No | Mata Pelajaran (Kurikulum) | Nilai Rata-rata Rapor | Nilai Ujian Sekolah
    // Dengan sub-header Kelompok A / Kelompok B
    // rowH kecil ~14pt
    // ════════════════════════════════════════════════════════════════════
    const noW    = 28
    const nilR   = 58   // Nilai Rata-rata Rapor
    const nilU   = 58   // Nilai Ujian Sekolah
    const nilIj  = 58   // Nilai Ijazah
    const mpW    = cw - noW - nilR - nilU - nilIj
    const hdrH   = 28   // header 2 baris
    const rowH   = 14
    const grpH   = 14   // tinggi baris kelompok (sub-header)
    const tblTop = y

    // ── Header ────────────────────────────────────────────────────────
    doc.rect(ml, y, cw, hdrH).lineWidth(0.7).stroke('#000')
    doc.moveTo(ml+noW,                    y).lineTo(ml+noW,                    y+hdrH).lineWidth(0.5).stroke('#000')
    doc.moveTo(ml+noW+mpW,                y).lineTo(ml+noW+mpW,                y+hdrH).lineWidth(0.5).stroke('#000')
    doc.moveTo(ml+noW+mpW+nilR,           y).lineTo(ml+noW+mpW+nilR,           y+hdrH).lineWidth(0.5).stroke('#000')
    doc.moveTo(ml+noW+mpW+nilR+nilU,      y).lineTo(ml+noW+mpW+nilR+nilU,      y+hdrH).lineWidth(0.5).stroke('#000')

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000')
      .text('No.',                    ml,                       y+9,  { width: noW,   align: 'center' })
      .text('Mata Pelajaran',         ml+noW,                   y+3,  { width: mpW,   align: 'center' })
      .text(`(${s.kurikulum||'Kurikulum Merdeka'})`, ml+noW,    y+13, { width: mpW,   align: 'center' })
      .text('Nilai Rata-rata',        ml+noW+mpW,               y+3,  { width: nilR,  align: 'center' })
      .text('Rapor',                  ml+noW+mpW,               y+13, { width: nilR,  align: 'center' })
      .text('Nilai Ujian',            ml+noW+mpW+nilR,          y+3,  { width: nilU,  align: 'center' })
      .text('Sekolah',                ml+noW+mpW+nilR,          y+13, { width: nilU,  align: 'center' })
      .text('Nilai',                  ml+noW+mpW+nilR+nilU,     y+3,  { width: nilIj, align: 'center' })
      .text('Ijazah',                 ml+noW+mpW+nilR+nilU,     y+13, { width: nilIj, align: 'center' })
    y += hdrH

    // ── Baris data dengan kelompok ────────────────────────────────────
    const mapelA = mapelList.filter(m => m.kelompok === 'A' || !m.kelompok)
    const mapelB = mapelList.filter(m => m.kelompok === 'B')
    const hasKelompok = mapelList.some(m => m.kelompok)

    let allNij = [], noCounter = 0

    function drawRow(m, noStr, isGroup = false) {
      const tY = y + 3
      const rH = isGroup ? grpH : rowH
      doc.rect(ml, y, cw, rH).lineWidth(0.5).stroke('#000')
      doc.moveTo(ml+noW,               y).lineTo(ml+noW,               y+rH).lineWidth(0.4).stroke('#000')
      doc.moveTo(ml+noW+mpW,           y).lineTo(ml+noW+mpW,           y+rH).lineWidth(0.4).stroke('#000')
      doc.moveTo(ml+noW+mpW+nilR,      y).lineTo(ml+noW+mpW+nilR,      y+rH).lineWidth(0.4).stroke('#000')
      doc.moveTo(ml+noW+mpW+nilR+nilU, y).lineTo(ml+noW+mpW+nilR+nilU, y+rH).lineWidth(0.4).stroke('#000')

      if (isGroup) {
        // Baris kelompok — span penuh, italic
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#000')
          .text(noStr, ml+noW+3, tY, { width: cw-noW-6 })
        y += grpH
        return
      }

      const { raport, ujian, nij } = calcNij(siswa.id, m.id)
      if (nij != null) allNij.push(nij)

      doc.font('Helvetica').fontSize(9).fillColor('#000')
        .text(noStr, ml+2, tY, { width: noW-4, align: 'center' })
        .text(m.nama || '', ml+noW+3, tY, { width: mpW-6 })
      if (raport != null) doc.text(raport.toFixed(2), ml+noW+mpW+2,          tY, { width: nilR-4,  align: 'center' })
      if (ujian  != null) doc.text(ujian.toFixed(2),  ml+noW+mpW+nilR+2,     tY, { width: nilU-4,  align: 'center' })
      if (nij    != null) doc.text(nij.toFixed(2),    ml+noW+mpW+nilR+nilU+2, tY, { width: nilIj-4, align: 'center' })
      y += rowH
    }

    // Selalu pakai nomor urut biasa tanpa label Kelompok A/B
    mapelList.forEach((m, i) => { drawRow(m, `${i+1}.`) })

    // Baris Rata-rata
    const rata = allNij.length ? (allNij.reduce((a,b)=>a+b,0)/allNij.length) : null
    doc.rect(ml, y, cw, rowH+2).lineWidth(0.7).stroke('#000')
    doc.moveTo(ml+noW+mpW,               y).lineTo(ml+noW+mpW,               y+rowH+2).lineWidth(0.5).stroke('#000')
    doc.moveTo(ml+noW+mpW+nilR,          y).lineTo(ml+noW+mpW+nilR,          y+rowH+2).lineWidth(0.5).stroke('#000')
    doc.moveTo(ml+noW+mpW+nilR+nilU,     y).lineTo(ml+noW+mpW+nilR+nilU,     y+rowH+2).lineWidth(0.5).stroke('#000')
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#000')
      .text('Rata-rata', ml+noW+2, y+3, { width: mpW-4, align: 'center' })
    if (rata != null) {
      doc.text(rata.toFixed(2), ml+noW+mpW+nilR+nilU+2, y+3, { width: nilIj-4, align: 'center' })
    }

    // Border luar tabel
    doc.moveTo(ml, tblTop).lineTo(ml, y+rowH+2).lineWidth(0.7).stroke('#000')
    doc.moveTo(ml+cw, tblTop).lineTo(ml+cw, y+rowH+2).lineWidth(0.7).stroke('#000')
    y += rowH + 2 + 22

    // ════════════════════════════════════════════════════════════════════
    // TTD KEPALA — kanan, garis pendek
    // ════════════════════════════════════════════════════════════════════
    const tglSk = fmtTgl(s.tgl_lulus)
    const ttdX  = pw / 2 + 10
    const ttdW  = pw - mr - ttdX

    const kotaStr  = s.kota  || '.....................'
    const tglStr   = s.tgl_lulus ? tglSk : '...................'
    doc.font('Helvetica').fontSize(9.5).fillColor('#000')
      .text(`${kotaStr}, ${tglStr}`, ttdX, y, { width: ttdW, align: 'center' })
    y += 12
    doc.text(`Kepala ${s.nama || ''}`, ttdX, y, { width: ttdW, align: 'center' })
    y += 85  // 3cm ruang tanda tangan

    const namaKepalaNi = s.kepala ? s.kepala.toUpperCase() : ''
    const garisWni = Math.min(ttdW - 10, Math.max(80, namaKepalaNi.length * 5.8))
    const garisXni = ttdX + (ttdW - garisWni) / 2
    doc.moveTo(garisXni, y).lineTo(garisXni+garisWni, y).lineWidth(0.7).stroke('#000')
    if (namaKepalaNi) {
      doc.font('Helvetica-Bold').fontSize(9.5)
        .text(namaKepalaNi, ttdX, y-15, { width: ttdW, align: 'center', underline: true })
    }
    y += 5
    doc.font('Helvetica').fontSize(9)
      .text(`NIP. ${s.nip || ''}`, ttdX, y, { width: ttdW, align: 'center' })
  })

  doc.end()
  return filePath
}

function generateDKN(outputPath, { sekolah: s, siswaList, mapelList, nilaiData, ujianSemId, raportSemIds, br, bu, totalB }) {
  const PDFDocument = require('pdfkit')
  // F4 landscape = 330mm x 215mm → dalam pt
  const F4L = [841.89, 595.28]
  const doc = new PDFDocument({ size: F4L, margin: 0 })
  const filePath = path.join(outputPath, 'DKN_Lengkap.pdf')
  doc.pipe(fs.createWriteStream(filePath))

  const pw = F4L[0], ph = F4L[1]
  const ml = 25, mr = 25, mt = 20, mb = 20
  const cw = pw - ml - mr

  function calcNij(siswaId, mapelId) {
    const nils = nilaiData[siswaId] || []
    const raps = nils.filter(n => raportSemIds.includes(n.semester_id) && n.nilai_p != null && n.mapel_id === mapelId)
    if (!raps.length) return null
    const raport = raps.reduce((a, r) => a + parseFloat(r.nilai_p), 0) / raps.length
    const um = nils.find(n => n.mapel_id === mapelId && n.semester_id === ujianSemId && n.nilai_ujian != null)
    if (!um) return null
    return (raport * br + parseFloat(um.nilai_ujian) * bu) / totalB
  }

  // ── KOP landscape — pakai drawKopBadrussalam ──────────────────────────
  let y = drawKopBadrussalam(doc, s, ml, cw, mt)

  // ── JUDUL ─────────────────────────────────────────────────────────────
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#000')
    .text('DAFTAR KUMPULAN NILAI (DKN)', ml, y, { width: cw, align: 'center' })
  y += 13
  doc.font('Helvetica').fontSize(9)
    .text(`Tahun Pelajaran ${s.tahun_ajaran || ''}`, ml, y, { width: cw, align: 'center' })
  y += 14

  // ── HITUNG LEBAR KOLOM ────────────────────────────────────────────────
  const n      = mapelList.length
  const noW    = 24
  const namaW  = 120
  const nisnW  = 68
  const rataW  = 46
  const sisaW  = cw - noW - namaW - nisnW - rataW
  // Lebar kolom nilai per mapel (minimal 26pt)
  const mW      = Math.max(26, Math.floor(sisaW / Math.max(n, 1)))
  const hdrH    = 28    // tinggi header 2 baris
  const ttdResv = 145   // ruang TTD di bawah tabel (3cm = 85pt + teks)
  const rowH    = Math.max(14, Math.floor((ph - mb - ttdResv - y - hdrH) / Math.max(siswaList.length, 1)))
  const clampedRowH = Math.min(Math.max(rowH, 14), 20)  // 14-20pt, proporsional di landscape

  // ── HEADER TABEL ──────────────────────────────────────────────────────
  const tblTop = y

  // Kotak header
  doc.rect(ml, y, cw, hdrH).lineWidth(0.7).stroke('#000')

  // Garis vertikal header
  let xh = ml
  for (const w of [noW, namaW, nisnW]) {
    xh += w
    doc.moveTo(xh, y).lineTo(xh, y + hdrH).lineWidth(0.5).stroke('#000')
  }
  mapelList.forEach(() => {
    xh += mW
    doc.moveTo(xh, y).lineTo(xh, y + hdrH).lineWidth(0.5).stroke('#000')
  })
  // Rata-rata
  doc.moveTo(xh, y).lineTo(xh, y + hdrH).lineWidth(0.5).stroke('#000')

  // Teks header
  const hTextY = y + (hdrH - 9) / 2
  xh = ml
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#000')
    .text('No',          xh + 1, hTextY, { width: noW - 2,   align: 'center' }); xh += noW
  doc.text('Nama Siswa', xh + 2, hTextY, { width: namaW - 4, align: 'center' }); xh += namaW
  doc.text('NISN',       xh + 1, hTextY, { width: nisnW - 2, align: 'center' }); xh += nisnW

  mapelList.forEach((m, i) => {
    // Nama mapel disingkat agar muat
    const maxLen = Math.floor(mW / 4.5)
    const label  = m.nama.length > maxLen ? m.nama.slice(0, maxLen - 1) + '.' : m.nama
    doc.font('Helvetica-Bold').fontSize(6.5)
      .text(label, xh + 1, y + 2, { width: mW - 2, align: 'center' })
    // Nomor urut mapel di bawah nama
    doc.font('Helvetica').fontSize(6)
      .text(`(${i + 1})`, xh + 1, y + hdrH - 10, { width: mW - 2, align: 'center' })
    xh += mW
  })
  doc.font('Helvetica-Bold').fontSize(8)
    .text('Rata', xh + 1, hTextY, { width: rataW - 2, align: 'center' })

  y += hdrH

  // ── BARIS DATA SISWA ──────────────────────────────────────────────────
  siswaList.forEach((siswa, i) => {
    if (y + clampedRowH > ph - mb) {
      // Halaman baru — ulangi header singkat
      doc.addPage()
      y = mt
      doc.font('Helvetica').fontSize(7).fillColor('#888')
        .text(`${s.nama || ''} — DKN (lanjutan)`, ml, y, { width: cw, align: 'center' })
      y += 12
    }

    // Border baris
    doc.rect(ml, y, cw, clampedRowH).lineWidth(0.5).stroke('#000')

    // Garis vertikal baris
    let xv = ml
    for (const w of [noW, namaW, nisnW]) {
      xv += w
      doc.moveTo(xv, y).lineTo(xv, y + clampedRowH).lineWidth(0.4).stroke('#000')
    }
    mapelList.forEach(() => {
      xv += mW
      doc.moveTo(xv, y).lineTo(xv, y + clampedRowH).lineWidth(0.4).stroke('#000')
    })
    doc.moveTo(xv, y).lineTo(xv, y + clampedRowH).lineWidth(0.4).stroke('#000')

    // Isi baris
    const tY = y + Math.max(2, (clampedRowH - 9) / 2)
    let x = ml
    doc.font('Helvetica').fontSize(8).fillColor('#000')
      .text(String(siswa.no_urut || i + 1), x + 1, tY, { width: noW - 2, align: 'center' }); x += noW
    doc.font('Helvetica-Bold').fontSize(7.5)
      .text(siswa.nama || '', x + 2, tY, { width: namaW - 4 }); x += namaW
    doc.font('Helvetica').fontSize(7.5)
      .text(siswa.nisn || '-', x + 1, tY, { width: nisnW - 2, align: 'center' }); x += nisnW

    let sumNij = 0, cntNij = 0
    mapelList.forEach(m => {
      const nij = calcNij(siswa.id, m.id)
      if (nij != null) { sumNij += nij; cntNij++ }
      doc.font('Helvetica').fontSize(8)
        .text(nij != null ? nij.toFixed(1) : '-', x + 1, tY, { width: mW - 2, align: 'center' })
      x += mW
    })

    const rata = cntNij > 0 ? (sumNij / cntNij).toFixed(2) : '-'
    doc.font('Helvetica-Bold').fontSize(8)
      .text(rata, x + 1, tY, { width: rataW - 2, align: 'center' })

    y += clampedRowH
  })

  // Garis bawah tabel (hanya garis horizontal bawah — vertikal sudah per baris)
  doc.moveTo(ml, y).lineTo(ml + cw, y).lineWidth(0.7).stroke('#000')

  // ── TTD (pojok kanan bawah) ───────────────────────────────────────────
  // Jika tidak cukup ruang untuk TTD di halaman ini, pindah ke halaman baru
  if (y + 145 > ph - mb) {
    doc.addPage()
    y = mt
  }
  y += 16
  const tglSk = fmtTgl(s.tgl_lulus)
  const ttdX  = pw - mr - 210
  const ttdW  = 210

  doc.font('Helvetica').fontSize(9.5).fillColor('#000')
    .text(`${s.kota || ''}, ${tglSk}`, ttdX, y, { width: ttdW, align: 'center' })
  y += 13
  doc.text(`Kepala ${s.nama || ''}`, ttdX, y, { width: ttdW, align: 'center' })
  y += 85  // 3cm ruang tanda tangan
  const namaKepalaDkn = s.kepala ? s.kepala.toUpperCase() : ''
  const garisWdkn = Math.min(ttdW - 10, Math.max(80, namaKepalaDkn.length * 5.8))
  const garisXdkn = ttdX + (ttdW - garisWdkn) / 2
  doc.moveTo(garisXdkn, y).lineTo(garisXdkn + garisWdkn, y).lineWidth(0.7).stroke('#000')
  if (namaKepalaDkn) {
    doc.font('Helvetica-Bold').fontSize(9.5)
      .text(namaKepalaDkn, ttdX, y - 16, { width: ttdW, align: 'center', underline: true })
  }
  y += 6
  doc.font('Helvetica').fontSize(9)
    .text(`NIP. ${s.nip || ''}`, ttdX, y, { width: ttdW, align: 'center' })

  doc.end()
  return filePath
}


function exportExcelAngkatan(outputPath, { sekolah: s, angkatan, siswaList, mapelList, semList, nilaiData, ujianSemId, raportSemIds, br, bu, totalB }) {
  const XLSX = require('xlsx')

  const wb = XLSX.utils.book_new()
  const raportSems = semList.filter(sm => raportSemIds.includes(sm.id))
  const nSem = raportSems.length

  // ── Sheet 1: REKAP AKHIR (mirip halaman terakhir PDF) ──────────────────
  const rekapRows = []

  // Header baris 1
  const hdr1 = ['NO', 'NAMA SISWA']
  mapelList.forEach(m => { hdr1.push(m.nama); for(let i=1;i<nSem;i++) hdr1.push('') })
  hdr1.push('JUMLAH', 'RATA-RATA')
  rekapRows.push(hdr1)

  // Header baris 2: sub-header semester
  const hdr2 = ['', '']
  mapelList.forEach(() => {
    raportSems.forEach((sm, i) => hdr2.push(`SMT ${i+1}`))
  })
  hdr2.push('', '')
  rekapRows.push(hdr2)

  // Data siswa
  siswaList.forEach((siswa, i) => {
    const row = [i+1, siswa.nama||'']
    const nils = nilaiData[siswa.id] || []
    let jumlah = 0, cnt = 0

    mapelList.forEach(m => {
      raportSems.forEach(sm => {
        const n = nils.find(n => n.mapel_id===m.id && n.semester_id===sm.id)
        if (n && n.nilai_p!=null) {
          const val = parseFloat(n.nilai_p)
          row.push(parseFloat(val.toFixed(2))); jumlah+=val; cnt++
        } else {
          row.push('')
        }
      })
    })

    row.push(cnt>0 ? parseFloat(jumlah.toFixed(2)) : '')
    row.push(cnt>0 ? parseFloat((jumlah/cnt).toFixed(2)) : '')
    rekapRows.push(row)
  })

  const wsRekap = XLSX.utils.aoa_to_sheet(rekapRows)

  // Merge header mapel
  if (!wsRekap['!merges']) wsRekap['!merges'] = []
  let col = 2
  mapelList.forEach(m => {
    if (nSem > 1) {
      wsRekap['!merges'].push({ s:{r:0,c:col}, e:{r:0,c:col+nSem-1} })
    }
    col += nSem
  })

  // Lebar kolom
  const wscols = [{ wch:5 }, { wch:30 }]
  mapelList.forEach(() => { raportSems.forEach(() => wscols.push({ wch:8 })) })
  wscols.push({ wch:10 }, { wch:12 })
  wsRekap['!cols'] = wscols
  wsRekap['!freeze'] = { xSplit: 2, ySplit: 2 }

  XLSX.utils.book_append_sheet(wb, wsRekap, 'Rekap Nilai')

  // ── Sheet 2: PER MAPEL (satu sheet tiap mapel, mirip halaman 6-18 PDF) ──
  mapelList.forEach(m => {
    const rows = []

    // Header
    const hm = ['NO', 'NAMA']
    raportSems.forEach((sm, i) => hm.push(`SMT ${i+1}`))
    hm.push('Rata Raport', 'Nilai UM', 'Nilai Ijazah')
    rows.push(hm)

    siswaList.forEach((siswa, i) => {
      const row = [i+1, siswa.nama||'']
      const nils = nilaiData[siswa.id]||[]
      const raps = []

      raportSems.forEach(sm => {
        const n = nils.find(n => n.mapel_id===m.id && n.semester_id===sm.id)
        if (n && n.nilai_p!=null) {
          const val = parseFloat(n.nilai_p)
          row.push(parseFloat(val.toFixed(2))); raps.push(val)
        } else { row.push('') }
      })

      const rataRap = raps.length ? raps.reduce((a,b)=>a+b,0)/raps.length : null
      const umRow = nils.find(n => n.mapel_id===m.id && n.semester_id===ujianSemId)
      const um = umRow && umRow.nilai_ujian!=null ? parseFloat(umRow.nilai_ujian) : null
      const nij = rataRap!=null && um!=null ? (rataRap*br+um*bu)/totalB : null

      row.push(rataRap!=null ? parseFloat(rataRap.toFixed(2)) : '')
      row.push(um!=null ? um : '')
      row.push(nij!=null ? parseFloat(nij.toFixed(2)) : '')
      rows.push(row)
    })

    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wc = [{ wch:5 }, { wch:30 }]
    raportSems.forEach(() => wc.push({ wch:8 }))
    wc.push({ wch:12 }, { wch:10 }, { wch:12 })
    ws['!cols'] = wc
    ws['!freeze'] = { xSplit: 2, ySplit: 1 }

    // Nama sheet maks 31 karakter
    const sheetName = m.nama.length > 28 ? m.nama.slice(0,28)+'.' : m.nama
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  })

  // ── Sheet 3: REKAP NILAI IJAZAH ────────────────────────────────────────
  const nijRows = [['NO', 'NAMA SISWA', 'NISN', ...mapelList.map(m=>m.nama), 'RATA-RATA']]
  siswaList.forEach((siswa, i) => {
    const row = [i+1, siswa.nama||'', siswa.nisn||'-']
    const nils = nilaiData[siswa.id]||[]
    let sum=0, cnt=0
    mapelList.forEach(m => {
      const raps = nils.filter(n=>raportSemIds.includes(n.semester_id)&&n.nilai_p!=null&&n.mapel_id===m.id)
      const raport = raps.length ? raps.reduce((a,r)=>a+parseFloat(r.nilai_p),0)/raps.length : null
      const um = nils.find(n=>n.mapel_id===m.id&&n.semester_id===ujianSemId&&n.nilai_ujian!=null)
      const nij = raport!=null&&um ? (raport*br+parseFloat(um.nilai_ujian)*bu)/totalB : null
      row.push(nij!=null ? parseFloat(nij.toFixed(2)) : '')
      if (nij) { sum+=nij; cnt++ }
    })
    row.push(cnt>0 ? parseFloat((sum/cnt).toFixed(2)) : '')
    nijRows.push(row)
  })

  const wsNij = XLSX.utils.aoa_to_sheet(nijRows)
  const wcNij = [{ wch:5 }, { wch:30 }, { wch:16 }, ...mapelList.map(()=>({ wch:10 })), { wch:12 }]
  wsNij['!cols'] = wcNij
  wsNij['!freeze'] = { xSplit: 3, ySplit: 1 }
  XLSX.utils.book_append_sheet(wb, wsNij, 'Nilai Ijazah')

  const fname = `Nilai_Angkatan_${(angkatan?.nama||'').replace(/[^a-zA-Z0-9]/g,'_')}_${Date.now()}.xlsx`
  const filePath = path.join(outputPath, fname)
  XLSX.writeFile(wb, filePath)
  return filePath
}


// ══════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════
//  IJAZAH — 1 halaman per siswa (sesuai blanko resmi Kemdikbud/Kemenag)


// ══════════════════════════════════════════════════════════════════════════
//  IJAZAH — pixel-perfect blanko resmi Kemdikbud/Kemenag
// ══════════════════════════════════════════════════════════════════════════

function generateIjazah(outputPath, { sekolah: s, siswaList }) {
  const PDFDocument = require('pdfkit')
  const doc = new PDFDocument({ size: 'A4', margin: 0 })
  const filePath = path.join(outputPath, 'Ijazah_Semua.pdf')
  doc.pipe(fs.createWriteStream(filePath))

  const pw = doc.page.width   // 595.28 pt
  const ph = doc.page.height  // 841.89 pt
  const ml = 32, mr = 32
  const cw = pw - ml - mr

  const __electronDir = path.dirname(__filename)
  const GARUDA_PATH   = path.join(__electronDir, 'assets', 'garuda.jpg')
  const TUT_WURI_PATH = path.join(__electronDir, 'assets', 'tut_wuri.png')

  // Garis bawah teks — panjang otomatis sesuai lebar teks + padding
  function underText(text, x, y, opts) {
    const font = opts?.bold ? 'Helvetica-Bold' : 'Helvetica'
    const sz   = opts?.size || 10
    const w    = Math.min(doc.widthOfString(text, { font, fontSize: sz }) + (opts?.pad || 8), opts?.maxW || 999)
    const cx   = opts?.cx ?? x  // center x jika perlu
    const lx   = opts?.center ? cx - w/2 : x
    doc.save().lineWidth(0.5).stroke('#000')
      .moveTo(lx, y).lineTo(lx + w, y).stroke().restore()
  }
  // Fallback compat — tidak dipakai lagi tapi jaga-jaga
  function dotLine(x, y, w) {
    doc.save().lineWidth(0.5).stroke('#000').moveTo(x,y).lineTo(x+w,y).stroke().restore()
  }
  function dotLineGray(x, y, w) {}

  siswaList.forEach((siswa, idx) => {
    if (idx > 0) doc.addPage()

    // Border dihilangkan sesuai permintaan

    // ════════════════════════════════════════════════════════════════════
    // No. Ijazah — pojok kanan atas
    // ════════════════════════════════════════════════════════════════════
    doc.font('Helvetica').fontSize(9).fillColor('#000')
      .text(`No. Ijazah: ${siswa.blanko || '...........................'}`,
            ml, 16, { width: cw, align: 'right' })

    // ════════════════════════════════════════════════════════════════════
    // HEADER:
    //   [Logo Tut Wuri kiri] [Nomenklatur 4 baris] [Garuda TENGAH - besar]
    // ════════════════════════════════════════════════════════════════════
    const hdrY     = 18
    const twSz     = 46
    const garudaSz = 70

    // Logo Tut Wuri — pojok kiri
    if (fs.existsSync(TUT_WURI_PATH)) {
      try { doc.image(TUT_WURI_PATH, ml, hdrY, { fit: [twSz, twSz] }) }
      catch(_) {}
    }

    // Nomenklatur 4 baris — di kanan logo Tut Wuri
    const nomX = ml + twSz + 5
    const nomW = pw / 2 - 35 - nomX
    doc.font('Helvetica-Bold').fontSize(6.2).fillColor('#000')
    doc.text('NOMENKLATUR KEMENTERIAN',  nomX, hdrY + 4,  { width: nomW, lineBreak: false }); doc.moveDown(0)
    doc.text('YANG MENYELENGGARAKAN',    nomX, hdrY + 13, { width: nomW, lineBreak: false }); doc.moveDown(0)
    doc.text('URUSAN PEMERINTAHAN',      nomX, hdrY + 22, { width: nomW, lineBreak: false }); doc.moveDown(0)
    doc.text('DI BIDANG PENDIDIKAN.',    nomX, hdrY + 31, { width: nomW, lineBreak: false })

    // Garuda — TENGAH halaman
    const garudaX = pw / 2 - garudaSz / 2
    const garudaY = hdrY - 6
    if (fs.existsSync(GARUDA_PATH)) {
      try { doc.image(GARUDA_PATH, garudaX, garudaY, { fit: [garudaSz, garudaSz] }) }
      catch(_) {}
    }

    const hdrBottom = hdrY + Math.max(twSz, garudaSz) + 6

    // ════════════════════════════════════════════════════════════════════
    // GARIS PEMBATAS HEADER — 2 garis
    // ════════════════════════════════════════════════════════════════════
    // Garis pembatas header dihilangkan — jarak tetap dipertahankan
    let y = hdrBottom + 13

    // ════════════════════════════════════════════════════════════════════
    // NOMENKLATUR centered bold (di bawah garis)
    // ════════════════════════════════════════════════════════════════════
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000')
      .text('NOMENKLATUR KEMENTERIAN YANG MENYELENGGARAKAN', ml, y, { width: cw, align: 'center' })
    y += 12
    doc.text('URUSAN PEMERINTAHAN DI BIDANG PENDIDIKAN.', ml, y, { width: cw, align: 'center' })
    y += 24

    // ════════════════════════════════════════════════════════════════════
    // IJAZAH — bold besar
    // ════════════════════════════════════════════════════════════════════
    doc.font('Helvetica-Bold').fontSize(28).fillColor('#000')
      .text('IJAZAH', ml, y, { width: cw, align: 'center' })
    y += 36

    // ════════════════════════════════════════════════════════════════════
    // GARIS TITIK (untuk nama satuan pendidikan — diisi sistem)
    // Di blanko kosong: hanya garis titik centered panjang
    // Di blanko terisi: nama sekolah bold di atasnya
    // ════════════════════════════════════════════════════════════════════
    if (s.nama) {
      const namaSekolah = s.nama.toUpperCase()
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#000')
        .text(namaSekolah, ml, y, { width: cw, align: 'center' })
    }
    y += 10

    // TAHUN AJARAN
    doc.font('Helvetica').fontSize(10).fillColor('#000')
      .text(`TAHUN AJARAN  ${s.tahun_ajaran || '......... / .........'}`, ml, y, { width: cw, align: 'center' })
    y += 32

    // ════════════════════════════════════════════════════════════════════
    // WATERMARK TUT WURI — besar, centered di tengah halaman vertikal
    // Sesuai blanko: mencakup dari "Dengan ini" s/d bawah LULUS
    // ════════════════════════════════════════════════════════════════════
    if (fs.existsSync(TUT_WURI_PATH)) {
      try {
        doc.save()
        doc.opacity(0.09)
        const wmSz = 220
        // Dari blanko asli, watermark center-Y ada di sekitar baris LULUS
        // Kira-kira 60% tinggi halaman
        const wmCenterY = ph * 0.46
        doc.image(TUT_WURI_PATH, pw/2 - wmSz/2, wmCenterY - wmSz/2, { fit: [wmSz, wmSz] })
        doc.restore()
      } catch(_) {}
    }

    // ════════════════════════════════════════════════════════════════════
    // "Dengan ini menyatakan bahwa:"
    // ════════════════════════════════════════════════════════════════════
    doc.font('Helvetica').fontSize(10).fillColor('#000')
      .text('Dengan ini menyatakan bahwa:', ml, y, { width: cw, align: 'center' })
    y += 32

    // ════════════════════════════════════════════════════════════════════
    // NAMA SISWA — garis titik panjang (nama dicetak di atasnya oleh sistem)
    // ════════════════════════════════════════════════════════════════════
    if (siswa.nama) {
      const namaSiswa = siswa.nama.toUpperCase()
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#000')
        .text(namaSiswa, ml, y, { width: cw, align: 'center' })
    }
    y += 14

    // ════════════════════════════════════════════════════════════════════
    // BIODATA SISWA
    // Blanko asli: label kiri flush, titik dua setelah label, garis titik
    // ════════════════════════════════════════════════════════════════════
    const lx  = ml + 4
    // Kolom titik dua & nilai rata-kanan dari center
    const sepX = ml + 158
    const valX = sepX + 10
    const valW = cw - 158 - 14

    function bioRow(label, value) {
      doc.font('Helvetica').fontSize(10).fillColor('#000')
        .text(label, lx, y, { width: 154, lineBreak: false })
        .text(':', sepX, y, { width: 8, lineBreak: false })
      if (value) {
        doc.font('Helvetica').fontSize(10)
          .text(value, valX + 2, y, { width: valW - 4, lineBreak: false })
      }
      y += 18
    }

    bioRow('tempat, tanggal lahir',
           siswa.tempat_lahir ? `${siswa.tempat_lahir}, ${fmtTgl(siswa.tgl_lahir)}` : '')
    bioRow('Nomor Induk Siswa Nasional', siswa.nisn || '')
    y += 14

    // ════════════════════════════════════════════════════════════════════
    // L U L U S
    // ════════════════════════════════════════════════════════════════════
    doc.font('Helvetica-Bold').fontSize(24).fillColor('#000')
      .text('L U L U S', ml, y, { width: cw, align: 'center' })
    y += 28

    doc.font('Helvetica').fontSize(10).fillColor('#000')
      .text('dari,', ml, y, { width: cw, align: 'center' })
    y += 22

    // ════════════════════════════════════════════════════════════════════
    // BIODATA SATUAN PENDIDIKAN
    // ════════════════════════════════════════════════════════════════════
    bioRow('satuan pendidikan',            s.nama  || '')
    bioRow('Nomor Pokok Sekolah Nasional', s.npsn  || '')
    y += 16

    // ════════════════════════════════════════════════════════════════════
    // PARAGRAF KEPUTUSAN KEPALA
    // Format blanko asli 3 baris:
    //   1. "berdasarkan Keputusan Kepala  [garis/nama]"
    //   2. "Nomor  [garis/nomor]  tanggal  [garis/tgl]  setelah memenuhi"
    //   3. "seluruh kriteria sesuai dengan peraturan perundang-undangan."
    // ════════════════════════════════════════════════════════════════════
    const tglSk = fmtTgl(s.tgl_lulus)
    const noSk  = s.no_sk || ''

    // Paragraf mengalir — satu blok teks tanpa garis
    const paraText = `Berdasarkan Keputusan Kepala ${s.nama || ''} Nomor ${noSk} Tanggal ${tglSk} setelah memenuhi seluruh kriteria sesuai dengan peraturan perundang-undangan.`
    doc.font('Helvetica').fontSize(9.5).fillColor('#000')
      .text(paraText, lx, y, { width: cw - 8, align: 'justify', lineGap: 2 })
    y += doc.heightOfString(paraText, { width: cw - 8, fontSize: 9.5, lineGap: 2 }) + 24

    // ════════════════════════════════════════════════════════════════════
    // FOTO + TTD
    // Blanko: foto (putus-putus) di kiri-tengah halaman, TTD di kanannya
    // ════════════════════════════════════════════════════════════════════
    const fotoW = 72, fotoH = 96
    // Foto center di 40% lebar halaman dari kiri
    const fotoX = Math.round(pw * 0.34) - fotoW / 2
    const fotoY = y

    // Kotak foto garis putus-putus
    doc.save()
      .dash(3, { space: 3 }).lineWidth(0.8).stroke('#333')
      .rect(fotoX, fotoY, fotoW, fotoH).stroke()
      .undash().restore()

    if (siswa.foto) {
      try {
        doc.image(siswa.foto, fotoX+1, fotoY+1,
                  { fit:[fotoW-2, fotoH-2], align:'center', valign:'center' })
      } catch(_) {
        doc.font('Helvetica').fontSize(6).fillColor('#aaa')
          .text('Foto Tidak Valid', fotoX+2, fotoY+fotoH/2-6, { width:fotoW-4, align:'center' })
      }
    } else {
      doc.font('Helvetica').fontSize(8).fillColor('#555')
        .text('pasfoto\n3x4 cm\nhitam putih\natau\nberwarna',
              fotoX+2, fotoY+20, { width:fotoW-4, align:'center' })
    }
    doc.fillColor('#000')

    // TTD Kepala — kanan foto, rata
    const ttdX = fotoX + fotoW + 22
    const ttdW = pw - mr - ttdX

    doc.font('Helvetica').fontSize(10)
      .text(`${s.kota || ''}, ${tglSk}`, ttdX, fotoY + 4, { width: ttdW, align: 'center' })
    doc.text('Kepala,', ttdX, fotoY + 18, { width: ttdW, align: 'center' })

    // Nama kepala — garis bawah dinamis sesuai panjang nama
    const namaTTDy = fotoY + fotoH - 16
    if (s.kepala) {
      doc.font('Helvetica-Bold').fontSize(9.5)
        .text(s.kepala, ttdX, namaTTDy - 13, { width: ttdW, align: 'center', underline: true })
      // Garis bawah nama — panjang dinamis
      const namaW = Math.min(doc.widthOfString(s.kepala, { font:'Helvetica-Bold', fontSize:9.5 }) + 10, ttdW - 10)
      const namaX = ttdX + (ttdW - namaW) / 2
      doc.save().lineWidth(0.5).stroke('#000')
        .moveTo(namaX, namaTTDy).lineTo(namaX + namaW, namaTTDy).stroke().restore()
    }
    doc.font('Helvetica').fontSize(9.5)
      .text(`NIP. ${s.nip || ''}`, ttdX, namaTTDy + 4, { width: ttdW, align: 'center' })
  })

  doc.end()
  return filePath
}




// ══════════════════════════════════════════════════════════════════════════
//  TRANSKRIP NILAI — sesuai blanko resmi
// ══════════════════════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════════════════════
//  TRANSKRIP NILAI — sesuai blanko resmi, tabel penuh mengisi halaman
// ══════════════════════════════════════════════════════════════════════════
function generateTranskrip(outputPath, { sekolah: s, siswaList, mapelList, nilaiData, ujianSemId, raportSemIds, br, bu, totalB }) {
  const PDFDocument = require('pdfkit')
  // F4 = 215mm x 330mm → dalam pt
  const F4 = [595.28, 841.89]
  const doc = new PDFDocument({ size: F4, margin: 0 })
  const filePath = path.join(outputPath, 'Transkrip_Nilai_Semua.pdf')
  doc.pipe(fs.createWriteStream(filePath))

  const pw = F4[0], ph = F4[1]
  const ml = 40, mr = 40, cw = pw - ml - mr
  const mb = 28   // margin bawah

  function dotLine(x, y, w) {
    doc.save().dash(1, { space: 2 }).lineWidth(0.45).stroke('#000')
      .moveTo(x, y).lineTo(x + w, y).stroke().undash().restore()
  }

  function getAvgNilai(siswaId, mapelId) {
    const nils = nilaiData[siswaId] || []
    const raps = nils.filter(n => raportSemIds.includes(n.semester_id) && n.nilai_p != null && n.mapel_id === mapelId)
    const raport = raps.length
      ? raps.reduce((a, r) => a + parseFloat(r.nilai_p), 0) / raps.length
      : null
    const um = nils.find(n => n.mapel_id === mapelId && n.semester_id === ujianSemId && n.nilai_ujian != null)
    if (raport == null && !um) return null
    if (raport == null) return parseFloat(um.nilai_ujian)
    if (!um) return raport
    return (raport * (br ?? 60) + parseFloat(um.nilai_ujian) * (bu ?? 40)) / (totalB ?? 100)
  }

  siswaList.forEach((siswa, idx) => {
    if (idx > 0) doc.addPage()

    // ════════════════════════════════════════════════════════════════════
    // KOP — sesuai referensi SMPIT Badrussalam
    // ════════════════════════════════════════════════════════════════════
    let y = drawKopBadrussalam(doc, s, ml, cw, 18)

    // ════════════════════════════════════════════════════════════════════
    // JUDUL
    // ════════════════════════════════════════════════════════════════════
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#000')
      .text('TRANSKRIP NILAI', ml, y, { width: cw, align: 'center' })
    y += 16
    doc.font('Helvetica').fontSize(9.5)
      .text(`Nomor: ${s.no_transkrip || '...................................'}`, ml, y, { width: cw, align: 'center' })
    y += 18

    // ════════════════════════════════════════════════════════════════════
    // BIODATA — 8 baris
    // ════════════════════════════════════════════════════════════════════
    const lx   = ml
    const sepX  = ml + 148
    const valX  = sepX + 8
    const valW  = cw - 148 - 8

    function bioRow(label, value) {
      doc.font('Helvetica').fontSize(9.5).fillColor('#000')
        .text(label, lx, y, { width: 144, lineBreak: false })
        .text(':', sepX, y, { width: 6, lineBreak: false })
      dotLine(valX, y + 11, valW)
      if (value) doc.text(value, valX + 2, y, { width: valW - 4, lineBreak: false })
      y += 14
    }

    bioRow('Satuan Pendidikan',            s.nama || '')
    bioRow('Nomor Pokok Sekolah Nasional', s.npsn || '')
    bioRow('Nama Lengkap',                 siswa.nama || '')
    bioRow('Tempat, Tanggal Lahir',
           siswa.tempat_lahir ? `${siswa.tempat_lahir}, ${fmtTgl(siswa.tgl_lahir)}` : '')
    bioRow('Nomor Induk Siswa Nasional',   siswa.nisn || '')
    bioRow('Nomor Ijazah',                 siswa.blanko || '')
    bioRow('Tanggal Kelulusan',            fmtTgl(s.tgl_lulus))
    bioRow('Jenis Kekhususan',             s.jenis_kekhususan || '')
    y += 8

    // ════════════════════════════════════════════════════════════════════
    // HITUNG TINGGI YANG TERSEDIA UNTUK TABEL
    // Rumus: sisa halaman = ph - mb - footnote(~28) - TTD(~110) - gapTblTTD(18) - y_sekarang
    // ════════════════════════════════════════════════════════════════════
    const tglSk = fmtTgl(s.tgl_lulus)
    const footnoteH = 28   // 2 baris footnote italic
    const ttdH      = 145  // kota+kepala+ruangTTD+nama+NIP (3cm)
    const gapH      = 20   // gap antara tabel dan TTD
    const hdrH      = 22   // tinggi header tabel

    const availH = ph - mb - footnoteH - ttdH - gapH - y   // tinggi total untuk tabel
    const allMapel = mapelList
    // Jumlah baris = max(jumlah mapel, minimum 12), tapi pastikan muat di halaman
    const minRows = Math.max(allMapel.length, 10)
    const totalRows = minRows
    // Tinggi setiap baris: isi sisa halaman, max 36pt agar tidak terlalu jarang
    const rowH = Math.min(15, Math.max(14, Math.floor((availH - hdrH) / totalRows)))

    // ════════════════════════════════════════════════════════════════════
    // TABEL NILAI
    // ════════════════════════════════════════════════════════════════════
    const noW  = 32
    const nilW = 55
    const mpW  = cw - noW - nilW
    const tblTop = y

    // Header
    doc.rect(ml, y, cw, hdrH).lineWidth(0.7).stroke('#000')
    doc.moveTo(ml + noW,       y).lineTo(ml + noW,       y + hdrH).lineWidth(0.5).stroke('#000')
    doc.moveTo(ml + noW + mpW, y).lineTo(ml + noW + mpW, y + hdrH).lineWidth(0.5).stroke('#000')
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000')
      .text('No.',            ml,                 y + 6, { width: noW,  align: 'center' })
      .text('Mata Pelajaran', ml + noW,           y + 6, { width: mpW,  align: 'center' })
      .text('Nilai',          ml + noW + mpW,     y + 6, { width: nilW, align: 'center' })
    y += hdrH

    // Baris data mapel
    allMapel.forEach((m, i) => {
      const v = getAvgNilai(siswa.id, m.id)

      doc.rect(ml, y, cw, rowH).lineWidth(0.5).stroke('#000')
      doc.moveTo(ml + noW,       y).lineTo(ml + noW,       y + rowH).lineWidth(0.4).stroke('#000')
      doc.moveTo(ml + noW + mpW, y).lineTo(ml + noW + mpW, y + rowH).lineWidth(0.4).stroke('#000')

      const textY = y + Math.max(2, (rowH - 10) / 2)
      doc.font('Helvetica').fontSize(9.5).fillColor('#000')
        .text(`${i + 1}.`, ml + 2, textY, { width: noW - 4, align: 'center' })
        .text(m.nama || '', ml + noW + 4, textY, { width: mpW - 8 })
      if (v != null) {
        doc.font('Helvetica').fontSize(9.5)
          .text(fmtN(v, 2), ml + noW + mpW + 2, textY, { width: nilW - 4, align: 'center' })
      }
      y += rowH
    })

    // Baris kosong pelengkap — isi sisa baris agar tabel penuh
    const emptyRows = totalRows - allMapel.length
    for (let i = 0; i < emptyRows; i++) {
      doc.rect(ml, y, cw, rowH).lineWidth(0.5).stroke('#000')
      doc.moveTo(ml + noW,       y).lineTo(ml + noW,       y + rowH).lineWidth(0.4).stroke('#000')
      doc.moveTo(ml + noW + mpW, y).lineTo(ml + noW + mpW, y + rowH).lineWidth(0.4).stroke('#000')
      // Label "dst" di baris kosong pertama setelah mapel terisi (sesuai blanko)
      if (i === 0 && allMapel.length > 0) {
        const textY = y + Math.max(2, (rowH - 10) / 2)
        doc.font('Helvetica').fontSize(9).fillColor('#000')
          .text('dst', ml + 2, textY, { width: noW - 4, align: 'center' })
      }
      y += rowH
    }

    // Garis penutup tabel
    doc.moveTo(ml, tblTop).lineTo(ml, y).lineWidth(0.7).stroke('#000')
    doc.moveTo(ml + cw, tblTop).lineTo(ml + cw, y).lineWidth(0.7).stroke('#000')
    doc.moveTo(ml, y).lineTo(ml + cw, y).lineWidth(0.7).stroke('#000')

    y += gapH

    // ════════════════════════════════════════════════════════════════════
    // TTD KEPALA — kanan
    // ════════════════════════════════════════════════════════════════════
    const ttdX = pw / 2 + 10
    const ttdW = pw - mr - ttdX

    dotLine(ttdX, y, ttdW)
    doc.font('Helvetica').fontSize(9.5).fillColor('#000')
      .text(`${s.kota || ''}, ${tglSk}`, ttdX, y + 3, { width: ttdW, align: 'center' })
    y += 14
    doc.text('Kepala,', ttdX, y, { width: ttdW, align: 'center' })
    y += 85   // 3cm ruang tanda tangan

    const namaKepalaTr = s.kepala ? s.kepala.toUpperCase() : ''
    const garisWtr = Math.min(ttdW - 10, Math.max(80, namaKepalaTr.length * 5.8))
    const garisXtr = ttdX + (ttdW - garisWtr) / 2
    doc.moveTo(garisXtr, y).lineTo(garisXtr + garisWtr, y).lineWidth(0.7).stroke('#000')
    if (namaKepalaTr) {
      doc.font('Helvetica-Bold').fontSize(9.5)
        .text(namaKepalaTr, ttdX, y - 15, { width: ttdW, align: 'center', underline: true })
    }
    y += 5
    doc.font('Helvetica').fontSize(9.5)
      .text(`NIP. ${s.nip || '...................................'}`, ttdX, y, { width: ttdW, align: 'center' })
    y += 30

    // ════════════════════════════════════════════════════════════════════
    // FOOTNOTE italic
    // ════════════════════════════════════════════════════════════════════
    doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#000')
      .text(
        'Transkrip Nilai ini telah dicetak ulang tanpa mengubah muatan Transkrip Nilai dan ' +
        'ditandatangani sesuai dengan ketentuan yang berlaku.',
        ml, y, { width: cw, align: 'justify' }
      )
  })

  doc.end()
  return filePath
}



function generateSKKelulusan(outputPath, { sekolah: s, siswaList }) {
  const PDFDocument = require('pdfkit')
  const F4sk = [595.28, 841.89]
  const doc = new PDFDocument({ size: F4sk, margin: 0 })
  const filePath = path.join(outputPath, 'SK_Penetapan_Kelulusan.pdf')
  doc.pipe(fs.createWriteStream(filePath))

  const ml = 50, mr = 50, pw = F4sk[0], ph = F4sk[1]
  const cw = pw - ml - mr
  const mb = 30

  const __electronDir = path.dirname(__filename)

  // ════════════════════════════════════════════════════════════════════
  // KOP — sesuai referensi SMPIT Badrussalam
  // ════════════════════════════════════════════════════════════════════
  let y = drawKopBadrussalam(doc, s, ml, cw, 18)

  // ════════════════════════════════════════════════════════════════════
  // JUDUL
  // ════════════════════════════════════════════════════════════════════
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000')
    .text('KEPUTUSAN KEPALA', ml, y, { width: cw, align: 'center' })
  y += 13
  doc.font('Helvetica-Bold').fontSize(11)
    .text((s.nama || '').toUpperCase(), ml, y, { width: cw, align: 'center' })
  y += 13
  doc.font('Helvetica-Bold').fontSize(10)
    .text(`NOMOR : ${s.no_sk || '............................................'}`, ml, y, { width: cw, align: 'center' })
  y += 12
  doc.font('Helvetica').fontSize(9.5)
    .text('TENTANG', ml, y, { width: cw, align: 'center' })
  y += 11
  doc.font('Helvetica-Bold').fontSize(10)
    .text(`PENETAPAN KELULUSAN PESERTA DIDIK ${(s.nama || '').toUpperCase()}`, ml, y, { width: cw, align: 'center' })
  y += 11
  doc.font('Helvetica-Bold').fontSize(10)
    .text(`TAHUN PELAJARAN ${s.tahun_ajaran || '......./......'}`, ml, y, { width: cw, align: 'center' })
  y += 18

  // ════════════════════════════════════════════════════════════════════
  // KONSIDERAN — Menimbang / Mengingat
  // Format: label kiri (bold) + titik dua + huruf/angka + teks
  // ════════════════════════════════════════════════════════════════════
  const lblW = 72   // lebar kolom "Menimbang"
  const noW  = 20   // lebar kolom huruf/angka
  const txtX = ml + lblW + 6 + noW  // mulai teks
  const txtW = cw - lblW - 6 - noW

  function konsideranHeader(label) {
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#000')
      .text(label, ml, y, { width: lblW, lineBreak: false })
      .text(':', ml + lblW, y, { width: 6, lineBreak: false })
    y += 14
  }

  function konsideranItem(no, teks) {
    const h = doc.heightOfString(teks, { width: txtW, font: 'Helvetica', fontSize: 9.5 })
    doc.font('Helvetica').fontSize(9.5).fillColor('#000')
      .text(no, ml + lblW + 6, y, { width: noW, lineBreak: false })
      .text(teks, txtX, y, { width: txtW, align: 'justify' })
    y += h + 5
  }

  const tglSk = fmtTgl(s.tgl_lulus)

  konsideranHeader('Menimbang')
  konsideranItem('a.', `Bahwa peserta didik ${s.nama || ''} Tahun Pelajaran ${s.tahun_ajaran || ''} telah mengikuti seluruh program pembelajaran dan memenuhi kriteria kelulusan yang ditetapkan;`)
  konsideranItem('b.', 'Bahwa berdasarkan hasil rapat Dewan Guru dan penilaian yang telah dilakukan, peserta didik yang namanya tercantum dalam lampiran Surat Keputusan ini dinyatakan telah memenuhi seluruh kriteria kelulusan;')
  konsideranItem('c.', 'Bahwa berdasarkan pertimbangan sebagaimana dimaksud pada huruf a dan b, perlu menetapkan Keputusan Kepala tentang Penetapan Kelulusan Peserta Didik;')
  y += 4

  konsideranHeader('Mengingat')
  konsideranItem('1.', 'Undang-Undang Nomor 20 Tahun 2003 tentang Sistem Pendidikan Nasional;')
  konsideranItem('2.', 'Peraturan Pemerintah Nomor 57 Tahun 2021 tentang Standar Nasional Pendidikan;')
  konsideranItem('3.', 'Permendikbudristek Nomor 58 Tahun 2024 tentang Ijazah Pendidikan Dasar dan Pendidikan Menengah;')
  konsideranItem('4.', 'Pedoman Pengelolaan Ijazah Kemendikdasmen Tahun 2025;')
  y += 8

  // ════════════════════════════════════════════════════════════════════
  // MEMUTUSKAN
  // ════════════════════════════════════════════════════════════════════
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#000')
    .text('MEMUTUSKAN :', ml, y, { width: cw, align: 'center' })
  y += 16

  function diktum(urutan, judul, isi) {
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#000')
      .text(urutan, ml, y, { width: lblW, lineBreak: false })
      .text(':', ml + lblW, y, { width: 6, lineBreak: false })
      .text(judul, txtX, y, { width: txtW })
    y += 12
    if (isi) {
      const h = doc.heightOfString(isi, { width: txtW, font: 'Helvetica', fontSize: 9.5 })
      doc.font('Helvetica').fontSize(9.5)
        .text(isi, txtX, y, { width: txtW, align: 'justify' })
      y += h + 8
    }
  }

  diktum('Pertama', 'MENETAPKAN', 'Keputusan Kepala tentang Penetapan Kelulusan Peserta Didik.')
  diktum('Kedua',   'Nama-nama Peserta Didik',
    `sebagaimana tersebut dalam lampiran dinyatakan LULUS dari ${s.nama || ''} Tahun Pelajaran ${s.tahun_ajaran || ''} berdasarkan analisis kriteria kelulusan.`)
  diktum('Ketiga',  'Apabila dikemudian hari terdapat kekeliruan',
    'dalam keputusan ini akan diperbaiki sebagaimana mestinya.')
  diktum('Keempat', 'Keputusan ini berlaku sejak tanggal ditetapkan.', null)
  y += 6

  // ════════════════════════════════════════════════════════════════════
  // DITETAPKAN
  // ════════════════════════════════════════════════════════════════════
  doc.font('Helvetica').fontSize(9.5).fillColor('#000')
    .text(`Ditetapkan di : ${s.kota || '.....................'}`, ml, y)
  y += 13
  doc.text(`Pada tanggal  : ${tglSk || '.....................'}`, ml, y)
  y += 22

  // TTD — kanan
  const ttdX = pw / 2 + 10
  const ttdW = pw - mr - ttdX
  doc.font('Helvetica').fontSize(9.5).text('Kepala,', ttdX, y, { width: ttdW, align: 'center' })
  y += 85  // 3cm ruang tanda tangan

  const namaKepalaSk = s.kepala ? s.kepala.toUpperCase() : ''
  const garisWsk = Math.min(ttdW - 10, Math.max(80, namaKepalaSk.length * 5.8))
  const garisXsk = ttdX + (ttdW - garisWsk) / 2
  doc.moveTo(garisXsk, y).lineTo(garisXsk + garisWsk, y).lineWidth(0.7).stroke('#000')
  if (namaKepalaSk) {
    doc.font('Helvetica-Bold').fontSize(9.5)
      .text(namaKepalaSk, ttdX, y - 15, { width: ttdW, align: 'center', underline: true })
  }
  y += 5
  doc.font('Helvetica').fontSize(9)
    .text(`NIP. ${s.nip || ''}`, ttdX, y, { width: ttdW, align: 'center' })

  // ════════════════════════════════════════════════════════════════════
  // HALAMAN 2 — LAMPIRAN: DAFTAR NAMA PESERTA DIDIK
  // ════════════════════════════════════════════════════════════════════
  doc.addPage()
  y = 30

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#000')
    .text('LAMPIRAN KEPUTUSAN KEPALA', ml, y, { width: cw, align: 'center' })
  y += 12
  doc.font('Helvetica-Bold').fontSize(10)
    .text((s.nama || '').toUpperCase(), ml, y, { width: cw, align: 'center' })
  y += 12
  doc.font('Helvetica').fontSize(9.5)
    .text(`NOMOR : ${s.no_sk || ''}`, ml, y, { width: cw, align: 'center' })
  y += 10
  doc.font('Helvetica').fontSize(9.5)
    .text(`TANGGAL : ${tglSk || ''}`, ml, y, { width: cw, align: 'center' })
  y += 14

  doc.font('Helvetica-Bold').fontSize(10)
    .text('DAFTAR NAMA PESERTA DIDIK YANG DINYATAKAN LULUS', ml, y, { width: cw, align: 'center' })
  y += 10
  doc.font('Helvetica-Bold').fontSize(10)
    .text(`TAHUN PELAJARAN ${s.tahun_ajaran || ''}`, ml, y, { width: cw, align: 'center' })
  y += 16

  // Tabel daftar siswa
  const noW2  = 28
  const nisnW = 75
  const namaW = cw - noW2 - nisnW
  const rH    = 15
  const hH    = 20

  // Header tabel
  doc.rect(ml, y, cw, hH).lineWidth(0.7).stroke('#000')
  doc.moveTo(ml+noW2,        y).lineTo(ml+noW2,        y+hH).lineWidth(0.5).stroke('#000')
  doc.moveTo(ml+noW2+namaW,  y).lineTo(ml+noW2+namaW,  y+hH).lineWidth(0.5).stroke('#000')
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#000')
    .text('No.',  ml,             y+5, { width: noW2,  align: 'center' })
    .text('Nama Peserta Didik', ml+noW2, y+5, { width: namaW, align: 'center' })
    .text('NISN', ml+noW2+namaW, y+5, { width: nisnW, align: 'center' })
  y += hH

  // Baris siswa
  siswaList.forEach((siswa, i) => {
    doc.rect(ml, y, cw, rH).lineWidth(0.5).stroke('#000')
    doc.moveTo(ml+noW2,       y).lineTo(ml+noW2,       y+rH).lineWidth(0.4).stroke('#000')
    doc.moveTo(ml+noW2+namaW, y).lineTo(ml+noW2+namaW, y+rH).lineWidth(0.4).stroke('#000')
    doc.font('Helvetica').fontSize(9.5).fillColor('#000')
      .text(String(i+1)+'.', ml+2, y+3, { width: noW2-4, align: 'center' })
      .text(siswa.nama || '', ml+noW2+4, y+3, { width: namaW-8 })
      .text(siswa.nisn || '', ml+noW2+namaW+2, y+3, { width: nisnW-4, align: 'center' })
    y += rH
  })

  // Border luar lampiran tabel
  doc.moveTo(ml, y-hH-rH*siswaList.length).lineTo(ml, y).lineWidth(0.7).stroke('#000')
  doc.moveTo(ml+cw, y-hH-rH*siswaList.length).lineTo(ml+cw, y).lineWidth(0.7).stroke('#000')
  doc.moveTo(ml, y).lineTo(ml+cw, y).lineWidth(0.7).stroke('#000')

  doc.end()
  return filePath
}




// ══════════════════════════════════════════════════════════════════════════
//  SURAT KETERANGAN KELAKUAN BAIK (SKKB) — format F4 (215x330mm)
// ══════════════════════════════════════════════════════════════════════════
function generateSKKB(outputPath, { sekolah: s, siswaList }) {
  const PDFDocument = require('pdfkit')
  // F4 = 215mm x 330mm → dalam pt (1mm = 2.8346pt)
  const F4 = [595.28, 841.89]
  const doc = new PDFDocument({ size: F4, margin: 0 })
  const filePath = path.join(outputPath, 'SKKB_Semua.pdf')
  doc.pipe(fs.createWriteStream(filePath))

  const pw = F4[0], ph = F4[1]
  const ml = 50, mr = 45, cw = pw - ml - mr

  const __electronDir = path.dirname(__filename)

  siswaList.forEach((siswa, idx) => {
    if (idx > 0) doc.addPage()

    // ════════════════════════════════════════════════════════════════════
    // KOP — pakai fungsi terpusat drawKopBadrussalam
    // ════════════════════════════════════════════════════════════════════
    let y = drawKopBadrussalam(doc, s, ml, cw, 18)

    // ════════════════════════════════════════════════════════════════════
    // JUDUL
    // ════════════════════════════════════════════════════════════════════
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#000')
      .text('SURAT KETERANGAN KELAKUAN BAIK', ml, y, { width: cw, align: 'center', underline: true })
    y += 14
    doc.font('Helvetica-Bold').fontSize(10)
      .text(`Nomor : ${siswa.no_skkb || s.no_skkb || '...................................................'}`,
            ml, y, { width: cw, align: 'center' })
    y += 22

    // ════════════════════════════════════════════════════════════════════
    // PEMBUKA — "Yang bertandatangan di bawah ini:"
    // ════════════════════════════════════════════════════════════════════
    doc.font('Helvetica').fontSize(10.5).fillColor('#000')
      .text('Yang bertandatangan di bawah ini:', ml, y)
    y += 18

    // ════════════════════════════════════════════════════════════════════
    // DATA KEPALA SEKOLAH
    // ════════════════════════════════════════════════════════════════════
    const indX  = ml + 28
    const sepX  = ml + 155   // lebih lebar untuk label panjang
    const valX  = sepX + 8
    const valW  = cw - 155 - 8

    function dataRow(label, value) {
      doc.font('Helvetica').fontSize(10.5).fillColor('#000')
        .text(label, indX, y, { width: 123, lineBreak: false })
        .text(':', sepX, y, { width: 6, lineBreak: false })
      if (value) doc.text(value, valX, y, { width: valW, lineBreak: false })
      y += 14
    }

    dataRow('Nama',       s.kepala || '')
    dataRow('Jabatan',    'Kepala Sekolah')
    dataRow('Unit Kerja', s.nama || '')
    dataRow('Alamat',     s.alamat_kepala || s.alamat || '')
    y += 10

    // ════════════════════════════════════════════════════════════════════
    // KALIMAT PENGANTAR
    // ════════════════════════════════════════════════════════════════════
    doc.font('Helvetica').fontSize(10.5).fillColor('#000')
      .text('Sesuai dengan jabatannya tersebut menerangkan bahwa :', ml, y)
    y += 18

    // ════════════════════════════════════════════════════════════════════
    // DATA SISWA
    // ════════════════════════════════════════════════════════════════════
    dataRow('Nama',                 siswa.nama || '')
    dataRow('Tempat Tanggal Lahir', siswa.tempat_lahir
      ? `${siswa.tempat_lahir}, ${fmtTgl(siswa.tgl_lahir)}` : '')
    dataRow('Kelas',                siswa.kelas || '')
    dataRow('No. Induk Sekolah',    siswa.nism || '')
    dataRow('Alamat',               siswa.alamat || '')
    y += 14

    // ════════════════════════════════════════════════════════════════════
    // ISI KETERANGAN
    // ════════════════════════════════════════════════════════════════════
    // Paragraf isi — render sederhana dengan nama sekolah bold inline
    const namaS = (s.nama || '').toUpperCase()
    const fullText = `Adalah benar-benar telah belajar di ${namaS} Menurut catatan kami, selama belajar di ${namaS} yang bersangkutan telah berkelakuan baik dan tidak terlibat dalam penyalahgunaan Narkotika, Psikotropika dan Zat Aditif lainnya.`
    doc.font('Helvetica').fontSize(10.5).fillColor('#000')
      .text(fullText, ml, y, { width: cw, align: 'justify' })
    y += doc.heightOfString(fullText, { width: cw, font: 'Helvetica', fontSize: 10.5 }) + 16

    // ════════════════════════════════════════════════════════════════════
    // PENUTUP
    // ════════════════════════════════════════════════════════════════════
    doc.font('Helvetica').fontSize(10.5)
      .text('Demikian surat keterangan ini dibuat dengan sebenarnya, untuk dapat diketahui dan dipergunakan semestinya.',
            ml, y, { width: cw, align: 'justify' })
    y += 40

    // ════════════════════════════════════════════════════════════════════
    // TTD — kanan
    // ════════════════════════════════════════════════════════════════════
    const tglSk = fmtTgl(s.tgl_lulus)
    const kotaStr = s.kota || '.....................'
    const tglStr  = s.tgl_lulus ? tglSk : '...................'
    const ttdX    = pw / 2 + 10
    const ttdW    = pw - mr - ttdX

    doc.font('Helvetica').fontSize(10.5).fillColor('#000')
      .text(`${kotaStr}, ${tglStr}`, ttdX, y, { width: ttdW, align: 'center' })
    y += 12
    doc.text('Kepala Sekolah', ttdX, y, { width: ttdW, align: 'center' })
    y += 85  // 3cm ruang tanda tangan

    const namaKepalaSkkb = s.kepala ? s.kepala.toUpperCase() : ''
    const garisWSkkb = Math.min(ttdW - 10, Math.max(80, namaKepalaSkkb.length * 5.8))
    const garisXSkkb = ttdX + (ttdW - garisWSkkb) / 2
    doc.moveTo(garisXSkkb, y).lineTo(garisXSkkb + garisWSkkb, y).lineWidth(0.7).stroke('#000')
    if (namaKepalaSkkb) {
      doc.font('Helvetica-Bold').fontSize(10.5)
        .text(namaKepalaSkkb, ttdX, y - 15, { width: ttdW, align: 'center', underline: true })
      y += 13
    }
    if (s.nip) {
      doc.font('Helvetica').fontSize(10).text(`NIP. ${s.nip}`, ttdX, y, { width: ttdW, align: 'center' })
    }
  })

  doc.end()
  return filePath
}


module.exports = {
  generateSKL,
  generateNilaiIjazah,
  generateDKN,
  exportExcelAngkatan,
  generateIjazah,
  generateTranskrip,
  generateSKKelulusan,
  generateSKKB,
}
