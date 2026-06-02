import { useState, useEffect, useCallback } from 'react'
import { Mail, Plus, Printer, Search, FileText, Users, ArrowRight, Clock } from 'lucide-react'
import { Button, Modal, Input, Select, SearchBar, PageHeader, Badge } from '../ui'
import { siswaApi, suratApi, sekolahApi, pdfCetakApi } from '../../lib/api'
import { clsx } from 'clsx'

type JenisSurat = 'aktif' | 'mutasi' | 'panggilan' | 'kartu_ujian'

const JENIS_LABEL: Record<JenisSurat, string> = {
  aktif: 'Keterangan Masih Aktif',
  mutasi: 'Keterangan Pindah / Mutasi',
  panggilan: 'Surat Panggilan Orang Tua',
  kartu_ujian: 'Kartu Peserta Ujian',
}
const JENIS_COLOR: Record<JenisSurat, string> = {
  aktif: 'bg-green-100 text-green-800',
  mutasi: 'bg-orange-100 text-orange-800',
  panggilan: 'bg-red-100 text-red-800',
  kartu_ujian: 'bg-blue-100 text-blue-800',
}

const tglFmt = (tgl: string) => {
  if (!tgl) return ''
  try { return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) }
  catch { return tgl }
}
const today = () => new Date().toISOString().slice(0, 10)

