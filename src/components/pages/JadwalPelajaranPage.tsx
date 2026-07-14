import { useState, useEffect } from 'react'
import { guruApi, kelasApi, jadwalPelajaranApi, pengaturanJamApi, piketApi } from '../../lib/api'
import { Button, Modal, DropDown, TextInput, ConfirmDialog, PageHeader, Spinner } from '../ui'
import { Plus, Trash2, Sparkles, Copy, AlertTriangle, CalendarClock, Settings, Users, Save, Wand2, FileSpreadsheet, FileText, CheckCircle2, ClipboardList, Pencil, Eye, Printer } from 'lucide-react'

const HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

const TIPE_OPT = [
  { value: 'mengajar', label: 'Jam Mengajar' },
  { value: 'istirahat', label: 'Istirahat' },
  { value: 'upacara', label: 'Upacara' },
  { value: 'pembiasaan', label: 'Pembiasaan' },
  { value: 'lainnya', label: 'Lainnya' },
]

// Palet warna dipakai berputar per-guru (biar konsisten mirip jadwal cetak: 1 guru = 1 warna)
const GURU_COLORS = [
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-pink-100 text-pink-800 border-pink-200',
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'bg-amber-100 text-amber-800 border-amber-200',
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-cyan-100 text-cyan-800 border-cyan-200',
  'bg-rose-100 text-rose-800 border-rose-200',
  'bg-lime-100 text-lime-800 border-lime-200',
  'bg-indigo-100 text-indigo-800 border-indigo-200',
  'bg-orange-100 text-orange-800 border-orange-200',
  'bg-teal-100 text-teal-800 border-teal-200',
  'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
]
function warnaGuru(guruId: any, guruIds: any[]) {
  const idx = guruIds.indexOf(guruId)
  if (idx < 0) return 'bg-gray-100 text-gray-700 border-gray-200'
  return GURU_COLORS[idx % GURU_COLORS.length]
}

