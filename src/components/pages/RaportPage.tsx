import { useState, useEffect, useCallback, useRef } from 'react'
import {
  BookOpen, Plus, Pencil, Trash2, Save, ChevronLeft,
  Settings, Users, Table, FileSpreadsheet, RefreshCw,
  CheckCircle, AlertCircle, Download, GraduationCap
} from 'lucide-react'
import { Button, Modal, Input, Select, ConfirmDialog, PageHeader, Badge, SearchBar, TextInput, DropDown } from '../ui'
import { raportApi, angkatanApi, pdfCetakApi } from '../../lib/api'
import { clsx } from 'clsx'

type Tab = 'periode'|'mapel'|'siswa'|'input-nilai'|'rekap'

const SEM_OPT   = ['Ganjil','Genap'].map(v=>({value:v,label:v}))
const KEL_OPT   = ['A','B','C','Mulok','Pengembangan Diri'].map(v=>({value:v,label:`Kelompok ${v}`}))
const PREDIKAT_COLOR: Record<string,string> = { A:'text-green-700 font-bold', 'B+':'text-blue-700 font-semibold', B:'text-blue-600', 'C+':'text-yellow-700', C:'text-orange-600', D:'text-red-600 font-bold' }

const fmtNilai = (v:any) => (v===null||v===undefined||v==='')?'':Number(v).toFixed(0)
const avg = (arr:number[]) => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length*10)/10 : null

// ─── Periode Form ─────────────────────────────────────────────────────────────
const EMPTY_PERIODE = { label:'', tahun_ajaran:'', semester:'Ganjil', angkatan_id:'', is_aktif:false, tgl_mulai:'', tgl_selesai:'', bobot_uh:40, bobot_uts:25, bobot_pas:30, bobot_hadir:5, jumlah_hari_efektif:0 }

