import { useEffect, useState, useCallback } from 'react'
import { FileSpreadsheet, FileText, Printer, RefreshCw, CheckCircle, XCircle, Download, Loader2, ChevronDown } from 'lucide-react'
import { Button, PageHeader, StatCard, Table, Badge , InfoTooltip } from '../ui'
import { nilaiApi, sekolahApi, appApi, pdfApi, angkatanApi, dbApi, exportApi } from '../../lib/api'
import type { Sekolah, Angkatan, RekapRow } from '../../types'

export function RekapCetakPage({ showToast }: { showToast: (msg: string, type?: any) => void }) {
  const [data, setData]           = useState<RekapRow[]>([])
  const [sekolah, setSekolah]     = useState<Sekolah | null>(null)
  const [loading, setLoading]     = useState(true)
  const [printing, setPrinting]   = useState<string | null>(null)
  const [angkatanList, setAngkatanList] = useState<Angkatan[]>([])
  // Per-dokumen pilihan angkatan: null = semua angkatan aktif
  const [angkatanSel, setAngkatanSel] = useState<Record<string, number | null>>({})
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rekap, skl, angk] = await Promise.all([nilaiApi.rekap(), sekolahApi.get(), angkatanApi.list()])
      setData(rekap || []); setSekolah(skl)
      setAngkatanList(angk || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  // Close dropdown on outside click
  useEffect(() => {
    const close = () => setOpenDropdown(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  const stats = {
    total:   data.length,
    lengkap: data.filter(r => r.lengkap).length,
    belum:   data.filter(r => !r.lengkap).length,
    avg:     (() => {
      const vals = data.filter(r => r.nilai_ijazah != null).map(r => r.nilai_ijazah!)
      return vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2) : '0.00'
    })(),
  }

  const exportExcel = async (angkatan_id?: number | null) => {
    try {
      const result = await exportApi.excelAngkatan(angkatan_id ?? null) as any
      if (result?.ok) showToast('Export Excel berhasil')
      else showToast(result?.error || result?.message || 'Gagal export', 'error')
    } catch (e: any) { showToast(`Gagal export: ${e.message}`, 'error') }
  }

  const printPDF = async (
    type: 'skl' | 'dkn' | 'nilaiIjazah' | 'ijazah' | 'transkrip' | 'sk_kelulusan' | 'skkb',
    label: string,
    angkatan_id?: number | null
  ) => {
    setPrinting(type)
    try {
      const aid = angkatan_id ?? null
      let result: any
      if (type === 'skl')             result = await pdfApi.skl(aid)
      else if (type === 'dkn')        result = await pdfApi.dkn(aid)
      else if (type === 'ijazah')     result = await pdfApi.ijazah(aid)
      else if (type === 'transkrip')  result = await pdfApi.transkrip(aid)
      else if (type === 'sk_kelulusan') result = await pdfApi.skKelulusan(aid)
      else if (type === 'skkb')       result = await pdfApi.skkb(aid)
      else                            result = await pdfApi.nilaiIjazah(aid)

      if (result?.ok) {
        showToast(`${label} berhasil dicetak dan dibuka`)
      } else {
        showToast(`Gagal cetak: ${result?.error || 'Unknown error'}`, 'error')
      }
    } catch (e: any) {
      showToast('Fitur PDF hanya tersedia di aplikasi desktop (.exe)', 'warning')
    } finally { setPrinting(null) }
  }

  const isElectron = !!(window as any).api

  const columns = [
    { key:'no_urut', header:'No', width:'56px', align:'center' as const,
      render:(r:RekapRow) => <span className="font-mono text-xs text-gray-400">{r.no_urut}</span> },
    { key:'nama', header:'Nama Siswa',
      render:(r:RekapRow) => <span className="font-semibold text-gray-900">{r.nama}</span> },
    { key:'nisn', header:'NISN', width:'140px',
      render:(r:RekapRow) => <span className="font-mono text-xs text-gray-500">{r.nisn||'-'}</span> },
    { key:'jml_nilai', header:'Data Nilai', width:'100px', align:'center' as const,
      render:(r:RekapRow) => <span className="text-sm text-gray-600">{r.jml_nilai}</span> },
    { key:'nilai_ijazah', header:'Nilai Ijazah', width:'140px', align:'center' as const,
      render:(r:RekapRow) => r.nilai_ijazah != null
        ? <span className="font-bold text-blue-700 text-base">{r.nilai_ijazah.toFixed(2)}</span>
        : <span className="text-gray-300 text-xs">Nilai belum lengkap</span> },
    { key:'lengkap', header:'Status', width:'150px', align:'center' as const,
      render:(r:RekapRow) => r.lengkap
        ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
            <CheckCircle className="w-3 h-3"/>Lengkap</span>
        : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-600">
            <XCircle className="w-3 h-3"/>Belum Lengkap</span> },
  ]

  // Dokumen yang bisa dipilih angkatan
  const PDF_BTNS: { type: 'skl'|'dkn'|'nilaiIjazah'|'ijazah'|'transkrip'|'sk_kelulusan'|'skkb'; label: string; info: string }[] = [
    { type: 'skl',          label: 'Cetak SKL',           info: 'Surat Keterangan Lulus per siswa (A4). Nomor SKL dari data masing-masing siswa.' },
    { type: 'dkn',          label: 'Cetak DKN',           info: 'Daftar Kumpulan Nilai semua siswa (F4 landscape). Berisi nilai per mapel dan rata-rata Nilai Ijazah.' },
    { type: 'nilaiIjazah',  label: 'Cetak Nilai Ijazah',  info: 'Lampiran nilai ijazah per siswa (A4). Berisi 4 kolom: Mapel, Rata Rapor, Nilai US, Nilai Ijazah.' },
    { type: 'ijazah',       label: 'Cetak Ijazah',        info: 'Halaman isian ijazah resmi. Gunakan blanko asli dari Kemendikbud/Kemenag sebagai kertas cetak.' },
    { type: 'transkrip',    label: 'Cetak Transkrip Nilai', info: 'Transkrip Nilai resmi per siswa (F4 portrait). Berisi biodata, tabel nilai akhir per mapel, dan TTD kepala sekolah.' },
    { type: 'sk_kelulusan', label: 'Cetak SK Kelulusan',  info: 'Surat Keputusan Kelulusan resmi (F4). Berisi halaman SK + lampiran daftar siswa lulus.' },
    { type: 'skkb',         label: 'Cetak SKKB',          info: 'Surat Keterangan Kelakuan Baik per siswa (A4). Nomor dari data siswa atau nomor default sekolah.' },
  ]

  function getAngkatanLabel(type: string) {
    const id = angkatanSel[type] ?? null
    if (!id) return 'Semua Angkatan'
    return angkatanList.find(a => a.id === id)?.nama ?? 'Semua Angkatan'
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Rekap & Cetak" subtitle="Rekap nilai ijazah dan cetak dokumen resmi"
        actions={<Button variant="secondary" icon={<RefreshCw className="w-4 h-4"/>} onClick={load}>Refresh</Button>} />

      {/* Backup & Restore */}
      <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-800">🗄️ Backup & Restore Database</p>
          <p className="text-xs text-amber-600">Backup menyimpan file <strong>.zip</strong> berisi database + export JSON. Restore bisa dari file .zip atau .db</p>
        </div>
        <button onClick={async () => {
          const r = await dbApi.backup() as any
          if (r?.ok) alert('✅ Backup berhasil disimpan di:\n' + r.path)
          else if (r?.message !== 'Dibatalkan') alert('❌ Gagal backup: ' + r?.message)
        }} className="px-4 py-2 text-sm font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
          💾 Backup (.zip)
        </button>
        <button onClick={async () => {
          if (!confirm('⚠️ Restore akan MENGGANTI semua data saat ini dengan data dari file backup.\n\nYakin lanjutkan?')) return
          const r = await dbApi.restore() as any
          if (r?.ok) { alert('✅ Restore berhasil! Aplikasi akan reload.'); window.location.reload() }
          else if (r?.message !== 'Dibatalkan') alert('❌ Gagal restore: ' + r?.message)
        }} className="px-4 py-2 text-sm font-semibold bg-white text-amber-700 border border-amber-400 rounded-lg hover:bg-amber-50 transition-colors">
          📂 Restore
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Siswa"      value={stats.total}   icon={<CheckCircle className="w-5 h-5"/>} color="text-blue-600"/>
        <StatCard label="Nilai Lengkap"    value={stats.lengkap} icon={<CheckCircle className="w-5 h-5"/>} color="text-emerald-600"/>
        <StatCard label="Belum Lengkap"    value={stats.belum}   icon={<XCircle className="w-5 h-5"/>}     color="text-red-500"/>
        <StatCard label="Rata-rata Ijazah" value={stats.avg}     icon={<FileText className="w-5 h-5"/>}    color="text-purple-600"/>
      </div>

      {/* Actions */}
      <div className="card p-4">
        <p className="text-sm font-bold text-gray-700 mb-1">Ekspor & Cetak Dokumen</p>
        {!isElectron && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-lg mb-3">
            Fitur cetak PDF hanya aktif di aplikasi desktop (.exe). Export Excel tersedia di semua platform.
          </div>
        )}
        <p className="text-xs text-gray-400 mb-3">
          Setiap tombol cetak punya dropdown angkatan di sebelahnya — pilih angkatan tertentu agar PDF hanya berisi siswa angkatan tersebut (tahun pelajaran ikut angkatan yang dipilih), atau biarkan "Semua Angkatan" untuk mencetak semua siswa aktif.
        </p>
        <div className="flex flex-wrap gap-2 items-start">
          <Button variant="secondary" icon={<FileSpreadsheet className="w-4 h-4 text-emerald-600"/>} onClick={exportExcel}>
            Export Excel
          </Button>

          {PDF_BTNS.map(({ type, label }) => {
            const isPrinting = printing === type
            const angId = angkatanSel[type] ?? null
            return (
              <div key={type} className="flex items-stretch">
                {/* Tombol cetak utama */}
                <button
                  disabled={!isElectron || !!printing}
                  onClick={() => printPDF(type, label, angId)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-l-lg border border-r-0 transition-colors
                    ${isElectron && !printing
                      ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                      : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'}`}>
                  {isPrinting
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin"/>
                    : <Printer className="w-3.5 h-3.5"/>}
                  <span>{isPrinting ? 'Mencetak...' : `${label} (PDF)`}</span>
                  {!isPrinting && <InfoTooltip text={type && PDF_BTNS.find(b=>b.type===type)?.info || ''} position="bottom" />}
                </button>

                {/* Dropdown pilih angkatan */}
                <div className="relative" onClick={e => e.stopPropagation()}>
                  <button
                    disabled={!isElectron || !!printing}
                    onClick={() => setOpenDropdown(openDropdown === type ? null : type)}
                    className={`flex items-center gap-1 px-2 py-2 text-xs font-medium rounded-r-lg border transition-colors h-full
                      ${isElectron && !printing
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                        : 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'}`}>
                    <span className="max-w-[90px] truncate">{getAngkatanLabel(type)}</span>
                    <ChevronDown className="w-3 h-3 flex-shrink-0"/>
                  </button>
                  {openDropdown === type && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[160px] py-1">
                      <button
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${!angId ? 'font-bold text-emerald-700' : 'text-gray-700'}`}
                        onClick={() => { setAngkatanSel(s => ({...s, [type]: null})); setOpenDropdown(null) }}>
                        Semua Angkatan
                      </button>
                      {angkatanList.map(a => (
                        <button key={a.id}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${angId === a.id ? 'font-bold text-emerald-700' : 'text-gray-700'}`}
                          onClick={() => { setAngkatanSel(s => ({...s, [type]: a.id})); setOpenDropdown(null) }}>
                          {a.nama}{a.tahun_lulus ? ` (${a.tahun_lulus})` : ''}
                        </button>
                      ))}
                      {angkatanList.length === 0 && (
                        <p className="px-3 py-2 text-xs text-gray-400">Belum ada angkatan</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          <Button variant="ghost" icon={<Download className="w-4 h-4"/>} onClick={() => appApi.openOutput()}>
            Buka Folder Output
          </Button>
        </div>
      </div>

      <Table columns={columns} data={data} keyFn={r=>r.id} loading={loading}
        emptyText="Belum ada data. Tambahkan siswa dan input nilai terlebih dahulu." />
    </div>
  )
}
