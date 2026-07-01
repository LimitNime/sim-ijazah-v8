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
        .text(namaKepalaSkl, ttdX, y - 15, { width: ttdW, align: 'center' })
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
        .text(namaKepalaNi, ttdX, y-15, { width: ttdW, align: 'center' })
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
      .text(namaKepalaDkn, ttdX, y - 16, { width: ttdW, align: 'center' })
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
        .text(s.kepala, ttdX, namaTTDy - 13, { width: ttdW, align: 'center' })
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
    y += 26

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
    doc.text('Kepala Sekolah,', ttdX, y, { width: ttdW, align: 'center' })
    y += 85   // 3cm ruang tanda tangan

    const namaKepalaTr = s.kepala ? s.kepala.toUpperCase() : ''
    const garisWtr = Math.min(ttdW - 10, Math.max(80, namaKepalaTr.length * 5.8))
    const garisXtr = ttdX + (ttdW - garisWtr) / 2
    doc.moveTo(garisXtr, y).lineTo(garisXtr + garisWtr, y).lineWidth(0.7).stroke('#000')
    if (namaKepalaTr) {
      doc.font(fB).fontSize(9.5)
        .text(namaKepalaTr, ttdX, y - 15, { width: ttdW, align: 'center' })
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
      .text(namaKepalaSk, ttdX, y - 15, { width: ttdW, align: 'center' })
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
        .text(namaKepalaSkkb, ttdX, y - 15, { width: ttdW, align: 'center' })
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
  generateBukuKleper,
  generateBukuInduk,
  generateLeger,
  generateBukuIndukGuru,
  generateAbsensiGuru,
  generateJadwal,
  generateJurnal,
  generateAbsensiSiswa,
  generateSurat,
  generateKartuUjian,
  generateRekapBOS,
  generateRaportSiswa,
  generateRaportAll,
}

// ══════════════════════════════════════════════════════════════════════════
//  BUKU KLEPER — PDF Indeks Alfabetis Siswa
// ══════════════════════════════════════════════════════════════════════════
function generateBukuKleper(outputPath, { sekolah: s, siswaList }) {
  const PDFDocument = require('pdfkit')
  const fs = require('fs')
  const path = require('path')
  const A4 = getPaperSize(s, false)
  const [pw, ph] = A4
  const ml = parseFloat(s.pdf_margin_left) || 45
  const mr = parseFloat(s.pdf_margin_right) || 45
  const mt = parseFloat(s.pdf_margin_top) || 18
  const cw = pw - ml - mr

  const doc = new PDFDocument({ size: A4, margins: { top: mt, bottom: 30, left: ml, right: mr }, autoFirstPage: false, bufferPages: true })
  const fn  = path.join(outputPath, `buku_kleper_${Date.now()}.pdf`)
  doc.pipe(fs.createWriteStream(fn))

  const f = fontSetup(doc, s)
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

  // Group siswa by first letter
  const grouped = {}
  for (const sw of siswaList) {
    const key = (sw.nama?.[0] || '#').toUpperCase()
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(sw)
  }

  const COL_W = [28, 180, 22, 80, 80, 120, 55, 55]
  const HEADERS = ['No', 'Nama Siswa', 'L/P', 'NISN', 'NIS/NISM', 'Tempat, Tgl Lahir', 'Kelas', 'Thn Masuk']
  const ROW_H = 16
  const HEAD_H = 18

  let firstLetter = true
  for (const letter of ALPHABET) {
    const rows = grouped[letter]
    if (!rows || rows.length === 0) continue

    doc.addPage()
    let y = drawKopResmi(doc, s, ml, cw)

    // Judul halaman
    doc.font(f.B).fontSize(12).fillColor('#000')
      .text('BUKU KLEPER SISWA', ml, y + 4, { width: cw, align: 'center' })
    y += 22
    doc.font(f.R).fontSize(9)
      .text(`Huruf: ${letter}  |  Jumlah: ${rows.length} siswa`, ml, y, { width: cw, align: 'center' })
    y += 16

    // Header tabel
    doc.rect(ml, y, cw, HEAD_H).fillAndStroke('#1e3a5f', '#1e3a5f')
    let x = ml
    HEADERS.forEach((h, i) => {
      doc.font(f.B).fontSize(7.5).fillColor('#fff')
        .text(h, x + 2, y + 4, { width: COL_W[i] - 4, align: 'center' })
      x += COL_W[i]
    })
    y += HEAD_H

    rows.forEach((sw, idx) => {
      if (y + ROW_H > ph - 40) {
        doc.addPage()
        y = drawKopResmi(doc, s, ml, cw)
        // Repeat header
        doc.rect(ml, y, cw, HEAD_H).fillAndStroke('#1e3a5f', '#1e3a5f')
        let hx = ml
        HEADERS.forEach((h, i) => {
          doc.font(f.B).fontSize(7.5).fillColor('#fff')
            .text(h, hx + 2, y + 4, { width: COL_W[i] - 4, align: 'center' })
          hx += COL_W[i]
        })
        y += HEAD_H
      }

      const bg = idx % 2 === 0 ? '#f9fafb' : '#fff'
      doc.rect(ml, y, cw, ROW_H).fillAndStroke(bg, '#d1d5db')
      const ttl = sw.tempat_lahir && sw.tgl_lahir ? `${sw.tempat_lahir}, ${fmtTgl(sw.tgl_lahir)}` : (sw.tempat_lahir || '-')
      const vals = [String(idx + 1), sw.nama || '-', sw.jk || '-', sw.nisn || '-', sw.nism || '-', ttl, sw.kelas || '-', sw.tahun_masuk || '-']
      let rx = ml
      vals.forEach((v, i) => {
        doc.font(i === 1 ? f.B : f.R).fontSize(7).fillColor('#111')
          .text(v, rx + 2, y + 4, { width: COL_W[i] - 4, align: i === 0 ? 'center' : 'left', ellipsis: true })
        rx += COL_W[i]
      })
      y += ROW_H
    })
  }

  // Summary page
  doc.addPage()
  let y = drawKopResmi(doc, s, ml, cw)
  doc.font(f.B).fontSize(12).fillColor('#000').text('REKAPITULASI BUKU KLEPER', ml, y + 4, { width: cw, align: 'center' })
  y += 26
  const totalL = siswaList.filter(sw => sw.jk === 'L').length
  const totalP = siswaList.filter(sw => sw.jk === 'P').length
  const cols = [['Huruf', 60], ['Jumlah Siswa', 80], ['L', 50], ['P', 50]]
  const sumW = cols.reduce((a, c) => a + c[1], 0)
  let sx = ml + (cw - sumW) / 2
  doc.rect(sx, y, sumW, 18).fillAndStroke('#1e3a5f', '#1e3a5f')
  let cx = sx
  cols.forEach(([h, w]) => { doc.font(f.B).fontSize(8).fillColor('#fff').text(h, cx + 2, y + 4, { width: w - 4, align: 'center' }); cx += w })
  y += 18
  for (const letter of ALPHABET) {
    const rows = grouped[letter] || []
    if (!rows.length) continue
    const bg = ALPHABET.indexOf(letter) % 2 === 0 ? '#f3f4f6' : '#fff'
    doc.rect(sx, y, sumW, 16).fillAndStroke(bg, '#d1d5db')
    let cx2 = sx
    const jl = rows.filter((sw) => sw.jk === 'L').length
    const jp = rows.filter((sw) => sw.jk === 'P').length
    ;[letter, String(rows.length), String(jl), String(jp)].forEach((v, i) => {
      doc.font(f.R).fontSize(8).fillColor('#111').text(v, cx2 + 2, y + 4, { width: cols[i][1] - 4, align: 'center' })
      cx2 += cols[i][1]
    })
    y += 16
  }
  y += 4
  doc.rect(sx, y, sumW, 18).fillAndStroke('#e8f0fe', '#1e3a5f')
  let cx3 = sx
  ;['TOTAL', String(siswaList.length), String(totalL), String(totalP)].forEach((v, i) => {
    doc.font(f.B).fontSize(8.5).fillColor('#1e3a5f').text(v, cx3 + 2, y + 4, { width: cols[i][1] - 4, align: 'center' })
    cx3 += cols[i][1]
  })

  doc.end()
  return fn
}

