/**
 * PDF Generator — SKL 1 halaman, Nilai Ijazah 1 halaman per siswa
 * Export Excel per angkatan mirip format rekap_nilai.pdf
 */
const path = require('path')
const fs   = require('fs')

// ── Font system ────────────────────────────────────────────────────────────
// Mendukung font dari: bundled assets, Windows Fonts, atau fallback Helvetica
// kop_font_family: key dari FONT_CATALOG di bawah, atau null = Helvetica

const FONT_CATALOG = {
  // ── Bundled (selalu tersedia) ──────────────────────────────────────────
  'Times New Roman': {
    regular:    { asset: 'LiberationSerif-Regular.ttf' },
    bold:       { asset: 'LiberationSerif-Bold.ttf' },
    italic:     { asset: 'LiberationSerif-Italic.ttf' },
    bolditalic: { asset: 'LiberationSerif-BoldItalic.ttf' },
  },
  'Arial': {
    regular:    { asset: 'LiberationSans-Regular.ttf' },
    bold:       { asset: 'LiberationSans-Bold.ttf' },
    italic:     { asset: 'LiberationSans-Italic.ttf' },
    bolditalic: { asset: 'LiberationSans-BoldItalic.ttf' },
  },
  // ── Windows Fonts (tersedia di Windows) ───────────────────────────────
  'Calibri':     { winFile: 'calibri',     styles: { bold:'b', italic:'i', bolditalic:'z' } },
  'Cambria':     { winFile: 'cambria',     styles: { bold:'b', italic:'i', bolditalic:'z' } },
  'Georgia':     { winFile: 'georgia',     styles: { bold:'b', italic:'i', bolditalic:'z' } },
  'Verdana':     { winFile: 'verdana',     styles: { bold:'b', italic:'i', bolditalic:'z' } },
  'Tahoma':      { winFile: 'tahoma',      styles: { bold:'bd' } },
  'Book Antiqua':{ winFile: 'bookos',      styles: { bold:'b', italic:'i', bolditalic:'z' } },
  'Palatino':    { winFile: 'pala',        styles: { bold:'b', italic:'i', bolditalic:'z' } },
}

// Cache per-document — reset setiap dokumen baru via resetFontCache()
let _fontCache = {}
function resetFontCache() { _fontCache = {} }

function _getWinFontPath(winFile, suffix) {
  const winDir = 'C:\Windows\Fonts'
  const candidates = [
    path.join(winDir, `${winFile}${suffix || ''}.ttf`),
    path.join(winDir, `${winFile}.ttf`),
  ]
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p } catch {}
  }
  return null
}

function _getAssetFontPath(assetFile) {
  const dir = path.join(path.dirname(__filename), 'assets')
  const p = path.join(dir, assetFile)
  try { if (fs.existsSync(p)) return p } catch {}
  return null
}

// Register semua style dari 1 family ke PDFKit, return key prefix atau null
function registerFonts(doc, familyName) {
  if (!familyName || familyName === 'Helvetica') return null
  // Tidak cache - register ulang ke setiap doc instance baru
  // karena PDFKit font registry per-instance

  const cat = FONT_CATALOG[familyName]
  if (!cat) { _fontCache[familyName] = null; return null }

  const key = familyName.replace(/\s+/g, '_')
  const styles = ['regular','bold','italic','bolditalic']
  let registered = 0

  for (const style of styles) {
    const fontKey = `${key}-${style}`
    let filePath = null

    // Coba dari asset bundled dulu
    if (cat[style]?.asset) {
      filePath = _getAssetFontPath(cat[style].asset)
    }
    // Kalau tidak ada, coba dari Windows Fonts
    if (!filePath && cat.winFile) {
      const suffix = style === 'regular' ? '' :
                     style === 'bold'       ? (cat.styles?.bold       || 'b') :
                     style === 'italic'     ? (cat.styles?.italic     || 'i') :
                     style === 'bolditalic' ? (cat.styles?.bolditalic || 'z') : ''
      filePath = _getWinFontPath(cat.winFile, suffix)
      // Fallback: kalau bolditalic tidak ada, pakai bold
      if (!filePath && style === 'bolditalic') {
        const boldSuffix = cat.styles?.bold || 'b'
        filePath = _getWinFontPath(cat.winFile, boldSuffix)
      }
      // Fallback: kalau italic tidak ada, pakai regular
      if (!filePath && (style === 'italic' || style === 'bolditalic')) {
        filePath = _getWinFontPath(cat.winFile, '')
      }
    }

    if (filePath) {
      try { doc.registerFont(fontKey, filePath); registered++ }
      catch {}
    }
  }

  return registered > 0 ? key : null
}

// Ambil nama font PDFKit yang siap dipakai
function getFont(familyKey, style) {
  // style: 'regular' | 'bold' | 'italic' | 'bolditalic'
  const builtin = {
    regular:'Helvetica', bold:'Helvetica-Bold',
    italic:'Helvetica-Oblique', bolditalic:'Helvetica-BoldOblique'
  }
  if (!familyKey) return builtin[style] || 'Helvetica'
  const fontKey = `${familyKey}-${style}`
  // Validasi dengan mencoba pakai — PDFKit akan error kalau belum diregister
  return fontKey
}

// Daftar font yang bisa dipilih user (untuk dropdown di SekolahPage)
const FONT_LIST = Object.keys(FONT_CATALOG)

// Apply font family ke doc, return {B, R, I, BI} shorthand
// ── Ukuran kertas ──────────────────────────────────────────────────────────
// A4: 210x297mm, F4/Folio: 215x330mm (standar Indonesia)
const PAPER = {
  A4:  [595.28, 841.89],   // 210x297mm
  F4:  [609.45, 935.43],   // 215x330mm (Folio)
}
function getPaperSize(s, landscape) {
  const key  = (s.pdf_ukuran || 'A4').toUpperCase()
  const size = PAPER[key] || PAPER['A4']
  return landscape ? [size[1], size[0]] : size
}

