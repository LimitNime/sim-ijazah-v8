import { useEffect, useState, useCallback } from 'react'
import { Save, RefreshCw, Hash, FileText, Info, AlertCircle } from 'lucide-react'
import { Button, PageHeader, Input , InfoTooltip } from '../ui'
import { nomorSuratApi } from '../../lib/api'

// Jenis surat yang punya nomor per-dokumen (bukan per siswa)
const JENIS_SURAT = [
  {
    key: 'sk_kelulusan',
    label: 'SK Kelulusan',
    field: 'no_sk',
    keterangan: 'Dipakai di dokumen SK Kelulusan (bagian NOMOR)',
    contoh: '420/SK-LLS/001/V/2025',
    icon: '📋',
  },
  {
    key: 'dkn',
    label: 'Daftar Kumpulan Nilai (DKN)',
    field: 'no_sk_dkn',
    keterangan: 'Dipakai di header DKN sebagai nomor referensi',
    contoh: '420/DKN/001/V/2025',
    icon: '📊',
  },
  {
    key: 'skkb',
    label: 'SKKB (default per dokumen)',
    field: 'no_skkb',
    keterangan: 'Dipakai sebagai fallback jika siswa tidak punya No SKKB individual',
    contoh: '421/SKKB/001/V/2025',
    icon: '📄',
  },
  {
    key: 'nilai_ijazah',
    label: 'Nilai Ijazah',
    field: 'no_nilai_ijazah',
    keterangan: 'Muncul di header dokumen Daftar Nilai Ijazah.',
    contoh: '421.2/NIJ/001/V/2025',
    info: 'Muncul di header dokumen Nilai Ijazah per siswa.',
    icon: '📝',
  },
  {
    key: 'transkrip',
    label: 'Transkrip Nilai',
    field: 'no_transkrip',
    keterangan: 'Muncul di baris "Nomor:" pada header Transkrip Nilai.',
    contoh: '421.2/TRN/001/V/2025',
    info: 'Muncul di baris "Nomor:" pada header dokumen Transkrip Nilai per siswa.',
    icon: '📋',
  },
]

const BULAN_ROMAWI = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII']

interface FormatState {
  kode_satuan: string
  kode_jenis: string
  nomor_urut: string
  bulan: string
  tahun: string
}

const DEFAULT_FORMAT: FormatState = {
  kode_satuan: '',
  kode_jenis: '',
  nomor_urut: '001',
  bulan: BULAN_ROMAWI[new Date().getMonth()],
  tahun: String(new Date().getFullYear()),
}