// ══════════════════════════════════════════════════════════════════════════
//  BUKU INDUK SISWA — PDF format resmi biodata lengkap
// ══════════════════════════════════════════════════════════════════════════
function generateBukuInduk(outputPath, { sekolah: s, siswaList }) {
  const PDFDocument = require('pdfkit')
  const fs = require('fs')
  const path = require('path')
  const A4 = getPaperSize(s, false)
  const [pw, ph] = A4
  const ml = 45, mr = 45, mt = 18, cw = pw - ml - mr

  const doc = new PDFDocument({ size: A4, margins: { top: mt, bottom: 30, left: ml, right: mr }, autoFirstPage: false })
  const fn  = path.join(outputPath, `buku_induk_siswa_${Date.now()}.pdf`)
  doc.pipe(fs.createWriteStream(fn))
  const f = fontSetup(doc, s)

  const drawField = (doc, label, value, x, y, lw, vw) => {
    doc.font(f.R).fontSize(8).fillColor('#555').text(label, x, y, { width: lw })
    doc.font(f.R).fontSize(8).fillColor('#000').text(':', x + lw, y, { width: 8 })
    doc.font(f.B).fontSize(8).fillColor('#000').text(value || '—', x + lw + 10, y, { width: vw })
    doc.moveTo(x + lw + 10, y + 10).lineTo(x + lw + 10 + vw, y + 10).lineWidth(0.3).stroke('#ccc')
  }

  for (const sw of siswaList) {
    doc.addPage()
    let y = drawKopResmi(doc, s, ml, cw)

    // Judul
    doc.font(f.B).fontSize(12).fillColor('#1e3a5f').text('BUKU INDUK SISWA', ml, y + 4, { width: cw, align: 'center' })
    doc.font(f.R).fontSize(8.5).fillColor('#555').text(s.nama_sekolah || '', ml, y + 20, { width: cw, align: 'center' })
    y += 40

    // Foto placeholder kanan atas
    const fotoSize = 70
    const fotoX = ml + cw - fotoSize
    doc.rect(fotoX, y, fotoSize, fotoSize).stroke('#999')
    if (sw.foto) {
      try { doc.image(sw.foto, fotoX + 1, y + 1, { fit: [fotoSize - 2, fotoSize - 2] }) }
      catch {}
    } else {
      doc.font(f.R).fontSize(7).fillColor('#aaa').text('Foto\n3×4', fotoX, y + 25, { width: fotoSize, align: 'center' })
    }

    const FW = cw - fotoSize - 10
    const LW = 90, VW = FW - LW - 12
    const sec = (title) => {
      doc.font(f.B).fontSize(8).fillColor('#1e3a5f').text(title, ml, y, { width: FW })
      doc.moveTo(ml, y + 10).lineTo(ml + FW, y + 10).lineWidth(0.5).stroke('#1e3a5f')
      y += 14
    }

    // Identitas siswa
    sec('A. IDENTITAS SISWA')
    const identitas = [
      ['Nama Lengkap', sw.nama], ['Jenis Kelamin', sw.jk === 'L' ? 'Laki-laki' : 'Perempuan'],
      ['NISN', sw.nisn], ['NIS / NISM', sw.nism], ['NIK', sw.nik],
      ['Tempat Lahir', sw.tempat_lahir], ['Tanggal Lahir', fmtTgl(sw.tgl_lahir)],
      ['Agama', sw.agama], ['Anak Ke', sw.anak_ke], ['Jumlah Saudara', sw.jml_saudara], ['Status Anak', sw.status_anak],
    ]
    identitas.forEach(([l, v]) => { drawField(doc, l, v, ml, y, LW, VW); y += 13 })

    y += 6; sec('B. ALAMAT SISWA')
    ;[['Alamat', sw.alamat], ['RT / RW', sw.rt && sw.rw ? `${sw.rt} / ${sw.rw}` : sw.rt || ''],
      ['Kelurahan/Desa', sw.kelurahan], ['Kecamatan', sw.kecamatan],
      ['Kabupaten/Kota', sw.kabupaten], ['Provinsi', sw.provinsi],
      ['Kode Pos', sw.kode_pos], ['No. HP Siswa', sw.no_hp],
    ].forEach(([l, v]) => { drawField(doc, l, v, ml, y, LW, VW); y += 13 })

    y += 6; sec('C. DATA ORANG TUA')
    ;[['Nama Ayah', sw.nama_ayah], ['Pekerjaan Ayah', sw.pekerjaan_ayah], ['Pendidikan Ayah', sw.pendidikan_ayah],
      ['Nama Ibu', sw.nama_ibu], ['Pekerjaan Ibu', sw.pekerjaan_ibu], ['Pendidikan Ibu', sw.pendidikan_ibu],
      ['No. HP Ortu', sw.no_hp_ortu], ['Alamat Ortu', sw.alamat_ortu],
    ].forEach(([l, v]) => { drawField(doc, l, v, ml, y, LW, VW); y += 13 })

    if (sw.nama_wali) {
      y += 6; sec('D. DATA WALI')
      ;[['Nama Wali', sw.nama_wali], ['Pekerjaan Wali', sw.pekerjaan_wali], ['No. HP Wali', sw.no_hp_wali],
      ].forEach(([l, v]) => { drawField(doc, l, v, ml, y, LW, VW); y += 13 })
    }

    y += 6; sec('E. RIWAYAT SEKOLAH')
    ;[['Asal Sekolah', sw.asal_sekolah], ['Tahun Masuk', sw.tahun_masuk],
      ['Kelas', sw.kelas], ['No. Induk', sw.no_induk],
    ].forEach(([l, v]) => { drawField(doc, l, v, ml, y, LW, VW); y += 13 })

    if (sw.keterangan) {
      y += 6
      doc.font(f.B).fontSize(8).fillColor('#555').text('Keterangan:', ml, y)
      doc.font(f.R).fontSize(8).fillColor('#000').text(sw.keterangan, ml + 70, y, { width: cw - 70 })
    }

    // TTD
    const ttdY = Math.max(y + 20, ph - 100)
    const ttdX = ml + cw - 180
    doc.font(f.R).fontSize(8).fillColor('#000')
      .text(`${s.kota_sekolah || '________'}, ${fmtTgl(new Date().toISOString().slice(0, 10))}`, ttdX, ttdY, { width: 180, align: 'center' })
      .text('Kepala Sekolah,', ttdX, ttdY + 12, { width: 180, align: 'center' })
    doc.moveDown(3)
    doc.font(f.B).fontSize(8).text(s.kepala_sekolah || '____________________', ttdX, ttdY + 52, { width: 180, align: 'center' })
      .font(f.R).text(`NIP. ${s.nip_kepsek || '____________________'}`, ttdX, ttdY + 62, { width: 180, align: 'center' })
  }

  doc.end()
  return fn
}

// ══════════════════════════════════════════════════════════════════════════
//  LEGER NILAI KELAS — PDF tabel nilai per kelas
// ══════════════════════════════════════════════════════════════════════════
function generateLeger(outputPath, { sekolah: s, kelas, siswaList, mapelList, nilaiMap, ujianSem, raportSems, br, bu, totalB }) {
  const PDFDocument = require('pdfkit')
  const fs = require('fs')
  const path = require('path')
  const A4land = getPaperSize(s, true)
  const [pw, ph] = A4land
  const ml = 30, mr = 30, mt = 18, cw = pw - ml - mr

  const doc = new PDFDocument({ size: A4land, margins: { top: mt, bottom: 25, left: ml, right: mr }, autoFirstPage: false })
  const fn  = path.join(outputPath, `leger_${kelas.nama?.replace(/\s/g,'_')}_${Date.now()}.pdf`)
  doc.pipe(fs.createWriteStream(fn))
  const f = fontSetup(doc, s)

  const getNilaiAkhir = (siswaId, mapelId) => {
    const nilaiRaport = raportSems.map((sem) => nilaiMap[`${siswaId}_${mapelId}_${sem.id}`]?.nilai_raport ?? null).filter((v) => v !== null)
    const avgR = nilaiRaport.length ? nilaiRaport.reduce((a, b) => a + b, 0) / nilaiRaport.length : null
    const nilaiU = ujianSem ? (nilaiMap[`${siswaId}_${mapelId}_${ujianSem.id}`]?.nilai_raport ?? null) : null
    if (avgR === null && nilaiU === null) return null
    return Math.round(((avgR ?? 0) * br + (nilaiU ?? 0) * bu) / totalB * 10) / 10
  }

  const NO_W = 22, NAMA_W = 130
  const mapelW = Math.min(Math.floor((cw - NO_W - NAMA_W - 45) / (mapelList.length + 1)), 42)
  const RATA_W = 45

  doc.addPage()
  let y = mt

  // Kop sederhana untuk landscape
  if (s.kop_image) {
    try {
      const imgBuf = fs.readFileSync(s.kop_image)
      let origW = 0, origH = 0
      if (imgBuf[0] === 0x89 && imgBuf[1] === 0x50) { origW = imgBuf.readUInt32BE(16); origH = imgBuf.readUInt32BE(20) }
      else if (imgBuf[0] === 0xFF && imgBuf[1] === 0xD8) {
        let i = 2
        while (i < imgBuf.length - 8) {
          if (imgBuf[i] !== 0xFF) break
          const marker = imgBuf[i + 1]; const segLen = imgBuf.readUInt16BE(i + 2)
          if (marker === 0xC0 || marker === 0xC2) { origH = imgBuf.readUInt16BE(i + 5); origW = imgBuf.readUInt16BE(i + 7); break }
          i += 2 + segLen
        }
      }
      const imgH = origW > 0 ? Math.round((origH / origW) * cw) : 70
      doc.image(s.kop_image, ml, y, { width: cw, height: imgH })
      y += imgH + 4
      doc.moveTo(ml, y).lineTo(ml + cw, y).lineWidth(3).stroke('#000')
      doc.moveTo(ml, y + 4).lineTo(ml + cw, y + 4).lineWidth(1).stroke('#000')
      y += 12
    } catch { y = drawKopResmi(doc, s, ml, cw) }
  } else { y = drawKopResmi(doc, s, ml, cw) }

  doc.font(f.B).fontSize(11).fillColor('#000').text('LEGER NILAI KELAS', ml, y, { width: cw, align: 'center' })
  y += 14
  doc.font(f.R).fontSize(9).text(`Kelas: ${kelas.nama}  |  Wali Kelas: ${kelas.wali_kelas || '—'}  |  Tahun Ajaran: ${kelas.tahun_ajaran || s.tahun_ajaran || '—'}  |  Bobot: Raport ${br}% + Ujian ${bu}%`, ml, y, { width: cw, align: 'center' })
  y += 16

  // Header tabel
  const tableW = NO_W + NAMA_W + mapelList.length * mapelW + RATA_W
  const startX = ml + (cw - tableW) / 2

  // Row 1: No, Nama, Mapel headers, Rata
  doc.rect(startX, y, tableW, 20).fillAndStroke('#1e3a5f', '#1e3a5f')
  doc.font(f.B).fontSize(7).fillColor('#fff')
  doc.text('No', startX, y + 6, { width: NO_W, align: 'center' })
  doc.text('Nama Siswa', startX + NO_W, y + 6, { width: NAMA_W, align: 'center' })
  let hx = startX + NO_W + NAMA_W
  mapelList.forEach((m) => {
    const abbr = m.singkatan || m.nama?.split(' ').map((w) => w[0]).join('') || m.nama?.slice(0, 4)
    doc.text(abbr, hx, y + 2, { width: mapelW, align: 'center' })
    hx += mapelW
  })
  doc.text('Rata²', hx, y + 6, { width: RATA_W, align: 'center' })
  y += 20

  // Rows
  const ROW_H = 14
  siswaList.forEach((sw, i) => {
    if (y + ROW_H > ph - 30) {
      doc.addPage()
      y = mt + 10
    }
    const bg = i % 2 === 0 ? '#f9fafb' : '#ffffff'
    doc.rect(startX, y, tableW, ROW_H).fillAndStroke(bg, '#d1d5db')
    doc.font(f.R).fontSize(7).fillColor('#111')
    doc.text(String(i + 1), startX, y + 4, { width: NO_W, align: 'center' })
    doc.font(f.B).fontSize(7).text(sw.nama, startX + NO_W + 2, y + 4, { width: NAMA_W - 4 })
    let rx = startX + NO_W + NAMA_W
    let total = 0, cnt = 0
    mapelList.forEach((m) => {
      const v = getNilaiAkhir(sw.id, m.id)
      if (v !== null) { total += v; cnt++ }
      const color = v === null ? '#999' : v >= 90 ? '#15803d' : v >= 75 ? '#1d4ed8' : v >= 60 ? '#b45309' : '#dc2626'
      doc.font(v !== null && v >= 75 ? f.B : f.R).fontSize(7).fillColor(color)
        .text(v !== null ? String(v) : '—', rx, y + 4, { width: mapelW, align: 'center' })
      rx += mapelW
    })
    const rata = cnt > 0 ? Math.round((total / cnt) * 10) / 10 : null
    const rataColor = rata === null ? '#999' : rata >= 75 ? '#15803d' : '#dc2626'
    doc.font(f.B).fontSize(7.5).fillColor(rataColor).text(rata !== null ? String(rata) : '—', rx, y + 4, { width: RATA_W, align: 'center' })
    y += ROW_H
  })

  // Mapel legend
  y += 8
  doc.font(f.B).fontSize(7).fillColor('#333').text('Keterangan Singkatan:', startX, y)
  y += 10
  mapelList.forEach((m, i) => {
    const abbr = m.singkatan || m.nama?.split(' ').map((w) => w[0]).join('') || m.nama?.slice(0, 4)
    const lx = startX + (i % 4) * (cw / 4)
    if (i % 4 === 0 && i > 0) y += 10
    doc.font(f.R).fontSize(7).fillColor('#555').text(`${abbr} = ${m.nama}`, lx, y, { width: cw / 4 - 5 })
  })

  doc.end()
  return fn
}

