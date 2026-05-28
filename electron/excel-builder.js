'use strict'
/**
 * excel-builder.js
 * Menulis file .xlsx (OOXML/SpreadsheetML) tanpa library tambahan.
 * Support: warna header, alternating rows, border, freeze pane, lebar kolom, merge cell.
 *
 * API:
 *   const wb = new Workbook()
 *   const ws = wb.addSheet('Nama Sheet')
 *   ws.setColWidths([5, 32, 14, ...])       // lebar kolom (karakter)
 *   ws.freezePane(row, col)                 // freeze N baris / M kolom
 *   ws.addRow(cells, styleKey)              // styleKey: 'header'|'subheader'|'data0'|'data1'|'title'|'label'
 *   ws.mergeCell(r1,c1,r2,c2)
 *   await wb.writeFile('/path/file.xlsx')
 */

const fs   = require('fs')
const path = require('path')
const zlib = require('zlib')

// ── Tema warna ────────────────────────────────────────────────────────────────
const T = {
  HDR:  'FF1E3A5F',  // biru gelap  – header utama
  SUB:  'FF2E6DA4',  // biru sedang – sub-header
  ALT:  'FFEBF3FB',  // biru muda   – alternating row
  WHT:  'FFFFFFFF',  // putih
  TXT:  'FF1A1A2E',  // teks gelap
  GRAY: 'FFF2F2F2',  // abu muda – label biodata
}

// ── Style catalog (akan dikompilasi jadi <xf> di styles.xml) ─────────────────
// Setiap entry: { font, fill, border, align }
const STYLE_DEFS = [
  // 0 – default / kosong
  { font: { sz:9 }, fill: 'none', border: 'none', align: 'left' },
  // 1 – header (teks putih, bg biru gelap, tebal, tengah, border tebal)
  { font: { sz:10, bold:true, color: T.WHT }, fill: T.HDR, border: 'thick', align: 'center' },
  // 2 – sub-header (teks putih, bg biru sedang, tebal, tengah)
  { font: { sz:9,  bold:true, color: T.WHT }, fill: T.SUB, border: 'thick', align: 'center' },
  // 3 – data baris genap (putih), tengah
  { font: { sz:9 }, fill: T.WHT, border: 'thin', align: 'center' },
  // 4 – data baris ganjil (biru muda), tengah
  { font: { sz:9 }, fill: T.ALT, border: 'thin', align: 'center' },
  // 5 – data baris genap, kiri
  { font: { sz:9 }, fill: T.WHT, border: 'thin', align: 'left' },
  // 6 – data baris ganjil, kiri
  { font: { sz:9 }, fill: T.ALT, border: 'thin', align: 'left' },
  // 7 – title biodata (teks putih, bg biru gelap, tebal, tengah)
  { font: { sz:11, bold:true, color: T.WHT }, fill: T.HDR, border: 'thick', align: 'center' },
  // 8 – label biodata (bold, bg abu, kiri)
  { font: { sz:9, bold:true }, fill: T.GRAY, border: 'thin', align: 'left' },
  // 9 – value biodata baris genap
  { font: { sz:9 }, fill: T.WHT, border: 'thin', align: 'left' },
  // 10 – value biodata baris ganjil
  { font: { sz:9 }, fill: T.ALT, border: 'thin', align: 'left' },
]
// Named aliases untuk kemudahan
const S = {
  DEFAULT:    0,
  HEADER:     1,
  SUBHEADER:  2,
  DATA_EVEN:  3,
  DATA_ODD:   4,
  DATA_EVEN_L:5,
  DATA_ODD_L: 6,
  TITLE:      7,
  LABEL:      8,
  VAL_EVEN:   9,
  VAL_ODD:    10,
}

// ── XML helpers ───────────────────────────────────────────────────────────────
function esc(v) {
  return String(v)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&apos;')
}
function colName(n) { // 1-based → A, B, ... Z, AA...
  let s = ''
  while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) }
  return s
}
function cellRef(r, c) { return colName(c) + r }

