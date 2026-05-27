import { useEffect, useState, useCallback } from 'react'
import { Eye, PenLine, Download, RefreshCw, CheckCircle, XCircle, ChevronDown, ChevronUp, FileText, Users } from 'lucide-react'
import { Button, SearchBar, PageHeader, StatCard, Spinner , InfoTooltip } from '../ui'
import { nilaiApi, mapelApi, semesterApi, angkatanApi, exportApi, pdfApi } from '../../lib/api'
import type { Mapel, Semester, Angkatan, RekapRow } from '../../types'

export function RekapNilaiPage({ showToast, onNavigate }: {
  showToast: (msg: string, type?: any) => void
  onNavigate?: (page: string, params?: any) => void
}) {
  const [q, setQ]                     = useState('')
  const [loading, setLoading]         = useState(true)
  const [rekapData, setRekapData]     = useState<RekapRow[]>([])
  const [mapelList, setMapelList]     = useState<Mapel[]>([])
  const [semList, setSemList]         = useState<Semester[]>([])
  const [angkatanList, setAngkatanList] = useState<Angkatan[]>([])
  const [selAngkatanId, setSelAngkatanId] = useState<number | 'semua'>('semua')
  const [angkatanSiswaIds, setAngkatanSiswaIds] = useState<Set<number> | null>(null)
  const [expandedId, setExpandedId]   = useState<number | null>(null)
  const [detailNilai, setDetailNilai] = useState<Record<number, any[]>>({})
  const [loadingDetail, setLoadingDetail] = useState<number | null>(null)
  const [filterStatus, setFilterStatus] = useState<'semua'|'lengkap'|'belum'>('semua')
  const [exporting, setExporting]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rekap, mapels, sems, angk] = await Promise.all([
        nilaiApi.rekap(),
        mapelApi.list(),
        semesterApi.list(),
        angkatanApi.list(),
      ])
      setRekapData(rekap || [])
      setMapelList(mapels || [])
      setSemList(sems || [])
      setAngkatanList(angk || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Load siswa IDs per angkatan saat filter berubah
  useEffect(() => {
    if (selAngkatanId === 'semua') { setAngkatanSiswaIds(null); return }
    angkatanApi.getSiswa(selAngkatanId as number).then((rows: any[]) => {
      setAngkatanSiswaIds(new Set(rows.map(r => r.id)))
    })
  }, [selAngkatanId])

  const raportSems = semList.filter(s => s.is_ujian === 0)
  const ujianSem   = semList.find(s => s.is_ujian === 1)

  const filtered = rekapData.filter(r => {
    if (angkatanSiswaIds !== null && !angkatanSiswaIds.has(r.id)) return false
    const matchQ = !q || r.nama.toLowerCase().includes(q.toLowerCase()) || (r.nisn||'').includes(q)
    const matchStatus = filterStatus === 'semua' || (filterStatus === 'lengkap' ? r.lengkap : !r.lengkap)
    return matchQ && matchStatus
  })

  const stats = {
    total:   filtered.length,
    lengkap: filtered.filter(r => r.lengkap).length,
    belum:   filtered.filter(r => !r.lengkap).length,
    avg: (() => {
      const vals = filtered.filter(r => r.nilai_ijazah != null).map(r => r.nilai_ijazah!)
      return vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2) : '-'
    })(),
  }

  const loadDetail = async (siswaId: number) => {
    if (expandedId === siswaId) { setExpandedId(null); return }
    if (!detailNilai[siswaId]) {
      setLoadingDetail(siswaId)
      try {
        const rows = await nilaiApi.getSiswa(siswaId)
        setDetailNilai(d => ({ ...d, [siswaId]: rows || [] }))
      } finally { setLoadingDetail(null) }
    }
    setExpandedId(siswaId)
  }

  const getNilai = (siswaId: number, mapelId: number, semId: number) =>
    (detailNilai[siswaId] || []).find((r: any) => r.mapel_id === mapelId && r.semester_id === semId)

  const handleExportExcelSiswa = async (siswaId: number) => {
    try {
      const result = await exportApi.excelSiswa(siswaId) as any
      if (result?.ok) showToast('Export Excel berhasil')
      else showToast(result?.message || 'Gagal export', 'error')
    } catch { showToast('Gagal export', 'error') }
  }

  const handleExportSemua = async () => {
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const wsData = [
        ['No','Nama Siswa','NISN','Jumlah Nilai','Nilai Ijazah','Status'],
        ...filtered.map(r => [r.no_urut, r.nama, r.nisn||'-', r.jml_nilai, r.nilai_ijazah?.toFixed(2)??'-', r.lengkap?'Lengkap':'Belum Lengkap'])
      ]
      const ws = (XLSX as any).utils.aoa_to_sheet(wsData)
      ws['!cols'] = [{wch:6},{wch:32},{wch:16},{wch:12},{wch:14},{wch:16}]
      const wb = (XLSX as any).utils.book_new()
      ;(XLSX as any).utils.book_append_sheet(wb, ws, 'Rekap Nilai')
      ;(XLSX as any).writeFile(wb, `Rekap_Nilai.xlsx`)
      showToast('Export Excel berhasil')
    } catch (e:any) { showToast(`Gagal export: ${e.message}`, 'error') }
    finally { setExporting(false) }
  }

  const handlePDFSiswa = async (type: string, siswaId: number, label: string) => {
    try {
      let result: any
      if      (type === 'skl')      result = await pdfApi.sklSiswa(siswaId)
      else if (type === 'transkrip') result = await pdfApi.transkripSiswa(siswaId)
      else if (type === 'nilai')    result = await pdfApi.nilaiIjazahSiswa(siswaId)
      else if (type === 'ijazah')   result = await pdfApi.ijazahSiswa(siswaId)
      else if (type === 'skkb')     result = await pdfApi.skkbSiswa(siswaId)
      if (result?.ok) showToast(`${label} berhasil dibuka`)
      else showToast(result?.error || 'Gagal cetak PDF', 'error')
    } catch { showToast('Fitur PDF hanya tersedia di aplikasi desktop', 'warning') }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Rekap Nilai" subtitle="Pantau kelengkapan dan nilai akhir seluruh siswa"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<RefreshCw className="w-4 h-4"/>} onClick={load}>Refresh</Button>
            <Button variant="secondary" icon={<Download className="w-4 h-4"/>} loading={exporting} onClick={handleExportSemua}>Export Excel</Button>
          </div>
        }/>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Ditampilkan"    value={stats.total}   icon={<Eye className="w-5 h-5"/>}          color="text-blue-600"/>
        <StatCard label="Nilai Lengkap"  value={stats.lengkap} icon={<CheckCircle className="w-5 h-5"/>}  color="text-emerald-600"/>
        <StatCard label="Belum Lengkap"  value={stats.belum}   icon={<XCircle className="w-5 h-5"/>}      color="text-red-500"/>
        <StatCard label="Rata-rata NI"   value={stats.avg}     icon={<FileText className="w-5 h-5"/>}     color="text-purple-600"/>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-48">
          <SearchBar value={q} onChange={setQ} placeholder="Cari nama / NISN..."/>
        </div>

        {/* Filter angkatan */}
        <div className="flex items-center gap-1.5">
          <Users className="w-4 h-4 text-gray-400"/>
          <select
            value={selAngkatanId}
            onChange={e => setSelAngkatanId(e.target.value === 'semua' ? 'semua' : parseInt(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="semua">Semua Angkatan</option>
            {angkatanList.map(a => (
              <option key={a.id} value={a.id}>{a.nama} {a.tahun_lulus ? `(${a.tahun_lulus})` : ''}</option>
            ))}
          </select>
        </div>

        {/* Filter status */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {(['semua','lengkap','belum'] as const).map(f => (
            <button key={f} onClick={() => setFilterStatus(f)}
              className={['px-3 py-2 font-medium transition-colors',
                filterStatus === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              ].join(' ')}>
              {f === 'semua' ? 'Semua' : f === 'lengkap' ? '✅ Lengkap' : '❌ Belum'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card flex items-center justify-center h-48">
          <Spinner/><span className="ml-2 text-gray-400">Memuat data...</span>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase w-8">No</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Nama Siswa</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase w-32">NISN</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase w-24">Nilai Terisi</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-blue-600 uppercase w-28"><span className="flex items-center justify-center gap-1">Nilai Ijazah <InfoTooltip text="Hasil akhir: (Rata Rapor × bobot%) + (Nilai US × bobot%). Ini yang tercantum di dokumen resmi." /></span></th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase w-24"><span className="flex items-center justify-center gap-1">Status <InfoTooltip text="Lengkap = semua nilai rapor dan nilai ujian sudah terisi dan siap cetak dokumen." /></span></th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase w-44">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-gray-400 py-12">Tidak ada data</td></tr>
                )}
                {filtered.map((r, i) => (
                  <>
                    {/* Row utama */}
                    <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">{r.no_urut}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{r.nama}</td>
                      <td className="px-3 py-3 text-center font-mono text-xs text-gray-500">{r.nisn||'-'}</td>
                      <td className="px-3 py-3 text-center text-xs font-semibold text-gray-600">{r.jml_nilai||0}</td>
                      <td className="px-3 py-3 text-center">
                        {r.nilai_ijazah != null
                          ? <span className="font-bold text-blue-700 text-sm">{r.nilai_ijazah.toFixed(2)}</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {r.lengkap
                          ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3"/>Lengkap</span>
                          : <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3"/>Belum</span>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {/* Expand detail */}
                          <button onClick={() => loadDetail(r.id)} title="Lihat detail nilai"
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
                            {loadingDetail === r.id ? <Spinner/> : expandedId === r.id ? <ChevronUp className="w-3.5 h-3.5"/> : <ChevronDown className="w-3.5 h-3.5"/>}
                          </button>
                          {/* Edit nilai */}
                          <button onClick={() => onNavigate?.('nilai', { siswaId: r.id })} title="Edit nilai"
                            className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors">
                            <PenLine className="w-3.5 h-3.5"/>
                          </button>
                          {/* Export Excel per siswa */}
                          <button onClick={() => handleExportExcelSiswa(r.id)} title="Export Excel siswa ini"
                            className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 transition-colors">
                            <Download className="w-3.5 h-3.5"/>
                          </button>
                          {/* PDF cepat - transkrip */}
                          <button onClick={() => handlePDFSiswa('transkrip', r.id, 'Transkrip')} title="PDF Transkrip"
                            className="p-1.5 rounded-lg hover:bg-purple-50 text-gray-400 hover:text-purple-600 transition-colors">
                            <FileText className="w-3.5 h-3.5"/>
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Row detail expandable */}
                    {expandedId === r.id && detailNilai[r.id] && (
                      <tr key={`detail-${r.id}`}>
                        <td colSpan={7} className="bg-blue-50/40 px-6 py-4">
                          <div className="overflow-x-auto rounded-xl border border-blue-100 bg-white shadow-sm">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                  <th className="px-3 py-2 text-left font-semibold text-gray-500 w-6">No</th>
                                  <th className="px-3 py-2 text-left font-semibold text-gray-600 min-w-36">Mata Pelajaran</th>
                                  {raportSems.map(s => (
                                    <th key={s.id} className="px-2 py-2 text-center font-semibold text-blue-500 w-16">
                                      {s.label.replace('Semester ','S').replace(' (Ganjil)','').replace(' (Genap)','')}
                                    </th>
                                  ))}
                                  <th className="px-2 py-2 text-center font-bold text-blue-700 w-20"><span className="flex items-center justify-center gap-1">Rata Raport <InfoTooltip text="Rata-rata nilai pengetahuan (P) dari semua semester rapor." /></span></th>
                                  {ujianSem && <th className="px-2 py-2 text-center font-semibold text-amber-600 w-20">Nilai US</th>}
                                  <th className="px-2 py-2 text-center font-bold text-purple-600 w-20"><span className="flex items-center justify-center gap-1">Nilai Ijazah <InfoTooltip text="Hasil akhir: (Rata Rapor × bobot%) + (Nilai US × bobot%). Ini yang tercantum di dokumen resmi." /></span></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {mapelList.map((m, mi) => {
                                  const rapVals: number[] = []
                                  const rapCells = raportSems.map(s => {
                                    const n = getNilai(r.id, m.id, s.id)
                                    if (n && n.nilai_p != null) {
                                      const val = parseFloat(n.nilai_p)
                                      rapVals.push(val)
                                      return <span className="font-semibold text-blue-700">{val.toFixed(1)}</span>
                                    }
                                    return <span className="text-red-400 font-bold">–</span>
                                  })

                                  const rataRaport = rapVals.length === raportSems.length
                                    ? rapVals.reduce((a,b)=>a+b,0)/rapVals.length : null

                                  const ujN = ujianSem ? getNilai(r.id, m.id, ujianSem.id) : null
                                  const ujVal = ujN?.nilai_ujian != null ? parseFloat(ujN.nilai_ujian) : null

                                  // Nilai ijazah dihitung di backend, tampilkan indikator saja
                                  const nijReady = rataRaport != null && ujVal != null

                                  return (
                                    <tr key={m.id} className={mi % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                      <td className="px-3 py-2 text-gray-400">{mi+1}</td>
                                      <td className="px-3 py-2 font-medium text-gray-800">{m.nama}</td>
                                      {rapCells.map((cell, ci) => (
                                        <td key={ci} className="px-2 py-2 text-center">{cell}</td>
                                      ))}
                                      <td className="px-2 py-2 text-center">
                                        {rataRaport != null
                                          ? <span className="font-bold text-blue-800">{rataRaport.toFixed(2)}</span>
                                          : <span className="text-red-300 font-bold">–</span>}
                                      </td>
                                      {ujianSem && (
                                        <td className="px-2 py-2 text-center">
                                          {ujVal != null
                                            ? <span className="font-semibold text-amber-700">{ujVal.toFixed(2)}</span>
                                            : <span className="text-red-400 font-bold">–</span>}
                                        </td>
                                      )}
                                      <td className="px-2 py-2 text-center">
                                        {nijReady
                                          ? <span className="text-xs text-purple-600 font-semibold">✓</span>
                                          : <span className="text-xs text-red-300">–</span>}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Cetak PDF per siswa */}
                          <div className="flex gap-2 mt-3 flex-wrap items-center">
                            <p className="text-xs font-semibold text-gray-500">Cetak PDF:</p>
                            {[
                              { type:'skl',      label:'SKL' },
                              { type:'transkrip', label:'Transkrip' },
                              { type:'nilai',    label:'Nilai Ijazah' },
                              { type:'ijazah',   label:'Ijazah' },
                              { type:'skkb',     label:'SKKB' },
                            ].map(p => (
                              <button key={p.type}
                                onClick={() => handlePDFSiswa(p.type, r.id, p.label)}
                                className="px-3 py-1 text-xs font-semibold rounded-lg bg-white border border-gray-200 hover:border-blue-400 hover:text-blue-600 transition-colors shadow-sm">
                                {p.label}
                              </button>
                            ))}
                            <button
                              onClick={() => handleExportExcelSiswa(r.id)}
                              className="px-3 py-1 text-xs font-semibold rounded-lg bg-white border border-gray-200 hover:border-emerald-400 hover:text-emerald-600 transition-colors shadow-sm">
                              Export Excel
                            </button>
                          </div>

                          {/* Info kelengkapan per semester */}
                          {!r.lengkap && r.detail_kelengkapan && (
                            <div className="mt-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
                              <p className="text-xs font-bold text-red-600 mb-1.5">⚠️ Semester yang belum lengkap:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {r.detail_kelengkapan.map((d: any) => (
                                  <span key={d.semester_id}
                                    className={['inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
                                      d.lengkap ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                    ].join(' ')}>
                                    {d.lengkap ? '✓' : `✗ ${d.kurang} mapel`} {d.label}
                                  </span>
                                ))}
                              </div>
                              <button className="mt-1.5 text-xs text-red-600 underline font-semibold"
                                onClick={() => onNavigate?.('nilai', { siswaId: r.id })}>
                                Lengkapi nilai sekarang →
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