// ══════════════════════════════════════════════════════════════════════════
//  BUKU INDUK GURU — PDF format kepegawaian
// ══════════════════════════════════════════════════════════════════════════
function generateBukuIndukGuru(outputPath, { sekolah: s, guruList }) {
  const PDFDocument = require('pdfkit')
  const fs = require('fs')
  const path = require('path')
  const A4 = getPaperSize(s, false)
  const [pw, ph] = A4
  const ml = 45, mr = 45, cw = pw - ml - mr

  const doc = new PDFDocument({ size: A4, margins: { top: 18, bottom: 30, left: ml, right: mr }, autoFirstPage: false })
  const fn  = path.join(outputPath, `buku_induk_guru_${Date.now()}.pdf`)
  doc.pipe(fs.createWriteStream(fn))
  const f = fontSetup(doc, s)

  for (const g of guruList) {
    doc.addPage()
    let y = drawKopResmi(doc, s, ml, cw)

    doc.font(f.B).fontSize(12).fillColor('#1e3a5f').text('BUKU INDUK GURU / TENAGA KEPENDIDIKAN', ml, y + 4, { width: cw, align: 'center' })
    y += 36

    const fotoX = ml + cw - 70
    doc.rect(fotoX, y, 70, 85).stroke('#999')
    if (g.foto) { try { doc.image(g.foto, fotoX + 1, y + 1, { fit: [68, 83] }) } catch {} }
    else { doc.font(f.R).fontSize(7).fillColor('#aaa').text('Foto\n3×4', fotoX, y + 30, { width: 70, align: 'center' }) }

    const FW = cw - 80, LW = 95, VW = FW - LW - 12

    const drawF = (label, value) => {
      doc.font(f.R).fontSize(8).fillColor('#555').text(label, ml, y, { width: LW })
      doc.font(f.R).fontSize(8).fillColor('#000').text(':', ml + LW, y, { width: 8 })
      doc.font(f.B).fontSize(8).fillColor('#000').text(value || '—', ml + LW + 10, y, { width: VW })
      doc.moveTo(ml + LW + 10, y + 10).lineTo(ml + LW + 10 + VW, y + 10).lineWidth(0.3).stroke('#ccc')
      y += 13
    }

    const secTitle = (t) => {
      doc.font(f.B).fontSize(8.5).fillColor('#1e3a5f').text(t, ml, y, { width: FW })
      doc.moveTo(ml, y + 11).lineTo(ml + FW, y + 11).lineWidth(0.5).stroke('#1e3a5f')
      y += 16
    }

    secTitle('A. IDENTITAS')
    drawF('Nama Lengkap', g.nama)
    drawF('Jenis Kelamin', g.jk === 'L' ? 'Laki-laki' : 'Perempuan')
    drawF('NIP', g.nip)
    drawF('Tempat, Tgl Lahir', g.tempat_lahir && g.tgl_lahir ? `${g.tempat_lahir}, ${fmtTgl(g.tgl_lahir)}` : g.tempat_lahir || '—')
    drawF('Agama', g.agama)

    y += 4; secTitle('B. KEPEGAWAIAN')
    drawF('Status Kepegawaian', g.status_kepegawaian)
    drawF('Golongan', g.golongan)
    drawF('Jabatan', g.jabatan)
    drawF('Mata Pelajaran', g.mapel)
    drawF('SK Pertama', g.sk_pertama)
    drawF('TMT Pertama', fmtTgl(g.tmt_pertama))
    drawF('Tahun Masuk', g.tahun_masuk)

    y += 4; secTitle('C. PENDIDIKAN & KONTAK')
    drawF('Pendidikan Terakhir', g.pendidikan)
    drawF('Jurusan', g.jurusan)
    drawF('No. HP', g.no_hp)
    drawF('Email', g.email)
    drawF('Alamat', g.alamat)

    if (g.keterangan) { y += 4; drawF('Keterangan', g.keterangan) }

    const ttdY = Math.max(y + 20, ph - 90)
    const ttdX = ml + cw - 180
    doc.font(f.R).fontSize(8).fillColor('#000')
      .text(`${s.kota_sekolah || '________'}, ${fmtTgl(new Date().toISOString().slice(0, 10))}`, ttdX, ttdY, { width: 180, align: 'center' })
      .text('Kepala Sekolah,', ttdX, ttdY + 12, { width: 180, align: 'center' })
    doc.font(f.B).fontSize(8).text(s.kepala_sekolah || '____________________', ttdX, ttdY + 52, { width: 180, align: 'center' })
      .font(f.R).text(`NIP. ${s.nip_kepsek || '____________________'}`, ttdX, ttdY + 62, { width: 180, align: 'center' })
  }

  doc.end()
  return fn
}

// ══════════════════════════════════════════════════════════════════════════
//  ABSENSI GURU — Rekap bulanan PDF
// ══════════════════════════════════════════════════════════════════════════
function generateAbsensiGuru(outputPath, { sekolah: s, rekapList, bulan }) {
  const PDFDocument = require('pdfkit')
  const fs = require('fs')
  const path = require('path')
  const A4land = getPaperSize(s, true)
  const [pw, ph] = A4land
  const ml = 30, mr = 30, cw = pw - ml - mr

  const doc = new PDFDocument({ size: A4land, margins: { top: 18, bottom: 25, left: ml, right: mr }, autoFirstPage: false })
  const fn  = path.join(outputPath, `absensi_guru_${bulan?.replace('-','_') || 'all'}_${Date.now()}.pdf`)
  doc.pipe(fs.createWriteStream(fn))
  const f = fontSetup(doc, s)

  doc.addPage()
  let y = drawKopResmi(doc, s, ml, cw)

  const [yr, mo] = (bulan || '').split('-')
  const bulanNama = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
  const bulanStr = mo ? `${bulanNama[parseInt(mo) - 1]} ${yr}` : 'Semua Bulan'

  doc.font(f.B).fontSize(11).fillColor('#000').text('REKAP ABSENSI GURU', ml, y, { width: cw, align: 'center' })
  y += 14
  doc.font(f.R).fontSize(9).text(`Bulan: ${bulanStr}  |  ${s.nama_sekolah || ''}`, ml, y, { width: cw, align: 'center' })
  y += 16

  const COLS = [{ h: 'No', w: 24 }, { h: 'Nama Guru', w: 170 }, { h: 'Mapel', w: 90 }, { h: 'Hadir', w: 45 }, { h: 'Sakit', w: 45 }, { h: 'Izin', w: 45 }, { h: 'Alpha', w: 45 }, { h: 'Dinas Luar', w: 55 }, { h: 'Total', w: 40 }, { h: '% Hadir', w: 55 }]
  const tableW = COLS.reduce((a, c) => a + c.w, 0)
  const sx = ml + (cw - tableW) / 2

  doc.rect(sx, y, tableW, 20).fillAndStroke('#1e3a5f', '#1e3a5f')
  let hx = sx
  COLS.forEach(c => { doc.font(f.B).fontSize(7.5).fillColor('#fff').text(c.h, hx + 1, y + 6, { width: c.w - 2, align: 'center' }); hx += c.w })
  y += 20

  rekapList.forEach((g, i) => {
    const pct = g.total > 0 ? Math.round(((g.H + g.DL) / g.total) * 100) : 0
    const bg = i % 2 === 0 ? '#f9fafb' : '#fff'
    doc.rect(sx, y, tableW, 16).fillAndStroke(bg, '#d1d5db')
    let rx = sx
    const vals = [String(i + 1), g.nama, g.mapel || '—', String(g.H || 0), String(g.S || 0), String(g.I || 0), String(g.A || 0), String(g.DL || 0), String(g.total || 0), `${pct}%`]
    vals.forEach((v, ci) => {
      const col = COLS[ci]
      const isBold = ci === 1
      const color = ci === 9 ? (pct >= 80 ? '#15803d' : pct >= 60 ? '#b45309' : '#dc2626') : '#111'
      doc.font(isBold ? f.B : f.R).fontSize(7.5).fillColor(color).text(v, rx + 2, y + 4, { width: col.w - 4, align: ci === 0 || ci >= 3 ? 'center' : 'left', ellipsis: true })
      rx += col.w
    })
    y += 16
  })

  // Summary
  y += 4
  const total = rekapList.reduce((a, g) => ({ H: a.H + (g.H || 0), S: a.S + (g.S || 0), I: a.I + (g.I || 0), A: a.A + (g.A || 0), DL: a.DL + (g.DL || 0), total: a.total + (g.total || 0) }), { H: 0, S: 0, I: 0, A: 0, DL: 0, total: 0 })
  doc.rect(sx, y, tableW, 18).fillAndStroke('#e8f0fe', '#1e3a5f')
  let tx = sx
  const totVals = ['', 'TOTAL', '', String(total.H), String(total.S), String(total.I), String(total.A), String(total.DL), String(total.total), '']
  totVals.forEach((v, ci) => { doc.font(f.B).fontSize(8).fillColor('#1e3a5f').text(v, tx + 2, y + 5, { width: COLS[ci].w - 4, align: 'center' }); tx += COLS[ci].w })

  doc.end()
  return fn
}

