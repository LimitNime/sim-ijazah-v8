import { useState, useEffect, useCallback } from 'react'
import { Users, Plus, Pencil, Trash2, Eye, X, Save, RefreshCw, ChevronLeft } from 'lucide-react'
import { Button, Modal, Input, Select, ConfirmDialog, SearchBar, PageHeader, Badge } from '../ui'
import { guruApi, absensiGuruApi, jamMengajarApi, skTugasApi } from '../../lib/api'
import { clsx } from 'clsx'

const today = () => new Date().toISOString().slice(0, 10)
const thisMonth = () => new Date().toISOString().slice(0, 7)

const STATUS_COLOR: Record<string, string> = { H: 'bg-green-100 text-green-800', S: 'bg-yellow-100 text-yellow-800', I: 'bg-blue-100 text-blue-800', A: 'bg-red-100 text-red-800', DL: 'bg-purple-100 text-purple-800' }
const STATUS_LABEL: Record<string, string> = { H: 'Hadir', S: 'Sakit', I: 'Izin', A: 'Alpha', DL: 'Dinas Luar' }

const AGAMA_OPT = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'].map(v => ({ value: v, label: v }))
const JK_OPT = [{ value: 'L', label: 'Laki-laki' }, { value: 'P', label: 'Perempuan' }]
const STATUS_KEPEG_OPT = ['PNS', 'PPPK', 'GTT', 'GTY', 'Honorer'].map(v => ({ value: v, label: v }))
const JENIS_TUGAS_OPT = ['Wali Kelas', 'Kepala Sekolah', 'Wakil Kepala Sekolah', 'Pembina OSIS', 'Pembina Ekstrakurikuler', 'Koordinator BK', 'Petugas Piket', 'Lainnya'].map(v => ({ value: v, label: v }))

const EMPTY_GURU: any = {
  nip: '', nama: '', jk: 'L', tempat_lahir: '', tgl_lahir: '', agama: 'Islam',
  pendidikan: '', jurusan: '', status_kepegawaian: 'PNS',
  sk_pertama: '', tmt_pertama: '', golongan: '', jabatan: 'Guru',
  mapel: '', no_hp: '', alamat: '', email: '', tahun_masuk: '', keterangan: ''
}

type Tab = 'data' | 'absensi' | 'jam' | 'sk'