function fontSetup(doc, s) {
  const ff = registerFonts(doc, s.kop_font_family)
  return {
    B:  getFont(ff, 'bold'),
    R:  getFont(ff, 'regular'),
    I:  getFont(ff, 'italic'),
    BI: getFont(ff, 'bolditalic'),
  }
}

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
  // Kalau ada kop_image (upload dari screenshot), pakai itu langsung
  if (s.kop_image) {
    try {
      // Baca dimensi asli gambar dari PNG/JPEG header supaya proporsional
      const imgBuf = fs.readFileSync(s.kop_image)
      let origW = 0, origH = 0
      // PNG: signature 8 byte, lalu chunk IHDR: width di byte 16-19, height di 20-23
      if (imgBuf[0] === 0x89 && imgBuf[1] === 0x50) {
        origW = imgBuf.readUInt32BE(16)
        origH = imgBuf.readUInt32BE(20)
      }
      // JPEG: scan SOF0/SOF2 marker untuk dimensi
      else if (imgBuf[0] === 0xFF && imgBuf[1] === 0xD8) {
        let i = 2
        while (i < imgBuf.length - 8) {
          if (imgBuf[i] !== 0xFF) break
          const marker = imgBuf[i + 1]
          const segLen = imgBuf.readUInt16BE(i + 2)
          if (marker === 0xC0 || marker === 0xC2) {
            origH = imgBuf.readUInt16BE(i + 5)
            origW = imgBuf.readUInt16BE(i + 7)
            break
          }
          i += 2 + segLen
        }
      }

      const imgW = cw
      // Hitung tinggi proporsional berdasarkan rasio gambar asli
      // Kalau gagal baca dimensi, fallback ke 90pt (sama seperti sebelumnya)
      const imgH = (origW > 0 && origH > 0)
        ? Math.round((origH / origW) * imgW)
        : 90

      doc.image(s.kop_image, ml, yStart, { width: imgW, height: imgH })
      // Garis bawah kop
      const kopBottom = yStart + imgH + 2
      doc.moveTo(ml, kopBottom).lineTo(ml + cw, kopBottom).lineWidth(3).stroke('#000')
      doc.moveTo(ml, kopBottom + 4).lineTo(ml + cw, kopBottom + 4).lineWidth(1).stroke('#000')
      return kopBottom + 16
    } catch(e) {
      // Fallback ke generate kop kalau image gagal
    }
  }

  // Ukuran font dari DB (dengan default)
  const fsYayasan = parseFloat(s.kop_font_yayasan) || 9
  const fsJenis   = parseFloat(s.kop_font_jenis)   || 9.5
  const fsNama    = parseFloat(s.kop_font_nama)     || 20
  const LOGO_SZ   = 72
  let y = yStart

  // Daftarkan font sesuai pilihan DB
  // kop_font_family: 'serif' (Times New Roman-like) | 'sans' (Arial-like) | null (Helvetica)
  const fontFamily = registerFonts(doc, s.kop_font_family)
  const fBold       = getFont(fontFamily, 'bold')
  const fRegular    = getFont(fontFamily, 'regular')
  const fItalic     = getFont(fontFamily, 'italic')

  const hasLogoKiri  = !!s.logo_sekolah
  const hasLogoKanan = !!(s.logo_kemdikbud || s.logo_garuda) && (s.kop_show_logo_kanan !== 0)

  // Logo kiri (sekolah)
  if (hasLogoKiri) {
    try { doc.image(s.logo_sekolah, ml, y, { fit: [LOGO_SZ, LOGO_SZ] }) }
    catch (_) { doc.rect(ml, y, LOGO_SZ, LOGO_SZ).lineWidth(0.3).stroke('#ccc') }
  }

  // Logo kanan (Kemdikbud / Kemenag / Garuda)
  const logoKananPath = s.logo_kemdikbud || s.logo_garuda
  if (hasLogoKanan && logoKananPath) {
    try { doc.image(logoKananPath, ml + cw - LOGO_SZ, y, { fit: [LOGO_SZ, LOGO_SZ] }) }
    catch (_) { doc.rect(ml + cw - LOGO_SZ, y, LOGO_SZ, LOGO_SZ).lineWidth(0.3).stroke('#ccc') }
  }

  // Area teks tengah
  const leftPad  = hasLogoKiri  ? LOGO_SZ + 10 : 0
  const rightPad = hasLogoKanan ? LOGO_SZ + 10 : 0
  const kopX = ml + leftPad
  const kopW = cw - leftPad - rightPad
  let ky = y + 2

  // Baris 1 — Yayasan
  if (s.yayasan) {
    doc.font(fBold).fontSize(fsYayasan).fillColor('#000')
      .text(s.yayasan.toUpperCase(), kopX, ky, { width: kopW, align: 'center' })
    ky += fsYayasan + 2
  }

  // Baris 2 — Jenis Sekolah
  if (s.jenis_sekolah) {
    doc.font(fBold).fontSize(fsJenis).fillColor('#000')
      .text(s.jenis_sekolah.toUpperCase(), kopX, ky, { width: kopW, align: 'center' })
    ky += fsJenis + 2
  }

  // Baris 3 — Nama singkat BESAR
  doc.font(fBold).fontSize(fsNama).fillColor('#000')
    .text((s.nama_singkat || s.nama || '').toUpperCase(), kopX, ky, { width: kopW, align: 'center' })
  ky += fsNama + 3

  // Baris 4 — NPSN + NSS sejajar
  const npsn   = s.npsn ? `NPSN: ${s.npsn}` : ''
  const nss    = s.nss  ? `NSS : ${s.nss}`  : ''
  const baris4 = [npsn, nss].filter(Boolean).join('          ')
  if (baris4) {
    doc.font(fBold).fontSize(8.5).fillColor('#000')
      .text(baris4, kopX, ky, { width: kopW, align: 'center' })
    ky += 11
  }

  // Baris 5 — Alamat baris 1 (italic)
  if (s.alamat) {
    doc.font(fItalic).fontSize(8.5).fillColor('#000')
      .text(s.alamat, kopX, ky, { width: kopW, align: 'center' })
    ky += 11
  }

  // Baris 6 — Alamat baris 2 / kecamatan (italic)
  if (s.alamat2) {
    doc.font(fItalic).fontSize(8.5).fillColor('#000')
      .text(s.alamat2, kopX, ky, { width: kopW, align: 'center' })
    ky += 11
  }

  // Garis bawah KOP — tebal + tipis
  const kopBottom = Math.max(ky + 4, y + LOGO_SZ + 4)
  doc.moveTo(ml, kopBottom).lineTo(ml + cw, kopBottom).lineWidth(3).stroke('#000')
  doc.moveTo(ml, kopBottom + 4).lineTo(ml + cw, kopBottom + 4).lineWidth(1).stroke('#000')

  return kopBottom + 16
}