// ══════════════════════════════════════════════════════════════════════════
//  JADWAL PELAJARAN — PDF tabel per kelas
// ══════════════════════════════════════════════════════════════════════════
function generateJadwal(outputPath, { sekolah: s, kelas, jadwalList }) {
  const PDFDocument = require('pdfkit')
  const fs = require('fs')
  const path = require('path')
  const A4land = getPaperSize(s, true)
  const [pw, ph] = A4land
  const ml = 30, mr = 30, cw = pw - ml - mr

  const doc = new PDFDocument({ size: A4land, margins: { top: 18, bottom: 25, left: ml, right: mr }, autoFirstPage: false })
  const fn  = path.join(outputPath, `jadwal_${kelas.nama?.replace(/\s/g,'_')}_${Date.now()}.pdf`)
  doc.pipe(fs.createWriteStream(fn))
  const f = fontSetup(doc, s)

  doc.addPage()
  let y = drawKopResmi(doc, s, ml, cw)

  doc.font(f.B).fontSize(12).fillColor('#000').text('JADWAL PELAJARAN', ml, y, { width: cw, align: 'center' })
  y += 14
  doc.font(f.R).fontSize(9).text(`Kelas: ${kelas.nama}  |  Wali Kelas: ${kelas.wali_kelas || '—'}  |  Tahun Ajaran: ${kelas.tahun_ajaran || s.tahun_ajaran || '—'}`, ml, y, { width: cw, align: 'center' })
  y += 18

  const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu']
  const JAM_W = 38, HARI_W = Math.floor((cw - JAM_W) / HARI.length)
  const MAX_JAM = Math.max(...jadwalList.map((j) => j.jam_ke), 10)
  const ROW_H = 36

  // Header
  doc.rect(ml, y, cw, 20).fillAndStroke('#1e3a5f', '#1e3a5f')
  doc.font(f.B).fontSize(8).fillColor('#fff').text('Jam', ml, y + 6, { width: JAM_W, align: 'center' })
  HARI.forEach((h, i) => doc.text(h, ml + JAM_W + i * HARI_W, y + 6, { width: HARI_W, align: 'center' }))
  y += 20

  const COLORS = ['#dbeafe', '#dcfce7', '#fef9c3', '#fce7f3', '#ede9fe', '#ffedd5']

  for (let jam = 1; jam <= MAX_JAM; jam++) {
    doc.rect(ml, y, JAM_W, ROW_H).fillAndStroke('#f3f4f6', '#d1d5db')
    doc.font(f.B).fontSize(10).fillColor('#374151').text(String(jam), ml, y + ROW_H / 2 - 6, { width: JAM_W, align: 'center' })

    HARI.forEach((hari, hi) => {
      const j = jadwalList.find((x) => x.hari === hari && x.jam_ke === jam)
      const x = ml + JAM_W + hi * HARI_W
      const bg = j ? COLORS[hi % COLORS.length] : '#fff'
      doc.rect(x, y, HARI_W, ROW_H).fillAndStroke(bg, '#d1d5db')
      if (j) {
        doc.font(f.B).fontSize(7.5).fillColor('#1e3a5f').text(j.nama_mapel || '—', x + 2, y + 4, { width: HARI_W - 4, align: 'center' })
        doc.font(f.R).fontSize(6.5).fillColor('#555').text(j.guru || '', x + 2, y + 14, { width: HARI_W - 4, align: 'center', ellipsis: true })
        if (j.jam_mulai) doc.font(f.R).fontSize(6).fillColor('#777').text(`${j.jam_mulai}–${j.jam_selesai}`, x + 2, y + 24, { width: HARI_W - 4, align: 'center' })
      }
    })
    y += ROW_H
  }

  doc.end()
  return fn
}

// ══════════════════════════════════════════════════════════════════════════
//  JURNAL KELAS — PDF per bulan
// ══════════════════════════════════════════════════════════════════════════
function generateJurnal(outputPath, { sekolah: s, kelas, jurnalList, bulan }) {
  const PDFDocument = require('pdfkit')
  const fs = require('fs')
  const path = require('path')
  const A4 = getPaperSize(s, false)
  const [pw, ph] = A4
  const ml = 40, mr = 40, cw = pw - ml - mr

  const doc = new PDFDocument({ size: A4, margins: { top: 18, bottom: 30, left: ml, right: mr }, autoFirstPage: false })
  const fn  = path.join(outputPath, `jurnal_${kelas.nama?.replace(/\s/g,'_')}_${bulan?.replace('-','_') || 'all'}_${Date.now()}.pdf`)
  doc.pipe(fs.createWriteStream(fn))
  const f = fontSetup(doc, s)

  doc.addPage()
  let y = drawKopResmi(doc, s, ml, cw)

  const [yr, mo] = (bulan || '').split('-')
  const bulanNama = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
  const bulanStr = mo ? `${bulanNama[parseInt(mo) - 1]} ${yr}` : 'Semua Bulan'

  doc.font(f.B).fontSize(12).fillColor('#000').text('JURNAL KELAS', ml, y, { width: cw, align: 'center' })
  y += 14
  doc.font(f.R).fontSize(9).text(`Kelas: ${kelas.nama}  |  Wali Kelas: ${kelas.wali_kelas || '—'}  |  Bulan: ${bulanStr}`, ml, y, { width: cw, align: 'center' })
  y += 18

  const COLS = [{ h: 'Tanggal', w: 80 }, { h: 'Jam Ke', w: 40 }, { h: 'Mata Pelajaran', w: 100 }, { h: 'Guru', w: 110 }, { h: 'Materi / Kegiatan', w: 150 }, { h: 'Catatan', w: 90 }]
  const tableW = COLS.reduce((a, c) => a + c.w, 0)
  const sx = ml + (cw - tableW) / 2

  const drawHeader = () => {
    doc.rect(sx, y, tableW, 18).fillAndStroke('#1e3a5f', '#1e3a5f')
    let hx = sx
    COLS.forEach(c => { doc.font(f.B).fontSize(7.5).fillColor('#fff').text(c.h, hx + 2, y + 5, { width: c.w - 4, align: 'center' }); hx += c.w })
    y += 18
  }
  drawHeader()

  const ROW_H = 22
  jurnalList.forEach((j, i) => {
    if (y + ROW_H > ph - 40) { doc.addPage(); y = drawKopResmi(doc, s, ml, cw); drawHeader() }
    const bg = i % 2 === 0 ? '#f9fafb' : '#fff'
    doc.rect(sx, y, tableW, ROW_H).fillAndStroke(bg, '#d1d5db')
    const vals = [fmtTgl(j.tanggal), String(j.jam_ke || '—'), j.nama_mapel || '—', j.guru || '—', j.materi || '—', j.catatan || '—']
    let rx = sx
    vals.forEach((v, ci) => {
      doc.font(ci === 4 || ci === 5 ? f.R : ci === 3 ? f.I : f.R).fontSize(7).fillColor('#111')
        .text(v, rx + 2, y + 4, { width: COLS[ci].w - 4, height: ROW_H - 6, ellipsis: true })
      rx += COLS[ci].w
    })
    y += ROW_H
  })

  if (jurnalList.length === 0) {
    doc.font(f.R).fontSize(10).fillColor('#999').text('Belum ada entri jurnal.', ml, y + 20, { width: cw, align: 'center' })
  }

  doc.end()
  return fn
}

// ══════════════════════════════════════════════════════════════════════════
//  ABSENSI SISWA — Rekap bulanan PDF per kelas
// ══════════════════════════════════════════════════════════════════════════
function generateAbsensiSiswa(outputPath, { sekolah: s, kelas, rekapList, bulan }) {
  const PDFDocument = require('pdfkit')
  const fs = require('fs')
  const path = require('path')
  const A4land = getPaperSize(s, true)
  const [pw, ph] = A4land
  const ml = 30, mr = 30, cw = pw - ml - mr

  const doc = new PDFDocument({ size: A4land, margins: { top: 18, bottom: 25, left: ml, right: mr }, autoFirstPage: false })
  const fn  = path.join(outputPath, `absensi_siswa_${kelas.nama?.replace(/\s/g,'_')}_${bulan?.replace('-','_') || 'all'}_${Date.now()}.pdf`)
  doc.pipe(fs.createWriteStream(fn))
  const f = fontSetup(doc, s)

  doc.addPage()
  let y = drawKopResmi(doc, s, ml, cw)

  const [yr, mo] = (bulan || '').split('-')
  const bulanNama = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
  const bulanStr = mo ? `${bulanNama[parseInt(mo) - 1]} ${yr}` : 'Semua Bulan'

  doc.font(f.B).fontSize(11).fillColor('#000').text('REKAP ABSENSI SISWA', ml, y, { width: cw, align: 'center' })
  y += 14
  doc.font(f.R).fontSize(9).text(`Kelas: ${kelas.nama}  |  Wali Kelas: ${kelas.wali_kelas || '—'}  |  Bulan: ${bulanStr}`, ml, y, { width: cw, align: 'center' })
  y += 16

  const COLS = [{ h: 'No', w: 24 }, { h: 'Nama Siswa', w: 180 }, { h: 'L/P', w: 30 }, { h: 'Hadir', w: 45 }, { h: 'Sakit', w: 45 }, { h: 'Izin', w: 45 }, { h: 'Alpha', w: 45 }, { h: 'Total', w: 40 }, { h: '% Hadir', w: 55 }]
  const tableW = COLS.reduce((a, c) => a + c.w, 0)
  const sx = ml + (cw - tableW) / 2

  doc.rect(sx, y, tableW, 20).fillAndStroke('#1e3a5f', '#1e3a5f')
  let hx = sx
  COLS.forEach(c => { doc.font(f.B).fontSize(7.5).fillColor('#fff').text(c.h, hx + 1, y + 6, { width: c.w - 2, align: 'center' }); hx += c.w })
  y += 20

  rekapList.forEach((sw, i) => {
    const pct = sw.total > 0 ? Math.round((sw.H / sw.total) * 100) : 0
    const bg = i % 2 === 0 ? '#f9fafb' : '#fff'
    doc.rect(sx, y, tableW, 16).fillAndStroke(bg, '#d1d5db')
    let rx = sx
    const vals = [String(i + 1), sw.nama, sw.jk || '—', String(sw.H || 0), String(sw.S || 0), String(sw.I || 0), String(sw.A || 0), String(sw.total || 0), `${pct}%`]
    vals.forEach((v, ci) => {
      const color = ci === 8 ? (pct >= 80 ? '#15803d' : pct >= 60 ? '#b45309' : '#dc2626') : '#111'
      doc.font(ci <= 1 ? f.B : f.R).fontSize(7.5).fillColor(color).text(v, rx + 2, y + 4, { width: COLS[ci].w - 4, align: ci === 0 || ci >= 3 ? 'center' : 'left', ellipsis: true })
      rx += COLS[ci].w
    })
    y += 16
  })

  doc.end()
  return fn
}

