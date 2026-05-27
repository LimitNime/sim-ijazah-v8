import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Users, CheckCircle, XCircle, Upload, Hash, RefreshCw, FileText, Camera, X, Download } from 'lucide-react'
import { Button, SearchBar, Modal, Input, Select, ConfirmDialog, Badge, PageHeader, StatCard, Table, EmptyState , InfoTooltip } from '../ui'
import { siswaApi, sekolahApi } from '../../lib/api'
import type { Siswa } from '../../types'

const AGAMA_OPTIONS = ['Islam','Kristen','Katolik','Hindu','Buddha','Konghucu','Lainnya']
const BULAN_ROMAWI  = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII']
const KODE_JENJANG: Record<string,string> = {
  'SD':'421.2','MI':'421.2','SMP':'421.3','MTs':'421.3',
  'SMA':'421.3','MA':'421.3','SMK':'421.5',
}

const EMPTY: Omit<Siswa,'id'> = {
  no_urut:0, nism:'', nisn:'', nama:'', jk:'Laki-laki',
  tempat_lahir:'', tgl_lahir:'', ortu:'', nama_ibu:'',
  agama:'Islam', kewarganegaraan:'Indonesia', anak_ke:'',
  asal_sekolah:'', tahun_masuk:'', kelas:'', no_hp_ortu:'', alamat:'',
  peserta_am:'', no_peserta:'', blanko:'', no_skl:'', no_skkb:'',
  jenis_kekhususan:'', foto:'',
}

