import { useState, useEffect, useCallback } from 'react'
import { UserPlus, Plus, Pencil, Trash2, Eye, X, CheckCircle, XCircle, Clock, Users, Search } from 'lucide-react'
import { Button, Modal, Input, Select, ConfirmDialog, SearchBar, PageHeader, Badge } from '../ui'
import { ppdbApi } from '../../lib/api'
import { clsx } from 'clsx'

const AGAMA_OPT = ['Islam','Kristen','Katolik','Hindu','Buddha','Konghucu'].map(v=>({value:v,label:v}))
const JK_OPT    = [{value:'L',label:'Laki-laki'},{value:'P',label:'Perempuan'}]
const STATUS_OPT = ['Daftar','Diterima','Cadangan','Ditolak'].map(v=>({value:v,label:v}))

const STATUS_COLOR: Record<string,string> = {
  Daftar:   'bg-yellow-100 text-yellow-800',
  Diterima: 'bg-green-100 text-green-800',
  Cadangan: 'bg-blue-100 text-blue-800',
  Ditolak:  'bg-red-100 text-red-800',
}
const STATUS_ICON: Record<string,any> = {
  Daftar:   <Clock className="w-3.5 h-3.5"/>,
  Diterima: <CheckCircle className="w-3.5 h-3.5"/>,
  Cadangan: <Users className="w-3.5 h-3.5"/>,
  Ditolak:  <XCircle className="w-3.5 h-3.5"/>,
}

const tglFmt = (t:string) => { try { return t?new Date(t).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'—' } catch { return t } }
const today = () => new Date().toISOString().slice(0,10)

const EMPTY: any = {
  no_pendaftaran:'', nama:'', jk:'L', tempat_lahir:'', tgl_lahir:'', agama:'Islam',
  asal_sekolah:'', nisn:'', nik:'', alamat:'', no_hp:'',
  nama_ayah:'', nama_ibu:'', pekerjaan_ayah:'', pekerjaan_ibu:'', no_hp_ortu:'',
  nilai_un:'', nilai_mtk:'', nilai_ipa:'', nilai_bindo:'', nilai_bing:'',
  status:'Daftar', gelombang:'', keterangan:''
}