// ══════════════════════════════════════════════════════════════════════════
//  SURAT-SURAT — Cetak PDF resmi
// ══════════════════════════════════════════════════════════════════════════
function generateSurat(outputPath, { sekolah: s, siswa, jenis, noSurat, keperluan, angkatan }) {
  const PDFDocument = require('pdfkit')
  const fs = require('fs')
  const path = require('path')
  const A4 = getPaperSize(s, false)
  const [pw, ph] = A4
  const ml = 55, mr = 55, cw = pw - ml - mr

  const doc = new PDFDocument({ size: A4, margins: { top: 18, bottom: 40, left: ml, right: mr }, autoFirstPage: false })
  const fn  = path.join(outputPath, `surat_${jenis}_${siswa.id}_${Date.now()}.pdf`)
  doc.pipe(fs.createWriteStream(fn))
  const f = fontSetup(doc, s)

  doc.addPage()
  let y = drawKopResmi(doc, s, ml, cw)

  const drawField = (label, value, lw = 120) => {
    doc.font(f.R).fontSize(10).fillColor('#000')
      .text(label, ml + 20, y, { width: lw })
      .text(':', ml + 20 + lw, y, { width: 10 })
      .font(f.B).text(value || '—', ml + 20 + lw + 12, y, { width: cw - lw - 32 })
    y += 14
  }

  const JUDUL = {
    aktif: 'SURAT KETERANGAN MASIH AKTIF BELAJAR',
    mutasi: 'SURAT KETERANGAN PINDAH SEKOLAH',
    panggilan: 'SURAT PANGGILAN ORANG TUA / WALI MURID',
    kartu_ujian: 'KARTU PESERTA UJIAN',
  }

  const tglCetak = fmtTgl(new Date().toISOString().slice(0, 10))

  if (jenis === 'kartu_ujian') {
    // Layout kartu ujian khusus
    doc.font(f.B).fontSize(13).fillColor('#1e3a5f').text(JUDUL.kartu_ujian, ml, y, { width: cw, align: 'center' })
    y += 18
    doc.font(f.R).fontSize(9).text(`${s.nama_sekolah || ''}  |  ${angkatan?.nama || s.tahun_ajaran || ''}`, ml, y, { width: cw, align: 'center' })
    y += 20
    doc.rect(ml + 20, y, cw - 40, 120).stroke('#1e3a5f').lineWidth(2)
    const inner = ml + 30
    const innerW = cw - 60
    const fotoBox = innerW - 90
    // Foto
    doc.rect(inner + fotoBox, y + 8, 80, 100).stroke('#999')
    if (siswa.foto) { try { doc.image(siswa.foto, inner + fotoBox + 1, y + 9, { fit: [78, 98] }) } catch {} }
    else { doc.font(f.R).fontSize(7).fillColor('#aaa').text('Foto 3×4', inner + fotoBox, y + 45, { width: 80, align: 'center' }) }
    let fy = y + 12
    ;[['Nama', siswa.nama], ['NISN', siswa.nisn], ['NIS', siswa.nism], ['Kelas', siswa.kelas], ['Tgl Lahir', fmtTgl(siswa.tgl_lahir)]].forEach(([l, v]) => {
      doc.font(f.R).fontSize(9).fillColor('#555').text(l, inner, fy, { width: 70 })
      doc.font(f.R).text(':', inner + 70, fy, { width: 8 })
      doc.font(f.B).fontSize(9).fillColor('#000').text(v || '—', inner + 80, fy, { width: fotoBox - 82 })
      fy += 13
    })
    y += 130
    doc.font(f.B).fontSize(11).fillColor('#1e3a5f').text(`No. Peserta: ${noSurat || '—————————'}`, ml, y + 10, { width: cw, align: 'center' })
    y += 30
    const ttdX2 = ml + cw - 160
    doc.font(f.R).fontSize(9).text(tglCetak, ttdX2, y, { width: 160, align: 'center' })
    doc.text('Kepala Sekolah,', ttdX2, y + 12, { width: 160, align: 'center' })
    doc.font(f.B).text(s.kepala_sekolah || '____________________', ttdX2, y + 60, { width: 160, align: 'center' })
    doc.font(f.R).text(`NIP. ${s.nip_kepsek || '____________________'}`, ttdX2, y + 72, { width: 160, align: 'center' })
  } else {
    // Layout surat biasa
    doc.font(f.B).fontSize(12).fillColor('#000').text(JUDUL[jenis] || 'SURAT KETERANGAN', ml, y, { width: cw, align: 'center' })
    y += 14
    doc.font(f.R).fontSize(10).text(`Nomor: ${noSurat || '    .../  /.../  /...'}`, ml, y, { width: cw, align: 'center' })
    y += 24

    if (jenis === 'panggilan') {
      doc.font(f.R).fontSize(10).fillColor('#000')
        .text('Kepada Yth.', ml, y).moveDown(0.3)
        .font(f.B).text(`Orang Tua/Wali dari: ${siswa.nama}`, ml).moveDown(0.3)
        .font(f.R).text('Di Tempat', ml)
      y = doc.y + 16
      doc.font(f.R).fontSize(10).text('Dengan hormat,', ml, y)
      y += 18
      doc.font(f.R).fontSize(10)
        .text(`Bersama surat ini kami mengundang Bapak/Ibu Orang Tua/Wali dari peserta didik kami:`, ml, y, { width: cw })
      y = doc.y + 10
    } else {
      doc.font(f.R).fontSize(10).text(`Yang bertanda tangan di bawah ini, Kepala ${s.nama_sekolah || 'Sekolah'} menerangkan bahwa:`, ml, y, { width: cw })
      y = doc.y + 12
    }

    drawField('Nama Lengkap', siswa.nama)
    drawField('NISN', siswa.nisn)
    drawField('NIS / NISM', siswa.nism)
    drawField('Tempat, Tanggal Lahir', siswa.tempat_lahir && siswa.tgl_lahir ? `${siswa.tempat_lahir}, ${fmtTgl(siswa.tgl_lahir)}` : siswa.tempat_lahir || '—')
    drawField('Kelas', siswa.kelas)
    drawField('Tahun Pelajaran', angkatan?.nama || s.tahun_ajaran || '—')
    y += 6

    if (jenis === 'aktif') {
      doc.font(f.R).fontSize(10).fillColor('#000')
        .text(`Adalah benar siswa/siswi tersebut di atas `, ml, y, { continued: true })
        .font(f.B).text('MASIH AKTIF BELAJAR ', { continued: true })
        .font(f.R).text(`di ${s.nama_sekolah || 'sekolah kami'}${keperluan ? ', dan surat ini dibuat untuk keperluan ' : ''}.`)
      if (keperluan) { doc.font(f.B).text(keperluan + '.', { continued: false }) }
    } else if (jenis === 'mutasi') {
      doc.font(f.R).fontSize(10).fillColor('#000')
        .text(`Adalah benar siswa/siswi tersebut di atas `, ml, y, { continued: true })
        .font(f.B).text('TELAH PINDAH / KELUAR ', { continued: true })
        .font(f.R).text(`dari ${s.nama_sekolah || 'sekolah kami'}${keperluan ? ' dengan alasan: ' : ''}.`)
      if (keperluan) { doc.font(f.B).text(keperluan + '.') }
    } else if (jenis === 'panggilan') {
      doc.font(f.R).fontSize(10).fillColor('#000')
        .text(`Untuk hadir di sekolah guna membicarakan hal-hal yang berkaitan dengan: `, ml, y, { continued: true })
        .font(f.B).text(keperluan || '____________________', { continued: false })
      y = doc.y + 10
      doc.font(f.R).fontSize(10).text('Adapun waktu pelaksanaannya adalah:', ml, y)
      y = doc.y + 8
      ;[['Hari, Tanggal', '____________________'], ['Pukul', '____________________'], ['Tempat', s.nama_sekolah || '____________________']].forEach(([l, v]) => {
        drawField(l, v, 100)
      })
    }

    y = doc.y + 20
    doc.font(f.R).fontSize(10).fillColor('#000')
      .text('Demikian surat keterangan ini kami buat dengan sebenarnya dan untuk dapat dipergunakan sebagaimana mestinya.', ml, y, { width: cw })
    y = doc.y + 30

    const ttdX = ml + cw - 180
    doc.font(f.R).fontSize(10).text(`${s.kota_sekolah || '________'}, ${tglCetak}`, ttdX, y, { width: 180, align: 'center' })
    doc.text(`Kepala ${s.nama_sekolah || 'Sekolah'},`, ttdX, y + 14, { width: 180, align: 'center' })
    doc.font(f.B).text(s.kepala_sekolah || '____________________', ttdX, y + 65, { width: 180, align: 'center' })
    doc.font(f.R).text(`NIP. ${s.nip_kepsek || '____________________'}`, ttdX, y + 77, { width: 180, align: 'center' })
  }

  doc.end()
  return fn
}