// Alias lama — agar kode lama yang masih pakai drawKopResmi tidak error
function drawKopResmi(doc, s, ml, cw) {
  const mt = parseFloat(s.pdf_margin_top) || 20
  return drawKopBadrussalam(doc, s, ml, cw, mt)
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
  const A4 = getPaperSize(s, false)
  const doc = new PDFDocument({ size: A4, margin: 0 })
  const filePath = path.join(outputPath, 'SKL_Kelulusan.pdf')
  doc.pipe(fs.createWriteStream(filePath))

  const pw = A4[0], ph = A4[1]
  const ml = parseFloat(s.pdf_margin_left)  || 45
  const mr = parseFloat(s.pdf_margin_right) || 45
  const mt = parseFloat(s.pdf_margin_top)   || 18
  const cw = pw - ml - mr

  function dotLine(x, y, w) {
    doc.save().lineWidth(0.5).stroke('#000')
      .moveTo(x, y).lineTo(x + w, y).stroke().restore()
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
    let y = drawKopBadrussalam(doc, s, ml, cw, mt)

    // ════════════════════════════════════════════════════════════════════
    // JUDUL — bisa dikustomisasi dari Data Sekolah
    // ════════════════════════════════════════════════════════════════════
    const _ff    = registerFonts(doc, s.kop_font_family)
    const _fBold = getFont(_ff, 'bold')
    const _fReg  = getFont(_ff, 'regular')
    const _fItal = getFont(_ff, 'italic')
    const judulSKL = (s.judul_skl || 'SURAT KETERANGAN LULUS').toUpperCase()
    doc.font(_fBold).fontSize(12).fillColor('#000')
      .text(judulSKL, ml, y, { width: cw, align: 'center', underline: true })
    y += 14
    doc.font(_fReg).fontSize(9.5)
      .text(`Nomor : ${siswa.no_skl || '...................................................'}`, ml, y, { width: cw, align: 'center' })
    y += 22

    // ════════════════════════════════════════════════════════════════════
    // PARAGRAF PEMBUKA — dari DB atau default
    // ════════════════════════════════════════════════════════════════════
    const tglSk    = fmtTgl(s.tgl_lulus)
    const tglRapat = s.tgl_rapat ? fmtTgl(s.tgl_rapat) : (s.tgl_lulus ? tglSk : '.....................')
    // Template variabel: {tgl_rapat}, {nama_sekolah}, {kabupaten}, {tahun_ajaran}
    const templatePembuka = s.paragraf_pembuka_skl ||
      'Berdasarkan hasil rapat Dewan Guru yang dilaksankan tanggal {tgl_rapat}, dan setelah dipastikan bahwa seluruh kriteria kelulusan telah terpenuhi sesuai dengan peraturan perundang undangan, Kepala {nama_sekolah} Kabupaten {kabupaten} menerangkan Bahwa:'
    const pembukaText = templatePembuka
      .replace(/{tgl_rapat}/g,      tglRapat)
      .replace(/{nama_sekolah}/g,   s.nama || '')
      .replace(/{kabupaten}/g,      s.kabupaten || '')
      .replace(/{tahun_ajaran}/g,   s.tahun_ajaran || '')
      .replace(/{kota}/g,           s.kota || '')
    doc.font(_fReg).fontSize(10).fillColor('#000')
      .text(pembukaText, ml, y, { width: cw, align: 'justify', lineGap: 4 })
    y += doc.heightOfString(pembukaText, { width: cw, lineGap: 4 }) + 14

    // ════════════════════════════════════════════════════════════════════
    // BIODATA — sesuai template asli: Nama Lengkap, No Peserta, Tgl Kelulusan
    // ════════════════════════════════════════════════════════════════════
    const lblX = ml + 4
    const sepX = ml + 170
    const valX = sepX + 6
    const valW = cw - 170 - 6

    function bioRow(label, value) {
      doc.font(_fReg).fontSize(9.5).fillColor('#000')
        .text(label, lblX, y, { width: 165, lineBreak: false })
        .text(':', sepX, y, { width: 5, lineBreak: false })
      if (value) {
        doc.text(value, valX, y, { width: valW, lineBreak: false })
      } else {
        dotLine(valX, y + 10, valW)
      }
      y += 16  // 1.5x
    }

    bioRow('Nama Lengkap',               siswa.nama || '')
    bioRow('Tempat, Tanggal Lahir',      siswa.tempat_lahir ? `${siswa.tempat_lahir}, ${fmtTgl(siswa.tgl_lahir)}` : '')
    bioRow('Nomor Induk Siswa',          siswa.nism || '')
    bioRow('Nomor Induk Siswa Nasional', siswa.nisn || '')
    bioRow('Nomor Peserta Ujian Sekolah',siswa.no_peserta || '')
    bioRow('Tanggal Kelulusan',          s.tgl_lulus ? tglSk : '')

    // Dinyatakan — label rata kiri, titik dua sejajar, lalu baris LULUS besar
    doc.font(_fReg).fontSize(9.5).fillColor('#000')
      .text('Dinyatakan', lblX, y, { width: 165, lineBreak: false })
      .text(':', sepX, y, { width: 5, lineBreak: false })
    y += 10

    // ════════════════════════════════════════════════════════════════════
    // LULUS — heading besar centered
    // ════════════════════════════════════════════════════════════════════
    doc.font(_fBold).fontSize(16).fillColor('#000')
      .text('LULUS', ml, y, { width: cw, align: 'center' })
    y += 22

    const subPara = `Dari ${s.nama || ''} Tahun Pelajaran ${s.tahun_ajaran || ''} dengan memperoleh nilai sebagai berikut :`
    doc.font(_fReg).fontSize(10)
      .text(subPara, ml, y, { width: cw, lineGap: 4 })
    y += doc.heightOfString(subPara, { width: cw, lineGap: 4 }) + 10

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
    doc.font(_fBold).fontSize(9).fillColor('#000')
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
      doc.font(_fReg).fontSize(9).fillColor('#000')
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
      doc.font(_fItal).fontSize(8.5).fillColor('#000')
        .text(label, ml + noW + 3, y + 2, { width: cw - noW - 6 })
      y += grpH
    }

    // ── Kumpulkan nilai IJAZAH untuk tabel SKL ──────────────────────────
    // Nilai Ijazah = (rata raport × bobot_raport + nilai_ujian × bobot_ujian) / totalB
    let allNilai = []
    const br_skl = (nilaiData._br || 60), bu_skl = (nilaiData._bu || 40), tb_skl = br_skl + bu_skl

    function calcNijSKL(siswaId, mapelId) {
      const nils = nilaiData[siswaId] || []
      // Rata-rata raport dari semua semester raport
      const raps = nils.filter(n => n.mapel_id === mapelId && n.semester_id !== ujianSemId && n.nilai_p != null)
      const rataR = raps.length > 0 ? raps.reduce((a,n)=>a+parseFloat(n.nilai_p),0)/raps.length : null
      // Nilai ujian
      const ujN = nils.find(n => n.mapel_id === mapelId && n.semester_id === ujianSemId && n.nilai_ujian != null)
      const ujVal = ujN ? parseFloat(ujN.nilai_ujian) : null
      if (rataR == null || ujVal == null) return null
      return (rataR * br_skl + ujVal * bu_skl) / tb_skl
    }

    let noCounter = 1
    mapelUmum.forEach((m) => {
      const nij = calcNijSKL(siswa.id, m.id)
      const val = nij != null ? fmtN(nij, 2) : ''
      if (nij != null) allNilai.push(nij)
      drawDataRow(String(noCounter++), m.nama || '', val)
    })

    if (hasMulok) {
      drawSubHeader('Muatan Lokal')
      mapelMulok.forEach((m) => {
        const nij = calcNijSKL(siswa.id, m.id)
        const val = nij != null ? fmtN(nij, 2) : ''
        if (nij != null) allNilai.push(nij)
        drawDataRow(String(noCounter++), m.nama || '', val)
      })
    }

    // ── Baris Rata-rata Nilai Ijazah ───────────────────────────────────
    const avg    = allNilai.length ? (allNilai.reduce((a, b) => a + b, 0) / allNilai.length) : null
    const avgStr = avg != null ? avg.toFixed(2) : ''

    doc.rect(ml, y, cw, rowH + 2).lineWidth(0.7).stroke('#000')
    doc.moveTo(ml + noW + mpW, y).lineTo(ml + noW + mpW, y + rowH + 2).lineWidth(0.5).stroke('#000')
    doc.font(_fBold).fontSize(9).fillColor('#000')
      .text('Rata-rata', ml + noW + 2, y + 3, { width: mpW - 4, align: 'center' })
    if (avgStr) doc.text(avgStr, ml + noW + mpW + 2, y + 3, { width: nilW - 4, align: 'center' })

    // Border luar tabel
    doc.moveTo(ml,      tblTop).lineTo(ml,      y + rowH + 2).lineWidth(0.7).stroke('#000')
    doc.moveTo(ml + cw, tblTop).lineTo(ml + cw, y + rowH + 2).lineWidth(0.7).stroke('#000')
    y += rowH + 2 + 10

    // ════════════════════════════════════════════════════════════════════
    // PARAGRAF PENUTUP — dari DB atau default
    // ════════════════════════════════════════════════════════════════════
    const penutupText = s.paragraf_penutup_skl ||
      'Demikian surat keterangan ini dibuat dengan sebenarnya untuk diketahui dan dipergunakan sebagaimana mestinya, dan bersifat/berlaku sementara sampai dengan diterbitkannya ijazah sebagai bukti kelulusan.'
    doc.font(_fReg).fontSize(10).fillColor('#000')
      .text(penutupText, ml, y, { width: cw, align: 'justify', lineGap: 4 })
    y += doc.heightOfString(penutupText, { width: cw, lineGap: 4 }) + 20

    // ════════════════════════════════════════════════════════════════════
    // TTD KEPALA — kanan, garis lebih lebar, nama bold + underline
    // ════════════════════════════════════════════════════════════════════
    const ttdX    = pw / 2 + 10
    const ttdW    = pw - mr - ttdX
    const tglStr  = s.tgl_lulus ? tglSk : '...................'
    const kotaStr = s.kota || '.....................'

    doc.font(_fReg).fontSize(9.5).fillColor('#000')
      .text(`${kotaStr}, ${tglStr}`, ttdX, y, { width: ttdW, align: 'center' })
    y += 12
    doc.text('Kepala Sekolah,', ttdX, y, { width: ttdW, align: 'center' })
    y += 85  // 3cm ruang tanda tangan

    const namaKepalaSkl = s.kepala ? s.kepala.toUpperCase() : ''
    const garisW = Math.min(ttdW - 10, Math.max(80, namaKepalaSkl.length * 5.8))
    const garisX = ttdX + (ttdW - garisW) / 2
    doc.moveTo(garisX, y).lineTo(garisX + garisW, y).lineWidth(0.7).stroke('#000')
    if (namaKepalaSkl) {
      doc.font(_fBold).fontSize(9.5)
        .text(namaKepalaSkl, ttdX, y - 15, { width: ttdW, align: 'center', underline: true })
    }
    y += 4
    doc.font(_fReg).fontSize(9)
      .text(`NIP. ${s.nip || '-'}`, ttdX, y, { width: ttdW, align: 'center' })
  })

  doc.end()
  return filePath
}


