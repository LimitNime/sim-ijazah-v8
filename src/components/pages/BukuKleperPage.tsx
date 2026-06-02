import { useState, useEffect, useCallback } from 'react'
import { BookOpen, Search, Printer } from 'lucide-react'
import { SearchBar, PageHeader, Badge } from '../ui'
import { kleperApi } from '../../lib/api'
import { clsx } from 'clsx'

const HURUF = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export function BukuKleperPage({ showToast }: { showToast: (msg: string, type?: any) => void }) {
  const [data, setData] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [huruf, setHuruf] = useState<string|null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let r: any
      if (huruf) r = await kleperApi.byHuruf(huruf)
      else r = await kleperApi.list(q || undefined)
      setData(Array.isArray(r) ? r : [])
    } finally { setLoading(false) }
  }, [q, huruf])

  useEffect(() => { load() }, [load])

  const handleSearch = (v: string) => { setQ(v); setHuruf(null) }
  const handleHuruf = (h: string) => { setHuruf(h === huruf ? null : h); setQ('') }

  // Group by first letter
  const grouped = data.reduce((acc: any, s: any) => {
    const key = (s.nama?.[0] || '#').toUpperCase()
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  const tglLahir = (tgl: string) => {
    if (!tgl) return '—'
    try { return new Date(tgl).toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' }) }
    catch { return tgl }
  }

  const handlePrint = () => window.print()

  return (
    <div className="space-y-4">
      <PageHeader
        title="Buku Kleper Siswa"
        subtitle="Indeks alfabetis data siswa"
        actions={
          <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700">
            <Printer className="w-4 h-4" /> Cetak
          </button>
        }
      />

      {/* Filter huruf */}
      <div className="flex flex-wrap gap-1">
        {HURUF.map(h => (
          <button key={h} onClick={() => handleHuruf(h)}
            className={clsx('w-8 h-8 rounded-lg text-sm font-bold transition-all',
              huruf === h ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-700')}>
            {h}
          </button>
        ))}
        {huruf && (
          <button onClick={() => { setHuruf(null); setQ('') }}
            className="px-3 h-8 rounded-lg text-sm text-gray-500 hover:bg-gray-100">✕ Reset</button>
        )}
      </div>

      {/* Search */}
      <div className="max-w-sm">
        <SearchBar value={q} onChange={handleSearch} placeholder="Cari nama, NISN, NIS..." />
      </div>

      {/* Stat */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <BookOpen className="w-4 h-4" />
        Menampilkan <strong>{data.length}</strong> siswa
        {huruf && <Badge color="blue">Huruf {huruf}</Badge>}
      </div>

      {/* Tabel */}
      {loading
        ? <div className="text-center py-12 text-gray-400">Memuat...</div>
        : data.length === 0
          ? <div className="text-center py-16 text-gray-400"><BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Tidak ada data</p></div>
          : (
            <div className="space-y-6 print:space-y-4">
              {Object.keys(grouped).sort().map(letter => (
                <div key={letter}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-extrabold text-lg">{letter}</div>
                    <span className="text-sm text-gray-500">{grouped[letter].length} siswa</span>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left w-8 text-gray-500 font-semibold">No</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-semibold">Nama Siswa</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-semibold">L/P</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-semibold">NISN</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-semibold">NIS / NISM</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-semibold">Tempat, Tanggal Lahir</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-semibold">Kelas</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-semibold">Tahun Masuk</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {grouped[letter].map((s: any, i: number) => (
                          <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                            <td className="px-3 py-2 text-gray-400 text-center">{i + 1}</td>
                            <td className="px-3 py-2 font-semibold text-gray-900">{s.nama}</td>
                            <td className="px-3 py-2">
                              <span className={clsx('text-xs font-bold', s.jk === 'P' ? 'text-pink-600' : 'text-blue-600')}>{s.jk || '—'}</span>
                            </td>
                            <td className="px-3 py-2 text-gray-600 font-mono text-xs">{s.nisn || '—'}</td>
                            <td className="px-3 py-2 text-gray-600 font-mono text-xs">{s.nism || '—'}</td>
                            <td className="px-3 py-2 text-gray-600">{s.tempat_lahir && s.tgl_lahir ? `${s.tempat_lahir}, ${tglLahir(s.tgl_lahir)}` : '—'}</td>
                            <td className="px-3 py-2 text-gray-600">{s.kelas || '—'}</td>
                            <td className="px-3 py-2 text-gray-600">{s.tahun_masuk || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )
      }
    </div>
  )
}