export function PenomoranSuratPage({ showToast }: { showToast: (msg: string, type?: any) => void }) {
  const [data, setData]       = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState<string | null>(null)

  // State format generator per jenis surat
  const [formats, setFormats] = useState<Record<string, FormatState>>(
    Object.fromEntries(JENIS_SURAT.map(j => [j.key, { ...DEFAULT_FORMAT, kode_jenis: j.key.replace('_','-').toUpperCase() }]))
  )
  const [activeGen, setActiveGen] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await nomorSuratApi.getAll() as any
      setData(result || {})
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const setVal = (field: string, val: string) => setData(d => ({ ...d, [field]: val }))

  const setFmt = (key: string, field: keyof FormatState, val: string) =>
    setFormats(f => ({ ...f, [key]: { ...f[key], [field]: val } }))

  const generateNomor = (key: string) => {
    const fmt = formats[key]
    const no = fmt.nomor_urut.padStart(3, '0')
    return `${fmt.kode_satuan}/${fmt.kode_jenis}/${no}/${fmt.bulan}/${fmt.tahun}`
  }

  const applyGenerated = (jenis: typeof JENIS_SURAT[0]) => {
    const nomor = generateNomor(jenis.key)
    setVal(jenis.field, nomor)
    setActiveGen(null)
  }

  const handleSave = async (jenis: typeof JENIS_SURAT[0]) => {
    setSaving(jenis.key)
    try {
      await nomorSuratApi.save(jenis.field, data[jenis.field] || '')
      showToast(`Nomor ${jenis.label} berhasil disimpan`)
    } catch { showToast('Gagal menyimpan', 'error') }
    finally { setSaving(null) }
  }

  const handleSaveAll = async () => {
    setSaving('all')
    try {
      await nomorSuratApi.saveAll(data)
      showToast('Semua nomor surat berhasil disimpan')
    } catch { showToast('Gagal menyimpan', 'error') }
    finally { setSaving(null) }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Penomoran Surat"
        subtitle="Atur nomor surat untuk setiap jenis dokumen — berlaku untuk semua siswa dalam satu batch cetak"
        actions={
          <Button icon={<Save className="w-4 h-4"/>} loading={saving === 'all'} onClick={handleSaveAll}>
            Simpan Semua
          </Button>
        }
      />

      {/* Info */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex gap-3 text-sm text-blue-700">
        <Info className="w-4 h-4 shrink-0 mt-0.5"/>
        <div>
          <p className="font-semibold mb-0.5">Nomor per dokumen (bukan per siswa)</p>
          <p className="text-xs text-blue-600">
            Nomor di sini akan muncul di semua siswa saat cetak batch.
            Untuk nomor per siswa (SKL individual, Blanko Ijazah, SKKB individual) — atur di menu Data Siswa.
          </p>
        </div>
      </div>

      {/* Cards per jenis surat */}
      <div className="flex flex-col gap-3">
        {JENIS_SURAT.map(jenis => (
          <div key={jenis.key} className="card p-5">
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl">{jenis.icon}</span>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900">{jenis.label}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{jenis.keterangan}</p>
              </div>
              <Button
                variant="secondary"
                icon={<Save className="w-3.5 h-3.5"/>}
                loading={saving === jenis.key}
                onClick={() => handleSave(jenis)}
              >
                Simpan
              </Button>
            </div>

            {/* Input nomor manual */}
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Input
                  label="Nomor Surat"
                  value={data[jenis.field] || ''}
                  onChange={e => setVal(jenis.field, e.target.value)}
                  placeholder={jenis.contoh}
                />
              </div>
              <button
                onClick={() => setActiveGen(activeGen === jenis.key ? null : jenis.key)}
                className="px-3 py-2 mb-[1px] text-xs font-semibold rounded-lg border border-gray-200 hover:border-blue-400 hover:text-blue-600 bg-white transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <Hash className="w-3.5 h-3.5"/>
                {activeGen === jenis.key ? 'Tutup Generator' : 'Generate Nomor'}
              </button>
            </div>

            {/* Preview nomor aktif */}
            {data[jenis.field] && (
              <div className="mt-2 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-emerald-500"/>
                <span className="text-xs text-gray-500">Aktif:</span>
                <span className="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  {data[jenis.field]}
                </span>
              </div>
            )}

            {!data[jenis.field] && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                <AlertCircle className="w-3.5 h-3.5"/>
                Belum ada nomor — akan tampil kosong/titik-titik di dokumen
              </div>
            )}

            {/* Generator panel */}
            {activeGen === jenis.key && (
              <div className="mt-4 border border-blue-100 bg-blue-50/50 rounded-xl p-4">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-3">
                  Generator Nomor Otomatis
                </p>
                <div className="grid grid-cols-5 gap-3 mb-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                      Kode Satuan
                    </label>
                    <input
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={formats[jenis.key].kode_satuan}
                      onChange={e => setFmt(jenis.key, 'kode_satuan', e.target.value.toUpperCase())}
                      placeholder="420"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                      Kode Jenis Surat
                    </label>
                    <input
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={formats[jenis.key].kode_jenis}
                      onChange={e => setFmt(jenis.key, 'kode_jenis', e.target.value.toUpperCase())}
                      placeholder="SK-LLS"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                      No Urut
                    </label>
                    <input
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={formats[jenis.key].nomor_urut}
                      onChange={e => setFmt(jenis.key, 'nomor_urut', e.target.value)}
                      placeholder="001"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                      Bulan
                    </label>
                    <select
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={formats[jenis.key].bulan}
                      onChange={e => setFmt(jenis.key, 'bulan', e.target.value)}
                    >
                      {BULAN_ROMAWI.map((b, i) => (
                        <option key={b} value={b}>
                          {b} — {['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'][i]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                      Tahun
                    </label>
                    <input
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={formats[jenis.key].tahun}
                      onChange={e => setFmt(jenis.key, 'tahun', e.target.value)}
                      placeholder="2025"
                    />
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-white border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Preview format:</p>
                    <p className="font-mono text-sm font-bold text-blue-800">
                      {generateNomor(jenis.key)}
                    </p>
                  </div>
                  <button
                    onClick={() => applyGenerated(jenis)}
                    className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                  >
                    Pakai Nomor Ini →
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Format: <span className="font-mono">Kode Satuan / Kode Jenis / No Urut / Bulan / Tahun</span>
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