// ══════════════════════════════════════════════════════════════════════════
//  KARTU PESERTA UJIAN — 6 kartu per halaman A4 portrait (3 baris × 2 kolom)
//  Logo dari sekolah.logo_sekolah, TTD dari sekolah.ttd_kepsek
// ══════════════════════════════════════════════════════════════════════════
function generateKartuUjian(outputPath, { sekolah: s, cfg, siswaList }) {
  const PDFDocument = require('pdfkit')
  const fs          = require('fs')
  const path        = require('path')

  // A4 portrait: 595.28 x 841.89 pt
  const PW = 595.28, PH = 841.89
  const PML = 18, PMR = 18, PMT = 18, PMB = 18

  const COLS      = 2
  const ROWS      = 3
  const GAP_X     = 8
  const GAP_Y     = 8
  const CARD_W    = (PW - PML - PMR - GAP_X * (COLS - 1)) / COLS    // ~280 pt
  const CARD_H    = (PH - PMT - PMB - GAP_Y * (ROWS - 1)) / ROWS    // ~265 pt

  const cardPos = []
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      cardPos.push([
        PML + col * (CARD_W + GAP_X),
        PMT + row * (CARD_H + GAP_Y)
      ])
    }
  }

  const doc = new PDFDocument({ size: [PW, PH], autoFirstPage: false })
  const fn  = path.join(outputPath, 'kartu_ujian_' + (cfg.nama_ujian||'ujian').replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'') + '_' + Date.now() + '.pdf')
  doc.pipe(fs.createWriteStream(fn))
  const f   = fontSetup(doc, s)

  const CARDS_PER_PAGE = COLS * ROWS   // 6

  const drawCard = (cx, cy, sw, noIdx) => {
    const PAD  = 7
    const IW   = CARD_W - PAD * 2   // inner width

    // Outer border
    doc.rect(cx, cy, CARD_W, CARD_H).lineWidth(1).stroke('#222')

    // ── HEADER: logo kiri + judul kanan ──────────────────────────────────
    const LOGO_SZ = 44
    let headerH   = LOGO_SZ + 6

    // Logo dari sekolah.logo_sekolah
    if (s.logo_sekolah) {
      try {
        doc.image(s.logo_sekolah, cx + PAD, cy + PAD, { fit: [LOGO_SZ, LOGO_SZ] })
      } catch (e) {}
    }

    const TX  = cx + PAD + LOGO_SZ + 5
    const TW  = CARD_W - PAD - LOGO_SZ - 5 - PAD
    let   ty  = cy + PAD + 1

    doc.font(f.B).fontSize(6.5).fillColor('#000')
       .text('KARTU PESERTA', TX, ty, { width: TW, align: 'center' })
    ty += 8

    // Nama ujian (bold, wrap jika panjang)
    const ujianLines = cfg.nama_ujian ? cfg.nama_ujian.toUpperCase() : ''
    doc.font(f.B).fontSize(7.5).fillColor('#000')
       .text(ujianLines, TX, ty, { width: TW, align: 'center' })
    ty = doc.y + 1

    // Nama sekolah
    const namaSekolah = (s.nama || 'NAMA SEKOLAH').toUpperCase()
    doc.font(f.B).fontSize(7).fillColor('#1e3a5f')
       .text(namaSekolah, TX, ty, { width: TW, align: 'center' })
    ty = doc.y + 1

    // Tahun pelajaran
    const taPelajaran = cfg.tahun_ajaran || s.tahun_ajaran || ''
    if (taPelajaran) {
      doc.font(f.R).fontSize(6.5).fillColor('#555')
         .text('TAHUN PELAJARAN ' + taPelajaran, TX, ty, { width: TW, align: 'center' })
    }

    // Garis bawah header (double line)
    const lineY = cy + headerH + PAD + 1
    doc.moveTo(cx, lineY).lineTo(cx + CARD_W, lineY).lineWidth(1.5).stroke('#000')
    doc.moveTo(cx, lineY + 3).lineTo(cx + CARD_W, lineY + 3).lineWidth(0.4).stroke('#000')

    // ── DATA SISWA ────────────────────────────────────────────────────────
    let y    = lineY + 9
    const LW = 50   // label width
    const FS = 8
    const RG = 12   // row gap

    const drawRow = (label, value, bold) => {
      doc.font(f.R).fontSize(FS - 1.5).fillColor('#555')
         .text(label, cx + PAD, y, { width: LW })
      doc.font(f.R).fontSize(FS - 1.5).fillColor('#000')
         .text(':', cx + PAD + LW, y, { width: 7 })
      doc.font(bold ? f.B : f.R).fontSize(FS).fillColor('#000')
         .text(value || '—', cx + PAD + LW + 7, y, { width: IW - LW - 7, ellipsis: true })
      // underline field
      doc.moveTo(cx + PAD + LW + 7, y + FS + 0.5)
         .lineTo(cx + CARD_W - PAD, y + FS + 0.5)
         .lineWidth(0.25).stroke('#ddd')
      y += RG
    }

    drawRow('Nama',       sw.nama,       true)
    drawRow('No. Peserta', sw.no_peserta || String(noIdx), false)

    // Kelas: ambil dari siswa.kelas, atau kelas_ujian, fallback IX
    const kelasVal = sw.kelas || sw.kelas_ujian || ''
    drawRow('Kelas', kelasVal, false)
    drawRow('Ruang', sw.ruang || cfg.ruang_default || '____', false)

    y += 2

    // Garis kosong bawah (area kursi dll)
    doc.moveTo(cx, y).lineTo(cx + CARD_W, y).lineWidth(0.5).stroke('#aaa')
    y += 5

    // ── BAGIAN BAWAH: TTD kiri, pesan kanan ──────────────────────────────
    const bottomArea = cy + CARD_H - PAD
    const ttdY       = bottomArea - 46   // posisi area TTD dari atas
    const TTD_W      = (IW - 8) / 2
    const ttdX       = cx + PAD

    // Kota + tanggal
    doc.font(f.R).fontSize(6).fillColor('#555')
       .text((s.kota || '') + ', ' + fmtBulanThn(), ttdX, ttdY, { width: TTD_W, align: 'center' })
    doc.font(f.R).fontSize(6).fillColor('#555')
       .text('Kepala Sekolah,', ttdX, ttdY + 7, { width: TTD_W, align: 'center' })

    // TTD image
    const TTD_IMG_H = 22
    const TTD_IMG_W = 44
    if (s.ttd_kepsek) {
      try {
        doc.image(s.ttd_kepsek, ttdX + (TTD_W - TTD_IMG_W) / 2, ttdY + 14, { fit: [TTD_IMG_W, TTD_IMG_H] })
      } catch (e) {}
    }

    // Nama kepala sekolah (bold + underline)
    const namaKepsek = s.kepala || '____________________'
    doc.font(f.B).fontSize(6.5).fillColor('#000')
       .text(namaKepsek, ttdX, ttdY + 38, { width: TTD_W, align: 'center' })
    doc.moveTo(ttdX + 2, ttdY + 47)
       .lineTo(ttdX + TTD_W - 2, ttdY + 47)
       .lineWidth(0.4).stroke('#000')
    doc.font(f.R).fontSize(5.5).fillColor('#555')
       .text('NIP. ' + (s.nip || '____________________'), ttdX, ttdY + 48, { width: TTD_W, align: 'center' })

    // Pesan kanan bawah
    const msgX = ttdX + TTD_W + 8
    const msgY = cy + CARD_H - PAD - 8
    doc.font(f.I).fontSize(5.5).fillColor('#888')
       .text('Selama Ujian Kartu Ini Harap Dibawa', msgX, msgY, { width: TTD_W, align: 'center' })
  }

  // ── Generate pages ───────────────────────────────────────────────────────
  for (let i = 0; i < siswaList.length; i++) {
    if (i % CARDS_PER_PAGE === 0) doc.addPage()
    const posIdx      = i % CARDS_PER_PAGE
    const [cx, cy]    = cardPos[posIdx]
    drawCard(cx, cy, siswaList[i], i + 1)
  }

  // Fill remaining slots on last page with dashed placeholder
  const lastPage = siswaList.length % CARDS_PER_PAGE
  if (lastPage !== 0) {
    for (let i = lastPage; i < CARDS_PER_PAGE; i++) {
      const [cx, cy] = cardPos[i]
      doc.rect(cx, cy, CARD_W, CARD_H).lineWidth(0.4).dash(5, { space: 4 }).stroke('#ccc')
      doc.undash()
    }
  }

  doc.end()
  return fn
}
// ══════════════════════════════════════════════════════════════════════════
//  REKAP BOS — PDF landscape
// ══════════════════════════════════════════════════════════════════════════
function generateRekapBOS(outputPath, { sekolah: s, items, tahun, semester, jumlah_siswa }) {
  const PDFDocument = require('pdfkit')
  const fs          = require('fs')
  const path        = require('path')
  const A4land      = getPaperSize(s, true)
  const [pw, ph]    = A4land
  const ml = 30, mr = 30, cw = pw - ml - mr

  const doc = new PDFDocument({ size: A4land, margins: { top: 18, bottom: 25, left: ml, right: mr }, autoFirstPage: false })
  const fn  = path.join(outputPath, `rekap_bos_${tahun || 'all'}_${(semester||'').replace(/\s/g,'')}_${Date.now()}.pdf`)
  doc.pipe(fs.createWriteStream(fn))
  const f   = fontSetup(doc, s)

  const fmtRp = n => n != null ? 'Rp ' + Math.round(n).toLocaleString('id-ID') : '—'
  const bln   = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
  const tglNow = `${new Date().getDate()} ${bln[new Date().getMonth()]} ${new Date().getFullYear()}`

  doc.addPage()
  let y = drawKopResmi(doc, s, ml, cw)

  doc.font(f.B).fontSize(12).fillColor('#000').text('LAPORAN PENGGUNAAN DANA BOS', ml, y, { width: cw, align: 'center' })
  y += 14
  doc.font(f.R).fontSize(9).text(`Semester: ${semester || '—'}  |  Tahun: ${tahun || '—'}  |  Jumlah Siswa: ${jumlah_siswa}  |  ${s.nama || ''}`, ml, y, { width: cw, align: 'center' })
  y += 18

  const COLS = [
    { h: 'No',          w: 24,  align: 'center' },
    { h: 'Komponen',    w: 170, align: 'left'   },
    { h: 'Sub Komponen',w: 160, align: 'left'   },
    { h: 'Anggaran',    w: 100, align: 'right'  },
    { h: 'Realisasi',   w: 100, align: 'right'  },
    { h: 'Sisa',        w: 90,  align: 'right'  },
    { h: 'Serapan',     w: 55,  align: 'center' },
  ]
  const tableW = COLS.reduce((a, c) => a + c.w, 0)
  const sx     = ml + (cw - tableW) / 2

  // Header
  doc.rect(sx, y, tableW, 20).fillAndStroke('#1e3a5f', '#1e3a5f')
  let hx = sx
  COLS.forEach(c => {
    doc.font(f.B).fontSize(7.5).fillColor('#fff').text(c.h, hx + 2, y + 6, { width: c.w - 4, align: c.align })
    hx += c.w
  })
  y += 20

  // Group items by komponen
  const grouped = {}
  for (const item of items) {
    if (!grouped[item.komponen]) grouped[item.komponen] = []
    grouped[item.komponen].push(item)
  }

  let grandAng = 0, grandReal = 0
  let kompNo = 0
  const ROW_H = 15

  for (const komp of Object.keys(grouped)) {
    kompNo++
    const rows = grouped[komp]
    const kompAng  = rows.reduce((a, r) => a + (r.anggaran  || 0), 0)
    const kompReal = rows.reduce((a, r) => a + (r.realisasi || 0), 0)
    grandAng  += kompAng
    grandReal += kompReal

    // Komponen header row
    if (y + ROW_H > ph - 30) { doc.addPage(); y = 30 }
    doc.rect(sx, y, tableW, ROW_H).fillAndStroke('#dbeafe', '#d1d5db')
    let rx = sx
    const kompVals = [String(kompNo), komp, '', fmtRp(kompAng), fmtRp(kompReal), fmtRp(kompAng - kompReal), kompAng > 0 ? `${Math.round((kompReal/kompAng)*100)}%` : '—']
    kompVals.forEach((v, ci) => {
      doc.font(f.B).fontSize(7.5).fillColor('#1e3a5f').text(v, rx + 2, y + 4, { width: COLS[ci].w - 4, align: COLS[ci].align, ellipsis: true })
      rx += COLS[ci].w
    })
    y += ROW_H

    // Sub rows
    rows.forEach((item, si) => {
      if (y + ROW_H > ph - 30) { doc.addPage(); y = 30 }
      const bg = si % 2 === 0 ? '#f9fafb' : '#fff'
      doc.rect(sx, y, tableW, ROW_H).fillAndStroke(bg, '#d1d5db')
      const sisa = (item.anggaran || 0) - (item.realisasi || 0)
      const pct  = item.anggaran > 0 ? Math.round((item.realisasi / item.anggaran) * 100) : 0
      const color = pct >= 80 ? '#15803d' : pct >= 50 ? '#b45309' : '#dc2626'
      let srx = sx
      const subVals = ['', '', item.sub_komponen || '—', fmtRp(item.anggaran), fmtRp(item.realisasi), fmtRp(Math.abs(sisa)) + (sisa < 0 ? '*' : ''), `${pct}%`]
      subVals.forEach((v, ci) => {
        const col = ci === 6 ? color : '#111'
        doc.font(ci === 2 ? f.R : f.R).fontSize(7.5).fillColor(col).text(v, srx + 2, y + 4, { width: COLS[ci].w - 4, align: COLS[ci].align, ellipsis: true })
        srx += COLS[ci].w
      })
      y += ROW_H
    })
  }

  // Grand total
  if (y + 20 > ph - 30) { doc.addPage(); y = 30 }
  y += 4
  doc.rect(sx, y, tableW, 20).fillAndStroke('#1e3a5f', '#1e3a5f')
  let tx = sx
  const grandSerapan = grandAng > 0 ? `${Math.round((grandReal / grandAng) * 100)}%` : '—'
  ;['', 'TOTAL KESELURUHAN', '', fmtRp(grandAng), fmtRp(grandReal), fmtRp(Math.abs(grandAng - grandReal)), grandSerapan].forEach((v, ci) => {
    doc.font(f.B).fontSize(8).fillColor('#fff').text(v, tx + 2, y + 6, { width: COLS[ci].w - 4, align: COLS[ci].align })
    tx += COLS[ci].w
  })
  y += 28

  // TTD
  const ttdX = sx + tableW - 180
  doc.font(f.R).fontSize(8.5).fillColor('#000')
    .text(`${s.kota || '___________'}, ${tglNow}`, ttdX, y, { width: 180, align: 'center' })
    .text('Kepala Sekolah,', ttdX, y + 12, { width: 180, align: 'center' })
  if (s.ttd_kepsek) { try { doc.image(s.ttd_kepsek, ttdX + 65, y + 18, { fit: [50, 30] }) } catch {} }
  doc.font(f.B).fontSize(8.5).text(s.kepala || '____________________', ttdX, y + 55, { width: 180, align: 'center' })
  doc.font(f.R).fontSize(7.5).text(`NIP. ${s.nip || '____________________'}`, ttdX, y + 65, { width: 180, align: 'center' })

  doc.end()
  return fn
}


