import { useEffect, useState, useCallback, useRef } from 'react'
import { Save, ChevronLeft, ChevronRight, PenLine, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { Button, SearchBar, PageHeader, StatCard, Spinner , InfoTooltip } from '../ui'
import { siswaApi, mapelApi, semesterApi, nilaiApi, sekolahApi } from '../../lib/api'
import type { Siswa, Mapel, Semester, Nilai } from '../../types'

interface NilaiMap {
  [key: string]: { nilai_p?: number | null; nilai_k?: number | null; nilai_ujian?: number | null }
}

function nilaiKey(mapel_id: number, sem_id: number) {
  return `${mapel_id}_${sem_id}`
}

function clampNilai(v: string): number | null {
  if (v === '' || v === undefined) return null
  const n = parseFloat(v.replace(',', '.'))
  if (isNaN(n)) return null
  return Math.min(100, Math.max(0, n))
}

function NilaiInput({ value, onChange, placeholder = '–', readOnly = false }: {
  value: number | null | undefined
  onChange?: (v: number | null) => void
  placeholder?: string
  readOnly?: boolean
}) {
  const [raw, setRaw] = useState(value != null ? String(value) : '')
  useEffect(() => { setRaw(value != null ? String(value) : '') }, [value])

  const isValid = raw === '' || (!isNaN(parseFloat(raw)) && parseFloat(raw) >= 0 && parseFloat(raw) <= 100)
  const hasValue = raw !== ''

  return (
    <input
      type="number"
      min={0} max={100} step={0.01}
      value={raw}
      readOnly={readOnly}
      placeholder={placeholder}
      onChange={e => {
        setRaw(e.target.value)
        onChange?.(clampNilai(e.target.value))
      }}
      className={[
        'w-full text-center text-sm font-semibold rounded-lg border px-2 py-2 outline-none transition-all',
        'focus:ring-2 focus:ring-blue-400',
        readOnly ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-default' :
          !isValid ? 'bg-red-50 border-red-400 text-red-700' :
          hasValue ? 'bg-blue-50 border-blue-300 text-blue-800' :
          'bg-white border-gray-300 text-gray-400',
      ].join(' ')}
    />
  )
}

export function InputNilaiPage({ showToast, initialSiswaId }: { showToast: (msg: string, type?: any) => void; initialSiswaId?: number }) {
  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [mapelList, setMapelList] = useState<Mapel[]>([])
  const [semList, setSemList] = useState<Semester[]>([])
  const [q, setQ] = useState('')
  const [selSiswa, setSelSiswa] = useState<Siswa | null>(null)
  const [selSem, setSelSem] = useState<Semester | null>(null)
  const [nilaiMap, setNilaiMap] = useState<NilaiMap>({})
  const [sekolah, setSekolah] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loadingNilai, setLoadingNilai] = useState(false)
  const [saving, setSaving] = useState(false)

  // Load master data
  useEffect(() => {
    Promise.all([
      siswaApi.list(),
      mapelApi.list(),
      semesterApi.list(),
    ]).then(([s, m, sem]) => {
      const siswaArr = s || []
      setSiswaList(siswaArr)
      setMapelList(m || [])
      const sems = sem || []
      setSemList(sems)
      if (sems.length > 0) setSelSem(sems[0])
      // Auto-select siswa jika dari navigasi rekap nilai
      if (initialSiswaId) {
        const found = siswaArr.find((sw: any) => sw.id === initialSiswaId)
        if (found) setSelSiswa(found)
      }
      setLoading(false)
    })
    sekolahApi.get().then(sk => setSekolah(sk))
  }, [initialSiswaId])

  // Filter siswa by search
  const filteredSiswa = siswaList.filter(s =>
    !q || s.nama.toLowerCase().includes(q.toLowerCase()) ||
    (s.nisn || '').includes(q) || (s.nism || '').includes(q)
  )

  // Load nilai when siswa changes
  useEffect(() => {
    if (!selSiswa) { setNilaiMap({}); return }
    setLoadingNilai(true)
    nilaiApi.getSiswa(selSiswa.id).then((rows: Nilai[]) => {
      const map: NilaiMap = {}
      rows.forEach(r => {
        const k = nilaiKey(r.mapel_id, r.semester_id)
        map[k] = { nilai_p: r.nilai_p, nilai_k: r.nilai_k, nilai_ujian: r.nilai_ujian }
      })
      setNilaiMap(map)
      setLoadingNilai(false)
    })
  }, [selSiswa])

  const getNilai = (mapel_id: number, sem_id: number) =>
    nilaiMap[nilaiKey(mapel_id, sem_id)] || {}

  const setNilai = (mapel_id: number, sem_id: number, field: string, val: number | null) => {
    const k = nilaiKey(mapel_id, sem_id)
    setNilaiMap(m => ({ ...m, [k]: { ...m[k], [field]: val } }))
  }

  const isUjian = (sem: Semester) => sem.is_ujian === 1

  const raportSems = semList.filter(s => !isUjian(s))
  const ujianSems = semList.filter(s => isUjian(s))

  // Stats for current semester
  const stats = useCallback(() => {
    if (!selSem) return { total: mapelList.length, filled: 0, empty: mapelList.length, avg: null }
    let filled = 0; const vals: number[] = []
    mapelList.forEach(m => {
      const n = getNilai(m.id, selSem.id)
      if (isUjian(selSem)) {
        if (n.nilai_ujian != null) { filled++; vals.push(n.nilai_ujian) }
      } else {
        if (n.nilai_p != null) {
          filled++; vals.push(n.nilai_p)
        }
      }
    })
    return {
      total: mapelList.length, filled, empty: mapelList.length - filled,
      avg: vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null
    }
  }, [selSem, nilaiMap, mapelList])()

  const save = async () => {
    if (!selSiswa || !selSem) return
    setSaving(true)
    try {
      const rows = mapelList.map(m => {
        const n = getNilai(m.id, selSem.id)
        return {
          siswa_id: selSiswa.id,
          mapel_id: m.id,
          semester_id: selSem.id,
          nilai_p: isUjian(selSem) ? null : (n.nilai_p ?? null),
          nilai_k: null,
          nilai_ujian: isUjian(selSem) ? (n.nilai_ujian ?? null) : null,
        }
      })
      await nilaiApi.saveBatch(rows)
      showToast(`Nilai ${selSem.label} berhasil disimpan`)
    } catch { showToast('Gagal menyimpan nilai', 'error') }
    finally { setSaving(false) }
  }

  const moveSiswa = (dir: -1 | 1) => {
    const idx = filteredSiswa.findIndex(s => s.id === selSiswa?.id)
    const ni = idx + dir
    if (ni >= 0 && ni < filteredSiswa.length) setSelSiswa(filteredSiswa[ni])
  }

  // Hitung rata raport dan nilai ijazah per mapel
  const rataRaportMap: Record<number, number | null> = {}
  const nijMap: Record<number, number | null> = {}
  if (selSiswa && selSem) {
    const raportSemsFull = semList.filter(s => !isUjian(s))
    if (isUjian(selSem)) {
      mapelList.forEach(m => {
        const rapVals: number[] = []
        raportSemsFull.forEach(s => {
          const rn = nilaiMap[nilaiKey(m.id, s.id)]
          if (rn?.nilai_p != null) rapVals.push(rn.nilai_p)
        })
        const rataRaport = rapVals.length === raportSemsFull.length
          ? rapVals.reduce((a, b) => a + b, 0) / rapVals.length : null
        rataRaportMap[m.id] = rataRaport
        const usN = nilaiMap[nilaiKey(m.id, selSem.id)]
        const usVal = usN?.nilai_ujian ?? null
        nijMap[m.id] = rataRaport != null && usVal != null && sekolah
          ? (rataRaport * (sekolah.bobot_raport ?? 60) + usVal * (sekolah.bobot_ujian ?? 40)) / ((sekolah.bobot_raport ?? 60) + (sekolah.bobot_ujian ?? 40))
          : null
      })
    } else {
      mapelList.forEach(m => {
        const rapVals: number[] = []
        raportSemsFull.forEach(s => {
          const rn = nilaiMap[nilaiKey(m.id, s.id)]
          if (rn?.nilai_p != null) rapVals.push(rn.nilai_p)
        })
        rataRaportMap[m.id] = rapVals.length > 0 ? rapVals.reduce((a, b) => a + b, 0) / rapVals.length : null
        nijMap[m.id] = null
      })
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64"><Spinner /> <span className="ml-2 text-gray-400">Memuat data...</span></div>
  )

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader title="Input Nilai" subtitle="Input nilai raport dan ujian per siswa"
        actions={
          <Button icon={<Save className="w-4 h-4"/>} loading={saving} onClick={save}
            disabled={!selSiswa || !selSem}>
            Simpan
          </Button>
        } />

      {/* Info bar */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs text-blue-700">
        <Info className="w-3.5 h-3.5 shrink-0" />
        Nilai Raport per Semester = Nilai Pengetahuan (P) &nbsp;·&nbsp; Nilai Ijazah = (Rata Raport × bobot%) + (Ujian × bobot%)
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* LEFT: siswa list */}
        <div className="w-64 shrink-0 flex flex-col gap-2">
          <SearchBar value={q} onChange={setQ} placeholder="Cari siswa..." />
          <div className="card flex-1 overflow-y-auto divide-y divide-gray-50">
            {filteredSiswa.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">Tidak ada siswa</p>
            )}
            {filteredSiswa.map(s => (
              <button key={s.id} onClick={() => setSelSiswa(s)}
                className={[
                  'w-full text-left px-3 py-2.5 transition-colors',
                  selSiswa?.id === s.id
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-50 text-gray-700'
                ].join(' ')}>
                <p className={['text-sm font-semibold truncate', selSiswa?.id === s.id ? 'text-white' : 'text-gray-900'].join(' ')}>
                  {s.no_urut}. {s.nama}
                </p>
                <p className={['text-xs truncate mt-0.5', selSiswa?.id === s.id ? 'text-blue-200' : 'text-gray-400'].join(' ')}>
                  {s.nisn || '-'}
                </p>
              </button>
            ))}
          </div>
          {/* Prev/Next */}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1 justify-center" icon={<ChevronLeft className="w-4 h-4"/>}
              onClick={() => moveSiswa(-1)} disabled={!selSiswa}>Prev</Button>
            <Button variant="secondary" className="flex-1 justify-center" onClick={() => moveSiswa(1)} disabled={!selSiswa}>
              Next <ChevronRight className="w-4 h-4"/>
            </Button>
          </div>
        </div>

        {/* RIGHT: nilai grid */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {!selSiswa ? (
            <div className="card flex items-center justify-center h-64 text-gray-400">
              <div className="text-center">
                <PenLine className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="font-medium">Pilih siswa di sebelah kiri</p>
              </div>
            </div>
          ) : (
            <>
              {/* Siswa info + stats */}
              <div className="card px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900">{selSiswa.nama}</p>
                  <p className="text-xs text-gray-500">NISN: {selSiswa.nisn || '-'} &nbsp;·&nbsp; NISM: {selSiswa.nism || '-'}</p>
                </div>
                <div className="flex gap-3">
                  <div className="text-center">
                    <p className="text-lg font-extrabold text-blue-600">{stats.filled}/{stats.total}</p>
                    <p className="text-xs text-gray-400">Terisi</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-extrabold text-emerald-600">{stats.avg ?? '-'}</p>
                    <p className="text-xs text-gray-400">Rata-rata</p>
                  </div>
                </div>
              </div>

              {/* Semester tabs */}
              <div className="flex gap-1 flex-wrap">
                {semList.map(sem => (
                  <button key={sem.id} onClick={() => setSelSem(sem)}
                    className={[
                      'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border',
                      selSem?.id === sem.id
                        ? isUjian(sem)
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    ].join(' ')}>
                    {sem.is_ujian ? 'Ujian Sekolah' : sem.label}
                  </button>
                ))}
              </div>

              {/* Nilai table */}
              {loadingNilai ? (
                <div className="card flex items-center justify-center h-48"><Spinner /></div>
              ) : selSem && (
                <div className="card overflow-hidden flex-1">
                  <div className="overflow-auto h-full">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide w-8">No</th>
                          <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Mata Pelajaran</th>
                          <th className="px-2 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide w-28 text-center">Kel.</th>
                          {isUjian(selSem) ? (
                            <>
                              <th className="px-3 py-3 text-xs font-bold text-amber-600 uppercase tracking-wide w-32 text-center"><span className="flex items-center justify-center gap-1">Nilai US <InfoTooltip text="Nilai Ujian Sekolah — dipakai bersama rata-rata rapor untuk menghitung Nilai Ijazah." position="bottom" /></span></th>
                              <th className="px-3 py-3 text-xs font-bold text-purple-600 uppercase tracking-wide w-32 text-center"><span className="flex items-center justify-center gap-1">Nilai Ijazah <InfoTooltip text="Hasil akhir: (Rata Rapor × bobot%) + (Nilai US × bobot%). Tampil di dokumen Nilai Ijazah." position="bottom" /></span></th>
                            </>
                          ) : (
                            <>
                              <th className="px-3 py-3 text-xs font-bold text-blue-600 uppercase tracking-wide w-32 text-center"><span className="flex items-center justify-center gap-1">Nilai Pengetahuan <InfoTooltip text="Nilai Pengetahuan (P) per semester — rata-ratanya jadi Nilai Rapor Ijazah." position="bottom" /></span></th>
                              <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide w-32 text-center">Rata Raport</th>
                            </>
                          )}
                          <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide w-24 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {mapelList.map((m, i) => {
                          const n = getNilai(m.id, selSem.id)
                          const isUj = isUjian(selSem)
                          const filled = isUj ? n.nilai_ujian != null : n.nilai_p != null

                          return (
                            <tr key={m.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                              <td className="px-4 py-2 text-xs text-gray-400 font-mono">{i + 1}</td>
                              <td className="px-4 py-2 font-semibold text-gray-900">{m.nama}</td>
                              <td className="px-2 py-2 text-center">
                                <span className={[
                                  'inline-flex px-2 py-0.5 rounded-full text-xs font-semibold',
                                  m.kelompok === 'A' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                ].join(' ')}>{m.kelompok}</span>
                              </td>
                              {isUj ? (
                                <>
                                  <td className="px-3 py-2">
                                    <NilaiInput value={n.nilai_ujian} onChange={v => setNilai(m.id, selSem.id, 'nilai_ujian', v)} />
                                  </td>
                                  <td className="px-3 py-2">
                                    <NilaiInput value={nijMap[m.id] ?? null} readOnly />
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="px-3 py-2">
                                    <NilaiInput value={n.nilai_p} onChange={v => setNilai(m.id, selSem.id, 'nilai_p', v)} />
                                  </td>
                                  <td className="px-3 py-2">
                                    <NilaiInput value={rataRaportMap[m.id] ?? null} readOnly />
                                  </td>
                                </>
                              )}
                              <td className="px-3 py-2 text-center">
                                {filled
                                  ? <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />
                                  : <AlertCircle className="w-4 h-4 text-gray-300 mx-auto" />
                                }
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