// ============================================================================
// TAB 1 — PENGATURAN JAM PELAJARAN (master jam per hari)
// ============================================================================
function TabPengaturanJam({ showToast }: any) {
  const [hariAktif, setHariAktif] = useState('Senin')
  const [semua, setSemua] = useState<any[]>([])
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copyModal, setCopyModal] = useState(false)
  const [copyTarget, setCopyTarget] = useState<string[]>([])
  const [autoModal, setAutoModal] = useState(false)
  const [autoForm, setAutoForm] = useState({ jumlah: '8', mulai: '07.00', durasi_menit: '40' })

  const load = async () => {
    setLoading(true)
    const r = await pengaturanJamApi.list()
    setSemua(Array.isArray(r) ? r : [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])
  useEffect(() => {
    setRows(
      semua
        .filter((r: any) => r.hari === hariAktif)
        .sort((a: any, b: any) => a.jam_ke - b.jam_ke)
        .map((r: any) => ({ jam_mulai: r.jam_mulai, jam_selesai: r.jam_selesai, tipe: r.tipe, label: r.label }))
    )
  }, [hariAktif, semua])

  const updateRow = (i: number, patch: any) => setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const addRow = () => {
    const last = rows[rows.length - 1]
    setRows(rs => [...rs, { jam_mulai: last?.jam_selesai || '', jam_selesai: '', tipe: 'mengajar', label: '' }])
  }
  const removeRow = (i: number) => setRows(rs => rs.filter((_, idx) => idx !== i))

  const handleSave = async () => {
    setSaving(true)
    const r = await pengaturanJamApi.saveHari(hariAktif, rows)
    if (r?.ok) { showToast(`Jam hari ${hariAktif} disimpan (${rows.length} slot)`); load() }
    else showToast('Gagal menyimpan', 'error')
    setSaving(false)
  }

  const handleCopy = async () => {
    if (copyTarget.length === 0) { showToast('Pilih minimal 1 hari tujuan', 'error'); return }
    const r = await pengaturanJamApi.copyHari(hariAktif, copyTarget)
    if (r?.ok) { showToast(`Jam ${hariAktif} disalin ke ${copyTarget.join(', ')}`); setCopyModal(false); setCopyTarget([]); load() }
    else showToast(r?.error || 'Gagal menyalin', 'error')
  }

  const handleAutoGen = () => {
    const parts = (autoForm.mulai || '07.00').split('.')
    let totalMenit = (parseInt(parts[0] || '7', 10) * 60) + parseInt(parts[1] || '0', 10)
    const jumlah = parseInt(autoForm.jumlah, 10) || 0
    const durasi = parseInt(autoForm.durasi_menit, 10) || 0
    const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}.${String(m % 60).padStart(2, '0')}`
    const hasil: any[] = []
    for (let i = 0; i < jumlah; i++) {
      hasil.push({ jam_mulai: fmt(totalMenit), jam_selesai: fmt(totalMenit + durasi), tipe: 'mengajar', label: '' })
      totalMenit += durasi
    }
    setRows(hasil)
    setAutoModal(false)
    showToast('Draft jam dibuat — cek & sesuaikan (mis. sisipkan istirahat), lalu Simpan')
  }

  const handleSeed = async () => {
    const r = await pengaturanJamApi.seedContoh()
    if (r?.ok) { showToast('Contoh jam pelajaran dimuat untuk semua hari'); load() }
  }

  if (loading) return <div className="py-16 flex justify-center"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {HARI_LIST.map(h => {
            const count = semua.filter((r: any) => r.hari === h).length
            return (
              <button key={h} onClick={() => setHariAktif(h)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium border transition ${hariAktif === h ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                {h}{count > 0 && <span className="opacity-70"> ({count})</span>}
              </button>
            )
          })}
        </div>
        <div className="flex gap-2">
          {semua.length === 0 && <Button variant="ghost" onClick={handleSeed} icon={<Sparkles className="w-4 h-4" />}>Muat Contoh</Button>}
          <Button variant="ghost" onClick={() => setAutoModal(true)} icon={<Sparkles className="w-4 h-4" />}>Isi Otomatis</Button>
          <Button variant="ghost" onClick={() => setCopyModal(true)} icon={<Copy className="w-4 h-4" />}>Salin ke Hari Lain</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Jam Ke', 'Mulai', 'Selesai', 'Tipe', 'Label (opsional)', ''].map(h => <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r: any, i: number) => (
              <tr key={i} className={r.tipe !== 'mengajar' ? 'bg-gray-50' : ''}>
                <td className="px-3 py-2 text-gray-400 font-medium">{i + 1}</td>
                <td className="px-3 py-2"><input value={r.jam_mulai} onChange={e => updateRow(i, { jam_mulai: e.target.value })} placeholder="07.00" className="border border-gray-200 rounded-lg px-2 py-1 text-sm w-24" /></td>
                <td className="px-3 py-2"><input value={r.jam_selesai} onChange={e => updateRow(i, { jam_selesai: e.target.value })} placeholder="07.30" className="border border-gray-200 rounded-lg px-2 py-1 text-sm w-24" /></td>
                <td className="px-3 py-2">
                  <select value={r.tipe} onChange={e => updateRow(i, { tipe: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-1 text-sm">
                    {TIPE_OPT.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2"><input value={r.label || ''} onChange={e => updateRow(i, { label: e.target.value })} placeholder={r.tipe !== 'mengajar' ? r.tipe : '—'} className="border border-gray-200 rounded-lg px-2 py-1 text-sm w-32" /></td>
                <td className="px-3 py-2"><button onClick={() => removeRow(i)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-gray-400">Belum ada jam untuk hari {hariAktif}. Klik "Isi Otomatis" atau "Muat Contoh" di atas.</td></tr>}
          </tbody>
        </table>
        <div className="p-3 border-t bg-gray-50 flex justify-between">
          <Button variant="ghost" onClick={addRow} icon={<Plus className="w-4 h-4" />}>Tambah Baris</Button>
          <Button onClick={handleSave} loading={saving} icon={<Save className="w-4 h-4" />}>Simpan Jam {hariAktif}</Button>
        </div>
      </div>

      <Modal open={autoModal} title="Isi Otomatis" onClose={() => setAutoModal(false)}
        footer={<><Button variant="ghost" onClick={() => setAutoModal(false)}>Batal</Button><Button onClick={handleAutoGen}>Buat Draft</Button></>}>
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Membuat draft jam mengajar berurutan untuk hari {hariAktif}. Istirahat / Upacara / Pembiasaan bisa disisipkan manual sesudahnya (tambah baris lalu ubah tipenya).</p>
          <TextInput label="Jumlah Jam Pelajaran" type="number" value={autoForm.jumlah} onChange={v => setAutoForm(f => ({ ...f, jumlah: v }))} />
          <TextInput label="Mulai Pukul (format 07.00)" value={autoForm.mulai} onChange={v => setAutoForm(f => ({ ...f, mulai: v }))} />
          <TextInput label="Durasi per JP (menit)" type="number" value={autoForm.durasi_menit} onChange={v => setAutoForm(f => ({ ...f, durasi_menit: v }))} />
        </div>
      </Modal>

      <Modal open={copyModal} title={`Salin Jam ${hariAktif} ke...`} onClose={() => setCopyModal(false)}
        footer={<><Button variant="ghost" onClick={() => setCopyModal(false)}>Batal</Button><Button onClick={handleCopy}>Salin</Button></>}>
        <div className="space-y-2">
          {HARI_LIST.filter(h => h !== hariAktif).map(h => (
            <label key={h} className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={copyTarget.includes(h)} onChange={e => setCopyTarget(t => (e.target.checked ? [...t, h] : t.filter(x => x !== h)))} />
              {h}
            </label>
          ))}
        </div>
      </Modal>
    </div>
  )
}

// ============================================================================
// TAB 2 — SUSUN JADWAL (tambah blok, cek tabrakan otomatis, rekomendasi hari)
// ============================================================================
function TabSusunJadwal({ showToast }: any) {
  const [kelasList, setKelasList] = useState<any[]>([])
  const [guruList, setGuruList] = useState<any[]>([])
  const [pengaturan, setPengaturan] = useState<any[]>([])
  const [kelasId, setKelasId] = useState<any>(null)
  const [hariAktif, setHariAktif] = useState('Senin')
  const [jadwalKelas, setJadwalKelas] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>({})
  const [kuota, setKuota] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [rekomendasi, setRekomendasi] = useState<any[] | null>(null)
  const [errMsg, setErrMsg] = useState('')
  const [confirmHapus, setConfirmHapus] = useState<{ open: boolean; blokId: string | null }>({ open: false, blokId: null })
  const [generating, setGenerating] = useState(false)
  const [confirmGenerate, setConfirmGenerate] = useState(false)
  const [resetDulu, setResetDulu] = useState(false)
  const [hasilGenerate, setHasilGenerate] = useState<any>(null)
  const [editBlokId, setEditBlokId] = useState<string | null>(null)
  const [editOriginal, setEditOriginal] = useState<{ durasi: number; jam_mengajar_id: any }>({ durasi: 0, jam_mengajar_id: null })

  useEffect(() => {
    kelasApi.list().then((r: any) => {
      const list = Array.isArray(r) ? r : []
      setKelasList(list)
      setKelasId((prev: any) => prev || (list[0] && list[0].id) || null)
    })
    guruApi.list().then((r: any) => setGuruList(Array.isArray(r) ? r : []))
    pengaturanJamApi.list().then((r: any) => setPengaturan(Array.isArray(r) ? r : []))
  }, [])

  const loadJadwal = async () => {
    if (!kelasId) return
    setLoading(true)
    const r = await jadwalPelajaranApi.getByKelas(kelasId)
    setJadwalKelas(Array.isArray(r) ? r : [])
    setLoading(false)
  }
  useEffect(() => { loadJadwal() }, [kelasId])

  const jamHariIni = pengaturan.filter((p: any) => p.hari === hariAktif).sort((a: any, b: any) => a.jam_ke - b.jam_ke)
  const jadwalHariIni = jadwalKelas.filter((j: any) => j.hari === hariAktif)
  const guruIdsDipakai = Array.from(new Set(jadwalKelas.map((j: any) => j.guru_id).filter(Boolean)))

  const bukaModalTambah = (jamKe?: number) => {
    setEditBlokId(null)
    setEditOriginal({ durasi: 0, jam_mengajar_id: null })
    setForm({ hari: hariAktif, mulai_jam_ke: jamKe ? String(jamKe) : '', durasi: '1', guru_id: '', jam_mengajar_id: '', mapel_id: '', nama_mapel: '', kelas_id: kelasId })
    setKuota([])
    setRekomendasi(null)
    setErrMsg('')
    setModal(true)
  }

  const bukaModalEdit = async (isi: any) => {
    const rowsBlok = jadwalKelas.filter((j: any) => j.blok_id === isi.blok_id).sort((a: any, b: any) => a.jam_ke - b.jam_ke)
    if (rowsBlok.length === 0) return
    const mulai = rowsBlok[0].jam_ke
    const durasiLama = rowsBlok.length
    setEditBlokId(isi.blok_id)
    setEditOriginal({ durasi: durasiLama, jam_mengajar_id: isi.jam_mengajar_id })
    setForm({ hari: isi.hari, mulai_jam_ke: String(mulai), durasi: String(durasiLama), guru_id: isi.guru_id || '', jam_mengajar_id: isi.jam_mengajar_id || '', mapel_id: isi.mapel_id, nama_mapel: isi.nama_mapel, kelas_id: kelasId, blok_id: isi.blok_id })
    setRekomendasi(null)
    setErrMsg('')
    setModal(true)
    setKuota([])
    if (isi.guru_id) {
      const r = await jadwalPelajaranApi.kuotaGuru(isi.guru_id)
      const dibebaskan = (Array.isArray(r) ? r : []).map((k: any) => (k.id === isi.jam_mengajar_id ? { ...k, sisa: k.sisa + durasiLama } : k))
      setKuota(dibebaskan.filter((k: any) => k.kelas_id === kelasId && k.sisa > 0))
    }
  }

  const pilihGuru = async (guru_id: number) => {
    setForm((f: any) => ({ ...f, guru_id, jam_mengajar_id: '', mapel_id: '', nama_mapel: '' }))
    const r = await jadwalPelajaranApi.kuotaGuru(guru_id)
    const dibebaskan = (Array.isArray(r) ? r : []).map((k: any) =>
      editBlokId && k.id === editOriginal.jam_mengajar_id ? { ...k, sisa: k.sisa + editOriginal.durasi } : k
    )
    setKuota(dibebaskan.filter((k: any) => k.kelas_id === kelasId && k.sisa > 0))
  }

  const pilihKuota = (jam_mengajar_id: number) => {
    const k = kuota.find((x: any) => x.id === jam_mengajar_id)
    if (!k) return
    setForm((f: any) => ({ ...f, jam_mengajar_id, mapel_id: k.mapel_id, nama_mapel: k.mapel, durasi: String(Math.min(Number(f.durasi) || 1, k.sisa, 3)) }))
  }

  const handleSubmit = async () => {
    setErrMsg(''); setRekomendasi(null)
    if (!form.guru_id) { setErrMsg('Pilih guru dulu.'); return }
    if (!form.jam_mengajar_id) { setErrMsg('Pilih mata pelajaran (dari kuota guru).'); return }
    if (!form.mulai_jam_ke) { setErrMsg('Pilih jam mulai.'); return }
    setSaving(true)
    const payload = { ...form, mulai_jam_ke: Number(form.mulai_jam_ke), durasi: Number(form.durasi) || 1 }
    const r = editBlokId ? await jadwalPelajaranApi.editBlok({ ...payload, blok_id: editBlokId }) : await jadwalPelajaranApi.addBlok(payload)
    setSaving(false)
    if (r?.ok) {
      showToast(editBlokId ? 'Perubahan disimpan' : 'Berhasil ditambahkan ke jadwal')
      setModal(false)
      loadJadwal()
    } else {
      setErrMsg(r?.error || 'Gagal menyimpan.')
      if (['guru', 'hari_tersedia', 'maks_jam_guru', 'maks_mapel_harian'].includes(r?.conflict)) {
        const rek = await jadwalPelajaranApi.rekomendasiHari({ guru_id: form.guru_id, durasi: payload.durasi, jam_mengajar_id: form.jam_mengajar_id })
        setRekomendasi(Array.isArray(rek) ? rek : [])
      }
    }
  }

  const pakaiRekomendasi = (rk: any) => {
    setForm((f: any) => ({ ...f, hari: rk.hari, mulai_jam_ke: String(rk.mulai_jam_ke) }))
    setRekomendasi(null)
    setErrMsg('')
  }

  const handleHapus = async () => {
    if (!confirmHapus.blokId) return
    await jadwalPelajaranApi.hapusBlok(confirmHapus.blokId)
    setConfirmHapus({ open: false, blokId: null })
    showToast('Blok jadwal dihapus')
    loadJadwal()
  }

  const handleGenerate = async (semuaKelas: boolean) => {
    setConfirmGenerate(false)
    setGenerating(true)
    const r = await jadwalPelajaranApi.generateOtomatis({ kelas_id: semuaKelas ? null : kelasId, reset: resetDulu })
    setGenerating(false)
    setResetDulu(false)
    if (r?.ok) {
      setHasilGenerate(r)
      showToast(`Berhasil menempatkan ${r.jumlah_berhasil} JP ke jadwal`)
      loadJadwal()
    } else {
      showToast(r?.error || 'Gagal menjalankan generate otomatis', 'error')
    }
  }

  const kelasAktif = kelasList.find((k: any) => k.id === kelasId)
  const guruOpt = [{ value: '', label: '— Pilih guru —' }, ...guruList.map((g: any) => ({ value: String(g.id), label: g.nama }))]
  const kuotaOpt = [
    { value: '', label: kuota.length ? '— Pilih mapel —' : form.guru_id ? 'Guru ini belum ada kuota di kelas ini' : '— Pilih guru dulu —' },
    ...kuota.map((k: any) => ({ value: String(k.id), label: `${k.mapel} (sisa ${k.sisa} JP)` })),
  ]
  const jamMulaiOpt = [
    { value: '', label: '— Pilih jam —' },
    ...jamHariIni.filter((j: any) => j.tipe === 'mengajar').map((j: any) => ({ value: String(j.jam_ke), label: `Jam ke-${j.jam_ke} (${j.jam_mulai}–${j.jam_selesai})` })),
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <DropDown value={String(kelasId || '')} onChange={v => setKelasId(Number(v))} options={kelasList.map((k: any) => ({ value: String(k.id), label: `${k.nama} (${k.tingkat || '-'})` }))} className="w-52" />
        <div className="flex gap-1.5 flex-wrap">
          {HARI_LIST.map(h => (
            <button key={h} onClick={() => setHariAktif(h)} className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${hariAktif === h ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>{h}</button>
          ))}
        </div>
        <div className="flex-1" />
        <Button variant="ghost" onClick={() => setConfirmGenerate(true)} loading={generating} icon={<Wand2 className="w-4 h-4" />}>Generate Otomatis</Button>
        <Button onClick={() => bukaModalTambah()} icon={<Plus className="w-4 h-4" />}>Tambah ke Jadwal</Button>
      </div>

      {loading ? <div className="py-16 flex justify-center"><Spinner /></div> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b text-sm font-semibold text-gray-700">Jadwal {kelasAktif?.nama || '-'} — {hariAktif}</div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{['Jam Ke', 'Waktu', 'Mata Pelajaran', 'Guru', ''].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {jamHariIni.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-gray-400">Hari {hariAktif} belum diatur. Buka tab "Pengaturan Jam" dulu.</td></tr>}
              {jamHariIni.map((j: any) => {
                if (j.tipe !== 'mengajar') {
                  return (
                    <tr key={j.jam_ke} className="bg-gray-50">
                      <td className="px-3 py-2 text-gray-400">{j.jam_ke}</td>
                      <td className="px-3 py-2 text-gray-400">{j.jam_mulai}–{j.jam_selesai}</td>
                      <td colSpan={3} className="px-3 py-2 text-gray-500 italic">{j.label || j.tipe}</td>
                    </tr>
                  )
                }
                const isi = jadwalHariIni.find((r: any) => r.jam_ke === j.jam_ke)
                return (
                  <tr key={j.jam_ke} className={!isi ? 'hover:bg-blue-50/50 cursor-pointer' : 'hover:bg-gray-50 cursor-pointer'} onClick={() => (isi ? bukaModalEdit(isi) : bukaModalTambah(j.jam_ke))}>
                    <td className="px-3 py-2 text-gray-400">{j.jam_ke}</td>
                    <td className="px-3 py-2 text-gray-400">{j.jam_mulai}–{j.jam_selesai}</td>
                    {isi ? (
                      <>
                        <td className="px-3 py-2 font-medium text-gray-800">{isi.nama_mapel}</td>
                        <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${warnaGuru(isi.guru_id, guruIdsDipakai)}`}>{isi.nama_guru || isi.guru}</span></td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button onClick={(e) => { e.stopPropagation(); bukaModalEdit(isi) }} className="p-1.5 hover:bg-blue-50 rounded-lg"><Pencil className="w-3.5 h-3.5 text-blue-400" /></button>
                            <button onClick={(e) => { e.stopPropagation(); setConfirmHapus({ open: true, blokId: isi.blok_id }) }} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <td colSpan={3} className="px-3 py-2 text-gray-300 text-xs">— Kosong, klik untuk isi —</td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} title={editBlokId ? 'Edit Jadwal' : 'Tambah ke Jadwal'} onClose={() => setModal(false)}
        footer={<><Button variant="ghost" onClick={() => setModal(false)}>Batal</Button><Button onClick={handleSubmit} loading={saving}>{editBlokId ? 'Simpan Perubahan' : 'Tambah ke Jadwal'}</Button></>}>
        <div className="space-y-3">
          <DropDown label="Hari" value={form.hari || ''} onChange={v => setForm((f: any) => ({ ...f, hari: v }))} options={HARI_LIST.map(h => ({ value: h, label: h }))} />
          <DropDown label="Guru *" value={String(form.guru_id || '')} onChange={v => pilihGuru(Number(v))} options={guruOpt} />
          <DropDown label="Mata Pelajaran *" value={String(form.jam_mengajar_id || '')} onChange={v => pilihKuota(Number(v))} options={kuotaOpt} />
          <div className="grid grid-cols-2 gap-3">
            <DropDown label="Mulai Jam Ke- *" value={String(form.mulai_jam_ke || '')} onChange={v => setForm((f: any) => ({ ...f, mulai_jam_ke: v }))} options={jamMulaiOpt} />
            <TextInput label="Durasi (JP)" type="number" value={String(form.durasi || '1')} onChange={v => setForm((f: any) => ({ ...f, durasi: v }))} />
          </div>
          <p className="text-xs text-gray-400">Maks 3 JP untuk mapel & kelas yang sama per hari. Kelas & guru otomatis dicek supaya tidak tabrakan jam.</p>
          {errMsg && (
            <div className="flex gap-2 items-start bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{errMsg}</span>
            </div>
          )}
          {rekomendasi && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              <p className="text-xs font-semibold text-blue-700 mb-1.5">Rekomendasi hari/jam lain yang kosong:</p>
              {rekomendasi.length === 0 ? <p className="text-xs text-blue-600">Tidak ada slot kosong yang cocok minggu ini — coba kurangi durasi atau atur ulang ketersediaan guru.</p> : (
                <div className="flex flex-wrap gap-1.5">
                  {rekomendasi.map((rk: any, i: number) => (
                    <button key={i} onClick={() => pakaiRekomendasi(rk)} className="px-2.5 py-1 bg-white border border-blue-200 rounded-full text-xs text-blue-700 hover:bg-blue-100">
                      {rk.hari} · jam ke-{rk.mulai_jam_ke} ({rk.jam_mulai})
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog open={confirmHapus.open} title="Hapus dari Jadwal" message="Hapus blok pelajaran ini dari jadwal?" danger onConfirm={handleHapus} onCancel={() => setConfirmHapus({ open: false, blokId: null })} />

      <Modal open={confirmGenerate} title="Generate Otomatis" onClose={() => setConfirmGenerate(false)}
        footer={<>
          <Button variant="ghost" onClick={() => setConfirmGenerate(false)}>Batal</Button>
          <Button variant="secondary" onClick={() => handleGenerate(false)}>Kelas Ini Saja</Button>
          <Button onClick={() => handleGenerate(true)}>Semua Kelas</Button>
        </>}>
        <p className="text-sm text-gray-600">Sistem akan otomatis menempatkan semua sisa kuota (yang belum dijadwalkan) ke jam-jam kosong yang valid — tanpa tabrakan guru/kelas, sesuai hari tersedia & batas jam guru, maksimal 3 JP/hari per mapel+kelas.</p>
        <p className="text-xs text-gray-400 mt-2">"Kelas Ini Saja" hanya proses kelas yang sedang dipilih. "Semua Kelas" proses seluruh kelas sekaligus.</p>
        <label className="flex items-start gap-2 mt-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 cursor-pointer">
          <input type="checkbox" checked={resetDulu} onChange={e => setResetDulu(e.target.checked)} className="mt-0.5" />
          <span className="text-xs text-amber-700">
            <strong>Hapus dulu jadwal lama sebelum generate ulang</strong> (dari kuota — yang dibuat manual di Wali Kelas tidak kena). Kalau tidak dicentang, sistem hanya mengisi jam yang masih kosong dan tidak mengubah yang sudah ada.
          </span>
        </label>
      </Modal>

      <Modal open={!!hasilGenerate} title="Hasil Generate Otomatis" onClose={() => setHasilGenerate(null)}
        footer={<Button onClick={() => setHasilGenerate(null)}>Tutup</Button>}>
        {hasilGenerate && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" /><span>{hasilGenerate.jumlah_blok} blok berhasil ditempatkan ({hasilGenerate.jumlah_berhasil} JP total).</span>
            </div>
            {hasilGenerate.gagal && hasilGenerate.gagal.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-600 mb-1.5">Belum bisa ditempatkan (perlu diatur manual atau longgarkan batasan):</p>
                <div className="max-h-52 overflow-y-auto space-y-1">
                  {hasilGenerate.gagal.map((g: any, i: number) => (
                    <div key={i} className="flex gap-2 items-start bg-red-50 border border-red-100 text-red-700 text-xs rounded-lg px-2.5 py-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>{g.guru} — {g.mapel} ({g.kelas}): kurang {g.kurang} JP</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(!hasilGenerate.gagal || hasilGenerate.gagal.length === 0) && <p className="text-xs text-gray-400">Semua kuota berhasil dijadwalkan penuh.</p>}
          </div>
        )}
      </Modal>
    </div>
  )
}

// ============================================================================
// TAB 3 — ANALISIS BEBAN KERJA & KETERSEDIAAN GURU
// ============================================================================
function TabAnalisisBeban({ showToast }: any) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; guru: any }>({ open: false, guru: null })
  const [hariPilih, setHariPilih] = useState<string[]>([])
  const [maksJam, setMaksJam] = useState('')
  const [saving, setSaving] = useState(false)
  const [printing, setPrinting] = useState<number | null>(null)

  const handleCetak = async (guru_id: number) => {
    setPrinting(guru_id)
    const r = await jadwalPelajaranApi.exportPdfGuru(guru_id)
    setPrinting(null)
    if (r?.ok) showToast('Jadwal guru berhasil dicetak & dibuka')
    else showToast(r?.error || 'Gagal mencetak', 'error')
  }

  const load = async () => {
    setLoading(true)
    const r = await jadwalPelajaranApi.workload()
    setData(Array.isArray(r) ? r : [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const bukaAtur = (g: any) => {
    setHariPilih(g.hari_tersedia ? g.hari_tersedia.split(',').map((s: string) => s.trim()).filter(Boolean) : [])
    setMaksJam(g.maks_jam_per_hari ? String(g.maks_jam_per_hari) : '')
    setModal({ open: true, guru: g })
  }
  const simpanAtur = async () => {
    if (!modal.guru) return
    setSaving(true)
    await guruApi.updateKetersediaan(modal.guru.guru_id, { hari_tersedia: hariPilih.join(','), maks_jam_per_hari: maksJam ? Number(maksJam) : null })
    showToast('Ketersediaan guru disimpan')
    setModal({ open: false, guru: null })
    setSaving(false)
    load()
  }

  if (loading) return <div className="py-16 flex justify-center"><Spinner /></div>

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Target JP = total kuota guru tsb (menu Kepegawaian &gt; Jam Mengajar). Aktual = jam yang sudah ditempatkan di jadwal lewat tab Susun Jadwal.</p>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Nama Guru', 'Ketersediaan', 'Target JP', 'Aktual Terjadwal', 'Keterangan', ''].map(h => <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {data.map((r: any) => (
              <tr key={r.guru_id}>
                <td className="px-3 py-2.5 font-medium text-gray-800">{r.nama_guru}</td>
                <td className="px-3 py-2.5 text-gray-500 text-xs">{r.hari_tersedia || 'Semua hari'}{r.maks_jam_per_hari ? ` · maks ${r.maks_jam_per_hari} JP/hari` : ''}</td>
                <td className="px-3 py-2.5 text-center">{r.target_jam}</td>
                <td className="px-3 py-2.5 text-center">{r.aktual_terjadwal}</td>
                <td className="px-3 py-2.5">
                  {r.selisih > 0 && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">Kurang {r.selisih} JP</span>}
                  {r.selisih < 0 && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">Lebih {Math.abs(r.selisih)} JP</span>}
                  {r.selisih === 0 && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">Lengkap</span>}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <button onClick={() => bukaAtur(r)} className="text-xs text-blue-600 hover:underline">Atur ketersediaan</button>
                    <button onClick={() => handleCetak(r.guru_id)} disabled={printing === r.guru_id} className="p-1 hover:bg-gray-100 rounded-lg disabled:opacity-40" title="Cetak jadwal guru ini">
                      <Printer className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-gray-400">Belum ada guru dengan kuota jam mengajar. Isi dulu di menu Kepegawaian &gt; Jam Mengajar.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={modal.open} title={`Ketersediaan — ${modal.guru?.nama_guru || ''}`} onClose={() => setModal({ open: false, guru: null })}
        footer={<><Button variant="ghost" onClick={() => setModal({ open: false, guru: null })}>Batal</Button><Button onClick={simpanAtur} loading={saving}>Simpan</Button></>}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">Hari Tersedia Mengajar</label>
            <p className="text-xs text-gray-400 mb-2">Kosongkan semua = tersedia semua hari (default). Cocok untuk guru honorer yang cuma masuk hari tertentu — dipakai sistem saat cek tabrakan & rekomendasi hari.</p>
            <div className="flex flex-wrap gap-1.5">
              {HARI_LIST.map(h => (
                <button key={h} type="button" onClick={() => setHariPilih(hs => (hs.includes(h) ? hs.filter(x => x !== h) : [...hs, h]))}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${hariPilih.includes(h) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>{h}</button>
              ))}
            </div>
          </div>
          <TextInput label="Maks Jam Mengajar per Hari (opsional)" type="number" value={maksJam} onChange={setMaksJam} placeholder="mis. 6" />
        </div>
      </Modal>
    </div>
  )
}

// ============================================================================
// TAB 4 — PREVIEW JADWAL LENGKAP (tampilan gabungan semua kelas di dalam app)
// ============================================================================
function TabPreview({ showToast }: any) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    jadwalPelajaranApi.previewLengkap().then((r: any) => { setData(r); setLoading(false) })
  }
  useEffect(() => { load() }, [])

  if (loading) return <div className="py-16 flex justify-center"><Spinner /></div>
  if (!data || !Array.isArray(data.kelasList) || data.kelasList.length === 0) {
    return <p className="text-sm text-gray-400 py-14 text-center">Belum ada data kelas / jadwal untuk dipratinjau.</p>
  }

  const { kelasList, hariList, jamByHari, isiByHari, kodeGuruMap, piket } = data
  const legendPairs = Object.values(kodeGuruMap || {}).sort((a: any, b: any) => {
    const na = parseInt(a.kode, 10), nb = parseInt(b.kode, 10)
    return na !== nb ? na - nb : String(a.kode).localeCompare(String(b.kode))
  })
  const adaPiket = (hariList || []).some((h: string) => (piket[h] || []).length > 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Pratinjau persis seperti hasil export — kalau sudah pas, tinggal Export Excel/PDF di pojok atas.</p>
        <Button variant="ghost" onClick={load}>Muat Ulang</Button>
      </div>

      {(hariList || []).map((hari: string) => {
        const jamRows = (jamByHari[hari] || []).slice().sort((a: any, b: any) => a.jam_ke - b.jam_ke)
        if (jamRows.length === 0) return null
        return (
          <div key={hari} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-2 bg-[#2e6da4] text-white text-sm font-semibold">{hari.toUpperCase()}</div>
            <div className="overflow-x-auto">
              <table className="text-xs w-full min-w-max">
                <thead className="bg-[#1e3a5f] text-white">
                  <tr>
                    <th className="px-2 py-1.5 font-semibold w-14">Jam</th>
                    <th className="px-2 py-1.5 font-semibold w-24">Waktu</th>
                    {kelasList.map((k: any) => <th key={k.id} className="px-2 py-1.5 font-semibold min-w-[70px]">{k.nama}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {jamRows.map((j: any) => {
                    if (j.tipe !== 'mengajar') {
                      return (
                        <tr key={j.jam_ke} className="border-b border-gray-100">
                          <td className="px-2 py-1.5 text-gray-400 text-center">{j.jam_ke}</td>
                          <td className="px-2 py-1.5 text-gray-400 text-center">{j.jam_mulai}-{j.jam_selesai}</td>
                          <td colSpan={kelasList.length} className="px-2 py-1.5 text-center italic text-amber-700 bg-amber-50">{j.label || j.tipe}</td>
                        </tr>
                      )
                    }
                    return (
                      <tr key={j.jam_ke} className="border-b border-gray-100">
                        <td className="px-2 py-1.5 text-gray-500 text-center bg-gray-50">{j.jam_ke}</td>
                        <td className="px-2 py-1.5 text-gray-500 text-center bg-gray-50">{j.jam_mulai}-{j.jam_selesai}</td>
                        {kelasList.map((k: any) => {
                          const isi = (isiByHari[hari] || []).find((r: any) => r.kelas_id === k.id && r.jam_ke === j.jam_ke)
                          if (!isi || !isi.guru_id) return <td key={k.id} className="px-2 py-1.5 text-center text-gray-300">·</td>
                          const kg = kodeGuruMap[`${isi.guru_id}|${isi.nama_mapel}`]
                          const cls = kg ? GURU_COLORS[kg.warnaIdx % 12] : 'bg-gray-100 text-gray-500 border-gray-200'
                          return <td key={k.id} className="px-1.5 py-1"><span className={`block text-center rounded-md py-1 font-bold border ${cls}`}>{kg ? kg.kode : '?'}</span></td>
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {legendPairs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2 bg-[#1e3a5f] text-white text-sm font-semibold">KETERANGAN KODE GURU</div>
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 p-3">
            {legendPairs.map((lg: any, i: number) => (
              <div key={i} className="flex items-center gap-2 py-1">
                <span className={`w-8 text-center text-xs font-bold rounded-md py-0.5 border shrink-0 ${GURU_COLORS[lg.warnaIdx % 12]}`}>{lg.kode}</span>
                <span className="text-xs text-gray-700 truncate">{lg.nama_guru} — {lg.nama_mapel}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {adaPiket && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2 bg-[#1e3a5f] text-white text-sm font-semibold">JADWAL PIKET</div>
          <table className="w-full text-xs">
            <tbody className="divide-y">
              {(hariList || []).filter((h: string) => (piket[h] || []).length > 0).map((hari: string) => (
                <tr key={hari}>
                  <td className="px-3 py-2 font-semibold text-gray-700 w-32">{hari}</td>
                  <td className="px-3 py-2 text-gray-600">{(piket[hari] || []).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// TAB 5 — JADWAL PIKET (terpisah dari jam mengajar, dipakai saat export)
// ============================================================================
function TabPiket({ showToast }: any) {
  const [guruList, setGuruList] = useState<any[]>([])
  const [piketData, setPiketData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; hari: string }>({ open: false, hari: '' })
  const [pilihan, setPilihan] = useState<number[]>([])
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const [g, p] = await Promise.all([guruApi.list(), piketApi.list()])
    setGuruList(Array.isArray(g) ? g : [])
    setPiketData(Array.isArray(p) ? p : [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const bukaAtur = (hari: string) => {
    setPilihan(piketData.filter((p: any) => p.hari === hari).map((p: any) => p.guru_id))
    setModal({ open: true, hari })
  }
  const simpan = async () => {
    setSaving(true)
    await piketApi.saveHari(modal.hari, pilihan)
    showToast(`Petugas piket ${modal.hari} disimpan`)
    setModal({ open: false, hari: '' })
    setSaving(false)
    load()
  }

  if (loading) return <div className="py-16 flex justify-center"><Spinner /></div>

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Petugas piket harian — tidak terkait jam mengajar, tapi ikut tampil di export Excel/PDF jadwal lengkap.</p>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b"><tr>{['Hari', 'Petugas Piket', ''].map(h => <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {HARI_LIST.map(hari => {
              const petugas = piketData.filter((p: any) => p.hari === hari)
              return (
                <tr key={hari}>
                  <td className="px-3 py-2.5 font-medium text-gray-800">{hari}</td>
                  <td className="px-3 py-2.5 text-gray-600">{petugas.length > 0 ? petugas.map((p: any) => p.nama_guru).join(', ') : <span className="text-gray-300">— belum diatur —</span>}</td>
                  <td className="px-3 py-2.5"><button onClick={() => bukaAtur(hari)} className="text-xs text-blue-600 hover:underline">Atur</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Modal open={modal.open} title={`Petugas Piket — ${modal.hari}`} onClose={() => setModal({ open: false, hari: '' })}
        footer={<><Button variant="ghost" onClick={() => setModal({ open: false, hari: '' })}>Batal</Button><Button onClick={simpan} loading={saving}>Simpan</Button></>}>
        <div className="max-h-72 overflow-y-auto space-y-1.5">
          {guruList.map((g: any) => (
            <label key={g.id} className="flex items-center gap-2 text-sm text-gray-700 py-1">
              <input type="checkbox" checked={pilihan.includes(g.id)} onChange={e => setPilihan(p => (e.target.checked ? [...p, g.id] : p.filter(x => x !== g.id)))} />
              {g.nama}
            </label>
          ))}
          {guruList.length === 0 && <p className="text-sm text-gray-400">Belum ada data guru.</p>}
        </div>
      </Modal>
    </div>
  )
}

// ============================================================================
// MAIN EXPORT
// ============================================================================
export function JadwalPelajaranPage({ showToast }: any) {
  const [tab, setTab] = useState('susun')
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)
  const tabs = [
    { key: 'susun', label: 'Susun Jadwal', icon: <CalendarClock className="w-4 h-4" /> },
    { key: 'pengaturan', label: 'Pengaturan Jam', icon: <Settings className="w-4 h-4" /> },
    { key: 'beban', label: 'Analisis Beban Kerja', icon: <Users className="w-4 h-4" /> },
    { key: 'preview', label: 'Preview', icon: <Eye className="w-4 h-4" /> },
    { key: 'piket', label: 'Jadwal Piket', icon: <ClipboardList className="w-4 h-4" /> },
  ]
  const doExport = async (jenis: 'excel' | 'pdf') => {
    setExporting(jenis)
    const r = jenis === 'excel' ? await jadwalPelajaranApi.exportExcel() : await jadwalPelajaranApi.exportPdf()
    setExporting(null)
    if (r?.ok) showToast(`${jenis === 'excel' ? 'Excel' : 'PDF'} jadwal lengkap berhasil dibuat & dibuka`)
    else showToast(r?.error || 'Gagal membuat file export', 'error')
  }
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader title="Jadwal Pelajaran" subtitle="Susun jadwal mengajar dengan cek tabrakan & rekomendasi hari otomatis" />
        <div className="flex gap-2 shrink-0">
          <Button variant="ghost" onClick={() => doExport('excel')} loading={exporting === 'excel'} icon={<FileSpreadsheet className="w-4 h-4" />}>Export Excel</Button>
          <Button variant="ghost" onClick={() => doExport('pdf')} loading={exporting === 'pdf'} icon={<FileText className="w-4 h-4" />}>Export PDF</Button>
        </div>
      </div>
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      {tab === 'susun' && <TabSusunJadwal showToast={showToast} />}
      {tab === 'pengaturan' && <TabPengaturanJam showToast={showToast} />}
      {tab === 'beban' && <TabAnalisisBeban showToast={showToast} />}
      {tab === 'preview' && <TabPreview showToast={showToast} />}
      {tab === 'piket' && <TabPiket showToast={showToast} />}
    </div>
  )
}