function generateNilaiIjazah(outputPath, { sekolah: s, siswaList, mapelList, nilaiData, ujianSemId, raportSemIds, br, bu, totalB }) {
  const PDFDocument = require('pdfkit')
  const A4 = getPaperSize(s, false)
  const doc = new PDFDocument({ size: A4, margin: 0 })
  const filePath = path.join(outputPath, 'Nilai_Ijazah_Semua.pdf')
  doc.pipe(fs.createWriteStream(filePath))

  const pw = A4[0], ph = A4[1]
  const ml = parseFloat(s.pdf_margin_left)  || 45
  const mr = parseFloat(s.pdf_margin_right) || 45
  const mt_doc = parseFloat(s.pdf_margin_top) || 18
  const cw = pw - ml - mr
  const {B:fB, R:fR, I:fI} = fontSetup(doc, s)
  const mb = 24

  function dotLineGray(x, y, w) {
    doc.save().lineWidth(0.4).stroke('#888')
      .moveTo(x,y).lineTo(x+w,y).stroke().restore()
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
    let y = drawKopBadrussalam(doc, s, ml, cw, parseFloat(s.pdf_margin_top)||18)
    doc.font(fB).fontSize(12).fillColor('#000')
      .text('DAFTAR NILAI', ml, y, { width: cw, align: 'center' })
    y += 14
    doc.font(fB).fontSize(10)
      .text(`TAHUN PELAJARAN ${s.tahun_ajaran || ''}`, ml, y, { width: cw, align: 'center' })
    y += 18

    // ════════════════════════════════════════════════════════════════════
    // BIODATA — 4 baris, label kiri, titik dua, garis titik kanan
    // ════════════════════════════════════════════════════════════════════
    const sepX = ml + 148
    const valX = sepX + 6
    const valW = cw - 148 - 6

    function bioRow(label, value) {
      doc.font(fR).fontSize(10).fillColor('#000')
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

    doc.font(fB).fontSize(8.5).fillColor('#000')
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
        doc.font(fB).fontSize(9).fillColor('#000')
          .text(noStr, ml+noW+3, tY, { width: cw-noW-6 })
        y += grpH
        return
      }

      const { raport, ujian, nij } = calcNij(siswa.id, m.id)
      if (nij != null) allNij.push(nij)

      doc.font(fR).fontSize(9).fillColor('#000')
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
    doc.font(fB).fontSize(9).fillColor('#000')
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
    doc.font(fR).fontSize(9.5).fillColor('#000')
      .text(`${kotaStr}, ${tglStr}`, ttdX, y, { width: ttdW, align: 'center' })
    y += 12
    doc.text(`Kepala ${s.nama || ''}`, ttdX, y, { width: ttdW, align: 'center' })
    y += 85  // 3cm ruang tanda tangan

    const namaKepalaNi = s.kepala ? s.kepala.toUpperCase() : ''
    const garisWni = Math.min(ttdW - 10, Math.max(80, namaKepalaNi.length * 5.8))
    const garisXni = ttdX + (ttdW - garisWni) / 2
    doc.moveTo(garisXni, y).lineTo(garisXni+garisWni, y).lineWidth(0.7).stroke('#000')
    if (namaKepalaNi) {
      doc.font(fB).fontSize(9.5)
        .text(namaKepalaNi, ttdX, y-15, { width: ttdW, align: 'center', underline: true })
    }
    y += 5
    doc.font(fR).fontSize(9)
      .text(`NIP. ${s.nip || ''}`, ttdX, y, { width: ttdW, align: 'center' })
  })

  doc.end()
  return filePath
}