// ─── Detail Guru ──────────────────────────────────────────────────────────────
function DetailGuru({ guru, onClose, onEdit }: any) {
  const Row = ({ label, value }: any) => (
    <><dt className="text-xs text-gray-500">{label}</dt><dd className="text-sm font-medium text-gray-800">{value || '—'}</dd></>
  )
  const tgl = (t: string) => { try { return t ? new Date(t).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '—' } catch { return t } }
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-xl bg-white h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-emerald-700 text-white">
          <div>
            <h2 className="font-bold text-lg">{guru.nama}</h2>
            <p className="text-emerald-200 text-sm">{guru.jabatan || 'Guru'} · {guru.mapel || '—'}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onEdit} className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm flex items-center gap-1"><Pencil className="w-3.5 h-3.5" />Edit</button>
            <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {[
            { title: 'Identitas', fields: [['NIP', guru.nip], ['Jenis Kelamin', guru.jk === 'L' ? 'Laki-laki' : 'Perempuan'], ['Tempat Lahir', guru.tempat_lahir], ['Tanggal Lahir', tgl(guru.tgl_lahir)], ['Agama', guru.agama]] },
            { title: 'Kepegawaian', fields: [['Status', guru.status_kepegawaian], ['Golongan', guru.golongan], ['Jabatan', guru.jabatan], ['Mapel', guru.mapel], ['SK Pertama', guru.sk_pertama], ['TMT Pertama', guru.tmt_pertama], ['Tahun Masuk', guru.tahun_masuk]] },
            { title: 'Kontak', fields: [['No. HP', guru.no_hp], ['Email', guru.email], ['Alamat', guru.alamat]] },
            { title: 'Pendidikan', fields: [['Pendidikan Terakhir', guru.pendidikan], ['Jurusan', guru.jurusan]] },
          ].map(sec => (
            <div key={sec.title}>
              <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2 pb-1 border-b border-emerald-100">{sec.title}</h4>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                {sec.fields.map(([l, v]) => <Row key={l} label={l} value={v} />)}
              </dl>
            </div>
          ))}
          {guru.keterangan && <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-gray-700">{guru.keterangan}</div>}
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Data Guru ───────────────────────────────────────────────────────────
function TabDataGuru({ showToast }: any) {
  const [data, setData] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<{ open: boolean; mode: 'add' | 'edit'; form: any }>({ open: false, mode: 'add', form: { ...EMPTY_GURU } })
  const [detail, setDetail] = useState<any>(null)
  const [confirm, setConfirm] = useState<{ open: boolean; id: number | null; nama: string }>({ open: false, id: null, nama: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await guruApi.list(q)
    setData(Array.isArray(r) ? r : [])
    setLoading(false)
  }, [q])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!modal.form.nama?.trim()) { showToast('Nama guru wajib diisi', 'error'); return }
    setSaving(true)
    try {
      if (modal.mode === 'add') await guruApi.add(modal.form)
      else await guruApi.update(modal.form.id, modal.form)
      setModal(m => ({ ...m, open: false }))
      showToast(modal.mode === 'add' ? 'Data guru ditambahkan' : 'Data guru diperbarui')
      load()
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirm.id) return
    await guruApi.delete(confirm.id)
    setConfirm({ open: false, id: null, nama: '' })
    showToast('Data guru dihapus')
    load()
  }

  const set = (k: string, v: any) => setModal(m => ({ ...m, form: { ...m.form, [k]: v } }))
  const F = ({ label, k, type = 'text', placeholder = '' }: any) => (
    <Input label={label} value={modal.form[k] || ''} onChange={v => set(k, v)} type={type} placeholder={placeholder} />
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 max-w-sm"><SearchBar value={q} onChange={setQ} placeholder="Cari nama, NIP..." /></div>
        <span className="text-sm text-gray-500">{data.length} guru</span>
        <div className="flex-1" />
        <Button onClick={() => setModal({ open: true, mode: 'add', form: { ...EMPTY_GURU } })} icon={<Plus className="w-4 h-4" />}>Tambah Guru</Button>
      </div>

      {loading
        ? <div className="text-center py-12 text-gray-400">Memuat...</div>
        : data.length === 0
          ? <div className="text-center py-16 text-gray-400"><Users className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Belum ada data guru</p></div>
          : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['No', 'Nama Guru', 'L/P', 'NIP', 'Status', 'Jabatan', 'Mapel', 'No HP', 'Aksi'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.map((g: any, i: number) => (
                    <tr key={g.id} className={clsx('hover:bg-emerald-50 cursor-pointer', i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')}
                      onClick={() => setDetail(g)}>
                      <td className="px-3 py-2.5 text-gray-400 text-center">{i + 1}</td>
                      <td className="px-3 py-2.5 font-semibold text-gray-900">{g.nama}</td>
                      <td className="px-3 py-2.5"><span className={clsx('text-xs font-bold', g.jk === 'P' ? 'text-pink-600' : 'text-blue-600')}>{g.jk}</span></td>
                      <td className="px-3 py-2.5 text-gray-500 font-mono text-xs">{g.nip || '—'}</td>
                      <td className="px-3 py-2.5"><Badge color={g.status_kepegawaian === 'PNS' ? 'blue' : 'gray'}>{g.status_kepegawaian || '—'}</Badge></td>
                      <td className="px-3 py-2.5 text-gray-600 text-xs">{g.jabatan || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-600 text-xs">{g.mapel || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-600 text-xs">{g.no_hp || '—'}</td>
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <button onClick={() => setDetail(g)} className="p-1.5 hover:bg-blue-100 rounded-lg"><Eye className="w-3.5 h-3.5 text-blue-500" /></button>
                          <button onClick={() => setModal({ open: true, mode: 'edit', form: { ...g } })} className="p-1.5 hover:bg-gray-100 rounded-lg"><Pencil className="w-3.5 h-3.5 text-gray-500" /></button>
                          <button onClick={() => setConfirm({ open: true, id: g.id, nama: g.nama })} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      }

      <Modal open={modal.open} title={modal.mode === 'add' ? 'Tambah Data Guru' : 'Edit Data Guru'} size="xl" onClose={() => setModal(m => ({ ...m, open: false }))}
        footer={<><Button variant="ghost" onClick={() => setModal(m => ({ ...m, open: false }))}>Batal</Button><Button onClick={handleSave} loading={saving}>Simpan</Button></>}>
        <div className="space-y-5">
          <div>
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-3">Identitas</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><F label="Nama Lengkap *" k="nama" /></div>
              <Select label="Jenis Kelamin" value={modal.form.jk || 'L'} onChange={v => set('jk', v)} options={JK_OPT} />
              <Select label="Agama" value={modal.form.agama || 'Islam'} onChange={v => set('agama', v)} options={AGAMA_OPT} />
              <F label="Tempat Lahir" k="tempat_lahir" />
              <F label="Tanggal Lahir" k="tgl_lahir" type="date" />
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-3">Kepegawaian</p>
            <div className="grid grid-cols-2 gap-3">
              <F label="NIP" k="nip" placeholder="19xxxxxx" />
              <Select label="Status Kepegawaian" value={modal.form.status_kepegawaian || 'PNS'} onChange={v => set('status_kepegawaian', v)} options={STATUS_KEPEG_OPT} />
              <F label="Golongan" k="golongan" placeholder="III/a" />
              <F label="Jabatan" k="jabatan" placeholder="Guru" />
              <F label="Mata Pelajaran" k="mapel" placeholder="Matematika" />
              <F label="SK Pertama" k="sk_pertama" />
              <F label="TMT Pertama" k="tmt_pertama" type="date" />
              <F label="Tahun Masuk" k="tahun_masuk" placeholder="2015" />
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-3">Pendidikan & Kontak</p>
            <div className="grid grid-cols-2 gap-3">
              <F label="Pendidikan Terakhir" k="pendidikan" placeholder="S1, S2..." />
              <F label="Jurusan" k="jurusan" />
              <F label="No. HP" k="no_hp" />
              <F label="Email" k="email" type="email" />
              <div className="col-span-2"><F label="Alamat" k="alamat" /></div>
              <div className="col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Keterangan</label>
                <textarea value={modal.form.keterangan || ''} onChange={e => set('keterangan', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-emerald-500 outline-none" rows={2} />
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {detail && <DetailGuru guru={detail} onClose={() => setDetail(null)} onEdit={() => { setModal({ open: true, mode: 'edit', form: { ...detail } }); setDetail(null) }} />}
      <ConfirmDialog open={confirm.open} title="Hapus Data Guru" danger message={`Hapus data guru "${confirm.nama}"?`} onConfirm={handleDelete} onCancel={() => setConfirm({ open: false, id: null, nama: '' })} />
    </div>
  )
}

// ─── Tab: Absensi Guru ────────────────────────────────────────────────────────
function TabAbsensiGuru({ showToast }: any) {
  const [mode, setMode] = useState<'input' | 'rekap'>('input')
  const [tanggal, setTanggal] = useState(today())
  const [bulan, setBulan] = useState(thisMonth())
  const [guru, setGuru] = useState<any[]>([])
  const [rekap, setRekap] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (mode === 'input') loadAbsensi() }, [tanggal, mode])
  useEffect(() => { if (mode === 'rekap') loadRekap() }, [bulan, mode])

  const loadAbsensi = async () => {
    setLoading(true)
    const r = await absensiGuruApi.get(tanggal)
    setGuru(Array.isArray(r) ? r : [])
    setLoading(false)
  }
  const loadRekap = async () => {
    setLoading(true)
    const r = await absensiGuruApi.rekap(bulan)
    setRekap(Array.isArray(r) ? r : [])
    setLoading(false)
  }
  const setStatus = (id: number, status: string) => setGuru(prev => prev.map(g => g.id === id ? { ...g, status } : g))
  const setKet = (id: number, ket: string) => setGuru(prev => prev.map(g => g.id === id ? { ...g, keterangan: ket } : g))
  const handleSave = async () => {
    setSaving(true)
    await absensiGuruApi.save(tanggal, guru.map(g => ({ guru_id: g.id, status: g.status, keterangan: g.keterangan || '' })))
    showToast('Absensi guru disimpan')
    setSaving(false)
  }
  const stats = { H: guru.filter(g => g.status === 'H').length, S: guru.filter(g => g.status === 'S').length, I: guru.filter(g => g.status === 'I').length, A: guru.filter(g => g.status === 'A').length, DL: guru.filter(g => g.status === 'DL').length }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-gray-100 rounded-lg p-0.5 text-sm">
          <button onClick={() => setMode('input')} className={clsx('px-3 py-1 rounded-md', mode === 'input' ? 'bg-white shadow text-blue-700 font-medium' : 'text-gray-500')}>Input Harian</button>
          <button onClick={() => setMode('rekap')} className={clsx('px-3 py-1 rounded-md', mode === 'rekap' ? 'bg-white shadow text-blue-700 font-medium' : 'text-gray-500')}>Rekap Bulanan</button>
        </div>
        {mode === 'input'
          ? <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
          : <input type="month" value={bulan} onChange={e => setBulan(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
        }
        {mode === 'input' && (
          <div className="flex gap-2 flex-wrap">
            {Object.entries(stats).map(([s, n]) => (
              <span key={s} className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLOR[s])}>{STATUS_LABEL[s]}: {n}</span>
            ))}
          </div>
        )}
        <div className="flex-1" />
        {mode === 'input' && <Button onClick={handleSave} icon={<Save className="w-4 h-4" />} loading={saving}>Simpan</Button>}
        {mode === 'rekap' && <button onClick={loadRekap} className="p-1.5 hover:bg-gray-100 rounded-lg"><RefreshCw className="w-4 h-4 text-gray-500" /></button>}
      </div>

      {loading ? <div className="text-center py-8 text-gray-400">Memuat...</div> :
        mode === 'input' ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-8">No</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Nama Guru</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Mapel</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {guru.map((g: any, i: number) => (
                  <tr key={g.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                    <td className="px-3 py-2 text-gray-400 text-center">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-gray-800">{g.nama}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{g.mapel || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-center flex-wrap">
                        {Object.keys(STATUS_LABEL).map(st => (
                          <button key={st} onClick={() => setStatus(g.id, st)}
                            className={clsx('px-2 py-1 rounded-lg text-xs font-bold transition-all',
                              g.status === st ? STATUS_COLOR[st] + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-100 text-gray-400 hover:bg-gray-200')}>
                            {st}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {g.status !== 'H' && (
                        <input value={g.keterangan || ''} onChange={e => setKet(g.id, e.target.value)}
                          className="border border-gray-200 rounded px-2 py-1 text-xs w-full" placeholder="Keterangan..." />
                      )}
                    </td>
                  </tr>
                ))}
                {guru.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400">Belum ada data guru. Tambah guru di tab Data Guru.</td></tr>}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['No', 'Nama Guru', 'Mapel', 'Hadir', 'Sakit', 'Izin', 'Alpha', 'Dinas Luar', 'Total', '% Hadir'].map(h => (
                    <th key={h} className="px-3 py-2 text-center text-xs font-semibold text-gray-500 first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rekap.map((g: any, i: number) => {
                  const pct = g.total > 0 ? Math.round(((g.H + g.DL) / g.total) * 100) : 0
                  return (
                    <tr key={g.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-gray-800">{g.nama}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs text-center">{g.mapel || '—'}</td>
                      {['H', 'S', 'I', 'A', 'DL'].map(st => (
                        <td key={st} className="px-3 py-2 text-center">
                          <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLOR[st])}>{g[st] || 0}</span>
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center text-gray-600 text-xs">{g.total}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div className={clsx('h-1.5 rounded-full', pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500')} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-600 w-8">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  )
}

// ─── Tab: Jam Mengajar ────────────────────────────────────────────────────────
function TabJamMengajar({ showToast }: any) {
  const [guruList, setGuruList] = useState<any[]>([])
  const [data, setData] = useState<any[]>([])
  const [ta, setTa] = useState(new Date().getFullYear() + '/' + (new Date().getFullYear() + 1))
  const [modal, setModal] = useState<{ open: boolean; form: any }>({ open: false, form: {} })
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState<{ open: boolean; id: number | null }>({ open: false, id: null })

  useEffect(() => { guruApi.list().then((r: any) => setGuruList(Array.isArray(r) ? r : [])) }, [])
  useEffect(() => { load() }, [ta])

  const load = async () => {
    const r = await jamMengajarApi.list(ta)
    setData(Array.isArray(r) ? r : [])
  }
  const handleSave = async () => {
    if (!modal.form.guru_id) { showToast('Pilih guru', 'error'); return }
    setSaving(true)
    await jamMengajarApi.save({ ...modal.form, tahun_ajaran: ta })
    setModal(m => ({ ...m, open: false }))
    showToast('Data jam mengajar disimpan')
    load()
    setSaving(false)
  }
  const handleDelete = async () => {
    if (!confirm.id) return
    await jamMengajarApi.delete(confirm.id)
    setConfirm({ open: false, id: null })
    showToast('Data dihapus')
    load()
  }

  const totalJam = data.reduce((a: number, r: any) => a + (r.jumlah_jam || 0), 0)
  const guruOpt = [{ value: '', label: '— Pilih guru —' }, ...guruList.map((g: any) => ({ value: g.id, label: g.nama }))]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Tahun Ajaran:</label>
          <input value={ta} onChange={e => setTa(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-32" placeholder="2024/2025" />
        </div>
        <span className="text-sm text-gray-500">Total: <strong>{totalJam}</strong> jam/minggu</span>
        <div className="flex-1" />
        <Button onClick={() => setModal({ open: true, form: { jumlah_jam: 1, tahun_ajaran: ta } })} icon={<Plus className="w-4 h-4" />}>Tambah</Button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['No', 'Nama Guru', 'Mata Pelajaran', 'Kelas', 'Jml Jam', 'Aksi'].map(h => <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {data.map((r: any, i: number) => (
              <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2.5 text-gray-400">{i + 1}</td>
                <td className="px-3 py-2.5 font-medium text-gray-800">{r.nama_guru}</td>
                <td className="px-3 py-2.5 text-gray-600">{r.mapel || '—'}</td>
                <td className="px-3 py-2.5 text-gray-600">{r.kelas || '—'}</td>
                <td className="px-3 py-2.5 text-center"><span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">{r.jumlah_jam}</span></td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    <button onClick={() => setModal({ open: true, form: { ...r } })} className="p-1.5 hover:bg-gray-100 rounded-lg"><Pencil className="w-3.5 h-3.5 text-gray-500" /></button>
                    <button onClick={() => setConfirm({ open: true, id: r.id })} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-400">Belum ada data jam mengajar</td></tr>}
          </tbody>
        </table>
      </div>
      <Modal open={modal.open} title="Jam Mengajar" onClose={() => setModal(m => ({ ...m, open: false }))}
        footer={<><Button variant="ghost" onClick={() => setModal(m => ({ ...m, open: false }))}>Batal</Button><Button onClick={handleSave} loading={saving}>Simpan</Button></>}>
        <div className="space-y-3">
          <Select label="Guru *" value={String(modal.form.guru_id || '')} onChange={v => setModal(m => ({ ...m, form: { ...m.form, guru_id: Number(v) } }))} options={guruOpt} />
          <Input label="Mata Pelajaran" value={modal.form.mapel || ''} onChange={v => setModal(m => ({ ...m, form: { ...m.form, mapel: v } }))} placeholder="Matematika" />
          <Input label="Kelas" value={modal.form.kelas || ''} onChange={v => setModal(m => ({ ...m, form: { ...m.form, kelas: v } }))} placeholder="VII A, VII B, VIII A..." />
          <Input label="Jumlah Jam/Minggu" value={String(modal.form.jumlah_jam || 1)} onChange={v => setModal(m => ({ ...m, form: { ...m.form, jumlah_jam: Number(v) } }))} type="number" />
        </div>
      </Modal>
      <ConfirmDialog open={confirm.open} title="Hapus Data" message="Hapus data jam mengajar ini?" danger onConfirm={handleDelete} onCancel={() => setConfirm({ open: false, id: null })} />
    </div>
  )
}

// ─── Tab: SK Tugas ────────────────────────────────────────────────────────────
function TabSKTugas({ showToast }: any) {
  const [guruList, setGuruList] = useState<any[]>([])
  const [data, setData] = useState<any[]>([])
  const [modal, setModal] = useState<{ open: boolean; form: any }>({ open: false, form: {} })
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState<{ open: boolean; id: number | null }>({ open: false, id: null })
  const tgl = (t: string) => { try { return t ? new Date(t).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' } catch { return t } }

  useEffect(() => {
    guruApi.list().then((r: any) => setGuruList(Array.isArray(r) ? r : []))
    load()
  }, [])

  const load = async () => {
    const r = await skTugasApi.list()
    setData(Array.isArray(r) ? r : [])
  }
  const handleSave = async () => {
    if (!modal.form.guru_id) { showToast('Pilih guru', 'error'); return }
    setSaving(true)
    await skTugasApi.save(modal.form)
    setModal(m => ({ ...m, open: false }))
    showToast('SK Tugas disimpan')
    load()
    setSaving(false)
  }
  const handleDelete = async () => {
    if (!confirm.id) return
    await skTugasApi.delete(confirm.id)
    setConfirm({ open: false, id: null })
    showToast('SK dihapus')
    load()
  }

  const guruOpt = [{ value: '', label: '— Pilih guru —' }, ...guruList.map((g: any) => ({ value: g.id, label: g.nama }))]
  const tugasOpt = JENIS_TUGAS_OPT

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setModal({ open: true, form: {} })} icon={<Plus className="w-4 h-4" />}>Tambah SK</Button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['No', 'Nama Guru', 'Jenis Tugas', 'Kelas', 'No. SK', 'Tanggal SK', 'Tahun Ajaran', 'Aksi'].map(h => <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {data.map((r: any, i: number) => (
              <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2.5 text-gray-400">{i + 1}</td>
                <td className="px-3 py-2.5 font-medium text-gray-800">{r.nama_guru}</td>
                <td className="px-3 py-2.5"><Badge color="purple">{r.jenis_tugas || '—'}</Badge></td>
                <td className="px-3 py-2.5 text-gray-600">{r.kelas || '—'}</td>
                <td className="px-3 py-2.5 text-gray-500 font-mono text-xs">{r.no_sk || '—'}</td>
                <td className="px-3 py-2.5 text-gray-600 text-xs">{tgl(r.tgl_sk)}</td>
                <td className="px-3 py-2.5 text-gray-600">{r.tahun_ajaran || '—'}</td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    <button onClick={() => setModal({ open: true, form: { ...r } })} className="p-1.5 hover:bg-gray-100 rounded-lg"><Pencil className="w-3.5 h-3.5 text-gray-500" /></button>
                    <button onClick={() => setConfirm({ open: true, id: r.id })} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-gray-400">Belum ada data SK Tugas</td></tr>}
          </tbody>
        </table>
      </div>
      <Modal open={modal.open} title="SK Tugas Tambahan" onClose={() => setModal(m => ({ ...m, open: false }))}
        footer={<><Button variant="ghost" onClick={() => setModal(m => ({ ...m, open: false }))}>Batal</Button><Button onClick={handleSave} loading={saving}>Simpan</Button></>}>
        <div className="space-y-3">
          <Select label="Guru *" value={String(modal.form.guru_id || '')} onChange={v => setModal(m => ({ ...m, form: { ...m.form, guru_id: Number(v) } }))} options={guruOpt} />
          <Select label="Jenis Tugas" value={modal.form.jenis_tugas || ''} onChange={v => setModal(m => ({ ...m, form: { ...m.form, jenis_tugas: v } }))} options={tugasOpt} />
          <Input label="Kelas (jika wali kelas)" value={modal.form.kelas || ''} onChange={v => setModal(m => ({ ...m, form: { ...m.form, kelas: v } }))} placeholder="VII A" />
          <Input label="Nomor SK" value={modal.form.no_sk || ''} onChange={v => setModal(m => ({ ...m, form: { ...m.form, no_sk: v } }))} />
          <Input label="Tanggal SK" value={modal.form.tgl_sk || ''} onChange={v => setModal(m => ({ ...m, form: { ...m.form, tgl_sk: v } }))} type="date" />
          <Input label="Tahun Ajaran" value={modal.form.tahun_ajaran || ''} onChange={v => setModal(m => ({ ...m, form: { ...m.form, tahun_ajaran: v } }))} placeholder="2024/2025" />
          <Input label="Keterangan" value={modal.form.keterangan || ''} onChange={v => setModal(m => ({ ...m, form: { ...m.form, keterangan: v } }))} />
        </div>
      </Modal>
      <ConfirmDialog open={confirm.open} title="Hapus SK Tugas" message="Hapus SK tugas ini?" danger onConfirm={handleDelete} onCancel={() => setConfirm({ open: false, id: null })} />
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function KepegawaianPage({ showToast }: { showToast: (msg: string, type?: any) => void }) {
  const [tab, setTab] = useState<Tab>('data')

  const TABS = [
    { key: 'data', label: 'Buku Induk Guru', icon: '👨‍🏫' },
    { key: 'absensi', label: 'Absensi Guru', icon: '✅' },
    { key: 'jam', label: 'Jam Mengajar', icon: '⏱️' },
    { key: 'sk', label: 'SK Tugas', icon: '📋' },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Kepegawaian" subtitle="Data guru, absensi, jam mengajar, dan SK tugas tambahan" />

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as Tab)}
            className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              tab === t.key ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-800')}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {tab === 'data' && <TabDataGuru showToast={showToast} />}
      {tab === 'absensi' && <TabAbsensiGuru showToast={showToast} />}
      {tab === 'jam' && <TabJamMengajar showToast={showToast} />}
      {tab === 'sk' && <TabSKTugas showToast={showToast} />}
    </div>
  )
}