// ── Styles XML builder ────────────────────────────────────────────────────────
function buildStylesXml() {
  // fonts
  const fonts = STYLE_DEFS.map(d => {
    const f = d.font || {}
    let s = '<font>'
    if (f.bold)  s += '<b/>'
    s += `<sz val="${f.sz || 10}"/>`
    s += `<name val="Calibri"/>`
    if (f.color) s += `<color rgb="${f.color}"/>`
    else         s += `<color theme="1"/>`
    s += '</font>'
    return s
  })

  // fills – index 0 & 1 reserved by Excel (none, gray)
  const fills = ['<fill><patternFill patternType="none"/></fill>',
                 '<fill><patternFill patternType="gray125"/></fill>']
  const fillIdx = [] // style index → fill index in fills array
  STYLE_DEFS.forEach(d => {
    if (!d.fill || d.fill === 'none') {
      fillIdx.push(0)
    } else {
      fillIdx.push(fills.length)
      fills.push(`<fill><patternFill patternType="solid"><fgColor rgb="${d.fill}"/></patternFill></fill>`)
    }
  })

  // borders
  const bNone  = '<border><left/><right/><top/><bottom/><diagonal/></border>'
  const bThin  = '<border><left style="thin"><color rgb="FFCCCCCC"/></left><right style="thin"><color rgb="FFCCCCCC"/></right><top style="thin"><color rgb="FFCCCCCC"/></top><bottom style="thin"><color rgb="FFCCCCCC"/></bottom><diagonal/></border>'
  const bThick = '<border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border>'
  const borderXmls = [bNone, bThin, bThick]
  const borderIdx = STYLE_DEFS.map(d =>
    d.border === 'thick' ? 2 : d.border === 'thin' ? 1 : 0
  )

  // alignments
  const alignMap = { center:'center', left:'left', right:'right' }

  // xf (cell format)
  const xfs = STYLE_DEFS.map((d, i) => {
    const al = alignMap[d.align] || 'general'
    const applyAlign = d.align && d.align !== 'general' ? '1' : '0'
    return `<xf numFmtId="0" fontId="${i}" fillId="${fillIdx[i]}" borderId="${borderIdx[i]}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="${applyAlign}">` +
           (applyAlign === '1' ? `<alignment horizontal="${al}" vertical="middle" wrapText="1"/>` : '') +
           `</xf>`
  })

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="${fonts.length}">${fonts.join('')}</fonts>
  <fills count="${fills.length}">${fills.join('')}</fills>
  <borders count="${borderXmls.length}">${borderXmls.join('')}</borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>
</styleSheet>`
}

// ── Sheet builder ─────────────────────────────────────────────────────────────
class Sheet {
  constructor(name) {
    this.name    = name.slice(0, 31).replace(/[:\\/?*[\]]/g, '_')
    this._rows   = []      // [{cells:[{v,s}], h}]
    this._widths = []
    this._merges = []
    this._freeze = null    // {row,col}
    this._maxCol = 0
  }

  setColWidths(arr) { this._widths = arr }

  freezePane(row, col) { this._freeze = { row, col } }

  mergeCell(r1, c1, r2, c2) {
    this._merges.push(`${cellRef(r1,c1)}:${cellRef(r2,c2)}`)
  }

  /**
   * addRow(cells, styleKeyOrArray, height?)
   * cells: array of values (string/number/null)
   * styleKeyOrArray: single key (applies to all), or array per cell
   *   keys: 'header','subheader','title','label',
   *         'data'(even/odd auto), 'data_l'(kiri), 'val', 'val_l', default
   * rowIdx: dipakai untuk alternating (0-based index data row)
   */
  addRow(cells, styleKeyOrArray, height, rowIdx) {
    const resolve = (key, ci) => {
      const even = (rowIdx == null || rowIdx % 2 === 0)
      switch (key) {
        case 'header':     return S.HEADER
        case 'subheader':  return S.SUBHEADER
        case 'title':      return S.TITLE
        case 'label':      return S.LABEL
        case 'data':       return even ? S.DATA_EVEN    : S.DATA_ODD
        case 'data_l':     return even ? S.DATA_EVEN_L  : S.DATA_ODD_L
        case 'val':        return even ? S.VAL_EVEN     : S.VAL_ODD
        case 'val_l':      return even ? S.VAL_EVEN     : S.VAL_ODD
        default:           return S.DEFAULT
      }
    }
    const row = cells.map((v, ci) => {
      const key = Array.isArray(styleKeyOrArray) ? styleKeyOrArray[ci] : styleKeyOrArray
      return { v: v == null ? '' : v, s: resolve(key, ci) }
    })
    this._maxCol = Math.max(this._maxCol, cells.length)
    this._rows.push({ cells: row, h: height || 16 })
  }

  toXml() {
    const rowsXml = this._rows.map((row, ri) => {
      const rNum = ri + 1
      const cellsXml = row.cells.map((cell, ci) => {
        const cRef = cellRef(rNum, ci + 1)
        const isNum = typeof cell.v === 'number' && isFinite(cell.v)
        if (isNum) {
          return `<c r="${cRef}" s="${cell.s}"><v>${cell.v}</v></c>`
        } else {
          const txt = esc(String(cell.v))
          return `<c r="${cRef}" s="${cell.s}" t="inlineStr"><is><t>${txt}</t></is></c>`
        }
      }).join('')
      return `<row r="${rNum}" ht="${row.h}" customHeight="1">${cellsXml}</row>`
    }).join('\n')

    const colsXml = this._widths.length
      ? '<cols>' + this._widths.map((w, i) =>
          `<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`
        ).join('') + '</cols>'
      : ''

    const freezeXml = this._freeze
      ? `<sheetView workbookViewId="0"><pane xSplit="${this._freeze.col}" ySplit="${this._freeze.row}" topLeftCell="${cellRef(this._freeze.row+1, this._freeze.col+1)}" activePane="bottomRight" state="frozen"/></sheetView>`
      : '<sheetView workbookViewId="0"/>'

    const mergeXml = this._merges.length
      ? `<mergeCells count="${this._merges.length}">${this._merges.map(m=>`<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
      : ''

    const dim = this._rows.length
      ? `A1:${cellRef(this._rows.length, this._maxCol || 1)}`
      : 'A1'

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
           xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="${dim}"/>
  <sheetViews>${freezeXml}</sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  ${colsXml}
  <sheetData>${rowsXml}</sheetData>
  ${mergeXml}
</worksheet>`
  }
}

// ── Workbook ──────────────────────────────────────────────────────────────────
class Workbook {
  constructor() { this._sheets = [] }

  addSheet(name) {
    const ws = new Sheet(name)
    this._sheets.push(ws)
    return ws
  }

  async writeFile(filePath) {
    // Kumpulkan semua file ke dalam zip (xlsx = zip)
    const files = {}

    // [Content_Types].xml
    const sheetTypes = this._sheets.map((_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    ).join('')
    files['[Content_Types].xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml"  ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml"    ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheetTypes}
</Types>`

    // _rels/.rels
    files['_rels/.rels'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

    // xl/_rels/workbook.xml.rels
    const wbRels = this._sheets.map((_, i) =>
      `<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`
    ).join('')
    const stylesRelId = this._sheets.length + 1
    files['xl/_rels/workbook.xml.rels'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${wbRels}
  <Relationship Id="rId${stylesRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

    // xl/workbook.xml
    const sheetElems = this._sheets.map((ws, i) =>
      `<sheet name="${esc(ws.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`
    ).join('')
    files['xl/workbook.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetElems}</sheets>
</workbook>`

    // xl/styles.xml
    files['xl/styles.xml'] = buildStylesXml()

    // xl/worksheets/sheetN.xml
    this._sheets.forEach((ws, i) => {
      files[`xl/worksheets/sheet${i+1}.xml`] = ws.toXml()
    })

    // Tulis sebagai ZIP
    await writeZip(filePath, files)
  }
}

// ── Minimal ZIP writer (store + deflate) ──────────────────────────────────────
function crc32(buf) {
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
      t[i] = c
    }
    return t
  })())
  let c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

function writeUInt16LE(buf, v, off) { buf[off]=v&0xFF; buf[off+1]=(v>>8)&0xFF }
function writeUInt32LE(buf, v, off) { buf[off]=v&0xFF; buf[off+1]=(v>>8)&0xFF; buf[off+2]=(v>>16)&0xFF; buf[off+3]=(v>>24)&0xFF }

async function writeZip(filePath, files) {
  const entries = []
  for (const [name, content] of Object.entries(files)) {
    const raw  = Buffer.from(content, 'utf8')
    const comp = await deflate(raw)
    // Gunakan store jika compressed lebih besar
    const useStore = comp.length >= raw.length
    const data  = useStore ? raw : comp
    const meth  = useStore ? 0 : 8
    const crc   = crc32(raw)
    entries.push({ name: Buffer.from(name, 'utf8'), raw, data, meth, crc })
  }

  const parts = []
  const centralDir = []
  let offset = 0

  for (const e of entries) {
    const nameLen = e.name.length
    // Local file header
    const lh = Buffer.alloc(30 + nameLen)
    writeUInt32LE(lh, 0x04034b50, 0)   // signature
    writeUInt16LE(lh, 20, 4)            // version needed
    writeUInt16LE(lh, 0, 6)             // flags
    writeUInt16LE(lh, e.meth, 8)        // compression
    writeUInt16LE(lh, 0, 10)            // mod time
    writeUInt16LE(lh, 0, 12)            // mod date
    writeUInt32LE(lh, e.crc, 14)
    writeUInt32LE(lh, e.data.length, 18)
    writeUInt32LE(lh, e.raw.length, 22)
    writeUInt16LE(lh, nameLen, 26)
    writeUInt16LE(lh, 0, 28)
    e.name.copy(lh, 30)

    centralDir.push({ e, offset, nameLen })
    parts.push(lh, e.data)
    offset += lh.length + e.data.length
  }

  // Central directory
  const cdStart = offset
  for (const { e, offset: loff, nameLen } of centralDir) {
    const cd = Buffer.alloc(46 + nameLen)
    writeUInt32LE(cd, 0x02014b50, 0)
    writeUInt16LE(cd, 20, 4)
    writeUInt16LE(cd, 20, 6)
    writeUInt16LE(cd, 0, 8)
    writeUInt16LE(cd, e.meth, 10)
    writeUInt16LE(cd, 0, 12)
    writeUInt16LE(cd, 0, 14)
    writeUInt32LE(cd, e.crc, 16)
    writeUInt32LE(cd, e.data.length, 20)
    writeUInt32LE(cd, e.raw.length, 24)
    writeUInt16LE(cd, nameLen, 28)
    writeUInt16LE(cd, 0, 30)  // extra
    writeUInt16LE(cd, 0, 32)  // comment
    writeUInt16LE(cd, 0, 34)  // disk start
    writeUInt16LE(cd, 0, 36)  // internal attr
    writeUInt32LE(cd, 0, 38)  // external attr
    writeUInt32LE(cd, loff, 42)
    e.name.copy(cd, 46)
    parts.push(cd)
    offset += cd.length
  }

  // End of central directory
  const cdSize = offset - cdStart
  const eocd = Buffer.alloc(22)
  writeUInt32LE(eocd, 0x06054b50, 0)
  writeUInt16LE(eocd, 0, 4)
  writeUInt16LE(eocd, 0, 6)
  writeUInt16LE(eocd, entries.length, 8)
  writeUInt16LE(eocd, entries.length, 10)
  writeUInt32LE(eocd, cdSize, 12)
  writeUInt32LE(eocd, cdStart, 16)
  writeUInt16LE(eocd, 0, 20)
  parts.push(eocd)

  fs.writeFileSync(filePath, Buffer.concat(parts))
}

function deflate(buf) {
  return new Promise((res, rej) => {
    zlib.deflateRaw(buf, (err, out) => err ? rej(err) : res(out))
  })
}

// ── Export ────────────────────────────────────────────────────────────────────
module.exports = { Workbook, S }