function generateDKN(outputPath, { sekolah: s, siswaList, mapelList, nilaiData, ujianSemId, raportSemIds, br, bu, totalB }) {
  const PDFDocument = require('pdfkit')
  // A4 landscape = 297mm x 210mm → dalam pt
  const A4L = getPaperSize(s, true)
  const doc = new PDFDocument({ size: A4L, margin: 0 })
  const filePath = path.join(outputPath, 'DKN_Lengkap.pdf')
  doc.pipe(fs.createWriteStream(filePath))

  const pw = A4L[0], ph = A4L[1]
  const ml = parseFloat(s.pdf_margin_left)   || 25
  const mr = parseFloat(s.pdf_margin_right)  || 25
  const mt = parseFloat(s.pdf_margin_top)    || 20
  const mb = parseFloat(s.pdf_margin_bottom) || 20
  const cw = pw - ml - mr
  const {B:fB, R:fR, I:fI} = fontSetup(doc, s)

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
  doc.font(fB).fontSize(12).fillColor('#000')
    .text('DAFTAR KUMPULAN NILAI (DKN)', ml, y, { width: cw, align: 'center' })
  y += 13
  doc.font(fR).fontSize(9)
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
  doc.font(fB).fontSize(8).fillColor('#000')
    .text('No',          xh + 1, hTextY, { width: noW - 2,   align: 'center' }); xh += noW
  doc.text('Nama Siswa', xh + 2, hTextY, { width: namaW - 4, align: 'center' }); xh += namaW
  doc.text('NISN',       xh + 1, hTextY, { width: nisnW - 2, align: 'center' }); xh += nisnW

  mapelList.forEach((m, i) => {
    // Nama mapel disingkat agar muat
    const maxLen = Math.floor(mW / 4.5)
    const label  = m.nama.length > maxLen ? m.nama.slice(0, maxLen - 1) + '.' : m.nama
    doc.font(fB).fontSize(6.5)
      .text(label, xh + 1, y + 2, { width: mW - 2, align: 'center' })
    // Nomor urut mapel di bawah nama
    doc.font(fR).fontSize(6)
      .text(`(${i + 1})`, xh + 1, y + hdrH - 10, { width: mW - 2, align: 'center' })
    xh += mW
  })
  doc.font(fB).fontSize(8)
    .text('Rata', xh + 1, hTextY, { width: rataW - 2, align: 'center' })

  y += hdrH

  // ── BARIS DATA SISWA ──────────────────────────────────────────────────
  siswaList.forEach((siswa, i) => {
    if (y + clampedRowH > ph - mb) {
      // Halaman baru — ulangi header singkat
      doc.addPage()
      y = mt
      doc.font(fR).fontSize(7).fillColor('#888')
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
    doc.font(fR).fontSize(8).fillColor('#000')
      .text(String(siswa.no_urut || i + 1), x + 1, tY, { width: noW - 2, align: 'center' }); x += noW
    doc.font(fB).fontSize(7.5)
      .text(siswa.nama || '', x + 2, tY, { width: namaW - 4 }); x += namaW
    doc.font(fR).fontSize(7.5)
      .text(siswa.nisn || '-', x + 1, tY, { width: nisnW - 2, align: 'center' }); x += nisnW

    let sumNij = 0, cntNij = 0
    mapelList.forEach(m => {
      const nij = calcNij(siswa.id, m.id)
      if (nij != null) { sumNij += nij; cntNij++ }
      doc.font(fR).fontSize(8)
        .text(nij != null ? nij.toFixed(1) : '-', x + 1, tY, { width: mW - 2, align: 'center' })
      x += mW
    })

    const rata = cntNij > 0 ? (sumNij / cntNij).toFixed(2) : '-'
    doc.font(fB).fontSize(8)
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

  doc.font(fR).fontSize(9.5).fillColor('#000')
    .text(`${s.kota || ''}, ${tglSk}`, ttdX, y, { width: ttdW, align: 'center' })
  y += 13
  doc.text(`Kepala ${s.nama || ''}`, ttdX, y, { width: ttdW, align: 'center' })
  y += 85  // 3cm ruang tanda tangan
  const namaKepalaDkn = s.kepala ? s.kepala.toUpperCase() : ''
  const garisWdkn = Math.min(ttdW - 10, Math.max(80, namaKepalaDkn.length * 5.8))
  const garisXdkn = ttdX + (ttdW - garisWdkn) / 2
  doc.moveTo(garisXdkn, y).lineTo(garisXdkn + garisWdkn, y).lineWidth(0.7).stroke('#000')
  if (namaKepalaDkn) {
    doc.font(fB).fontSize(9.5)
      .text(namaKepalaDkn, ttdX, y - 16, { width: ttdW, align: 'center', underline: true })
  }
  y += 6
  doc.font(fR).fontSize(9)
    .text(`NIP. ${s.nip || ''}`, ttdX, y, { width: ttdW, align: 'center' })

  doc.end()
  return filePath
}


function exportExcelAngkatan(outputPath, { sekolah: s, angkatan, siswaList, mapelList, semList, nilaiData, ujianSemId, raportSemIds, br, bu, totalB }) {
  const { Workbook } = require('./excel-builder')
  const path_mod     = require('path')

  const raportSems = semList.filter(s => !s.is_ujian)
  const ujianSem   = semList.find(s => s.is_ujian)

  function getNilai(siswaId, mapelId, semId) {
    return (nilaiData[siswaId] || []).find(n => n.mapel_id === mapelId && n.semester_id === semId)
  }

  const wb = new Workbook()

  // ── Sheet 1: Nilai Ijazah (1 siswa 1 baris, kolom per mapel) ─────────
  const ws1 = wb.addSheet('Nilai Ijazah')
  ws1.setColWidths([5, 32, 14, ...mapelList.map(() => 12), 14])
  ws1.freezePane(2, 3)
  // Baris info
  ws1.mergeCell(1, 1, 1, 3 + mapelList.length + 1)
  ws1.addRow(
    [`Nilai Ijazah = (Rata Raport × ${br}%) + (Nilai Ujian × ${bu}%)   |   Angkatan: ${angkatan?.nama || 'Semua'}`],
    'subheader', 18
  )
  // Header
  ws1.addRow(
    ['No', 'Nama Siswa', 'NISN', ...mapelList.map(m => m.nama), 'Rata NIJ'],
    'header', 36
  )
  // Data per siswa
  siswaList.forEach((sw, ri) => {
    let sumNij = 0, cntNij = 0
    const nijCells = mapelList.map(m => {
      const raps  = raportSems.map(sem => getNilai(sw.id, m.id, sem.id)?.nilai_p).filter(v => v != null)
      const rataR = raps.length === raportSems.length && raps.length > 0
        ? raps.reduce((a,b) => a + parseFloat(b), 0) / raps.length : null
      const ujN   = ujianSem ? getNilai(sw.id, m.id, ujianSem.id) : null
      const ujVal = ujN?.nilai_ujian != null ? parseFloat(ujN.nilai_ujian) : null
      const nij   = rataR != null && ujVal != null
        ? parseFloat(((rataR*br + ujVal*bu)/totalB).toFixed(2)) : null
      if (nij != null) { sumNij += nij; cntNij++ }
      return nij ?? ''
    })
    const avg = cntNij > 0 ? parseFloat((sumNij/cntNij).toFixed(2)) : ''
    ws1.addRow(
      [ri+1, sw.nama||'', sw.nisn||'', ...nijCells, avg],
      ['data_l','data_l','data', ...mapelList.map(()=>'data'), 'data'],
      16, ri
    )
  })

  // ── Sheet 2: Rekap Nilai (1 siswa 1 baris, kolom Rata Sem1..N, RataRap, US, NIJ) ─
  const ws2 = wb.addSheet('Rekap Nilai')
  const semLabels = raportSems.map(s => s.label)
  ws2.setColWidths([5, 32, 14, ...raportSems.map(()=>12), 14, 13, 14])
  ws2.freezePane(1, 3)
  ws2.addRow(
    ['No', 'Nama Siswa', 'NISN',
     ...semLabels,
     'Rata Raport', 'Nilai Ujian', 'Nilai Ijazah'],
    'header', 36
  )
  siswaList.forEach((sw, ri) => {
    // Per siswa: rata semua mapel per semester
    const rataPerSem = raportSems.map(sem => {
      const vals = mapelList.map(m => {
        const n = getNilai(sw.id, m.id, sem.id)
        return n?.nilai_p != null ? parseFloat(n.nilai_p) : null
      }).filter(v => v !== null)
      return vals.length > 0 ? parseFloat((vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2)) : null
    })
    // Rata raport keseluruhan (rata dari semua nilai_p semua mapel semua sem raport)
    const allRap = mapelList.flatMap(m =>
      raportSems.map(sem => {
        const n = getNilai(sw.id, m.id, sem.id)
        return n?.nilai_p != null ? parseFloat(n.nilai_p) : null
      })
    ).filter(v => v !== null)
    const rataRap = allRap.length > 0 ? parseFloat((allRap.reduce((a,b)=>a+b,0)/allRap.length).toFixed(2)) : null
    // Rata nilai ujian semua mapel
    const allUji = mapelList.map(m => {
      const n = ujianSem ? getNilai(sw.id, m.id, ujianSem.id) : null
      return n?.nilai_ujian != null ? parseFloat(n.nilai_ujian) : null
    }).filter(v => v !== null)
    const rataUji = allUji.length > 0 ? parseFloat((allUji.reduce((a,b)=>a+b,0)/allUji.length).toFixed(2)) : null
    // NIJ
    let sumNij=0, cntNij=0
    mapelList.forEach(m => {
      const raps = raportSems.map(sem=>getNilai(sw.id,m.id,sem.id)?.nilai_p).filter(v=>v!=null)
      const rataR = raps.length===raportSems.length&&raps.length>0 ? raps.reduce((a,b)=>a+parseFloat(b),0)/raps.length : null
      const ujN  = ujianSem ? getNilai(sw.id,m.id,ujianSem.id) : null
      const ujV  = ujN?.nilai_ujian!=null ? parseFloat(ujN.nilai_ujian) : null
      const nij  = rataR!=null&&ujV!=null ? (rataR*br+ujV*bu)/totalB : null
      if (nij!=null){sumNij+=nij;cntNij++}
    })
    const avgNij = cntNij>0 ? parseFloat((sumNij/cntNij).toFixed(2)) : null
    ws2.addRow(
      [ri+1, sw.nama||'', sw.nisn||'',
       ...rataPerSem.map(v => v??''),
       rataRap??'', rataUji??'', avgNij??''],
      ['data_l','data_l','data',...raportSems.map(()=>'data'),'data','data','data'],
      16, ri
    )
  })

  // ── Sheet 3: Detail per Mata Pelajaran ───────────────────────────────
  mapelList.forEach(m => {
    const wsM = wb.addSheet(m.nama.slice(0, 31))
    const pctR = `Bobot (${br}%)`
    const pctU = `Bobot (${bu}%)`
    wsM.setColWidths([5, 32, 14, ...raportSems.map(()=>10), 13, 15, 13, 15, 14])
    wsM.freezePane(1, 3)
    wsM.addRow(
      ['No','Nama Siswa','NISN',...semLabels,'Rata Raport',pctR,'Nilai Ujian',pctU,'Nilai Ijazah'],
      'header', 36
    )
    siswaList.forEach((sw, ri) => {
      const rapVals = []
      const semCells = raportSems.map(sem => {
        const n = getNilai(sw.id, m.id, sem.id)
        const v = n?.nilai_p != null ? parseFloat(n.nilai_p) : null
        if (v!=null) rapVals.push(v)
        return v??''
      })
      const rataR  = rapVals.length>0 ? rapVals.reduce((a,b)=>a+b,0)/rapVals.length : null
      const ujN    = ujianSem ? getNilai(sw.id, m.id, ujianSem.id) : null
      const ujVal  = ujN?.nilai_ujian!=null ? parseFloat(ujN.nilai_ujian) : null
      const nilRap = rataR!=null ? parseFloat((rataR*br/totalB).toFixed(2)) : null
      const nilUji = ujVal!=null ? parseFloat((ujVal*bu/totalB).toFixed(2)) : null
      const nij    = nilRap!=null&&nilUji!=null ? parseFloat((nilRap+nilUji).toFixed(2)) : null
      wsM.addRow(
        [ri+1, sw.nama||'', sw.nisn||'', ...semCells,
         rataR!=null?parseFloat(rataR.toFixed(2)):'',
         nilRap??'', ujVal??'', nilUji??'', nij??''],
        ['data_l','data_l','data',...raportSems.map(()=>'data'),'data','data','data','data','data'],
        16, ri
      )
    })
  })

  const fname    = `Nilai_Angkatan_${(angkatan?.nama||'Semua').replace(/[^a-zA-Z0-9]/g,'_')}_${Date.now()}.xlsx`
  const filePath = path_mod.join(outputPath, fname)
  return wb.writeFile(filePath).then(() => filePath)
}

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
    const font = opts?.bold ? fB : fR
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

  // Font dari DB
  const {B:fB, R:fR, I:fI} = fontSetup(doc, s)

  siswaList.forEach((siswa, idx) => {
    if (idx > 0) doc.addPage()

    // ════════════════════════════════════════════════════════════════════
    // BORDER KOTAK LUAR — ganda (sesuai blanko ijazah resmi)
    // ════════════════════════════════════════════════════════════════════
    const bOuter = 6   // jarak dari tepi halaman ke garis luar
    const bInner = 11  // jarak dari tepi halaman ke garis dalam
    doc.save().lineWidth(2).stroke('#000')
      .rect(bOuter, bOuter, pw - bOuter*2, ph - bOuter*2).stroke().restore()
    doc.save().lineWidth(0.6).stroke('#000')
      .rect(bInner, bInner, pw - bInner*2, ph - bInner*2).stroke().restore()

    // ════════════════════════════════════════════════════════════════════
    // No. Ijazah — pojok kanan atas
    // ════════════════════════════════════════════════════════════════════
    doc.font(fR).fontSize(9).fillColor('#000')
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
    doc.font(fB).fontSize(6.2).fillColor('#000')
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
    doc.font(fB).fontSize(8.5).fillColor('#000')
      .text('NOMENKLATUR KEMENTERIAN YANG MENYELENGGARAKAN', ml, y, { width: cw, align: 'center' })
    y += 12
    doc.text('URUSAN PEMERINTAHAN DI BIDANG PENDIDIKAN.', ml, y, { width: cw, align: 'center' })
    y += 24

    // ════════════════════════════════════════════════════════════════════
    // IJAZAH — bold besar
    // ════════════════════════════════════════════════════════════════════
    doc.font(fB).fontSize(28).fillColor('#000')
      .text('IJAZAH', ml, y, { width: cw, align: 'center' })
    y += 36

    // ════════════════════════════════════════════════════════════════════
    // GARIS TITIK (untuk nama satuan pendidikan — diisi sistem)
    // Di blanko kosong: hanya garis titik centered panjang
    // Di blanko terisi: nama sekolah bold di atasnya
    // ════════════════════════════════════════════════════════════════════
    if (s.nama) {
      const namaSekolah = s.nama.toUpperCase()
      doc.font(fB).fontSize(10).fillColor('#000')
        .text(namaSekolah, ml, y, { width: cw, align: 'center' })
    }
    y += 10

    // TAHUN AJARAN
    doc.font(fR).fontSize(10).fillColor('#000')
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
    doc.font(fR).fontSize(10).fillColor('#000')
      .text('Dengan ini menyatakan bahwa:', ml, y, { width: cw, align: 'center' })
    y += 32

    // ════════════════════════════════════════════════════════════════════
    // NAMA SISWA — garis titik panjang (nama dicetak di atasnya oleh sistem)
    // ════════════════════════════════════════════════════════════════════
    y += 10  // padding atas nama
    if (siswa.nama) {
      const namaSiswa = siswa.nama.toUpperCase()
      doc.font(fB).fontSize(12).fillColor('#000')
        .text(namaSiswa, ml, y, { width: cw, align: 'center' })
    }
    y += 18  // padding bawah nama

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
      doc.font(fR).fontSize(10).fillColor('#000')
        .text(label, lx, y, { width: 154, lineBreak: false })
        .text(':', sepX, y, { width: 8, lineBreak: false })
      if (value) {
        doc.font(fR).fontSize(10)
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
    doc.font(fB).fontSize(24).fillColor('#000')
      .text('L U L U S', ml, y, { width: cw, align: 'center' })
    y += 28

    doc.font(fR).fontSize(10).fillColor('#000')
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
    doc.font(fR).fontSize(9.5).fillColor('#000')
      .text(paraText, lx, y, { width: cw - 8, align: 'justify', lineGap: 4 })
    y += doc.heightOfString(paraText, { width: cw - 8, fontSize: 9.5, lineGap: 4 }) + 28

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
        doc.font(fR).fontSize(6).fillColor('#aaa')
          .text('Foto Tidak Valid', fotoX+2, fotoY+fotoH/2-6, { width:fotoW-4, align:'center' })
      }
    } else {
      doc.font(fR).fontSize(8).fillColor('#555')
        .text('pasfoto\n3x4 cm\nhitam putih\natau\nberwarna',
              fotoX+2, fotoY+20, { width:fotoW-4, align:'center' })
    }
    doc.fillColor('#000')

    // TTD Kepala — kanan foto, rata
    const ttdX = fotoX + fotoW + 22
    const ttdW = pw - mr - ttdX

    doc.font(fR).fontSize(10)
      .text(`${s.kota || ''}, ${tglSk}`, ttdX, fotoY + 4, { width: ttdW, align: 'center' })
    doc.text('Kepala,', ttdX, fotoY + 18, { width: ttdW, align: 'center' })

    // Nama kepala — garis bawah dinamis sesuai panjang nama
    const namaTTDy = fotoY + fotoH - 16
    if (s.kepala) {
      doc.font(fB).fontSize(9.5)
        .text(s.kepala, ttdX, namaTTDy - 13, { width: ttdW, align: 'center', underline: true })
      // Garis bawah nama — panjang dinamis
      const namaW = Math.min(doc.widthOfString(s.kepala, { font:'Helvetica-Bold', fontSize:9.5 }) + 10, ttdW - 10)
      const namaX = ttdX + (ttdW - namaW) / 2
      doc.save().lineWidth(0.5).stroke('#000')
        .moveTo(namaX, namaTTDy).lineTo(namaX + namaW, namaTTDy).stroke().restore()
    }
    doc.font(fR).fontSize(9.5)
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
  // A4 = 210mm x 297mm → dalam pt
  const A4 = getPaperSize(s, false)
  const doc = new PDFDocument({ size: A4, margin: 0 })
  const filePath = path.join(outputPath, 'Transkrip_Nilai_Semua.pdf')
  doc.pipe(fs.createWriteStream(filePath))

  const pw = A4[0], ph = A4[1]
  const ml = parseFloat(s.pdf_margin_left)  || 40
  const mr = parseFloat(s.pdf_margin_right) || 40
  const cw = pw - ml - mr
  const {B:fB, R:fR, I:fI} = fontSetup(doc, s)
  const mb = 28   // margin bawah

  function dotLine(x, y, w) {
    doc.save().lineWidth(0.5).stroke('#000')
      .moveTo(x, y).lineTo(x + w, y).stroke().restore()
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
    let y = drawKopBadrussalam(doc, s, ml, cw, parseFloat(s.pdf_margin_top)||18)

    // ════════════════════════════════════════════════════════════════════
    // JUDUL
    // ════════════════════════════════════════════════════════════════════
    doc.font(fB).fontSize(13).fillColor('#000')
      .text('TRANSKRIP NILAI', ml, y, { width: cw, align: 'center' })
    y += 16
    doc.font(fR).fontSize(9.5)
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
      doc.font(fR).fontSize(9.5).fillColor('#000')
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
    doc.font(fB).fontSize(10).fillColor('#000')
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
      doc.font(fR).fontSize(9.5).fillColor('#000')
        .text(`${i + 1}.`, ml + 2, textY, { width: noW - 4, align: 'center' })
        .text(m.nama || '', ml + noW + 4, textY, { width: mpW - 8 })
      if (v != null) {
        doc.font(fR).fontSize(9.5)
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
        doc.font(fR).fontSize(9).fillColor('#000')
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

    doc.font(fR).fontSize(9.5).fillColor('#000')
      .text(`${s.kota || ''}, ${tglSk}`, ttdX, y, { width: ttdW, align: 'center' })
    y += 14
    doc.text('Kepala,', ttdX, y, { width: ttdW, align: 'center' })
    y += 85   // 3cm ruang tanda tangan

    const namaKepalaTr = s.kepala ? s.kepala.toUpperCase() : ''
    const garisWtr = Math.min(ttdW - 10, Math.max(80, namaKepalaTr.length * 5.8))
    const garisXtr = ttdX + (ttdW - garisWtr) / 2
    doc.moveTo(garisXtr, y).lineTo(garisXtr + garisWtr, y).lineWidth(0.7).stroke('#000')
    if (namaKepalaTr) {
      doc.font(fB).fontSize(9.5)
        .text(namaKepalaTr, ttdX, y - 15, { width: ttdW, align: 'center', underline: true })
    }
    y += 5
    doc.font(fR).fontSize(9.5)
      .text(`NIP. ${s.nip || '...................................'}`, ttdX, y, { width: ttdW, align: 'center' })
    y += 30

    // ════════════════════════════════════════════════════════════════════
    // FOOTNOTE italic
    // ════════════════════════════════════════════════════════════════════
    doc.font(fI).fontSize(8.5).fillColor('#000')
      .text(
        'Transkrip Nilai ini telah dicetak ulang tanpa mengubah muatan Transkrip Nilai dan ' +
        'ditandatangani sesuai dengan ketentuan yang berlaku.',
        ml, y, { width: cw, align: 'justify', lineGap: 4 }
      )
  })

  doc.end()
  return filePath
}



function generateSKKelulusan(outputPath, { sekolah: s, siswaList }) {
  const PDFDocument = require('pdfkit')
  const A4sk = getPaperSize(s, false)
  const doc = new PDFDocument({ size: A4sk, margin: 0 })
  const filePath = path.join(outputPath, 'SK_Penetapan_Kelulusan.pdf')
  doc.pipe(fs.createWriteStream(filePath))

  const pw = A4sk[0], ph = A4sk[1]
  const ml = parseFloat(s.pdf_margin_left)  || 50
  const mr = parseFloat(s.pdf_margin_right) || 50
  const {B:fB, R:fR, I:fI} = fontSetup(doc, s)
  const cw = pw - ml - mr
  const mb = 30

  const __electronDir = path.dirname(__filename)

  // ════════════════════════════════════════════════════════════════════
  // KOP — sesuai referensi SMPIT Badrussalam
  // ════════════════════════════════════════════════════════════════════
  let y = drawKopBadrussalam(doc, s, ml, cw, parseFloat(s.pdf_margin_top)||18)

  // ════════════════════════════════════════════════════════════════════
  // JUDUL
  // ════════════════════════════════════════════════════════════════════
  doc.font(fB).fontSize(11).fillColor('#000')
    .text('KEPUTUSAN KEPALA', ml, y, { width: cw, align: 'center' })
  y += 13
  doc.font(fB).fontSize(11)
    .text((s.nama || '').toUpperCase(), ml, y, { width: cw, align: 'center' })
  y += 13
  doc.font(fB).fontSize(10)
    .text(`NOMOR : ${s.no_sk || '............................................'}`, ml, y, { width: cw, align: 'center' })
  y += 12
  doc.font(fR).fontSize(9.5)
    .text('TENTANG', ml, y, { width: cw, align: 'center' })
  y += 11
  doc.font(fB).fontSize(10)
    .text(`PENETAPAN KELULUSAN PESERTA DIDIK ${(s.nama || '').toUpperCase()}`, ml, y, { width: cw, align: 'center' })
  y += 11
  doc.font(fB).fontSize(10)
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
    doc.font(fB).fontSize(9.5).fillColor('#000')
      .text(label, ml, y, { width: lblW, lineBreak: false })
      .text(':', ml + lblW, y, { width: 6, lineBreak: false })
    y += 14
  }

  function konsideranItem(no, teks) {
    const h = doc.heightOfString(teks, { width: txtW, font: 'Helvetica', fontSize: 9.5 })
    doc.font(fR).fontSize(9.5).fillColor('#000')
      .text(no, ml + lblW + 6, y, { width: noW, lineBreak: false })
      .text(teks, txtX, y, { width: txtW, align: 'justify', lineGap: 4 })
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
  doc.font(fB).fontSize(10).fillColor('#000')
    .text('MEMUTUSKAN :', ml, y, { width: cw, align: 'center' })
  y += 16

  function diktum(urutan, judul, isi) {
    doc.font(fB).fontSize(9.5).fillColor('#000')
      .text(urutan, ml, y, { width: lblW, lineBreak: false })
      .text(':', ml + lblW, y, { width: 6, lineBreak: false })
      .text(judul, txtX, y, { width: txtW })
    y += 12
    if (isi) {
      const h = doc.heightOfString(isi, { width: txtW, font: 'Helvetica', fontSize: 9.5, lineGap: 4 })
      doc.font(fR).fontSize(9.5)
        .text(isi, txtX, y, { width: txtW, align: 'justify', lineGap: 4 })
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
  doc.font(fR).fontSize(9.5).fillColor('#000')
    .text(`Ditetapkan di : ${s.kota || '.....................'}`, ml, y)
  y += 13
  doc.text(`Pada tanggal  : ${tglSk || '.....................'}`, ml, y)
  y += 22

  // TTD — kanan
  const ttdX = pw / 2 + 10
  const ttdW = pw - mr - ttdX
  doc.font(fR).fontSize(9.5).text('Kepala,', ttdX, y, { width: ttdW, align: 'center' })
  y += 85  // 3cm ruang tanda tangan

  const namaKepalaSk = s.kepala ? s.kepala.toUpperCase() : ''
  const garisWsk = Math.min(ttdW - 10, Math.max(80, namaKepalaSk.length * 5.8))
  const garisXsk = ttdX + (ttdW - garisWsk) / 2
  doc.moveTo(garisXsk, y).lineTo(garisXsk + garisWsk, y).lineWidth(0.7).stroke('#000')
  if (namaKepalaSk) {
    doc.font(fB).fontSize(9.5)
      .text(namaKepalaSk, ttdX, y - 15, { width: ttdW, align: 'center', underline: true })
  }
  y += 5
  doc.font(fR).fontSize(9)
    .text(`NIP. ${s.nip || ''}`, ttdX, y, { width: ttdW, align: 'center' })

  // ════════════════════════════════════════════════════════════════════
  // HALAMAN 2 — LAMPIRAN: DAFTAR NAMA PESERTA DIDIK
  // ════════════════════════════════════════════════════════════════════
  doc.addPage()
  y = 30

  doc.font(fB).fontSize(10).fillColor('#000')
    .text('LAMPIRAN KEPUTUSAN KEPALA', ml, y, { width: cw, align: 'center' })
  y += 12
  doc.font(fB).fontSize(10)
    .text((s.nama || '').toUpperCase(), ml, y, { width: cw, align: 'center' })
  y += 12
  doc.font(fR).fontSize(9.5)
    .text(`NOMOR : ${s.no_sk || ''}`, ml, y, { width: cw, align: 'center' })
  y += 10
  doc.font(fR).fontSize(9.5)
    .text(`TANGGAL : ${tglSk || ''}`, ml, y, { width: cw, align: 'center' })
  y += 14

  doc.font(fB).fontSize(10)
    .text('DAFTAR NAMA PESERTA DIDIK YANG DINYATAKAN LULUS', ml, y, { width: cw, align: 'center' })
  y += 10
  doc.font(fB).fontSize(10)
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
  doc.font(fB).fontSize(9.5).fillColor('#000')
    .text('No.',  ml,             y+5, { width: noW2,  align: 'center' })
    .text('Nama Peserta Didik', ml+noW2, y+5, { width: namaW, align: 'center' })
    .text('NISN', ml+noW2+namaW, y+5, { width: nisnW, align: 'center' })
  y += hH

  // Baris siswa
  siswaList.forEach((siswa, i) => {
    doc.rect(ml, y, cw, rH).lineWidth(0.5).stroke('#000')
    doc.moveTo(ml+noW2,       y).lineTo(ml+noW2,       y+rH).lineWidth(0.4).stroke('#000')
    doc.moveTo(ml+noW2+namaW, y).lineTo(ml+noW2+namaW, y+rH).lineWidth(0.4).stroke('#000')
    doc.font(fR).fontSize(9.5).fillColor('#000')
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
  // A4 = 210mm x 297mm → dalam pt (1mm = 2.8346pt)
  const A4 = getPaperSize(s, false)
  const doc = new PDFDocument({ size: A4, margin: 0 })
  const filePath = path.join(outputPath, 'SKKB_Semua.pdf')
  doc.pipe(fs.createWriteStream(filePath))

  const pw = A4[0], ph = A4[1]
  const ml = parseFloat(s.pdf_margin_left)  || 50
  const mr = parseFloat(s.pdf_margin_right) || 45
  const cw = pw - ml - mr
  const {B:fB, R:fR, I:fI} = fontSetup(doc, s)

  const __electronDir = path.dirname(__filename)

  siswaList.forEach((siswa, idx) => {
    if (idx > 0) doc.addPage()

    // ════════════════════════════════════════════════════════════════════
    // KOP — pakai fungsi terpusat drawKopBadrussalam
    // ════════════════════════════════════════════════════════════════════
    let y = drawKopBadrussalam(doc, s, ml, cw, parseFloat(s.pdf_margin_top)||18)

    // ════════════════════════════════════════════════════════════════════
    // JUDUL
    // ════════════════════════════════════════════════════════════════════
    doc.font(fB).fontSize(12).fillColor('#000')
      .text('SURAT KETERANGAN KELAKUAN BAIK', ml, y, { width: cw, align: 'center', underline: true })
    y += 14
    doc.font(fB).fontSize(10)
      .text(`Nomor : ${siswa.no_skkb || s.no_skkb || '...................................................'}`,
            ml, y, { width: cw, align: 'center' })
    y += 22

    // ════════════════════════════════════════════════════════════════════
    // PEMBUKA — "Yang bertandatangan di bawah ini:"
    // ════════════════════════════════════════════════════════════════════
    doc.font(fR).fontSize(10.5).fillColor('#000')
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
      doc.font(fR).fontSize(10.5).fillColor('#000')
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
    doc.font(fR).fontSize(10.5).fillColor('#000')
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
    doc.font(fR).fontSize(10.5).fillColor('#000')
      .text(fullText, ml, y, { width: cw, align: 'justify', lineGap: 4 })
    y += doc.heightOfString(fullText, { width: cw, font: 'Helvetica', fontSize: 10.5, lineGap: 4 }) + 20

    // ════════════════════════════════════════════════════════════════════
    // PENUTUP
    // ════════════════════════════════════════════════════════════════════
    doc.font(fR).fontSize(10.5)
      .text('Demikian surat keterangan ini dibuat dengan sebenarnya, untuk dapat diketahui dan dipergunakan semestinya.',
            ml, y, { width: cw, align: 'justify', lineGap: 4 })
    y += 40

    // ════════════════════════════════════════════════════════════════════
    // TTD — kanan
    // ════════════════════════════════════════════════════════════════════
    const tglSk = fmtTgl(s.tgl_lulus)
    const kotaStr = s.kota || '.....................'
    const tglStr  = s.tgl_lulus ? tglSk : '...................'
    const ttdX    = pw / 2 + 10
    const ttdW    = pw - mr - ttdX

    doc.font(fR).fontSize(10.5).fillColor('#000')
      .text(`${kotaStr}, ${tglStr}`, ttdX, y, { width: ttdW, align: 'center' })
    y += 12
    doc.text('Kepala Sekolah', ttdX, y, { width: ttdW, align: 'center' })
    y += 85  // 3cm ruang tanda tangan

    const namaKepalaSkkb = s.kepala ? s.kepala.toUpperCase() : ''
    const garisWSkkb = Math.min(ttdW - 10, Math.max(80, namaKepalaSkkb.length * 5.8))
    const garisXSkkb = ttdX + (ttdW - garisWSkkb) / 2
    doc.moveTo(garisXSkkb, y).lineTo(garisXSkkb + garisWSkkb, y).lineWidth(0.7).stroke('#000')
    if (namaKepalaSkkb) {
      doc.font(fB).fontSize(10.5)
        .text(namaKepalaSkkb, ttdX, y - 15, { width: ttdW, align: 'center', underline: true })
      y += 13
    }
    if (s.nip) {
      doc.font(fR).fontSize(10).text(`NIP. ${s.nip}`, ttdX, y, { width: ttdW, align: 'center' })
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