export function SiswaPage({ showToast }: { showToast: (msg: string, type?: any) => void }) {
  const [data, setData]           = useState<Siswa[]>([])
  const [q, setQ]                 = useState('')
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [errors, setErrors]       = useState<Record<string,string>>({})
  const [importLoading, setImportLoading] = useState(false)
  const [sekolah, setSekolah]     = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'identitas'|'dokumen'|'foto'>('identitas')

  const [modal, setModal]   = useState<{ open:boolean; mode:'add'|'edit'; form:any }>({ open:false, mode:'add', form:{...EMPTY} })
  const [confirm, setConfirm] = useState<{ open:boolean; id:number|null; nama:string }>({ open:false, id:null, nama:'' })

  // Generate No SKL
  const [genModal, setGenModal]   = useState(false)
  const [genOpts, setGenOpts]     = useState({ kode_sekolah:'', bulan_romawi: BULAN_ROMAWI[new Date().getMonth()], tahun: String(new Date().getFullYear()), mulai_dari:'1' })
  const [genPreview, setGenPreview] = useState('')
  const [genLoading, setGenLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await siswaApi.list(q) || []) }
    finally { setLoading(false) }
  }, [q])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    sekolahApi.get().then(s => {
      setSekolah(s)
      if (s?.nama) {
        const kata = (s.nama||'').split(' ')
        const kode = kata.slice(0,3).map((k:string)=>k.replace(/[^A-Z0-9]/gi,'')).join('.').toUpperCase()
        setGenOpts(o => ({ ...o, kode_sekolah: o.kode_sekolah||kode }))
      }
    })
  }, [])

  useEffect(() => {
    const jenjang = sekolah?.jenjang || 'MI'
    const kodeJ = KODE_JENJANG[jenjang] || '421.2'
    const no = String(parseInt(genOpts.mulai_dari)||1).padStart(3,'0')
    setGenPreview(`${kodeJ}/${no}/${genOpts.kode_sekolah||'...'}/  ${genOpts.bulan_romawi}/${genOpts.tahun}`)
  }, [genOpts, sekolah])

  const stats = {
    total: data.length,
    nilai: data.filter(s => (s.jml_nilai??0) > 0).length,
    skl:   data.filter(s => !!s.no_skl).length,
  }

  const openAdd = () => {
    const maxNo = data.length > 0 ? Math.max(...data.map(s => s.no_urut||0)) + 1 : 1
    setErrors({}); setActiveTab('identitas')
    setModal({ open:true, mode:'add', form:{ ...EMPTY, no_urut: maxNo } })
  }
  const openEdit = (row: Siswa) => {
    setErrors({}); setActiveTab('identitas')
    setModal({ open:true, mode:'edit', form:{ ...row } })
  }
  const set = (key: string, val: any) => setModal(m => ({ ...m, form:{ ...m.form, [key]:val } }))

  const validate = (f: any) => {
    const e: Record<string,string> = {}
    if (!f.nama?.trim())        e.nama     = 'Nama wajib diisi'
    if (!f.no_urut || f.no_urut < 1) e.no_urut = 'No urut tidak valid'
    return e
  }

  const handleSave = async () => {
    const errs = validate(modal.form)
    if (Object.keys(errs).length) { setErrors(errs); setActiveTab('identitas'); return }
    setSaving(true)
    try {
      if (modal.mode === 'add') await siswaApi.add(modal.form)
      else await siswaApi.update(modal.form.id, modal.form)
      setModal(m => ({ ...m, open:false }))
      showToast(modal.mode === 'add' ? 'Siswa berhasil ditambahkan' : 'Data siswa diperbarui')
      load()
    } catch (e:any) { showToast(e.message||'Gagal menyimpan','error') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirm.id) return
    try { await siswaApi.delete(confirm.id); showToast('Data siswa dihapus'); load() }
    catch { showToast('Gagal menghapus','error') }
    finally { setConfirm({ open:false, id:null, nama:'' }) }
  }

  const handleGenerateSkl = async () => {
    setGenLoading(true)
    try {
      const result = await siswaApi.generateNoSkl(genOpts) as any
      if (result?.ok) { showToast(`No SKL berhasil digenerate untuk ${result.generated} siswa`); setGenModal(false); load() }
      else showToast('Gagal generate No SKL','error')
    } catch { showToast('Gagal generate No SKL','error') }
    finally { setGenLoading(false) }
  }

  const handleImportExcel = async () => {
    setImportLoading(true)
    try {
      const result = await siswaApi.importExcel() as any
      if (result?.ok) { showToast(result.message); load() }
      else showToast(result?.message||'Gagal import','error')
    } catch { showToast('Gagal import Excel','error') }
    finally { setImportLoading(false) }
  }

  const handleDownloadTemplate = async () => {
    try {
      const result = await siswaApi.downloadTemplate() as any
      if (result?.ok) showToast('Template berhasil didownload')
      else showToast(result?.message||'Gagal download template','error')
    } catch { showToast('Gagal download template','error') }
  }

  const handleUploadFoto = async (siswaId: number) => {
    const result = await siswaApi.uploadFoto(siswaId) as any
    if (result) { showToast('Foto berhasil diupload'); load(); setModal(m => m.form.id === siswaId ? { ...m, form:{ ...m.form, foto:result } } : m) }
  }

  const columns = [
    { key:'no_urut', header:'No', width:'48px', align:'center' as const,
      render:(r:Siswa) => <span className="font-mono text-xs text-gray-400">{r.no_urut}</span> },
    { key:'nama', header:'Nama Siswa',
      render:(r:Siswa) => (
        <div>
          <p className="font-semibold text-gray-900">{r.nama}</p>
          {r.kelas && <p className="text-xs text-gray-400">Kelas {r.kelas}</p>}
        </div>
      )},
    { key:'nisn', header:'NISN / NISM', width:'150px',
      render:(r:Siswa) => (
        <div>
          <p className="font-mono text-xs text-gray-600">{r.nisn||'-'}</p>
          <p className="font-mono text-xs text-gray-400">{r.nism||'-'}</p>
        </div>
      )},
    { key:'agama', header:'Agama', width:'80px',
      render:(r:Siswa) => <span className="text-xs text-gray-500">{r.agama||'-'}</span> },
    { key:'no_skl', header:'No SKL', width:'160px',
      render:(r:Siswa) => r.no_skl
        ? <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{r.no_skl}</span>
        : <span className="text-xs text-gray-400 italic">Belum</span> },
    { key:'jk', header:'JK', width:'48px', align:'center' as const,
      render:(r:Siswa) => <Badge color={r.jk==='Laki-laki'?'blue':'purple'}>{r.jk==='Laki-laki'?'L':'P'}</Badge> },
    { key:'jml_nilai', header:'Nilai', width:'64px', align:'center' as const,
      render:(r:Siswa) => (r.jml_nilai??0)>0
        ? <span className="flex items-center justify-center gap-1 text-emerald-600 text-xs font-semibold"><CheckCircle className="w-3.5 h-3.5"/>{r.jml_nilai}</span>
        : <span className="flex items-center justify-center gap-1 text-gray-400 text-xs"><XCircle className="w-3.5 h-3.5"/>0</span> },
    { key:'aksi', header:'Aksi', width:'80px', align:'center' as const,
      render:(r:Siswa) => (
        <div className="flex items-center justify-center gap-1">
          <button onClick={e => { e.stopPropagation(); openEdit(r) }} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"><Pencil className="w-3.5 h-3.5"/></button>
          <button onClick={e => { e.stopPropagation(); setConfirm({ open:true, id:r.id, nama:r.nama }) }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
        </div>
      )},
  ]

  const TABS = [
    { key:'identitas', label:'Data Pribadi' },
    { key:'dokumen',   label:'Dokumen & Nomor' },
    { key:'foto',      label:'Foto & SKL' },
  ] as const

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Data Siswa" subtitle="Kelola data siswa lengkap — identitas, dokumen, dan foto"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Hash className="w-4 h-4"/>} onClick={() => setGenModal(true)}>Generate No SKL</Button>
            <Button icon={<Plus className="w-4 h-4"/>} onClick={openAdd}>Tambah Siswa</Button>
          </div>
        }/>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Siswa"          value={stats.total} icon={<Users className="w-5 h-5"/>} color="text-blue-600"/>
        <StatCard label="Sudah Ada Nilai"       value={stats.nilai} icon={<CheckCircle className="w-5 h-5"/>} color="text-emerald-600"/>
        <StatCard label="No SKL Tergenerate"    value={stats.skl}   icon={<FileText className="w-5 h-5"/>} color="text-purple-600"/>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1"><SearchBar value={q} onChange={setQ} placeholder="Cari nama / NISN / NISM..."/></div>
        <Button variant="secondary" icon={<Download className="w-4 h-4"/>} onClick={handleDownloadTemplate}>Template</Button>
        <Button variant="secondary" icon={<Upload className="w-4 h-4"/>} loading={importLoading} onClick={handleImportExcel}>Import Excel</Button>
      </div>

      <Table columns={columns} data={data} keyFn={r => r.id} loading={loading}
        emptyText="Belum ada data siswa. Klik Tambah Siswa untuk memulai."/>

      {/* ── Modal Generate No SKL ── */}
      <Modal open={genModal} onClose={() => setGenModal(false)} title="Generate Nomor SKL Otomatis" size="md"
        footer={<>
          <Button variant="secondary" onClick={() => setGenModal(false)}>Batal</Button>
          <Button icon={<RefreshCw className="w-4 h-4"/>} loading={genLoading} onClick={handleGenerateSkl}>
            Generate untuk {data.length} Siswa
          </Button>
        </>}>
        <div className="flex flex-col gap-4">
          <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-800">
            <p className="font-semibold mb-1">Format No SKL:</p>
            <p className="font-mono text-xs bg-white rounded px-2 py-1.5 border border-blue-200">
              {KODE_JENJANG[sekolah?.jenjang||'MI']||'421.2'} / [No Urut] / [Kode Sekolah] / [Bulan Romawi] / [Tahun]
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label="Kode Sekolah (singkatan)" value={genOpts.kode_sekolah}
                onChange={e => setGenOpts(o => ({ ...o, kode_sekolah: e.target.value.toUpperCase() }))}
                placeholder="Contoh: MI.CONTOH"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Bulan</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={genOpts.bulan_romawi} onChange={e => setGenOpts(o => ({ ...o, bulan_romawi: e.target.value }))}>
                {BULAN_ROMAWI.map((b,i) => <option key={b} value={b}>{b} — {['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'][i]}</option>)}
              </select>
            </div>
            <Input label="Tahun" value={genOpts.tahun} onChange={e => setGenOpts(o => ({ ...o, tahun: e.target.value }))} placeholder="2025"/>
            <Input label="Nomor Urut Mulai" type="number" min="1" value={genOpts.mulai_dari}
              onChange={e => setGenOpts(o => ({ ...o, mulai_dari: e.target.value }))} placeholder="1"/>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Preview Nomor Pertama:</p>
            <p className="font-mono text-sm font-bold text-gray-800 bg-white border border-gray-200 rounded-lg px-3 py-2">{genPreview}</p>
            <p className="text-xs text-amber-600 mt-2 bg-amber-50 rounded px-2 py-1.5">⚠️ Ini akan menimpa semua No SKL yang sudah ada.</p>
          </div>
        </div>
      </Modal>

      {/* ── Modal Form Tambah / Edit ── */}
      <Modal open={modal.open} onClose={() => setModal(m => ({ ...m, open:false }))}
        title={modal.mode==='add' ? 'Tambah Siswa Baru' : `Edit: ${modal.form.nama||'Siswa'}`}
        size="xl"
        footer={<>
          <Button variant="secondary" onClick={() => setModal(m => ({ ...m, open:false }))}>Batal</Button>
          <Button loading={saving} onClick={handleSave}>Simpan Data</Button>
        </>}>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4 -mt-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={['px-4 py-2 text-sm font-semibold border-b-2 transition-colors',
                activeTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              ].join(' ')}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Data Pribadi */}
        {activeTab === 'identitas' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input label="Nama Lengkap *" value={modal.form.nama||''} onChange={e => set('nama',e.target.value)} error={errors.nama} placeholder="Nama lengkap sesuai akta lahir"/>
            </div>
            <Input label="No Urut *" type="number" value={modal.form.no_urut||''} onChange={e => set('no_urut',parseInt(e.target.value)||0)} error={errors.no_urut}/>
            <Select label="Jenis Kelamin" value={modal.form.jk||'Laki-laki'} onChange={e => set('jk',e.target.value)}
              options={[{value:'Laki-laki',label:'Laki-laki'},{value:'Perempuan',label:'Perempuan'}]}/>
            <Input label="Tempat Lahir" value={modal.form.tempat_lahir||''} onChange={e => set('tempat_lahir',e.target.value)} placeholder="Kota tempat lahir"/>
            <Input label="Tanggal Lahir" type="date" value={modal.form.tgl_lahir||''} onChange={e => set('tgl_lahir',e.target.value)}/>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Agama</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={modal.form.agama||'Islam'} onChange={e => set('agama',e.target.value)}>
                {AGAMA_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <Input label="Kewarganegaraan" value={modal.form.kewarganegaraan||'Indonesia'} onChange={e => set('kewarganegaraan',e.target.value)} placeholder="Indonesia"/>
            <Input label="Anak ke-" type="number" value={modal.form.anak_ke||''} onChange={e => set('anak_ke',e.target.value)} placeholder="1, 2, 3, ..."/>
            <Input label="Kelas" value={modal.form.kelas||''} onChange={e => set('kelas',e.target.value)} placeholder="Contoh: VI A"/>
            <Input label="Tahun Masuk" value={modal.form.tahun_masuk||''} onChange={e => set('tahun_masuk',e.target.value)} placeholder="2019"/>
            <Input label="Asal Sekolah (SD/MI)" value={modal.form.asal_sekolah||''} onChange={e => set('asal_sekolah',e.target.value)} placeholder="Nama SD/MI asal"/>
            <div className="col-span-2 border-t border-gray-100 pt-3 mt-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Orang Tua / Wali</p>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Nama Ayah / Wali" value={modal.form.ortu||''} onChange={e => set('ortu',e.target.value)} placeholder="Nama ayah atau wali"/>
                <Input label="Nama Ibu" value={modal.form.nama_ibu||''} onChange={e => set('nama_ibu',e.target.value)} placeholder="Nama ibu kandung"/>
                <Input label="No HP Orang Tua" value={modal.form.no_hp_ortu||''} onChange={e => set('no_hp_ortu',e.target.value)} placeholder="08xx-xxxx-xxxx"/>
                <div className="col-span-2">
                  <Input label="Alamat Lengkap" value={modal.form.alamat||''} onChange={e => set('alamat',e.target.value)} placeholder="Jl. ... RT/RW ... Desa/Kel ... Kec ..."/>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Dokumen & Nomor */}
        {activeTab === 'dokumen' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
              <p className="font-semibold mb-1">ℹ️ Nomor-nomor berikut akan muncul otomatis di dokumen yang sesuai</p>
              <p>NISN → semua dokumen &nbsp;·&nbsp; NISM → SKL, Transkrip &nbsp;·&nbsp; Blanko Ijazah → Ijazah &amp; Transkrip &nbsp;·&nbsp; No Peserta → SKL</p>
            </div>
            <Input label={<span className="flex items-center gap-1">NISN <InfoTooltip text="Wajib diisi — dipakai sebagai kunci pencocokan saat import nilai dari Excel." position="bottom" /></span>}  value={modal.form.nisn||''} onChange={e => set('nisn',e.target.value)} placeholder="Nomor Induk Siswa Nasional (10 digit)"/>
            <Input label={<span className="flex items-center gap-1">NISM <InfoTooltip text="Muncul di biodata dokumen Transkrip Nilai dan SKL." position="bottom" /></span>}  value={modal.form.nism||''} onChange={e => set('nism',e.target.value)} placeholder="Nomor Induk Siswa Madrasah"/>
            <Input label="No Peserta Ujian Sekolah" value={modal.form.no_peserta||''} onChange={e => set('no_peserta',e.target.value)} placeholder="No peserta ujian sekolah (di SKL)"/>

            <Input label="No Blanko Ijazah" value={modal.form.blanko||''} onChange={e => set('blanko',e.target.value)} placeholder="No seri blanko dari Kemendikbud — muncul di Ijazah & Transkrip"/>

            <div className="col-span-2">
              <Input label="Jenis Kekhususan" value={modal.form.jenis_kekhususan||''} onChange={e => set('jenis_kekhususan',e.target.value)} placeholder="Kosongkan jika tidak ada kekhususan"/>
            </div>
          </div>
        )}

        {/* Tab: Foto & SKL */}
        {activeTab === 'foto' && (
          <div className="flex flex-col gap-4">
            {/* No SKL */}
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Hash className="w-4 h-4 text-blue-500"/>
                <p className="text-sm font-semibold text-gray-700">Nomor SKL</p>
                <span className="text-xs text-gray-400">(bisa diisi manual atau gunakan Generate No SKL)</span>
              </div>

            </div>
            {/* Foto */}
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Camera className="w-4 h-4 text-purple-500"/>
                <p className="text-sm font-semibold text-gray-700">Foto Siswa</p>
                <span className="text-xs text-gray-400">Muncul otomatis di SKL (3×4 cm)</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-20 h-24 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {modal.form.foto
                    ? <img src={modal.form.foto} alt="foto" className="w-full h-full object-cover"/>
                    : <Camera className="w-8 h-8 text-gray-300"/>}
                </div>
                <div className="flex flex-col gap-2">
                  {modal.mode === 'edit' && (
                    <>
                      <button type="button" onClick={() => handleUploadFoto(modal.form.id)}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors">
                        <Upload className="w-3.5 h-3.5"/>
                        {modal.form.foto ? 'Ganti Foto' : 'Upload Foto'}
                      </button>
                      {modal.form.foto && (
                        <button type="button" onClick={async () => { await siswaApi.removeFoto(modal.form.id); set('foto',''); load() }}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                          <X className="w-3.5 h-3.5"/> Hapus Foto
                        </button>
                      )}
                    </>
                  )}
                  {modal.mode === 'add' && <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">Simpan data siswa dulu, lalu edit untuk upload foto.</p>}
                  <p className="text-xs text-gray-400">PNG/JPG, wajah jelas.<br/>Disarankan 3×4 cm.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={confirm.open} onConfirm={handleDelete} onCancel={() => setConfirm({ open:false, id:null, nama:'' })}
        title="Hapus Data Siswa" message={`Yakin hapus data "${confirm.nama}"? Semua nilai siswa ini juga akan terhapus.`} danger/>
    </div>
  )
}
