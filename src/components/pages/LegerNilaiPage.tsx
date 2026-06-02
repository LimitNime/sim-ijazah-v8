import { useState, useEffect } from 'react'
import { TableProperties, ChevronLeft, Download } from 'lucide-react'
import { PageHeader } from '../ui'
import { legerApi, kelasApi } from '../../lib/api'
import { clsx } from 'clsx'

export function LegerNilaiPage({ showToast }: { showToast: (msg: string, type?: any) => void }) {
  const [kelasList, setKelasList] = useState<any[]>([])
  const [kelas, setKelas] = useState<any>(null)
  const [leger, setLeger] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [viewSem, setViewSem] = useState<'raport'|'ujian'|'akhir'>('akhir')

  useEffect(() => {
    kelasApi.list().then((r: any) => setKelasList(Array.isArray(r) ? r : []))
  }, [])

  useEffect(() => {
    if (!kelas) return
    setLoading(true)
    legerApi.get(kelas.id).then((r: any) => {
      setLeger(r)
      setLoading(false)
    })
  }, [kelas])

  const getNilai = (siswaId: number, mapelId: number, semId: number) => {
    if (!leger?.nilaiMap) return null
    return leger.nilaiMap[`${siswaId}_${mapelId}_${semId}`]
  }

  const getNilaiAkhir = (siswaId: number, mapelId: number) => {
    if (!leger) return null
    const { raportSems, ujianSem, nilaiMap, br, bu, totalB } = leger
    if (!raportSems?.length) return null
    const nilaiRaport = raportSems.map((s: any) => {
      const n = nilaiMap[`${siswaId}_${mapelId}_${s.id}`]
      return n?.nilai_raport ?? null
    }).filter((v: any) => v !== null)
    const avgRaport = nilaiRaport.length ? nilaiRaport.reduce((a: number, b: number) => a + b, 0) / nilaiRaport.length : null
    const nilaiUjian = ujianSem ? (nilaiMap[`${siswaId}_${mapelId}_${ujianSem.id}`]?.nilai_raport ?? null) : null
    if (avgRaport === null && nilaiUjian === null) return null
    const r = avgRaport ?? 0, u = nilaiUjian ?? 0
    return Math.round(((r * br) + (u * bu)) / totalB * 10) / 10
  }

  const getRataRata = (siswaId: number) => {
    if (!leger?.mapel?.length) return null
    const vals = leger.mapel.map((m: any) => getNilaiAkhir(siswaId, m.id)).filter((v: any) => v !== null)
    if (!vals.length) return null
    return Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length * 10) / 10
  }

  const nilaiColor = (n: number | null) => {
    if (n === null) return ''
    if (n >= 90) return 'text-green-700 font-bold'
    if (n >= 75) return 'text-blue-700'
    if (n >= 60) return 'text-yellow-700'
    return 'text-red-600 font-semibold'
  }

  if (!kelas) {
    return (
      <div className="space-y-4">
        <PageHeader title="Leger Nilai Kelas" subtitle="Daftar nilai semua mata pelajaran per kelas" />
        <div className="text-center py-12">
          <TableProperties className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h3 className="font-semibold text-gray-700 mb-4">Pilih Kelas</h3>
          {kelasList.length === 0
            ? <p className="text-gray-400 text-sm">Belum ada kelas. Buat di menu Wali Kelas.</p>
            : <div className="flex flex-wrap gap-2 justify-center">
                {kelasList.map(k => (
                  <button key={k.id} onClick={() => setKelas(k)}
                    className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-medium hover:bg-blue-100">
                    {k.nama}
                  </button>
                ))}
              </div>
          }
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Leger Nilai Kelas" subtitle={`Kelas ${kelas.nama}`}
        actions={
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700">
            <Download className="w-4 h-4" /> Cetak
          </button>
        }
      />

      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => setKelas(null)} className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
          <ChevronLeft className="w-4 h-4" />Ganti Kelas
        </button>

        {/* Toggle view */}
        <div className="flex bg-gray-100 rounded-lg p-0.5 text-sm ml-auto">
          {(['akhir','raport','ujian'] as const).map(v => (
            <button key={v} onClick={() => setViewSem(v)}
              className={clsx('px-3 py-1 rounded-md capitalize', viewSem === v ? 'bg-white shadow text-blue-700 font-medium' : 'text-gray-500')}>
              {v === 'akhir' ? 'Nilai Akhir' : v === 'raport' ? 'Per Semester' : 'Nilai Ujian'}
            </button>
          ))}
        </div>
      </div>

      {loading
        ? <div className="text-center py-12 text-gray-400">Memuat...</div>
        : !leger || leger.siswa?.length === 0
          ? <div className="text-center py-12 text-gray-400">Tidak ada data siswa di kelas ini.</div>
          : (
            <div className="overflow-auto rounded-xl border border-gray-200 bg-white">
              <table className="text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="px-2 py-2 text-left sticky left-0 bg-gray-800 z-10 min-w-[28px]">No</th>
                    <th className="px-3 py-2 text-left sticky left-7 bg-gray-800 z-10 min-w-[160px]">Nama Siswa</th>
                    {viewSem === 'raport' && leger.raportSems?.map((s: any) => (
                      <th key={s.id} colSpan={leger.mapel?.length || 1} className="px-2 py-2 text-center border-l border-gray-600">
                        {s.nama}
                      </th>
                    ))}
                    {viewSem === 'ujian' && (
                      <th colSpan={leger.mapel?.length || 1} className="px-2 py-2 text-center border-l border-gray-600">
                        {leger.ujianSem?.nama || 'Ujian'}
                      </th>
                    )}
                    {viewSem === 'akhir' && (
                      <th colSpan={(leger.mapel?.length || 0) + 1} className="px-2 py-2 text-center border-l border-gray-600">
                        Nilai Akhir (Raport {leger.br}% + Ujian {leger.bu}%)
                      </th>
                    )}
                  </tr>
                  <tr className="bg-gray-700 text-white">
                    <th className="px-2 py-1.5 sticky left-0 bg-gray-700 z-10"></th>
                    <th className="px-3 py-1.5 sticky left-7 bg-gray-700 z-10"></th>
                    {viewSem === 'raport' && leger.raportSems?.map((s: any) =>
                      leger.mapel?.map((m: any) => (
                        <th key={`${s.id}_${m.id}`} className="px-1.5 py-1.5 text-center max-w-[52px] truncate border-l border-gray-600 font-normal">
                          <span title={m.nama}>{m.singkatan || m.nama?.slice(0,6)}</span>
                        </th>
                      ))
                    )}
                    {viewSem === 'ujian' && leger.mapel?.map((m: any) => (
                      <th key={m.id} className="px-1.5 py-1.5 text-center max-w-[52px] border-l border-gray-600 font-normal">
                        <span title={m.nama}>{m.singkatan || m.nama?.slice(0,6)}</span>
                      </th>
                    ))}
                    {viewSem === 'akhir' && leger.mapel?.map((m: any) => (
                      <th key={m.id} className="px-1.5 py-1.5 text-center max-w-[52px] border-l border-gray-600 font-normal">
                        <span title={m.nama}>{m.singkatan || m.nama?.slice(0,6)}</span>
                      </th>
                    ))}
                    {viewSem === 'akhir' && <th className="px-2 py-1.5 text-center border-l border-gray-600">Rata²</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leger.siswa?.map((s: any, i: number) => (
                    <tr key={s.id} className={i % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}>
                      <td className="px-2 py-2 text-center text-gray-400 sticky left-0 bg-inherit z-10">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-gray-900 sticky left-7 bg-inherit z-10 whitespace-nowrap">{s.nama}</td>

                      {viewSem === 'raport' && leger.raportSems?.map((sem: any) =>
                        leger.mapel?.map((m: any) => {
                          const n = getNilai(s.id, m.id, sem.id)
                          const v = n?.nilai_raport ?? null
                          return (
                            <td key={`${sem.id}_${m.id}`} className={clsx('px-1.5 py-2 text-center border-l border-gray-100', nilaiColor(v))}>
                              {v ?? '—'}
                            </td>
                          )
                        })
                      )}

                      {viewSem === 'ujian' && leger.mapel?.map((m: any) => {
                        const n = leger.ujianSem ? getNilai(s.id, m.id, leger.ujianSem.id) : null
                        const v = n?.nilai_raport ?? null
                        return (
                          <td key={m.id} className={clsx('px-1.5 py-2 text-center border-l border-gray-100', nilaiColor(v))}>
                            {v ?? '—'}
                          </td>
                        )
                      })}

                      {viewSem === 'akhir' && leger.mapel?.map((m: any) => {
                        const v = getNilaiAkhir(s.id, m.id)
                        return (
                          <td key={m.id} className={clsx('px-1.5 py-2 text-center border-l border-gray-100', nilaiColor(v))}>
                            {v ?? '—'}
                          </td>
                        )
                      })}
                      {viewSem === 'akhir' && (
                        <td className={clsx('px-2 py-2 text-center border-l border-gray-200 font-bold', nilaiColor(getRataRata(s.id)))}>
                          {getRataRata(s.id) ?? '—'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-500 flex gap-4">
                <span className="text-green-700 font-semibold">≥90 Sangat Baik</span>
                <span className="text-blue-700">≥75 Baik</span>
                <span className="text-yellow-700">≥60 Cukup</span>
                <span className="text-red-600 font-semibold">&lt;60 Perlu Perhatian</span>
              </div>
            </div>
          )
      }
    </div>
  )
}