// ══════════════════════════════════════════════════════════════════════════
//  RAPORT SISWA — PDF format resmi A4 portrait
//  Satu halaman per siswa (atau 2 halaman jika mapel banyak)
// ══════════════════════════════════════════════════════════════════════════

function buildRaportPage(doc, f, s, periode, siswa, rsSiswa, mapelList, nilaiMap) {
  const PW = 595.28, PH = 841.89
  const ml = 45, mr = 45, mt = 20, cw = PW - ml - mr

  // ── KOP ──────────────────────────────────────────────────────────────────
  let y = drawKopResmi(doc, s, ml, cw)

  // ── JUDUL ─────────────────────────────────────────────────────────────────
  doc.rect(ml, y, cw, 22).fill('#1e3a5f')
  doc.font(f.B).fontSize(11).fillColor('#fff')
     .text('LAPORAN HASIL BELAJAR SISWA (RAPORT)', ml, y + 5, { width: cw, align: 'center' })
  y += 26

  doc.font(f.R).fontSize(9).fillColor('#555')
     .text(`Semester ${periode.semester}  |  Tahun Pelajaran ${periode.tahun_ajaran}`, ml, y, { width: cw, align: 'center' })
  y += 14

  // ── IDENTITAS SISWA ────────────────────────────────────────────────────────
  const identY = y
  const halfW  = cw / 2 - 5

  const drawId = (label, value, x, yy, lw) => {
    doc.font(f.R).fontSize(8).fillColor('#555').text(label, x, yy, { width: lw })
    doc.font(f.R).fontSize(8).fillColor('#000').text(':', x + lw, yy, { width: 8 })
    doc.font(f.B).fontSize(8.5).fillColor('#000').text(value || '—', x + lw + 8, yy, { width: halfW - lw - 8 })
    doc.moveTo(x + lw + 8, yy + 10).lineTo(x + halfW, yy + 10).lineWidth(0.3).stroke('#ddd')
  }

  const LW = 72
  let iy = identY
  const kiri = [
    ['Nama Lengkap', siswa.nama],
    ['NIS / NISM',   siswa.nism || '-'],
    ['NISN',         siswa.nisn || '-'],
    ['Tempat Lahir', siswa.tempat_lahir || '-'],
    ['Tanggal Lahir', siswa.tgl_lahir ? fmtTgl(siswa.tgl_lahir) : '-'],
    ['Agama',         siswa.agama || '-'],
  ]
  const kanan = [
    ['Kelas',         rsSiswa?.kelas || siswa.kelas || '-'],
    ['No. Absen',     rsSiswa?.no_absen ? String(rsSiswa.no_absen) : '-'],
    ['Nama Orang Tua', siswa.nama_ayah || siswa.nama_ibu || '-'],
    ['Alamat',         siswa.alamat || '-'],
    ['Tahun Pelajaran', periode.tahun_ajaran],
    ['Wali Kelas',     rsSiswa?.catatan_wali ? '' : '-'],
  ]

  kiri.forEach(([l, v]) => { drawId(l, v, ml, iy, LW); iy += 12 })
  iy = identY
  kanan.forEach(([l, v]) => { drawId(l, v, ml + halfW + 10, iy, LW); iy += 12 })

  y = identY + kiri.length * 12 + 4

  // ── TABEL NILAI ────────────────────────────────────────────────────────────
  // Pisah mapel per kelompok
  const kelompokMap = {}
  for (const m of mapelList) {
    const k = m.kelompok || 'A'
    if (!kelompokMap[k]) kelompokMap[k] = []
    kelompokMap[k].push(m)
  }

  const KELOMPOK_LABEL = {
    'A': 'KELOMPOK A — Muatan Nasional',
    'B': 'KELOMPOK B — Muatan Kewilayahan',
    'C': 'KELOMPOK C — Muatan Peminatan',
    'Mulok': 'MUATAN LOKAL',
    'Pengembangan Diri': 'PENGEMBANGAN DIRI',
  }

  // Kolom tabel: No | Mata Pelajaran | UH1..n | Avg UH | UTS | PAS | Nilai Akhir | Predikat | Ket
  // Lebar disesuaikan
  const NO_W   = 22
  const MP_W   = 120
  const UH_W   = 28   // per kolom UH (max 6)
  const AVG_W  = 30
  const UTS_W  = 30
  const PAS_W  = 30
  const NA_W   = 38
  const PR_W   = 28
  const DESC_W = cw - NO_W - MP_W - AVG_W - UTS_W - PAS_W - NA_W - PR_W
  const ROW_H  = 14
  const HDR_H  = 18

  // Count max bab across all mapel
  const maxBab = mapelList.reduce((mx, m) => Math.max(mx, m.jumlah_bab || 1), 1)
  const totalUhW = UH_W * maxBab

  // Recalculate with actual UH columns
  const actualDesc = cw - NO_W - MP_W - totalUhW - AVG_W - UTS_W - PAS_W - NA_W - PR_W
  const descW = Math.max(actualDesc, 40)

  const COLS = [
    { h: 'No', w: NO_W, align: 'center' },
    { h: 'Mata Pelajaran', w: MP_W, align: 'left' },
    ...Array.from({length: maxBab}, (_, i) => ({ h: `UH${i+1}`, w: UH_W, align: 'center' })),
    { h: 'Avg UH', w: AVG_W, align: 'center' },
    { h: 'UTS', w: UTS_W, align: 'center' },
    { h: 'PAS', w: PAS_W, align: 'center' },
    { h: 'NA', w: NA_W, align: 'center' },
    { h: 'Pred', w: PR_W, align: 'center' },
    { h: 'Deskripsi / Catatan', w: descW, align: 'left' },
  ]
  const tableW = COLS.reduce((a, c) => a + c.w, 0)
  const sx = ml

  const drawTableHeader = () => {
    doc.rect(sx, y, tableW, HDR_H).fillAndStroke('#1e3a5f', '#1e3a5f')
    let hx = sx
    COLS.forEach(c => {
      doc.font(f.B).fontSize(6).fillColor('#fff')
         .text(c.h, hx + 1, y + 5, { width: c.w - 2, align: c.align })
      hx += c.w
    })
    y += HDR_H
  }

  const PREDIKAT_BG = { A:'#dcfce7', 'B+':'#dbeafe', B:'#e0f2fe', 'C+':'#fef9c3', C:'#ffedd5', D:'#fee2e2' }

  const drawMapelRow = (m, idx, isLast) => {
    if (y + ROW_H > PH - 60) return false  // need new page
    const n    = nilaiMap[m.id]
    const bg   = idx % 2 === 0 ? '#f9fafb' : '#fff'
    doc.rect(sx, y, tableW, ROW_H).fillAndStroke(bg, '#d1d5db')

    // Hitung avg UH
    const uhs = Array.from({length: maxBab}, (_, i) => n?.[`uh${i+1}`]).filter(v => v != null)
    const avgUH = uhs.length ? Math.round(uhs.reduce((a, b) => a + b, 0) / uhs.length * 10) / 10 : null
    const na = n?.nilai_akhir ?? null
    const pr = n?.predikat ?? ''

    const vals = [
      String(idx + 1),
      m.nama,
      ...Array.from({length: maxBab}, (_, i) => n?.[`uh${i+1}`] != null ? String(n[`uh${i+1}`]) : '—'),
      avgUH != null ? String(avgUH) : '—',
      n?.uts != null ? String(n.uts) : '—',
      n?.pas != null ? String(n.pas) : '—',
      na != null ? String(na) : '—',
      pr || '—',
      n?.deskripsi || '',
    ]

    let rx = sx
    vals.forEach((v, ci) => {
      const col    = COLS[ci]
      const isBold = ci === 1 || ci === vals.length - 3
      const naCol  = ci === vals.length - 3 && na != null ? (na < m.kkm ? '#dc2626' : '#15803d') : '#111'

      // Predikat background
      if (ci === vals.length - 2 && pr && PREDIKAT_BG[pr]) {
        doc.rect(rx + 1, y + 1, col.w - 2, ROW_H - 2).fill(PREDIKAT_BG[pr])
      }

      doc.font(isBold ? f.B : f.R).fontSize(6.5).fillColor(naCol)
         .text(v, rx + 1, y + 4, { width: col.w - 2, align: col.align, ellipsis: true })
      rx += col.w
    })
    y += ROW_H
    return true
  }

  let mapelIdx = 0
  const kelompokKeys = Object.keys(kelompokMap).sort()

  for (const kel of kelompokKeys) {
    if (y + HDR_H + 20 > PH - 60) break  // overflow protection

    const label = KELOMPOK_LABEL[kel] || `Kelompok ${kel}`

    // Kelompok label row
    doc.rect(sx, y, tableW, 14).fillAndStroke('#f0f4ff', '#d1d5db')
    doc.font(f.B).fontSize(7).fillColor('#1e3a5f')
       .text(label, sx + 4, y + 3, { width: tableW - 8 })
    y += 14

    // Sub-header only on first kelompok or after new page
    drawTableHeader()

    kelompokMap[kel].forEach((m, i) => drawMapelRow(m, mapelIdx++, false))
  }

  // ── REKAP KEHADIRAN ────────────────────────────────────────────────────────
  y += 6
  if (y + 50 > PH - 80) { /* skip if no space */ } else {
    const hadir = rsSiswa?.hadir || 0
    const sakit = rsSiswa?.sakit || 0
    const izin  = rsSiswa?.izin  || 0
    const alpha = rsSiswa?.alpha || 0
    const hariEfektif = periode.jumlah_hari_efektif || 0
    const pct = hariEfektif > 0 ? Math.round((hadir / hariEfektif) * 100) : 0

    doc.font(f.B).fontSize(8).fillColor('#1e3a5f').text('REKAP KEHADIRAN', sx, y)
    y += 12
    doc.rect(sx, y, tableW, 16).fillAndStroke('#1e3a5f', '#1e3a5f')
    const hdCols = [['Hari Efektif', 70], ['Hadir', 50], ['Sakit', 50], ['Izin', 50], ['Alpha', 50], ['% Kehadiran', 70]]
    let hx = sx
    hdCols.forEach(([h, w]) => {
      doc.font(f.B).fontSize(7).fillColor('#fff').text(h, hx + 2, y + 4, { width: w - 4, align: 'center' })
      hx += w
    })
    y += 16
    doc.rect(sx, y, tableW, 16).fillAndStroke('#f9fafb', '#d1d5db')
    let dx = sx
    ;[String(hariEfektif), String(hadir), String(sakit), String(izin), String(alpha), `${pct}%`].forEach((v, i) => {
      const w = hdCols[i][1]
      const color = i === 5 ? (pct >= 80 ? '#15803d' : '#dc2626') : '#111'
      doc.font(f.B).fontSize(9).fillColor(color).text(v, dx + 2, y + 4, { width: w - 4, align: 'center' })
      dx += w
    })
    y += 20
  }

  // ── CATATAN WALI KELAS ─────────────────────────────────────────────────────
  if (rsSiswa?.catatan_wali) {
    y += 4
    doc.font(f.B).fontSize(8).fillColor('#333').text('Catatan Wali Kelas:', sx, y)
    doc.font(f.R).fontSize(8).fillColor('#000').text(rsSiswa.catatan_wali, sx + 85, y, { width: cw - 85 })
    y += 14
  }

  // ── TTD ────────────────────────────────────────────────────────────────────
  const ttdY = Math.max(y + 10, PH - 100)
  const col1X = ml
  const col3X = ml + cw - 170
  const col2X = ml + (cw - 170) / 2 - 40

  // Kol 1: Orang tua/wali
  doc.font(f.R).fontSize(8).fillColor('#000')
     .text('Orang Tua / Wali,', col1X, ttdY, { width: 160, align: 'center' })
  doc.font(f.R).fontSize(8).text(`${s.kota || '________'}, ${fmtTgl(new Date().toISOString().slice(0,10))}`, col2X, ttdY, { width: 160, align: 'center' })
  doc.font(f.R).fontSize(8).text(`${s.kota || '________'}, ${fmtTgl(new Date().toISOString().slice(0,10))}`, col3X, ttdY, { width: 170, align: 'center' })

  doc.font(f.R).fontSize(8)
     .text('Wali Kelas,', col2X, ttdY + 12, { width: 160, align: 'center' })
     .text('Kepala Sekolah,', col3X, ttdY + 12, { width: 170, align: 'center' })

  // TTD kepala sekolah
  if (s.ttd_kepsek) {
    try {
      const fs = require('fs')
      doc.image(s.ttd_kepsek, col3X + 55, ttdY + 20, { fit: [60, 30] })
    } catch {}
  }

  doc.font(f.B).fontSize(8)
     .text('____________________', col1X, ttdY + 52, { width: 160, align: 'center' })
     .text('____________________', col2X, ttdY + 52, { width: 160, align: 'center' })
     .text((s.kepala || '____________________').toUpperCase(), col3X, ttdY + 52, { width: 170, align: 'center' })

  doc.font(f.R).fontSize(7)
     .text(`NIP. ${s.nip || '____________________'}`, col3X, ttdY + 63, { width: 170, align: 'center' })
}