// ─── Tab: Periode ─────────────────────────────────────────────────────────────
function TabPeriode({ periodeList, angkatanList, onReload, showToast, onOpen }: any) {
  const [modal, setModal] = useState<{open:boolean;mode:'add'|'edit';form:any}>({open:false,mode:'add',form:{...EMPTY_PERIODE}})
  const [confirm, setConfirm] = useState<{open:boolean;id:number|null;nama:string}>({open:false,id:null,nama:''})
  const [saving, setSaving] = useState(false)

  const totalBobot = (modal.form.bobot_uh||0)+(modal.form.bobot_uts||0)+(modal.form.bobot_pas||0)+(modal.form.bobot_hadir||0)

  const handleSave = async () => {
    if (!modal.form.label?.trim()) { showToast('Label wajib diisi','error'); return }
    if (totalBobot !== 100) { showToast(`Total bobot harus 100% (sekarang ${totalBobot}%)`,'error'); return }
    setSaving(true)
    try {
      const d = { ...modal.form, angkatan_id: modal.form.angkatan_id ? Number(modal.form.angkatan_id) : null }
      if (modal.mode==='add') await raportApi.periodeAdd(d)
      else await raportApi.periodeUpdate(modal.form.id, d)
      setModal(m=>({...m,open:false}))
      showToast(modal.mode==='add'?'Periode ditambahkan':'Periode diperbarui')
      onReload()
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirm.id) return
    await raportApi.periodeDelete(confirm.id)
    setConfirm({open:false,id:null,nama:''})
    showToast('Periode dihapus beserta seluruh data nilai')
    onReload()
  }

  const angOpt = [{value:'',label:'— Semua Siswa —'},...angkatanList.map((a:any)=>({value:String(a.id),label:a.nama}))]
  const set = (k:string,v:any) => setModal(m=>({...m,form:{...m.form,[k]:v}}))

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={()=>setModal({open:true,mode:'add',form:{...EMPTY_PERIODE}})} icon={<Plus className="w-4 h-4"/>}>Buat Periode Raport</Button>
      </div>

      {periodeList.length===0
        ? <div className="text-center py-20 text-gray-400"><BookOpen className="w-16 h-16 mx-auto mb-4 opacity-20"/><p className="font-semibold">Belum ada periode raport</p><p className="text-sm mt-1">Buat periode untuk semester yang akan dinilai</p></div>
        : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {periodeList.map((p:any) => (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                <div className={clsx('px-5 py-4 text-white', p.is_aktif ? 'bg-gradient-to-r from-blue-700 to-blue-500' : 'bg-gradient-to-r from-gray-600 to-gray-500')}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-lg leading-tight">{p.label}</h3>
                      <p className="text-white/80 text-sm">{p.tahun_ajaran} · Semester {p.semester}</p>
                    </div>
                    {p.is_aktif && <span className="bg-green-400 text-green-900 text-xs font-bold px-2 py-0.5 rounded-full">AKTIF</span>}
                  </div>
                </div>
                <div className="px-5 py-3 space-y-1.5 text-sm">
                  <div className="flex items-center gap-2"><span className="text-gray-400 text-xs w-24">Angkatan</span><span className="font-medium">{p.nama_angkatan||'Semua Siswa'}</span></div>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {[['UH',p.bobot_uh],['UTS',p.bobot_uts],['PAS',p.bobot_pas],['Hadir',p.bobot_hadir]].map(([l,v])=>(
                      <span key={l} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">{l}: {v}%</span>
                    ))}
                  </div>
                  {p.jumlah_hari_efektif > 0 && <div className="flex items-center gap-2"><span className="text-gray-400 text-xs w-24">Hari Efektif</span><span className="font-medium">{p.jumlah_hari_efektif} hari</span></div>}
                </div>
                <div className="px-4 pb-4 flex gap-2">
                  <button onClick={()=>onOpen(p)} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
                    <BookOpen className="w-4 h-4"/> Buka & Kelola
                  </button>
                  <button onClick={()=>setModal({open:true,mode:'edit',form:{...p,angkatan_id:p.angkatan_id||''}})} className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50">
                    <Pencil className="w-4 h-4 text-gray-500"/>
                  </button>
                  <button onClick={()=>setConfirm({open:true,id:p.id,nama:p.label})} className="p-2.5 rounded-xl border border-red-100 hover:bg-red-50">
                    <Trash2 className="w-4 h-4 text-red-400"/>
                  </button>
                </div>
              </div>
            ))}
          </div>
      }

      <Modal open={modal.open} title={modal.mode==='add'?'Buat Periode Raport':'Edit Periode Raport'}
        onClose={()=>setModal(m=>({...m,open:false}))}
        footer={<><Button variant="ghost" onClick={()=>setModal(m=>({...m,open:false}))}>Batal</Button><Button onClick={handleSave} loading={saving}>Simpan</Button></>}>
        <div className="space-y-3">
          <TextInput label="Label Periode *" value={modal.form.label||''} onChange={v=>set('label',v)} placeholder="Raport Semester Ganjil 2024/2025"/>
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Tahun Ajaran" value={modal.form.tahun_ajaran||''} onChange={v=>set('tahun_ajaran',v)} placeholder="2024/2025"/>
            <DropDown label="Semester" value={modal.form.semester||'Ganjil'} onChange={v=>set('semester',v)} options={SEM_OPT}/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Tanggal Mulai" value={modal.form.tgl_mulai||''} onChange={v=>set('tgl_mulai',v)} type="date"/>
            <TextInput label="Tanggal Selesai" value={modal.form.tgl_selesai||''} onChange={v=>set('tgl_selesai',v)} type="date"/>
          </div>
          <TextInput label="Jumlah Hari Efektif (untuk hitung % kehadiran)" value={String(modal.form.jumlah_hari_efektif||0)} onChange={v=>set('jumlah_hari_efektif',Number(v))} type="number"/>
          <DropDown label="Angkatan" value={String(modal.form.angkatan_id||'')} onChange={v=>set('angkatan_id',v)} options={angOpt}/>

          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-xs font-bold text-blue-700 mb-2">Bobot Penilaian (harus total 100%)</p>
            <div className="grid grid-cols-2 gap-2">
              {[['Ulangan Harian (UH)','bobot_uh'],['Ulangan Tengah Semester (UTS)','bobot_uts'],['Penilaian Akhir Semester (PAS)','bobot_pas'],['Kehadiran','bobot_hadir']].map(([l,k])=>(
                <div key={k}>
                  <label className="text-xs text-gray-600 mb-0.5 block">{l}</label>
                  <div className="flex items-center gap-1">
                    <input type="number" min="0" max="100" value={modal.form[k]??0} onChange={e=>set(k,Number(e.target.value))}
                      className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center focus:ring-2 focus:ring-blue-500 outline-none"/>
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className={clsx('mt-2 text-sm font-bold', totalBobot===100?'text-green-700':'text-red-600')}>
              Total: {totalBobot}% {totalBobot===100?'✓':'⚠ Harus 100%'}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!modal.form.is_aktif} onChange={e=>set('is_aktif',e.target.checked)} className="w-4 h-4 text-blue-600"/>
            <span className="text-sm font-medium text-gray-700">Tandai sebagai periode aktif</span>
          </label>
        </div>
      </Modal>

      <ConfirmDialog open={confirm.open} title="Hapus Periode Raport" danger
        message={`Hapus periode "${confirm.nama}"? Semua data nilai raport akan ikut terhapus permanen.`}
        onConfirm={handleDelete} onCancel={()=>setConfirm({open:false,id:null,nama:''})}/>
    </div>
  )
}

// ─── Tab: Mapel ───────────────────────────────────────────────────────────────
function TabMapel({ periode, onReload, showToast }: any) {
  const [mapelList, setMapelList] = useState<any[]>([])
  const [modal, setModal] = useState<{open:boolean;form:any}>({open:false,form:{}})
  const [confirm, setConfirm] = useState<{open:boolean;id:number|null;nama:string}>({open:false,id:null,nama:''})
  const [saving, setSaving] = useState(false)

  const EMPTY_MAPEL = { nama:'', kelompok:'A', urutan:1, guru:'', kkm:75, jumlah_bab:3, periode_id:periode.id }

  const load = useCallback(async ()=>{
    const r = await raportApi.mapelList(periode.id)
    setMapelList(Array.isArray(r)?r:[])
  },[periode.id])

  useEffect(()=>{ load() },[load])

  const handleSave = async () => {
    if (!modal.form.nama?.trim()) { showToast('Nama mapel wajib diisi','error'); return }
    setSaving(true)
    await raportApi.mapelSave({ ...modal.form, periode_id: periode.id })
    setModal(m=>({...m,open:false}))
    showToast(modal.form.id?'Mapel diperbarui':'Mapel ditambahkan')
    load()
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!confirm.id) return
    await raportApi.mapelDelete(confirm.id)
    setConfirm({open:false,id:null,nama:''})
    showToast('Mapel dihapus')
    load()
  }

  const set = (k:string,v:any) => setModal(m=>({...m,form:{...m.form,[k]:v}}))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{mapelList.length} mata pelajaran</p>
        <Button onClick={()=>setModal({open:true,form:{...EMPTY_MAPEL}})} icon={<Plus className="w-4 h-4"/>}>Tambah Mapel</Button>
      </div>

      {mapelList.length===0
        ? <div className="text-center py-12 text-gray-400"><Table className="w-12 h-12 mx-auto mb-3 opacity-30"/><p>Belum ada mata pelajaran untuk periode ini</p></div>
        : <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['No','Nama Mapel','Kelompok','Guru','KKM','Jml Bab','Urutan','Aksi'].map(h=><th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {mapelList.map((m:any,i:number)=>(
                  <tr key={m.id} className={i%2===0?'bg-white':'bg-gray-50/40'}>
                    <td className="px-3 py-2.5 text-gray-400 text-center">{i+1}</td>
                    <td className="px-3 py-2.5 font-semibold text-gray-900">{m.nama}</td>
                    <td className="px-3 py-2.5"><Badge color="blue">Kel. {m.kelompok}</Badge></td>
                    <td className="px-3 py-2.5 text-gray-600">{m.guru||'—'}</td>
                    <td className="px-3 py-2.5 text-center font-medium">{m.kkm}</td>
                    <td className="px-3 py-2.5 text-center text-gray-600">{m.jumlah_bab} bab</td>
                    <td className="px-3 py-2.5 text-center text-gray-500">{m.urutan}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        <button onClick={()=>setModal({open:true,form:{...m}})} className="p-1.5 hover:bg-gray-100 rounded-lg"><Pencil className="w-3.5 h-3.5 text-gray-500"/></button>
                        <button onClick={()=>setConfirm({open:true,id:m.id,nama:m.nama})} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400"/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      }

      <Modal open={modal.open} title={modal.form.id?'Edit Mata Pelajaran':'Tambah Mata Pelajaran'}
        onClose={()=>setModal(m=>({...m,open:false}))}
        footer={<><Button variant="ghost" onClick={()=>setModal(m=>({...m,open:false}))}>Batal</Button><Button onClick={handleSave} loading={saving}>Simpan</Button></>}>
        <div className="space-y-3">
          <TextInput label="Nama Mata Pelajaran *" value={modal.form.nama||''} onChange={v=>set('nama',v)} placeholder="Matematika"/>
          <TextInput label="Nama Guru Pengampu" value={modal.form.guru||''} onChange={v=>set('guru',v)} placeholder="Nama guru"/>
          <div className="grid grid-cols-2 gap-3">
            <DropDown label="Kelompok" value={modal.form.kelompok||'A'} onChange={v=>set('kelompok',v)} options={KEL_OPT}/>
            <TextInput label="KKM" value={String(modal.form.kkm||75)} onChange={v=>set('kkm',Number(v))} type="number"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Jumlah Bab (1–6)</label>
              <input type="range" min="1" max="6" value={modal.form.jumlah_bab||3} onChange={e=>set('jumlah_bab',Number(e.target.value))}
                className="w-full accent-blue-600"/>
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                {[1,2,3,4,5,6].map(n=><span key={n} className={modal.form.jumlah_bab===n?'text-blue-700 font-bold':''}>{n}</span>)}
              </div>
              <p className="text-xs text-blue-700 font-semibold mt-1">{modal.form.jumlah_bab||3} bab → {modal.form.jumlah_bab||3} kolom UH</p>
            </div>
            <TextInput label="Urutan Tampil" value={String(modal.form.urutan||99)} onChange={v=>set('urutan',Number(v))} type="number"/>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={confirm.open} title="Hapus Mata Pelajaran" danger
        message={`Hapus "${confirm.nama}"? Semua nilai mapel ini akan ikut terhapus.`}
        onConfirm={handleDelete} onCancel={()=>setConfirm({open:false,id:null,nama:''})}/>
    </div>
  )
}

// ─── Tab: Siswa (kehadiran per siswa) ─────────────────────────────────────────
function TabSiswaRaport({ periode, showToast }: any) {
  const [siswaList, setSiswaList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [changed, setChanged] = useState<Set<number>>(new Set())

  const load = useCallback(async ()=>{
    setLoading(true)
    const r = await raportApi.siswaList(periode.id)
    setSiswaList(Array.isArray(r)?r:[])
    setLoading(false)
  },[periode.id])

  useEffect(()=>{ load() },[load])

  const setField = (id:number, key:string, val:any) => {
    setSiswaList(prev=>prev.map(s=>s.id===id?{...s,[key]:val}:s))
    setChanged(prev=>new Set(prev).add(id))
  }

  const handleSaveAll = async () => {
    setSaving(true)
    const toSave = siswaList.filter(s=>changed.has(s.id))
    for (const s of toSave) {
      await raportApi.siswaSave(periode.id, s.id, { kelas:s.kelas, no_absen:s.no_absen, hadir:s.hadir, sakit:s.sakit, izin:s.izin, alpha:s.alpha, catatan_wali:s.catatan_wali })
    }
    setChanged(new Set())
    showToast(`${toSave.length} data kehadiran disimpan`)
    setSaving(false)
  }

  const totalHadir = siswaList.reduce((a,s)=>a+(s.hadir||0),0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-3 text-sm text-gray-600">
          <span>{siswaList.length} siswa</span>
          {changed.size>0 && <span className="text-amber-600 font-medium">⚠ {changed.size} belum disimpan</span>}
        </div>
        <div className="flex-1"/>
        <Button onClick={handleSaveAll} loading={saving} icon={<Save className="w-4 h-4"/>}>Simpan Semua</Button>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs text-amber-800">
        💡 Isi kehadiran siswa di sini. Persentase kehadiran dihitung otomatis dari: <strong>Hadir ÷ {periode.jumlah_hari_efektif||'?'} hari efektif × 100</strong>. Pastikan jumlah hari efektif sudah diatur di pengaturan periode.
      </div>

      {loading ? <div className="text-center py-8 text-gray-400">Memuat...</div>
        : <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['No Abs','Nama Siswa','Kelas','Hadir','Sakit','Izin','Alpha','Total Absen','% Hadir','Catatan Wali Kelas'].map(h=>(
                    <th key={h} className="px-2 py-2.5 text-center text-xs font-semibold text-gray-500 first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {siswaList.map((s:any,i:number)=>{
                  const totalAbsen = (s.sakit||0)+(s.izin||0)+(s.alpha||0)
                  const pct = periode.jumlah_hari_efektif > 0 ? Math.round(((s.hadir||0)/periode.jumlah_hari_efektif)*100) : 0
                  const isDirty = changed.has(s.id)
                  return (
                    <tr key={s.id} className={clsx(i%2===0?'bg-white':'bg-gray-50/40', isDirty&&'bg-amber-50/60')}>
                      <td className="px-2 py-1.5">
                        <input type="number" value={s.no_absen||i+1} onChange={e=>setField(s.id,'no_absen',Number(e.target.value))}
                          className="w-12 border border-gray-200 rounded px-1 py-0.5 text-xs text-center"/>
                      </td>
                      <td className="px-3 py-1.5 font-medium text-gray-800 whitespace-nowrap">{s.nama}</td>
                      <td className="px-2 py-1.5">
                        <input value={s.kelas||''} onChange={e=>setField(s.id,'kelas',e.target.value)}
                          className="w-20 border border-gray-200 rounded px-1 py-0.5 text-xs" placeholder="VII A"/>
                      </td>
                      {['hadir','sakit','izin','alpha'].map(k=>(
                        <td key={k} className="px-1 py-1.5 text-center">
                          <input type="number" min="0" value={s[k]||0} onChange={e=>setField(s.id,k,Number(e.target.value))}
                            className={clsx('w-14 border rounded px-1 py-0.5 text-xs text-center',
                              k==='hadir'?'border-green-200 bg-green-50':k==='alpha'?'border-red-200 bg-red-50':'border-gray-200')}/>
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-center text-sm font-medium">{totalAbsen}</td>
                      <td className="px-2 py-1.5 text-center">
                        <span className={clsx('text-xs font-bold', pct>=80?'text-green-700':pct>=60?'text-yellow-700':'text-red-600')}>{pct}%</span>
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={s.catatan_wali||''} onChange={e=>setField(s.id,'catatan_wali',e.target.value)}
                          className="w-full border border-gray-200 rounded px-1 py-0.5 text-xs" placeholder="Opsional"/>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
      }
    </div>
  )
}

// ─── Tab: Input Nilai ─────────────────────────────────────────────────────────
function TabInputNilai({ periode, showToast }: any) {
  const [mapelList, setMapelList] = useState<any[]>([])
  const [siswaList, setSiswaList] = useState<any[]>([])
  const [selMapel, setSelMapel] = useState<any>(null)
  const [nilaiRows, setNilaiRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(()=>{
    raportApi.mapelList(periode.id).then((r:any)=>{ const m = Array.isArray(r)?r:[]; setMapelList(m); if(m.length>0&&!selMapel) setSelMapel(m[0]) })
    raportApi.siswaList(periode.id).then((r:any)=>setSiswaList(Array.isArray(r)?r:[]))
  },[periode.id])

  useEffect(()=>{ if(selMapel) loadNilai() },[selMapel])

  const loadNilai = async () => {
    if (!selMapel) return
    setLoading(true)
    setDirty(false)
    // Get all nilai for this mapel
    const nilaiAll:any[] = []
    for (const s of siswaList) {
      const r:any = await raportApi.nilaiGet(periode.id, s.id)
      const n = Array.isArray(r) ? r.find((x:any)=>x.mapel_id===selMapel.id) : null
      nilaiAll.push({ siswa_id:s.id, nama:s.nama, jk:s.jk, no_absen:s.no_absen||(siswaList.indexOf(s)+1),
        uh1:n?.uh1??'', uh2:n?.uh2??'', uh3:n?.uh3??'', uh4:n?.uh4??'', uh5:n?.uh5??'', uh6:n?.uh6??'',
        uts:n?.uts??'', pas:n?.pas??'', nilai_akhir:n?.nilai_akhir??null, predikat:n?.predikat??'' })
    }
    setNilaiRows(nilaiAll)
    setLoading(false)
  }

  // Reload nilai setelah siswa dimuat
  useEffect(()=>{ if(selMapel&&siswaList.length>0) loadNilai() },[siswaList.length, selMapel?.id])

  const setNilai = (siswaId:number, key:string, val:string) => {
    setNilaiRows(prev=>prev.map(r=>r.siswa_id===siswaId?{...r,[key]:val}:r))
    setDirty(true)
  }

  const handleSave = async () => {
    if (!selMapel) return
    setSaving(true)
    const rows = nilaiRows.map(r=>({
      siswa_id:r.siswa_id,
      uh1:r.uh1!==''?Number(r.uh1):null, uh2:r.uh2!==''?Number(r.uh2):null,
      uh3:r.uh3!==''?Number(r.uh3):null, uh4:r.uh4!==''?Number(r.uh4):null,
      uh5:r.uh5!==''?Number(r.uh5):null, uh6:r.uh6!==''?Number(r.uh6):null,
      uts:r.uts!==''?Number(r.uts):null, pas:r.pas!==''?Number(r.pas):null,
      deskripsi:r.deskripsi||''
    }))
    await raportApi.nilaiBulk(periode.id, selMapel.id, rows)
    setDirty(false)
    showToast(`Nilai ${selMapel.nama} disimpan`)
    loadNilai()
    setSaving(false)
  }

  // Kolom UH sesuai jumlah_bab
  const uhCols = selMapel ? Array.from({length:selMapel.jumlah_bab||3},(_,i)=>i+1) : []

  // Rata-rata kelas
  const avgKelas = nilaiRows.filter(r=>r.nilai_akhir!==null).map(r=>r.nilai_akhir)
  const rataKelas = avgKelas.length ? Math.round(avgKelas.reduce((a,b)=>a+b,0)/avgKelas.length*10)/10 : null

  const NInput = ({row,k}:{row:any,k:string}) => (
    <input type="number" min="0" max="100" step="0.5"
      value={row[k]} onChange={e=>setNilai(row.siswa_id,k,e.target.value)}
      onFocus={e=>e.target.select()}
      className="w-full border-0 bg-transparent text-center text-sm outline-none focus:bg-blue-50 rounded px-0.5 py-1"/>
  )

  if (mapelList.length===0) return (
    <div className="text-center py-16 text-gray-400"><AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30"/><p>Belum ada mata pelajaran.<br/>Tambahkan di tab Mata Pelajaran.</p></div>
  )

  return (
    <div className="space-y-4">
      {/* Pilih mapel */}
      <div className="flex gap-2 flex-wrap">
        {mapelList.map((m:any)=>(
          <button key={m.id} onClick={()=>{ if(dirty&&!confirm('Ada perubahan yang belum disimpan. Pindah mapel?')) return; setSelMapel(m) }}
            className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
              selMapel?.id===m.id?'bg-blue-600 text-white border-blue-600 shadow-md':'border-gray-200 text-gray-700 hover:border-blue-400')}>
            {m.nama}
            {m.guru && <span className="block text-xs opacity-70">{m.guru}</span>}
          </button>
        ))}
      </div>

      {selMapel && (
        <>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1">
              <p className="font-semibold text-gray-800">{selMapel.nama}</p>
              <p className="text-xs text-gray-500">
                Guru: {selMapel.guru||'—'} · KKM: {selMapel.kkm} · Bobot: UH {periode.bobot_uh}% + UTS {periode.bobot_uts}% + PAS {periode.bobot_pas}% + Hadir {periode.bobot_hadir}%
              </p>
            </div>
            {rataKelas !== null && (
              <div className="text-right">
                <p className="text-xs text-gray-500">Rata-rata Kelas</p>
                <p className={clsx('text-xl font-bold', rataKelas>=selMapel.kkm?'text-green-700':'text-red-600')}>{rataKelas}</p>
              </div>
            )}
            <Button onClick={handleSave} loading={saving} icon={<Save className="w-4 h-4"/>}>
              {dirty?'Simpan *':'Simpan'}
            </Button>
          </div>

          {loading ? <div className="text-center py-8 text-gray-400">Memuat...</div>
            : <div className="overflow-auto rounded-xl border border-gray-200 bg-white">
                <table className="text-sm border-collapse w-full">
                  <thead>
                    <tr className="bg-gray-800 text-white">
                      <th className="px-2 py-2 text-center w-8 sticky left-0 bg-gray-800 z-10">No</th>
                      <th className="px-3 py-2 text-left sticky left-8 bg-gray-800 z-10 min-w-[140px]">Nama Siswa</th>
                      {uhCols.map(n=>(
                        <th key={n} className="px-1 py-1 text-center min-w-[52px] border-l border-gray-600">
                          <div className="text-xs font-bold">UH {n}</div>
                          <div className="text-[10px] text-gray-300">Bab {n}</div>
                        </th>
                      ))}
                      <th className="px-1 py-1 text-center min-w-[52px] border-l border-gray-500 bg-yellow-900/40">
                        <div className="text-xs font-bold">Avg UH</div>
                      </th>
                      <th className="px-1 py-1 text-center min-w-[52px] border-l border-gray-500 bg-blue-900/40">
                        <div className="text-xs font-bold">UTS</div>
                        <div className="text-[10px] text-gray-300">{periode.bobot_uts}%</div>
                      </th>
                      <th className="px-1 py-1 text-center min-w-[52px] border-l border-gray-500 bg-purple-900/40">
                        <div className="text-xs font-bold">PAS</div>
                        <div className="text-[10px] text-gray-300">{periode.bobot_pas}%</div>
                      </th>
                      <th className="px-1 py-1 text-center min-w-[60px] border-l border-gray-400 bg-green-900/40">
                        <div className="text-xs font-bold">Nilai Akhir</div>
                      </th>
                      <th className="px-1 py-1 text-center w-10 border-l border-gray-400">P</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {nilaiRows.map((r:any,i:number)=>{
                      const uhs = uhCols.map(n=>r[`uh${n}`]).filter(v=>v!==''&&v!==null&&v!==undefined).map(Number)
                      const avgUH = uhs.length ? Math.round(avg(uhs)!*10)/10 : null
                      const na = r.nilai_akhir
                      const isBelow = na!==null && na < selMapel.kkm
                      return (
                        <tr key={r.siswa_id} className={clsx(i%2===0?'bg-white':'bg-gray-50/50', isBelow&&'bg-red-50/40')}>
                          <td className="px-2 py-1 text-center text-gray-400 text-xs sticky left-0 bg-inherit z-10">{r.no_absen}</td>
                          <td className="px-3 py-1 font-medium text-gray-800 sticky left-8 bg-inherit z-10 whitespace-nowrap text-xs">{r.nama}</td>
                          {uhCols.map(n=>(
                            <td key={n} className="border-l border-gray-100 p-0">
                              <NInput row={r} k={`uh${n}`}/>
                            </td>
                          ))}
                          <td className="border-l border-gray-200 px-1 py-1 text-center">
                            <span className="text-xs font-semibold text-yellow-700">{avgUH??'—'}</span>
                          </td>
                          <td className="border-l border-gray-200 p-0 bg-blue-50/20">
                            <NInput row={r} k="uts"/>
                          </td>
                          <td className="border-l border-gray-200 p-0 bg-purple-50/20">
                            <NInput row={r} k="pas"/>
                          </td>
                          <td className={clsx('border-l border-gray-200 px-1 py-1 text-center', isBelow?'bg-red-100':'bg-green-50/40')}>
                            <span className={clsx('text-sm font-bold', na===null?'text-gray-300':isBelow?'text-red-700':'text-green-700')}>{na??'—'}</span>
                          </td>
                          <td className="border-l border-gray-200 px-1 py-1 text-center">
                            <span className={clsx('text-xs', r.predikat ? PREDIKAT_COLOR[r.predikat]||'text-gray-600':'text-gray-300')}>{r.predikat||'—'}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-gray-800 text-white">
                    <tr>
                      <td className="px-2 py-2 text-center sticky left-0 bg-gray-800 z-10" colSpan={2}>
                        <span className="text-xs font-bold">Rata-rata Kelas</span>
                      </td>
                      {uhCols.map(n=>{
                        const vals = nilaiRows.map(r=>r[`uh${n}`]).filter(v=>v!==''&&v!=null).map(Number)
                        const a = vals.length?Math.round(avg(vals)!*10)/10:null
                        return <td key={n} className="px-1 py-2 text-center text-xs font-bold border-l border-gray-600">{a??'—'}</td>
                      })}
                      <td className="px-1 py-2 text-center text-xs border-l border-gray-500">
                        {(()=>{const vs=nilaiRows.map(r=>uhCols.map(n=>r[`uh${n}`]).filter((v:any)=>v!==''&&v!=null).map(Number)).map(uhs=>uhs.length?avg(uhs):null).filter(v=>v!==null) as number[];return vs.length?Math.round(avg(vs)!*10)/10:'—'})()}
                      </td>
                      <td className="px-1 py-2 text-center text-xs border-l border-gray-500">
                        {(()=>{const vs=nilaiRows.map(r=>r.uts).filter((v:any)=>v!==''&&v!=null).map(Number);return vs.length?Math.round(avg(vs)!*10)/10:'—'})()}
                      </td>
                      <td className="px-1 py-2 text-center text-xs border-l border-gray-500">
                        {(()=>{const vs=nilaiRows.map(r=>r.pas).filter((v:any)=>v!==''&&v!=null).map(Number);return vs.length?Math.round(avg(vs)!*10)/10:'—'})()}
                      </td>
                      <td className="px-1 py-2 text-center text-xs font-bold border-l border-gray-400">
                        {rataKelas??'—'}
                      </td>
                      <td className="border-l border-gray-400"/>
                    </tr>
                  </tfoot>
                </table>
                <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-500 flex gap-4">
                  <span>Nilai akhir = UH×{periode.bobot_uh}% + UTS×{periode.bobot_uts}% + PAS×{periode.bobot_pas}% + Hadir×{periode.bobot_hadir}%</span>
                  <span className="text-red-500">■ Di bawah KKM ({selMapel.kkm})</span>
                </div>
              </div>
          }
        </>
      )}
    </div>
  )
}

// ─── Tab: Rekap Nilai ─────────────────────────────────────────────────────────
function TabRekap({ periode, showToast }: any) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [printingAll, setPrintingAll] = useState(false)
  const [printingSiswa, setPrintingSiswa] = useState<number|null>(null)

  const load = useCallback(async()=>{
    setLoading(true)
    const r = await raportApi.rekap(periode.id)
    setData(r)
    setLoading(false)
  },[periode.id])

  useEffect(()=>{ load() },[load])

  const handleExport = async () => {
    setExporting(true)
    const r:any = await raportApi.exportExcel(periode.id)
    if (!r?.ok) showToast(r?.error||'Gagal export','error')
    else showToast('File Excel dibuka')
    setExporting(false)
  }

  const getNilai = (siswaId:number, mapelId:number) => {
    return data?.nilai?.find((n:any)=>n.siswa_id===siswaId&&n.mapel_id===mapelId)
  }

  const getRata = (siswaId:number) => {
    if (!data?.mapel?.length) return null
    const vals = data.mapel.map((m:any)=>getNilai(siswaId,m.id)?.nilai_akhir).filter((v:any)=>v!=null)
    return vals.length ? Math.round(vals.reduce((a:number,b:number)=>a+b,0)/vals.length*10)/10 : null
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 flex-wrap">
        <button onClick={load} className="p-1.5 hover:bg-gray-100 rounded-lg"><RefreshCw className="w-4 h-4 text-gray-500"/></button>
        <button onClick={handleExport} disabled={exporting}
          className="flex items-center gap-2 px-3 py-1.5 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 disabled:opacity-50">
          <FileSpreadsheet className="w-4 h-4"/> {exporting?'Mengekspor...':'Export Excel'}
        </button>
        <button onClick={async()=>{ setPrintingAll(true); const r:any=await pdfCetakApi.raportAll(periode.id); if(!r?.ok) alert(r?.error||'Gagal'); setPrintingAll(false) }}
          disabled={printingAll}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-700 text-white text-sm rounded-lg hover:bg-blue-800 disabled:opacity-50">
          <Download className="w-4 h-4"/> {printingAll?'Membuat PDF...':'Cetak Semua Raport'}
        </button>
      </div>

      {loading ? <div className="text-center py-8 text-gray-400">Memuat...</div>
        : !data || data.siswa?.length===0
          ? <div className="text-center py-12 text-gray-400">Belum ada data</div>
          : (
            <div className="overflow-auto rounded-xl border border-gray-200 bg-white">
              <table className="text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="px-2 py-2 text-center sticky left-0 bg-gray-800 z-10 w-8">No</th>
                    <th className="px-3 py-2 text-left sticky left-8 bg-gray-800 z-10 min-w-[140px]">Nama Siswa</th>
                    <th className="px-2 py-2 text-center border-l border-gray-600 w-12">Kelas</th>
                    {data.mapel?.map((m:any)=>(
                      <th key={m.id} className="px-1 py-1 text-center border-l border-gray-600 min-w-[52px]">
                        <div className="font-bold text-[10px] leading-tight">{m.nama.split(' ').slice(0,2).join(' ')}</div>
                        <div className="text-[9px] text-gray-300">KKM {m.kkm}</div>
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center border-l border-gray-400 min-w-[55px] bg-green-900/40">Rata²</th>
                    <th className="px-2 py-2 text-center border-l border-gray-400 w-16 bg-blue-900/40">Cetak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.siswa?.map((s:any,i:number)=>{
                    const rs = data.siswaData?.find((r:any)=>r.siswa_id===s.id)
                    const rata = getRata(s.id)
                    return (
                      <tr key={s.id} className={i%2===0?'bg-white hover:bg-blue-50':'bg-gray-50/50 hover:bg-blue-50'}>
                        <td className="px-2 py-2 text-center text-gray-400 sticky left-0 bg-inherit z-10">{i+1}</td>
                        <td className="px-3 py-2 font-medium text-gray-800 sticky left-8 bg-inherit z-10 whitespace-nowrap">{s.nama}</td>
                        <td className="px-2 py-2 text-center text-gray-500 border-l border-gray-100">{rs?.kelas||s.kelas||'—'}</td>
                        {data.mapel?.map((m:any)=>{
                          const n = getNilai(s.id,m.id)
                          const v = n?.nilai_akhir??null
                          const below = v!==null&&v<m.kkm
                          return (
                            <td key={m.id} className={clsx('px-1 py-2 text-center border-l border-gray-100', below&&'bg-red-50')}>
                              <div className={clsx('font-semibold', v===null?'text-gray-300':below?'text-red-700':'text-gray-800')}>{v??'—'}</div>
                              {n?.predikat&&<div className={clsx('text-[10px]', PREDIKAT_COLOR[n.predikat]||'')}>{n.predikat}</div>}
                            </td>
                          )
                        })}
                        <td className="px-2 py-2 text-center border-l border-gray-200 bg-green-50/40">
                          <span className={clsx('font-bold text-sm', rata===null?'text-gray-300':'text-gray-800')}>{rata??'—'}</span>
                      </td>
                      <td className="px-2 py-2 text-center border-l border-gray-200">
                        <button onClick={async()=>{ setPrintingSiswa(s.id); const r:any=await pdfCetakApi.raportSiswa(periode.id,s.id); if(!r?.ok) alert(r?.error||'Gagal'); setPrintingSiswa(null) }}
                          disabled={printingSiswa===s.id}
                          className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
                          {printingSiswa===s.id?'...':'📄 PDF'}
                        </button>
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export function RaportPage({ showToast }: { showToast:(msg:string,type?:any)=>void }) {
  const [tab, setTab] = useState<Tab>('periode')
  const [periodeList, setPeriodeList] = useState<any[]>([])
  const [angkatanList, setAngkatanList] = useState<any[]>([])
  const [activePeriode, setActivePeriode] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const loadPeriode = useCallback(async()=>{
    setLoading(true)
    const [p,a] = await Promise.all([raportApi.periodeList(), angkatanApi.list()])
    setPeriodeList(Array.isArray(p)?p:[])
    setAngkatanList(Array.isArray(a)?a:[])
    setLoading(false)
  },[])

  useEffect(()=>{ loadPeriode() },[loadPeriode])

  const TABS_MAIN = [{ key:'periode', label:'Periode Raport', icon:'📅' }]
  const TABS_PERIODE = [
    { key:'mapel',       label:'Mata Pelajaran', icon:'📚' },
    { key:'siswa',       label:'Kehadiran Siswa', icon:'🧑‍🎓' },
    { key:'input-nilai', label:'Input Nilai',     icon:'✏️' },
    { key:'rekap',       label:'Rekap & Export',  icon:'📊' },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Raport Semester" subtitle="Kelola nilai raport per semester dengan UH, UTS, PAS, dan kehadiran"
        actions={activePeriode&&(
          <button onClick={()=>{ setActivePeriode(null); setTab('periode') }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
            <ChevronLeft className="w-4 h-4"/> Semua Periode
          </button>
        )}
      />

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {(activePeriode ? TABS_PERIODE : TABS_MAIN).map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key as Tab)}
            className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              tab===t.key?'bg-white text-blue-700 shadow-sm':'text-gray-500 hover:text-gray-800')}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Active periode banner */}
      {activePeriode && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2">
          <GraduationCap className="w-5 h-5 text-blue-600"/>
          <div>
            <span className="font-bold text-blue-800">{activePeriode.label}</span>
            <span className="text-blue-600 text-sm ml-2">{activePeriode.tahun_ajaran} · Semester {activePeriode.semester}</span>
          </div>
          {activePeriode.is_aktif && <span className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">AKTIF</span>}
        </div>
      )}

      {loading && !activePeriode
        ? <div className="text-center py-12 text-gray-400">Memuat...</div>
        : tab==='periode'
          ? <TabPeriode periodeList={periodeList} angkatanList={angkatanList} onReload={loadPeriode} showToast={showToast} onOpen={(p:any)=>{ setActivePeriode(p); setTab('mapel') }}/>
          : activePeriode
            ? <>
                {tab==='mapel'       && <TabMapel periode={activePeriode} onReload={loadPeriode} showToast={showToast}/>}
                {tab==='siswa'       && <TabSiswaRaport periode={activePeriode} showToast={showToast}/>}
                {tab==='input-nilai' && <TabInputNilai periode={activePeriode} showToast={showToast}/>}
                {tab==='rekap'       && <TabRekap periode={activePeriode} showToast={showToast}/>}
              </>
            : null
      }
    </div>
  )
}
