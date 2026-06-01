import React, { useEffect, useState, useCallback } from 'react'
import { nilaiApi, exportApi, angkatanApi } from '../../lib/api'
import { Download, Medal, Trophy, Award } from 'lucide-react'
import type { RankingRow } from '../../types'

interface Angkatan { id: number; nama: string; is_aktif: number }

interface Props { showToast: (msg: string, type?: 'success'|'error') => void }
// Override RankingRow to allow partial data
interface RankingRowExt extends RankingRow {
  mapel_isi?: number
  mapel_total?: number
}

export function RankingPage({ showToast }: Props) {
  const [data, setData]         = useState<RankingRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [exporting, setExp]     = useState(false)
  const [search, setSearch]     = useState('')
  const [angkatanList, setAngkatanList] = useState<Angkatan[]>([])
  const [angkatanId, setAngkatanId]     = useState<number|null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await (nilaiApi as any).ranking(angkatanId) as any
      setData(Array.isArray(rows) ? rows : [])
    } finally { setLoading(false) }
  }, [angkatanId])

  useEffect(() => {
    angkatanApi.list().then((list: any) => setAngkatanList(Array.isArray(list) ? list : []))
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = data.filter(r =>
    !search || r.nama?.toLowerCase().includes(search.toLowerCase()) ||
    r.nisn?.includes(search) || r.kelas?.toLowerCase().includes(search.toLowerCase())
  )

  const handleExport = async () => {
    setExp(true)
    try {
      const result = await exportApi.excelRanking() as any
      if (result?.ok) showToast('Export Ranking berhasil')
      else showToast(result?.error || 'Gagal export', 'error')
    } catch (e: any) { showToast(`Gagal export: ${e.message}`, 'error') }
    finally { setExp(false) }
  }

  const fmt = (v: number | null) =>
    v != null ? v.toFixed(2) : <span className="text-gray-300">—</span>

  const RankBadge = ({ rank }: { rank: number | null }) => {
    if (rank == null) return <span className="text-gray-300 text-sm">—</span>
    if (rank === 1) return <span className="flex items-center justify-center gap-1 text-yellow-600 font-black text-base"><Trophy className="w-4 h-4"/> 1</span>
    if (rank === 2) return <span className="flex items-center justify-center gap-1 text-gray-500 font-black text-base"><Medal className="w-4 h-4"/> 2</span>
    if (rank === 3) return <span className="flex items-center justify-center gap-1 text-amber-700 font-black text-base"><Award className="w-4 h-4"/> 3</span>
    return <span className="font-bold text-gray-700">{rank}</span>
  }

  // Stats
  const lengkap = data.filter(r => r.lengkap && r.nilai_ijazah != null)
  const avg     = lengkap.length > 0 ? (lengkap.reduce((a,r) => a + r.nilai_ijazah!, 0) / lengkap.length) : null
  const highest = lengkap.length > 0 ? lengkap[0] : null
  const lowest  = lengkap.length > 0 ? lengkap[lengkap.length - 1] : null

  return (
    <div className="flex flex-col gap-5 p-6 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ranking Siswa</h1>
          <p className="text-sm text-gray-500 mt-0.5">Berdasarkan Nilai Ijazah · {data.length} siswa</p>
        </div>
        <button
          onClick={handleExport} disabled={exporting}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4"/>
          {exporting ? 'Mengexport...' : 'Export Excel'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Siswa', value: data.length, color: 'blue' },
          { label: 'Nilai Lengkap', value: lengkap.length, color: 'emerald' },
          { label: 'Rata-rata NIJ', value: avg ? avg.toFixed(2) : '—', color: 'purple' },
          { label: 'Nilai Tertinggi', value: highest ? `${highest.nilai_ijazah?.toFixed(2)} (${highest.nama.split(' ')[0]})` : '—', color: 'yellow' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className="text-lg font-bold text-gray-900 truncate">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter & Search */}
      <div className="flex gap-3 items-center flex-wrap">
        <select
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          value={angkatanId ?? ''}
          onChange={e => setAngkatanId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Semua Angkatan</option>
          {angkatanList.map((a: Angkatan) => (
            <option key={a.id} value={a.id}>{a.nama}</option>
          ))}
        </select>
        <input
          className="flex-1 min-w-[200px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          placeholder="Cari nama, NISN, kelas..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="text-xs text-gray-400 hover:text-gray-600 px-2">✕ Reset</button>
        )}
      </div>

      {/* Tabel */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800 text-white text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-center w-16">Ranking</th>
                <th className="px-4 py-3 text-left">Nama Siswa</th>
                <th className="px-4 py-3 text-center">NISN</th>
                <th className="px-4 py-3 text-center">Kelas</th>
                <th className="px-4 py-3 text-center">Rata Raport</th>
                <th className="px-4 py-3 text-center">Nilai Ujian</th>
                <th className="px-4 py-3 text-center font-black">Nilai Ijazah</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">Memuat...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                  {search ? 'Tidak ada hasil pencarian' : 'Belum ada data nilai'}
                </td></tr>
              ) : filtered.map((r, i) => {
                const isTop3 = r.ranking != null && r.ranking <= 3
                return (
                  <tr key={r.id}
                    className={`border-t border-gray-50 transition-colors ${
                      isTop3 ? (r.ranking===1?'bg-yellow-50 hover:bg-yellow-100':r.ranking===2?'bg-gray-50 hover:bg-gray-100':'bg-amber-50 hover:bg-amber-100')
                               : i%2===0 ? 'bg-white hover:bg-blue-50' : 'bg-slate-50 hover:bg-blue-50'
                    }`}
                  >
                    <td className="px-4 py-3 text-center"><RankBadge rank={r.ranking}/></td>
                    <td className="px-4 py-3 font-medium text-gray-900">{r.nama}</td>
                    <td className="px-4 py-3 text-center font-mono text-xs text-gray-500">{r.nisn||'—'}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{r.kelas||'—'}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{fmt(r.rata_raport)}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{fmt(r.nilai_ujian)}</td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {r.nilai_ijazah != null
                        ? <span className={`font-black text-base ${r.ranking===1?'text-yellow-600':r.ranking===2?'text-gray-600':r.ranking===3?'text-amber-700':'text-blue-700'}`}>
                            {r.nilai_ijazah.toFixed(2)}
                          </span>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.lengkap
                        ? <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full">Lengkap</span>
                        : <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                            {(r as any).mapel_isi != null
                              ? `${(r as any).mapel_isi}/${(r as any).mapel_total} mapel`
                              : 'Belum'}
                          </span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
            Menampilkan {filtered.length} dari {data.length} siswa
            {lowest && avg && (
              <span className="ml-4">· Nilai terendah: <strong>{lowest.nilai_ijazah?.toFixed(2)}</strong> ({lowest.nama.split(' ')[0]})</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
