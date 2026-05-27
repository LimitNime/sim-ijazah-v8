import { useEffect, useState } from 'react'
import { Save, School, Upload, X, ImageIcon } from 'lucide-react'
import { Button, Input, Select, PageHeader, SectionCard , InfoTooltip } from '../ui'
import { sekolahApi } from '../../lib/api'
import type { Sekolah } from '../../types'

const JENJANG = ['MI','SD','MTs','SMP','MA','SMA','SMK','Lainnya'].map(v => ({ value: v, label: v }))

const isElectron = () => !!(window as any).api

function LogoUploader({
  label, field, value, onChange
}: { label: string; field: string; value?: string; onChange: (v: string | null) => void }) {
  const [loading, setLoading] = useState(false)

  const upload = async () => {
    if (!isElectron()) return
    setLoading(true)
    try {
      const result = await sekolahApi.uploadLogo(field)
      if (result) onChange(result)
    } finally { setLoading(false) }
  }

  const remove = async () => {
    await sekolahApi.removeLogo(field)
    onChange(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</p>
      <div className="flex items-center gap-3">
        {/* Preview */}
        <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
          {value
            ? <img src={value} alt={label} className="w-full h-full object-contain p-1" />
            : <ImageIcon className="w-8 h-8 text-gray-300" />}
        </div>
        {/* Actions */}
        <div className="flex flex-col gap-2">
          {isElectron()
            ? <>
                <Button variant="secondary" size="sm" icon={<Upload className="w-3.5 h-3.5"/>} loading={loading} onClick={upload}>
                  {value ? 'Ganti Logo' : 'Upload Logo'}
                </Button>
                {value && (
                  <Button variant="ghost" size="sm" icon={<X className="w-3.5 h-3.5 text-red-400"/>} onClick={remove}>
                    Hapus
                  </Button>
                )}
              </>
            : <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                Upload logo hanya tersedia di aplikasi desktop (.exe)
              </p>
          }
          <p className="text-xs text-gray-400">PNG/JPG, maks 2MB.<br/>Disarankan ukuran 256×256 px.</p>
        </div>
      </div>
    </div>
  )
}

export function SekolahPage({ showToast }: { showToast: (msg: string, type?: any) => void }) {
  const [form, setForm] = useState<Partial<Sekolah>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    sekolahApi.get().then(d => { setForm(d || {}); setLoading(false) })
  }, [])

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.nama?.trim()) { showToast('Nama sekolah wajib diisi', 'error'); return }
    setSaving(true)
    try {
      await sekolahApi.save(form)
      showToast('Data sekolah berhasil disimpan')
    } catch { showToast('Gagal menyimpan', 'error') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Memuat...</div>

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Data Sekolah" subtitle="Profil sekolah, kop surat, dan konfigurasi nilai"
        actions={<Button icon={<Save className="w-4 h-4"/>} loading={saving} onClick={save}>Simpan</Button>} />

      {/* Logo */}
      <SectionCard title="Logo Sekolah">
        <div className="grid grid-cols-2 gap-6">
          <LogoUploader
            label="Logo Sekolah (Kop Surat)"
            field="logo_sekolah"
            value={form.logo_sekolah}
            onChange={v => set('logo_sekolah', v)}
          />
          <LogoUploader
            label="Logo Kemdikbud / Kemenag"
            field="logo_kemdikbud"
            value={form.logo_kemdikbud}
            onChange={v => set('logo_kemdikbud', v)}
          />
        </div>
        <p className="mt-3 text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-lg">
          Logo akan otomatis muncul di dokumen <strong>Ijazah</strong> dan <strong>Transkrip Nilai</strong> saat dicetak.
        </p>
      </SectionCard>

      {/* Identitas */}
      <SectionCard title="Identitas Sekolah">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input label={<span className="flex items-center gap-1">Nama Sekolah <InfoTooltip text="Muncul di kop surat semua dokumen: SKL, DKN, Transkrip, Nilai Ijazah, SK Kelulusan, SKKB." position="bottom" /></span>} value={form.nama || ''} onChange={e => set('nama', e.target.value)} placeholder="Nama lengkap sekolah" />
          </div>
          <Input label="Nama Singkat / Akronim" value={form.nama_singkat || ''} onChange={e => set('nama_singkat', e.target.value)} placeholder="mis. SMPIT Badrussalam" />
          <Input label="Yayasan / Penyelenggara" value={form.yayasan || ''} onChange={e => set('yayasan', e.target.value)} placeholder="Nama yayasan (opsional, muncul di kop)" />
          <Input label="Jenis Sekolah" value={form.jenis_sekolah || ''} onChange={e => set('jenis_sekolah', e.target.value)} placeholder="mis. SMP ISLAM TERPADU" />
          <Input label="NSS / NSM" value={form.nss || ''} onChange={e => set('nss', e.target.value)} placeholder="Nomor Statistik Sekolah" />
          <Input label={<span className="flex items-center gap-1">NPSN <InfoTooltip text="Nomor Pokok Sekolah Nasional — muncul di kop surat dan biodata Transkrip Nilai." position="bottom" /></span>} value={form.npsn || ''} onChange={e => set('npsn', e.target.value)} placeholder="Nomor Pokok Sekolah Nasional" />
          <Input label={<span className="flex items-center gap-1">Kepala Sekolah <InfoTooltip text="Nama kepala sekolah yang muncul di bagian TTD semua dokumen resmi." position="bottom" /></span>} value={form.kepala || ''} onChange={e => set('kepala', e.target.value)} placeholder="Nama kepala sekolah" />
          <Input label={<span className="flex items-center gap-1">NIP Kepala Sekolah <InfoTooltip text="Muncul di bawah nama kepala sekolah pada bagian TTD semua dokumen." position="bottom" /></span>} value={form.nip || ''} onChange={e => set('nip', e.target.value)} placeholder="NIP (kosongkan jika tidak ada)" />
          <div className="col-span-2">
            <Input label="Alamat Baris 1" value={form.alamat || ''} onChange={e => set('alamat', e.target.value)} placeholder="Jl. ..." />
          </div>
          <div className="col-span-2">
            <Input label="Alamat Baris 2 (opsional, muncul di kop surat)" value={form.alamat2 || ''} onChange={e => set('alamat2', e.target.value)} placeholder="Telp. / Kode Pos / Website — baris kedua kop" />
          </div>
          <Input label="Kota / Kabupaten" value={form.kota || ''} onChange={e => set('kota', e.target.value)} placeholder="Kota" />
          <Input label="Kabupaten (untuk SKL)" value={form.kabupaten || ''} onChange={e => set('kabupaten', e.target.value)} placeholder="Nama kabupaten (muncul di teks SKL)" />
          <Input label="Provinsi" value={form.provinsi || ''} onChange={e => set('provinsi', e.target.value)} placeholder="Provinsi" />
          <Input label="Kode Pos" value={form.kode_pos || ''} onChange={e => set('kode_pos', e.target.value)} placeholder="12345" />
          <Input label="Telepon" value={form.telp || ''} onChange={e => set('telp', e.target.value)} placeholder="021-..." />
          <Input label="Email Sekolah" type="email" value={form.email_sekolah || ''} onChange={e => set('email_sekolah', e.target.value)} placeholder="email@sekolah.id" />
          <Input label="Website" value={form.website || ''} onChange={e => set('website', e.target.value)} placeholder="www.sekolah.id" />
        </div>
      </SectionCard>

      {/* Akademik */}
      <SectionCard title="Konfigurasi Akademik">
        <div className="grid grid-cols-2 gap-4">
          <Select label="Jenjang Sekolah" value={form.jenjang || 'MI'} onChange={e => set('jenjang', e.target.value)} options={JENJANG} />
          <Input label={<span className="flex items-center gap-1">Tahun Ajaran <InfoTooltip text="Muncul di judul DKN dan dokumen Nilai Ijazah. Format: 2024/2025." position="bottom" /></span>} value={form.tahun_ajaran || ''} onChange={e => set('tahun_ajaran', e.target.value)} placeholder="2024/2025" />
          <Input label={<span className="flex items-center gap-1">Tanggal Penetapan Lulus <InfoTooltip text="Tanggal kelulusan resmi — muncul di bagian TTD semua dokumen: SKL, Nilai Ijazah, Transkrip, DKN, SK Kelulusan." position="bottom" /></span>} type="date" value={form.tgl_lulus || ''} onChange={e => set('tgl_lulus', e.target.value)} />
          <div />
          <Input label="Program Keahlian" value={form.program_keahlian || ''} onChange={e => set('program_keahlian', e.target.value)} placeholder="Teknologi Informasi dan Komunikasi" />
          <Input label="Kompetensi Keahlian" value={form.kompetensi_keahlian || ''} onChange={e => set('kompetensi_keahlian', e.target.value)} placeholder="Rekayasa Perangkat Lunak" />
          <Input label="Nama Instansi Penerbit SK" value={form.keputusan_kepala || ''} onChange={e => set('keputusan_kepala', e.target.value)} placeholder="Kepala Dinas Pendidikan Provinsi ..." />
          <Input label="Nomor SK Kelulusan" value={form.no_sk || ''} onChange={e => set('no_sk', e.target.value)} placeholder="420/1234/Disdik" />
          <Input label={<span className="flex items-center gap-1">Tanggal Rapat Dewan Guru <InfoTooltip text="Muncul di teks SK Kelulusan sebagai tanggal rapat penentuan kelulusan." position="bottom" /></span>} type="date" value={form.tgl_rapat || ''} onChange={e => set('tgl_rapat', e.target.value)} />
          <Input label="Jenis Kekhususan (opsional)" value={form.jenis_kekhususan || ''} onChange={e => set('jenis_kekhususan', e.target.value)} placeholder="mis. Umum / Kekhususan" />
          <div className="col-span-2">
            <Input label="Nomor SKKB Default" value={form.no_skkb || ''} onChange={e => set('no_skkb', e.target.value)} placeholder="mis. 421/SKKB/001/2025" />
          </div>
          <div className="col-span-2">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Bobot Nilai Ijazah</p>
            <div className="grid grid-cols-2 gap-4">
              <Input label={`Bobot Raport: ${form.bobot_raport ?? 60}%`}
                type="range" min={0} max={100}
                value={form.bobot_raport ?? 60}
                onChange={e => { const v = Number(e.target.value); set('bobot_raport', v); set('bobot_ujian', 100 - v) }}
                className="h-2 cursor-pointer accent-blue-600" />
              <Input label={`Bobot Ujian Sekolah (US): ${form.bobot_ujian ?? 40}%`}
                type="range" min={0} max={100}
                value={form.bobot_ujian ?? 40}
                onChange={e => { const v = Number(e.target.value); set('bobot_ujian', v); set('bobot_raport', 100 - v) }}
                className="h-2 cursor-pointer accent-blue-600" />
            </div>
            {((form.bobot_raport ?? 0) + (form.bobot_ujian ?? 0)) !== 100 && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 font-semibold">
                ⚠️ Total bobot harus 100%. Sekarang: {(form.bobot_raport ?? 0) + (form.bobot_ujian ?? 0)}%
              </div>
            )}
            <div className="mt-2 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
              <strong>Rumus Nilai Ijazah:</strong> (Rata Raport × {form.bobot_raport ?? 0}%) + (Nilai US × {form.bobot_ujian ?? 0}%)
              &nbsp;— Total: <strong>{(form.bobot_raport ?? 0) + (form.bobot_ujian ?? 0)}%</strong>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