// ─── Preview & Print template ─────────────────────────────────────────────────
function PrintPreview({ data, jenis, noSurat, keperluan, onClose, onPrint, sekolah }: any) {
  const { siswa, angkatan } = data
  const tglCetak = tglFmt(today())

  const SuratAktif = () => (
    <div className="surat-body font-serif text-sm leading-relaxed">
      <p className="text-center font-bold text-base mb-1">SURAT KETERANGAN MASIH AKTIF BELAJAR</p>
      <p className="text-center mb-6">Nomor: {noSurat || '……/……/……/……'}</p>
      <p className="mb-4">Yang bertanda tangan di bawah ini, Kepala {sekolah?.nama_sekolah || 'SMP'}, menerangkan bahwa:</p>
      <div className="ml-8 mb-4 space-y-1">
        {[['Nama', siswa.nama],['NISN', siswa.nisn || '—'],['NIS / NISM', siswa.nism || '—'],['Tempat, Tgl Lahir', siswa.tempat_lahir && siswa.tgl_lahir ? `${siswa.tempat_lahir}, ${tglFmt(siswa.tgl_lahir)}` : '—'],['Kelas', siswa.kelas || '—'],['Tahun Pelajaran', angkatan?.nama || sekolah?.tahun_ajaran || '—']].map(([l, v]) => (
          <div key={l} className="flex">
            <span className="w-44 shrink-0">{l}</span>
            <span className="mr-2">:</span>
            <span className="font-semibold">{v}</span>
          </div>
        ))}
      </div>
      <p className="mb-4">Adalah benar siswa/siswi tersebut di atas <strong>MASIH AKTIF BELAJAR</strong> di {sekolah?.nama_sekolah || 'sekolah kami'}{keperluan ? `, dan surat ini dibuat untuk keperluan <strong>${keperluan}</strong>` : ''}.</p>
      <p className="mb-6">Demikian surat keterangan ini kami buat dengan sebenarnya dan untuk dapat dipergunakan sebagaimana mestinya.</p>
    </div>
  )

  const SuratMutasi = () => (
    <div className="surat-body font-serif text-sm leading-relaxed">
      <p className="text-center font-bold text-base mb-1">SURAT KETERANGAN PINDAH SEKOLAH</p>
      <p className="text-center mb-6">Nomor: {noSurat || '……/……/……/……'}</p>
      <p className="mb-4">Yang bertanda tangan di bawah ini, Kepala {sekolah?.nama_sekolah || 'SMP'}, menerangkan bahwa:</p>
      <div className="ml-8 mb-4 space-y-1">
        {[['Nama', siswa.nama],['NISN', siswa.nisn || '—'],['NIS / NISM', siswa.nism || '—'],['Tempat, Tgl Lahir', siswa.tempat_lahir && siswa.tgl_lahir ? `${siswa.tempat_lahir}, ${tglFmt(siswa.tgl_lahir)}` : '—'],['Kelas', siswa.kelas || '—']].map(([l, v]) => (
          <div key={l} className="flex">
            <span className="w-44 shrink-0">{l}</span>
            <span className="mr-2">:</span>
            <span className="font-semibold">{v}</span>
          </div>
        ))}
      </div>
      <p className="mb-4">Adalah benar siswa/siswi tersebut di atas <strong>TELAH PINDAH / KELUAR</strong> dari {sekolah?.nama_sekolah || 'sekolah kami'}{keperluan ? ` dengan alasan: <strong>${keperluan}</strong>` : ''}.</p>
      <p className="mb-6">Demikian surat keterangan ini kami buat dengan sebenarnya.</p>
    </div>
  )

  const SuratPanggilan = () => (
    <div className="surat-body font-serif text-sm leading-relaxed">
      <p className="text-center font-bold text-base mb-1">SURAT PANGGILAN ORANG TUA / WALI</p>
      <p className="text-center mb-6">Nomor: {noSurat || '……/……/……/……'}</p>
      <p className="mb-2">Kepada Yth.</p>
      <p className="mb-2 font-semibold">Orang Tua / Wali dari: {siswa.nama}</p>
      <p className="mb-6">Di Tempat</p>
      <p className="mb-4">Dengan hormat,</p>
      <p className="mb-4">Bersama surat ini kami mengundang Bapak/Ibu Orang Tua / Wali dari peserta didik kami:</p>
      <div className="ml-8 mb-4 space-y-1">
        {[['Nama', siswa.nama],['Kelas', siswa.kelas || '—'],['NIS', siswa.nism || '—']].map(([l, v]) => (
          <div key={l} className="flex">
            <span className="w-32 shrink-0">{l}</span>
            <span className="mr-2">:</span>
            <span className="font-semibold">{v}</span>
          </div>
        ))}
      </div>
      <p className="mb-4">Untuk hadir di sekolah guna membicarakan hal-hal yang berkaitan dengan: <strong>{keperluan || '____________________'}</strong>.</p>
      <p className="mb-2">Adapun waktu pelaksanaannya adalah:</p>
      <div className="ml-8 mb-6 space-y-1">
        <div className="flex"><span className="w-32">Hari, Tanggal</span><span className="mr-2">:</span><span>____________________</span></div>
        <div className="flex"><span className="w-32">Pukul</span><span className="mr-2">:</span><span>____________________</span></div>
        <div className="flex"><span className="w-32">Tempat</span><span className="mr-2">:</span><span>{sekolah?.nama_sekolah || '____________________'}</span></div>
      </div>
      <p className="mb-6">Besar harapan kami agar Bapak/Ibu dapat hadir tepat waktu. Atas perhatian dan kehadiran Bapak/Ibu, kami ucapkan terima kasih.</p>
    </div>
  )

  const KartuUjian = () => (
    <div className="surat-body font-serif text-sm">
      <p className="text-center font-bold text-base mb-1">KARTU PESERTA UJIAN</p>
      <p className="text-center mb-4">{sekolah?.nama_sekolah || 'SMP'} — {angkatan?.nama || sekolah?.tahun_ajaran || ''}</p>
      <div className="border-2 border-gray-800 p-4 max-w-md mx-auto">
        <div className="flex gap-4">
          <div className="flex-1 space-y-1.5">
            {[['Nama', siswa.nama],['NISN', siswa.nisn || '—'],['NIS / NISM', siswa.nism || '—'],['Kelas', siswa.kelas || '—'],['Tempat Lahir', siswa.tempat_lahir || '—'],['Tanggal Lahir', siswa.tgl_lahir ? tglFmt(siswa.tgl_lahir) : '—']].map(([l, v]) => (
              <div key={l} className="flex text-xs">
                <span className="w-28 shrink-0 text-gray-600">{l}</span>
                <span className="mr-1">:</span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
          </div>
          <div className="w-24 h-28 border-2 border-dashed border-gray-400 flex items-center justify-center text-xs text-gray-400 text-center shrink-0">
            Foto<br />3×4
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-gray-400 flex justify-between text-xs">
          <div><p className="text-gray-500">No. Peserta</p><p className="font-bold text-lg mt-0.5">{noSurat || '————————'}</p></div>
          <div className="text-right"><p className="text-gray-500 mb-1">Tanda tangan peserta</p><div className="h-10 border-b border-gray-400 w-32"/></div>
        </div>
      </div>
    </div>
  )

  const TtdBlock = () => (
    <div className="mt-8 flex justify-end font-serif text-sm">
      <div className="text-center">
        <p>{sekolah?.kota_sekolah || '_______________'}, {tglCetak}</p>
        <p className="mt-1">Kepala {sekolah?.nama_sekolah || 'Sekolah'}</p>
        <div className="h-16"/>
        <p className="font-bold underline">{sekolah?.kepala_sekolah || '____________________'}</p>
        <p>NIP. {sekolah?.nip_kepsek || '____________________'}</p>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-gray-800">{JENIS_LABEL[jenis as JenisSurat]}</h2>
          <div className="flex gap-2">
            <button onClick={onPrint} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              <Printer className="w-4 h-4" />Cetak
            </button>
            <button onClick={onClose} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">Tutup</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {/* Kop simulasi */}
          <div className="border-b-4 border-double border-gray-800 pb-3 mb-4 text-center">
            <p className="font-bold text-sm">{sekolah?.nama_yayasan || ''}</p>
            <p className="font-bold text-base">{sekolah?.nama_sekolah || 'NAMA SEKOLAH'}</p>
            <p className="text-xs text-gray-600">{sekolah?.alamat_sekolah || 'Alamat Sekolah'}</p>
          </div>
          {jenis === 'aktif' && <SuratAktif />}
          {jenis === 'mutasi' && <SuratMutasi />}
          {jenis === 'panggilan' && <SuratPanggilan />}
          {jenis === 'kartu_ujian' && <KartuUjian />}
          {jenis !== 'kartu_ujian' && <TtdBlock />}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function SuratPage({ showToast }: { showToast: (msg: string, type?: any) => void }) {
  const [tab, setTab] = useState<'buat'|'riwayat'>('buat')
  const [jenis, setJenis] = useState<JenisSurat>('aktif')
  const [siswaList, setSiswaList] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [selectedSiswa, setSelectedSiswa] = useState<any>(null)
  const [noSurat, setNoSurat] = useState('')
  const [keperluan, setKeperluan] = useState('')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<any>(null)
  const [sekolah, setSekolah] = useState<any>(null)
  const [riwayat, setRiwayat] = useState<any[]>([])
  const [riwayatLoading, setRiwayatLoading] = useState(false)

  useEffect(() => {
    sekolahApi.get().then((r: any) => setSekolah(r))
  }, [])

  const loadSiswa = useCallback(async () => {
    setLoading(true)
    const r = await siswaApi.list(q)
    setSiswaList(Array.isArray(r) ? r.slice(0, 30) : [])
    setLoading(false)
  }, [q])

  useEffect(() => { loadSiswa() }, [loadSiswa])

  const loadRiwayat = async () => {
    setRiwayatLoading(true)
    const r = await suratApi.list()
    setRiwayat(Array.isArray(r) ? r : [])
    setRiwayatLoading(false)
  }

  useEffect(() => { if (tab === 'riwayat') loadRiwayat() }, [tab])

  const handleBuatSurat = async () => {
    if (!selectedSiswa) { showToast('Pilih siswa terlebih dahulu', 'error'); return }
    const data = await suratApi.getSiswa(selectedSiswa.id)
    setPreview({ data, jenis, noSurat, keperluan })
  }

  const handlePrint = async () => {
    if (!selectedSiswa) return
    const r: any = await pdfCetakApi.surat({
      siswa_id: selectedSiswa.id, jenis, noSurat, keperluan
    })
    if (!r?.ok) showToast(r?.error || 'Gagal cetak PDF', 'error')
    else { showToast('Surat PDF dibuka'); setPreview(null) }
  }

  const JENIS_LIST: { key: JenisSurat; icon: string; desc: string }[] = [
    { key: 'aktif', icon: '📄', desc: 'Untuk keperluan beasiswa, pindah, dll' },
    { key: 'mutasi', icon: '🔄', desc: 'Surat keterangan pindah sekolah' },
    { key: 'panggilan', icon: '👨‍👩‍👧', desc: 'Undang orang tua ke sekolah' },
    { key: 'kartu_ujian', icon: '🪪', desc: 'Kartu identitas peserta ujian' },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Surat-Surat Sekolah" subtitle="Buat dan cetak surat keterangan, panggilan, dan kartu ujian" />

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['buat', 'riwayat'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              tab === t ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            {t === 'buat' ? '✏️ Buat Surat' : '🕐 Riwayat'}
          </button>
        ))}
      </div>

      {tab === 'buat' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Kiri: Pilih jenis + siswa */}
          <div className="lg:col-span-1 space-y-4">
            {/* Jenis surat */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-bold text-gray-500 uppercase mb-3">Jenis Surat</p>
              <div className="space-y-2">
                {JENIS_LIST.map(j => (
                  <button key={j.key} onClick={() => setJenis(j.key)}
                    className={clsx('w-full text-left px-3 py-2.5 rounded-lg border transition-all',
                      jenis === j.key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300')}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{j.icon}</span>
                      <div>
                        <p className={clsx('text-sm font-semibold', jenis === j.key ? 'text-blue-700' : 'text-gray-800')}>{JENIS_LABEL[j.key]}</p>
                        <p className="text-xs text-gray-500">{j.desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Form tambahan */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase">Detail Surat</p>
              <Input label="Nomor Surat" value={noSurat} onChange={setNoSurat} placeholder="422.1/001/SK/VI/2025" />
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                  {jenis === 'panggilan' ? 'Perihal / Keperluan' : jenis === 'kartu_ujian' ? 'No. Peserta' : 'Keperluan'}
                </label>
                <input value={keperluan} onChange={e => setKeperluan(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder={jenis === 'panggilan' ? 'Kenaikan kelas, pelanggaran, dll' : 'Opsional'} />
              </div>
            </div>
          </div>

          {/* Kanan: Pilih siswa */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-bold text-gray-500 uppercase mb-3">Pilih Siswa</p>
            <div className="mb-3">
              <SearchBar value={q} onChange={setQ} placeholder="Cari nama atau NISN..." />
            </div>
            {loading
              ? <div className="text-center py-8 text-gray-400">Memuat...</div>
              : (
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {siswaList.map(s => (
                    <button key={s.id} onClick={() => setSelectedSiswa(s)}
                      className={clsx('w-full text-left px-3 py-2 rounded-lg transition-all flex items-center gap-3',
                        selectedSiswa?.id === s.id ? 'bg-blue-600 text-white' : 'hover:bg-gray-100')}>
                      <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                        selectedSiswa?.id === s.id ? 'bg-white text-blue-600' : s.jk === 'P' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700')}>
                        {s.nama?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{s.nama}</p>
                        <p className={clsx('text-xs', selectedSiswa?.id === s.id ? 'text-blue-200' : 'text-gray-500')}>
                          {s.nisn || s.nism || '—'} · {s.kelas || 'Kelas —'}
                        </p>
                      </div>
                      {selectedSiswa?.id === s.id && <ArrowRight className="w-4 h-4 ml-auto" />}
                    </button>
                  ))}
                  {siswaList.length === 0 && <p className="text-center text-gray-400 py-8">Tidak ada siswa</p>}
                </div>
              )
            }

            {selectedSiswa && (
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                    selectedSiswa.jk === 'P' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700')}>
                    {selectedSiswa.nama?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{selectedSiswa.nama}</p>
                    <p className="text-xs text-gray-500">{JENIS_LABEL[jenis]}</p>
                  </div>
                </div>
                <Button onClick={handleBuatSurat} icon={<FileText className="w-4 h-4" />}>Preview & Cetak</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'riwayat' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {riwayatLoading
            ? <div className="text-center py-12 text-gray-400">Memuat...</div>
            : riwayat.length === 0
              ? <div className="text-center py-16 text-gray-400"><Clock className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Belum ada riwayat surat</p></div>
              : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">No</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Jenis Surat</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Nama Siswa</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Nomor Surat</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Tanggal</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {riwayat.map((r: any, i: number) => (
                      <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-2.5 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2.5">
                          <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', JENIS_COLOR[r.jenis as JenisSurat] || 'bg-gray-100 text-gray-700')}>
                            {JENIS_LABEL[r.jenis as JenisSurat] || r.jenis}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-medium text-gray-800">{r.nama_siswa || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-600 font-mono text-xs">{r.no_surat || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-600">{r.tanggal ? tglFmt(r.tanggal) : '—'}</td>
                        <td className="px-3 py-2.5 text-gray-500 text-xs">{r.keterangan || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
          }
        </div>
      )}

      {preview && (
        <PrintPreview {...preview} sekolah={sekolah}
          onClose={() => setPreview(null)}
          onPrint={handlePrint} />
      )}
    </div>
  )
}