// ─── Single siswa ──────────────────────────────────────────────────────────
function generateRaportSiswa(outputPath, { sekolah, periode, siswa, rsSiswa, mapelList, nilaiMap }) {
  const PDFDocument = require('pdfkit')
  const fs          = require('fs')
  const path        = require('path')
  const doc = new PDFDocument({ size: [595.28, 841.89], margins: { top: 20, bottom: 30, left: 45, right: 45 }, autoFirstPage: false })
  const fn  = path.join(outputPath, `raport_${siswa.nama?.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'') || siswa.id}_${Date.now()}.pdf`)
  doc.pipe(fs.createWriteStream(fn))
  const f   = fontSetup(doc, sekolah)
  doc.addPage()
  buildRaportPage(doc, f, sekolah, periode, siswa, rsSiswa, mapelList, nilaiMap)
  doc.end()
  return fn
}

// ─── All siswa dalam satu PDF ─────────────────────────────────────────────
function generateRaportAll(outputPath, { sekolah, periode, siswaList, mapelList, nilaiAll, rsAll }) {
  const PDFDocument = require('pdfkit')
  const fs          = require('fs')
  const path        = require('path')
  const doc = new PDFDocument({ size: [595.28, 841.89], margins: { top: 20, bottom: 30, left: 45, right: 45 }, autoFirstPage: false })
  const fn  = path.join(outputPath, `raport_semua_${periode.label?.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'') || periode.id}_${Date.now()}.pdf`)
  doc.pipe(fs.createWriteStream(fn))
  const f   = fontSetup(doc, sekolah)

  const nilaiMap = {}
  for (const n of nilaiAll) {
    if (!nilaiMap[n.siswa_id]) nilaiMap[n.siswa_id] = {}
    nilaiMap[n.siswa_id][n.mapel_id] = n
  }
  const rsMap = {}
  for (const rs of rsAll) rsMap[rs.siswa_id] = rs

  for (const siswa of siswaList) {
    doc.addPage()
    buildRaportPage(doc, f, sekolah, periode, siswa, rsMap[siswa.id] || null, mapelList, nilaiMap[siswa.id] || {})
  }

  doc.end()
  return fn
}