// ─── Detail View ──────────────────────────────────────────────────────────────
function DetailView({ data, onClose, onEdit, onStatusChange, showToast }: any) {
  const [changingStatus, setChangingStatus] = useState(false)
  const [terimaLoading, setTerimaLoading] = useState(false)

  const handleStatusChange = async (status: string) => {
    setChangingStatus(true)
    await ppdbApi.updateStatus(data.id, status)
    showToast(`Status diubah ke ${status}`)
    setChangingStatus(false)
    onStatusChange()
  }

  const handleTerima = async () => {
    if (!confirm('Terima sebagai siswa? Data akan dimasukkan ke daftar siswa.')) return
    setTerimaLoading(true)
    const r: any = await ppdbApi.terimaJadiSiswa(data.id)
    if (r?.ok) { showToast('Siswa berhasil diterima dan dimasukkan ke data siswa'); onStatusChange() }
    else showToast(r?.error||'Gagal','error')
    setTerimaLoading(false)
  }

  const Row = ({l,v}:any) => <><dt className="text-xs text-gray-500">{l}</dt><dd className="text-sm font-medium text-gray-800">{v||'—'}</dd></>

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}/>
      <div className="relative ml-auto w-full max-w-xl bg-white h-full flex flex-col shadow-2xl">
        <div className={clsx('px-6 py-4 border-b text-white',
          data.status==='Diterima'?'bg-green-700':data.status==='Ditolak'?'bg-red-700':data.status==='Cadangan'?'bg-blue-700':'bg-yellow-600')}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-bold text-lg">{data.nama}</h2>
              <p className="text-white/80 text-sm">No. Daftar: {data.no_pendaftaran||'—'} · {tglFmt(data.tgl_daftar)}</p>
            </div>
            <div className="flex gap-2 items-center">
              <span className={clsx('px-2 py-0.5 rounded-full text-xs font-bold', STATUS_COLOR[data.status])}>{data.status}</span>
              <button onClick={onEdit} className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg"><Pencil className="w-4 h-4"/></button>
              <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg"><X className="w-5 h-5"/></button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Status actions */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Ubah Status</p>
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPT.map(s=>(
                <button key={s.value} onClick={()=>handleStatusChange(s.value)} disabled={changingStatus||data.status===s.value}
                  className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border',
                    data.status===s.value?STATUS_COLOR[s.value]+' border-current':'border-gray-200 text-gray-600 hover:border-gray-400 disabled:opacity-50')}>
                  {STATUS_ICON[s.value]}{s.label}
                </button>
              ))}
            </div>
            {data.status !== 'Diterima' && (
              <button onClick={handleTerima} disabled={terimaLoading}
                className="mt-2 flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 w-full justify-center">
                <CheckCircle className="w-4 h-4"/> {terimaLoading?'Memproses...':'Terima & Masukkan ke Data Siswa'}
              </button>
            )}
          </div>

          <div>
            <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2 pb-1 border-b border-blue-100">Identitas</h4>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              <Row l="Nama" v={data.nama}/>
              <Row l="Jenis Kelamin" v={data.jk==='L'?'Laki-laki':'Perempuan'}/>
              <Row l="NISN" v={data.nisn}/>
              <Row l="NIK" v={data.nik}/>
              <Row l="Tempat Lahir" v={data.tempat_lahir}/>
              <Row l="Tanggal Lahir" v={tglFmt(data.tgl_lahir)}/>
              <Row l="Agama" v={data.agama}/>
              <Row l="Asal Sekolah" v={data.asal_sekolah}/>
            </dl>
          </div>

          <div>
            <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2 pb-1 border-b border-blue-100">Kontak & Alamat</h4>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              <Row l="No. HP Siswa" v={data.no_hp}/>
              <Row l="No. HP Orang Tua" v={data.no_hp_ortu}/>
              <div className="col-span-2"><Row l="Alamat" v={data.alamat}/></div>
            </dl>
          </div>

          <div>
            <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2 pb-1 border-b border-blue-100">Orang Tua</h4>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              <Row l="Nama Ayah" v={data.nama_ayah}/>
              <Row l="Pekerjaan Ayah" v={data.pekerjaan_ayah}/>
              <Row l="Nama Ibu" v={data.nama_ibu}/>
              <Row l="Pekerjaan Ibu" v={data.pekerjaan_ibu}/>
            </dl>
          </div>

          {(data.nilai_un||data.nilai_mtk||data.nilai_ipa) && (
            <div>
              <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2 pb-1 border-b border-blue-100">Nilai Ujian Sekolah</h4>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                <Row l="Rata-rata UN" v={data.nilai_un}/>
                <Row l="Matematika" v={data.nilai_mtk}/>
                <Row l="IPA" v={data.nilai_ipa}/>
                <Row l="Bhs. Indonesia" v={data.nilai_bindo}/>
                <Row l="Bhs. Inggris" v={data.nilai_bing}/>
              </dl>
            </div>
          )}

          {(data.gelombang||data.keterangan) && (
            <div>
              <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2 pb-1 border-b border-blue-100">Info PPDB</h4>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                <Row l="Gelombang" v={data.gelombang}/>
                <Row l="Keterangan" v={data.keterangan}/>
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Form Modal ───────────────────────────────────────────────────────────────
function FormModal({ open, mode, form, setForm, onClose, onSave, saving, onGenerateNo }: any) {
  const set = (k:string,v:any) => setForm((f:any)=>({...f,[k]:v}))
  const F = ({label,k,type='text',placeholder=''}:any) => (
    <Input label={label} value={form[k]||''} onChange={v=>set(k,v)} type={type} placeholder={placeholder}/>
  )
  return (
    <Modal open={open} title={mode==='add'?'Tambah Pendaftar Baru':'Edit Data Pendaftar'} size="xl"
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Batal</Button><Button onClick={onSave} loading={saving}>Simpan</Button></>}>
      <div className="space-y-5">
        <div>
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3">Data Pendaftaran</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex gap-2 col-span-2">
              <div className="flex-1"><F label="No. Pendaftaran" k="no_pendaftaran" placeholder="Auto generate"/></div>
              {mode==='add' && <button onClick={onGenerateNo} className="mt-5 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-600 font-medium whitespace-nowrap">Generate</button>}
            </div>
            <Select label="Gelombang" value={form.gelombang||''} onChange={v=>set('gelombang',v)} options={[{value:'',label:'—'},{value:'I',label:'Gelombang I'},{value:'II',label:'Gelombang II'},{value:'III',label:'Gelombang III'}]}/>
            <Select label="Status" value={form.status||'Daftar'} onChange={v=>set('status',v)} options={STATUS_OPT}/>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3">Identitas Calon Siswa</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><F label="Nama Lengkap *" k="nama" placeholder="Sesuai akta kelahiran"/></div>
            <Select label="Jenis Kelamin" value={form.jk||'L'} onChange={v=>set('jk',v)} options={JK_OPT}/>
            <Select label="Agama" value={form.agama||'Islam'} onChange={v=>set('agama',v)} options={AGAMA_OPT}/>
            <F label="Tempat Lahir" k="tempat_lahir"/>
            <F label="Tanggal Lahir" k="tgl_lahir" type="date"/>
            <F label="NISN" k="nisn" placeholder="10 digit"/>
            <F label="NIK" k="nik" placeholder="16 digit"/>
            <div className="col-span-2"><F label="Asal Sekolah" k="asal_sekolah" placeholder="SDN ... / MIN ..."/></div>
            <div className="col-span-2"><F label="Alamat Lengkap" k="alamat"/></div>
            <F label="No. HP Siswa" k="no_hp"/>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3">Data Orang Tua</p>
          <div className="grid grid-cols-2 gap-3">
            <F label="Nama Ayah" k="nama_ayah"/>
            <F label="Pekerjaan Ayah" k="pekerjaan_ayah"/>
            <F label="Nama Ibu" k="nama_ibu"/>
            <F label="Pekerjaan Ibu" k="pekerjaan_ibu"/>
            <div className="col-span-2"><F label="No. HP Orang Tua" k="no_hp_ortu"/></div>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3">Nilai Ujian (opsional)</p>
          <div className="grid grid-cols-3 gap-3">
            <F label="Rata-rata UN" k="nilai_un" type="number"/>
            <F label="Matematika" k="nilai_mtk" type="number"/>
            <F label="IPA" k="nilai_ipa" type="number"/>
            <F label="Bhs. Indonesia" k="nilai_bindo" type="number"/>
            <F label="Bhs. Inggris" k="nilai_bing" type="number"/>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Keterangan</label>
          <textarea value={form.keterangan||''} onChange={e=>set('keterangan',e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none" rows={2}/>
        </div>
      </div>
    </Modal>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function PPDBPage({ showToast }: { showToast:(msg:string,type?:any)=>void }) {
  const [data, setData] = useState<any[]>([])
  const [stats, setStats] = useState<any>({total:0,daftar:0,diterima:0,ditolak:0,cadangan:0})
  const [q, setQ] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<{open:boolean;mode:'add'|'edit';form:any}>({open:false,mode:'add',form:{...EMPTY}})
  const [detail, setDetail] = useState<any>(null)
  const [confirm, setConfirm] = useState<{open:boolean;id:number|null;nama:string}>({open:false,id:null,nama:''})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [r, s] = await Promise.all([ppdbApi.list(q||undefined, filterStatus||undefined), ppdbApi.stats()])
    setData(Array.isArray(r)?r:[])
    setStats(s||{total:0,daftar:0,diterima:0,ditolak:0,cadangan:0})
    setLoading(false)
  }, [q, filterStatus])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!modal.form.nama?.trim()) { showToast('Nama wajib diisi','error'); return }
    setSaving(true)
    try {
      if (modal.mode==='add') await ppdbApi.add(modal.form)
      else await ppdbApi.update(modal.form.id, modal.form)
      setModal(m=>({...m,open:false}))
      showToast(modal.mode==='add'?'Pendaftar ditambahkan':'Data diperbarui')
      load()
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirm.id) return
    await ppdbApi.delete(confirm.id)
    setConfirm({open:false,id:null,nama:''})
    showToast('Data dihapus')
    load()
  }

  const handleGenerateNo = async () => {
    const r: any = await ppdbApi.generateNo()
    if (r) setModal(m=>({...m,form:{...m.form,no_pendaftaran:r}}))
  }

  const STAT_CARDS = [
    { label:'Total Daftar', value:stats.total, color:'bg-gray-100 text-gray-800', icon:'📋' },
    { label:'Menunggu', value:stats.daftar, color:'bg-yellow-100 text-yellow-800', icon:'⏳' },
    { label:'Diterima', value:stats.diterima, color:'bg-green-100 text-green-800', icon:'✅' },
    { label:'Cadangan', value:stats.cadangan, color:'bg-blue-100 text-blue-800', icon:'📌' },
    { label:'Ditolak', value:stats.ditolak, color:'bg-red-100 text-red-800', icon:'❌' },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="PPDB — Penerimaan Peserta Didik Baru" subtitle="Pendataan dan seleksi calon siswa baru"
        actions={<Button onClick={()=>setModal({open:true,mode:'add',form:{...EMPTY}})} icon={<Plus className="w-4 h-4"/>}>Tambah Pendaftar</Button>}
      />

      {/* Stat cards */}
      <div className="flex gap-3 flex-wrap">
        {STAT_CARDS.map(s=>(
          <button key={s.label} onClick={()=>setFilterStatus(s.label==='Total Daftar'?'':s.label==='Menunggu'?'Daftar':s.label)}
            className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-semibold text-sm transition-all',
              s.color,
              filterStatus===(s.label==='Menunggu'?'Daftar':s.label==='Total Daftar'?'':s.label)?'border-current shadow-md scale-105':'border-transparent hover:border-current')}>
            <span>{s.icon}</span>
            <span>{s.value}</span>
            <span className="font-normal text-xs">{s.label}</span>
          </button>
        ))}
        {filterStatus && <button onClick={()=>setFilterStatus('')} className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl">✕ Reset</button>}
      </div>

      {/* Search */}
      <div className="max-w-sm">
        <SearchBar value={q} onChange={setQ} placeholder="Cari nama, NISN, no. daftar..."/>
      </div>

      {/* Tabel */}
      {loading
        ? <div className="text-center py-12 text-gray-400">Memuat...</div>
        : data.length === 0
          ? (
            <div className="text-center py-16 text-gray-400">
              <UserPlus className="w-12 h-12 mx-auto mb-3 opacity-30"/>
              <p className="font-semibold">Belum ada pendaftar</p>
              <p className="text-sm mt-1">{filterStatus?'Tidak ada dengan status ini':'Klik Tambah Pendaftar untuk mulai'}</p>
            </div>
          )
          : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['No','No. Daftar','Nama Calon Siswa','L/P','Asal Sekolah','Tgl Daftar','Gelombang','Status','Aksi'].map(h=>(
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.map((d:any,i:number)=>(
                    <tr key={d.id} onClick={()=>setDetail(d)}
                      className={clsx('hover:bg-blue-50 cursor-pointer',i%2===0?'bg-white':'bg-gray-50/40')}>
                      <td className="px-3 py-2.5 text-gray-400 text-center">{i+1}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-600">{d.no_pendaftaran||'—'}</td>
                      <td className="px-3 py-2.5 font-semibold text-gray-900">{d.nama}</td>
                      <td className="px-3 py-2.5">
                        <span className={clsx('text-xs font-bold',d.jk==='P'?'text-pink-600':'text-blue-600')}>{d.jk}</span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 text-xs">{d.asal_sekolah||'—'}</td>
                      <td className="px-3 py-2.5 text-gray-600 text-xs">{tglFmt(d.tgl_daftar)}</td>
                      <td className="px-3 py-2.5 text-gray-600 text-xs text-center">{d.gelombang||'—'}</td>
                      <td className="px-3 py-2.5">
                        <span className={clsx('flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold w-fit', STATUS_COLOR[d.status])}>
                          {STATUS_ICON[d.status]}{d.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5" onClick={e=>e.stopPropagation()}>
                        <div className="flex gap-1">
                          <button onClick={()=>setDetail(d)} className="p-1.5 hover:bg-blue-100 rounded-lg"><Eye className="w-3.5 h-3.5 text-blue-500"/></button>
                          <button onClick={()=>setModal({open:true,mode:'edit',form:{...d}})} className="p-1.5 hover:bg-gray-100 rounded-lg"><Pencil className="w-3.5 h-3.5 text-gray-500"/></button>
                          <button onClick={()=>setConfirm({open:true,id:d.id,nama:d.nama})} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400"/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-500">
                {data.length} pendaftar ditampilkan
              </div>
            </div>
          )
      }

      <FormModal open={modal.open} mode={modal.mode} form={modal.form}
        setForm={(fn:any)=>setModal(m=>({...m,form:typeof fn==='function'?fn(m.form):fn}))}
        onClose={()=>setModal(m=>({...m,open:false}))}
        onSave={handleSave} saving={saving} onGenerateNo={handleGenerateNo}/>

      {detail && (
        <DetailView data={detail} onClose={()=>setDetail(null)} showToast={showToast}
          onEdit={()=>{ setModal({open:true,mode:'edit',form:{...detail}}); setDetail(null) }}
          onStatusChange={()=>{ load(); setDetail(null) }}/>
      )}

      <ConfirmDialog open={confirm.open} title="Hapus Data Pendaftar" danger
        message={`Hapus data pendaftar "${confirm.nama}"?`}
        onConfirm={handleDelete} onCancel={()=>setConfirm({open:false,id:null,nama:''})}/>
    </div>
  )
}
