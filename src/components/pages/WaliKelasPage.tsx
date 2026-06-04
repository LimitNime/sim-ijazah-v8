import { useState, useEffect, useCallback, useRef } from 'react'
import {
  LayoutGrid, Map, Calendar, BookOpen, UserCheck,
  Plus, Pencil, Trash2, Save, RefreshCw, ChevronLeft,
  Users, GraduationCap, Shuffle, Printer, Download
} from 'lucide-react'
import { Button, Modal, Input, Select, ConfirmDialog, PageHeader, Badge, Table, TextInput, DropDown } from '../ui'
import { kelasApi, denahApi, jadwalApi, jurnalApi, absensiApi, angkatanApi, mapelApi, pdfCetakApi } from '../../lib/api'
import { clsx } from 'clsx'

const HARI = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']
const STATUS_COLOR: Record<string,string> = { H:'bg-green-100 text-green-800', S:'bg-yellow-100 text-yellow-800', I:'bg-blue-100 text-blue-800', A:'bg-red-100 text-red-800' }
const STATUS_LABEL: Record<string,string> = { H:'Hadir', S:'Sakit', I:'Izin', A:'Alpha' }

type Tab = 'kelas'|'denah'|'jadwal'|'jurnal'|'absensi'

// ─── helpers ─────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0,10)
const thisMonth = () => new Date().toISOString().slice(0,7)

export function WaliKelasPage({ showToast }: { showToast:(msg:string,type?:any)=>void }) {
  const [tab, setTab] = useState<Tab>('kelas')
  const [kelasList, setKelasList] = useState<any[]>([])
  const [selectedKelas, setSelectedKelas] = useState<any|null>(null)
  const [angkatanList, setAngkatanList] = useState<any[]>([])
  const [mapelList, setMapelList] = useState<any[]>([])

  useEffect(() => {
    angkatanApi.list().then((r:any) => setAngkatanList(Array.isArray(r)?r:[]))
    mapelApi.list().then((r:any) => setMapelList(Array.isArray(r)?r:[]))
    loadKelas()
  }, [])

  const loadKelas = async () => {
    const r = await kelasApi.list()
    setKelasList(Array.isArray(r)?r:[])
  }

  const TABS = [
    { key:'kelas',   label:'Data Kelas',   icon:<LayoutGrid className="w-4 h-4"/> },
    { key:'denah',   label:'Denah Kelas',  icon:<Map className="w-4 h-4"/> },
    { key:'jadwal',  label:'Jadwal',        icon:<Calendar className="w-4 h-4"/> },
    { key:'jurnal',  label:'Jurnal Kelas', icon:<BookOpen className="w-4 h-4"/> },
    { key:'absensi', label:'Absensi',       icon:<UserCheck className="w-4 h-4"/> },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Wali Kelas" subtitle="Kelola kelas, denah, jadwal, jurnal, dan absensi" icon={<GraduationCap className="w-5 h-5"/>} />

      {/* Tab Bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={()=>setTab(t.key as Tab)}
            className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              tab===t.key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-800')}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab==='kelas'  && <TabKelas kelasList={kelasList} angkatanList={angkatanList} showToast={showToast} onReload={loadKelas} onSelect={k=>{setSelectedKelas(k);setTab('denah')}} />}
      {tab==='denah'  && <TabDenah kelasList={kelasList} selectedKelas={selectedKelas} setSelectedKelas={setSelectedKelas} showToast={showToast} />}
      {tab==='jadwal' && <TabJadwal kelasList={kelasList} selectedKelas={selectedKelas} setSelectedKelas={setSelectedKelas} mapelList={mapelList} showToast={showToast} />}
      {tab==='jurnal' && <TabJurnal kelasList={kelasList} selectedKelas={selectedKelas} setSelectedKelas={setSelectedKelas} mapelList={mapelList} showToast={showToast} />}
      {tab==='absensi'&& <TabAbsensi kelasList={kelasList} selectedKelas={selectedKelas} setSelectedKelas={setSelectedKelas} showToast={showToast} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: DATA KELAS
// ═══════════════════════════════════════════════════════════════════════════
function TabKelas({ kelasList, angkatanList, showToast, onReload, onSelect }: any) {
  const EMPTY = { nama:'', tingkat:'VII', tahun_ajaran:'', wali_kelas:'', angkatan_id:'', kapasitas:32 }
  const [modal, setModal] = useState<{open:boolean;mode:'add'|'edit';form:any}>({open:false,mode:'add',form:{...EMPTY}})
  const [confirm, setConfirm] = useState<{open:boolean;id:number|null;nama:string}>({open:false,id:null,nama:''})
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!modal.form.nama?.trim()) { showToast('Nama kelas wajib diisi','error'); return }
    setSaving(true)
    try {
      const d = { ...modal.form, kapasitas: Number(modal.form.kapasitas)||32, angkatan_id: modal.form.angkatan_id ? Number(modal.form.angkatan_id) : null }
      if (modal.mode==='add') await kelasApi.add(d)
      else await kelasApi.update(modal.form.id, d)
      setModal(m=>({...m,open:false}))
      showToast(modal.mode==='add'?'Kelas ditambahkan':'Kelas diperbarui')
      onReload()
    } catch { showToast('Gagal menyimpan','error') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirm.id) return
    await kelasApi.delete(confirm.id)
    setConfirm({open:false,id:null,nama:''})
    showToast('Kelas dihapus')
    onReload()
  }

  const TINGKAT = ['VII','VIII','IX','X','XI','XII'].map(v=>({value:v,label:`Kelas ${v}`}))

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={()=>setModal({open:true,mode:'add',form:{...EMPTY}})} icon={<Plus className="w-4 h-4"/>}>Tambah Kelas</Button>
      </div>

      {kelasList.length===0
        ? <div className="text-center py-16 text-gray-400"><LayoutGrid className="w-12 h-12 mx-auto mb-3 opacity-30"/><p>Belum ada kelas. Klik Tambah Kelas untuk memulai.</p></div>
        : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {kelasList.map(k => {
              const ang = angkatanList.find((a:any)=>a.id===k.angkatan_id)
              return (
                <div key={k.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{k.nama}</h3>
                      <p className="text-sm text-gray-500">{k.tahun_ajaran||'—'}</p>
                    </div>
                    <Badge variant="info">{k.tingkat||'—'}</Badge>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600 mb-4">
                    <p>👤 Wali Kelas: <span className="font-medium">{k.wali_kelas||'—'}</span></p>
                    <p>👥 Kapasitas: <span className="font-medium">{k.kapasitas} siswa</span></p>
                    {ang && <p>🎓 Angkatan: <span className="font-medium">{ang.nama}</span></p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={()=>onSelect(k)} className="flex-1 text-center py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors">Buka</button>
                    <button onClick={()=>setModal({open:true,mode:'edit',form:{...k,angkatan_id:k.angkatan_id||''}})} className="p-1.5 rounded-lg hover:bg-gray-100"><Pencil className="w-4 h-4 text-gray-500"/></button>
                    <button onClick={()=>setConfirm({open:true,id:k.id,nama:k.nama})} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-400"/></button>
                  </div>
                </div>
              )
            })}
          </div>
      }

      <Modal open={modal.open} title={modal.mode==='add'?'Tambah Kelas':'Edit Kelas'} onClose={()=>setModal(m=>({...m,open:false}))}
        footer={<><Button variant="ghost" onClick={()=>setModal(m=>({...m,open:false}))}>Batal</Button><Button onClick={handleSave} loading={saving}>Simpan</Button></>}>
        <div className="space-y-3">
          <TextInput label="Nama Kelas *" value={modal.form.nama} onChange={v=>setModal(m=>({...m,form:{...m.form,nama:v}}))} placeholder="Contoh: VII A" />
          <DropDown label="Tingkat" value={modal.form.tingkat} onChange={v=>setModal(m=>({...m,form:{...m.form,tingkat:v}}))} options={TINGKAT} />
          <TextInput label="Tahun Ajaran" value={modal.form.tahun_ajaran} onChange={v=>setModal(m=>({...m,form:{...m.form,tahun_ajaran:v}}))} placeholder="2024/2025" />
          <TextInput label="Nama Wali Kelas" value={modal.form.wali_kelas} onChange={v=>setModal(m=>({...m,form:{...m.form,wali_kelas:v}}))} placeholder="Nama guru" />
          <TextInput label="Kapasitas (jumlah kursi)" value={String(modal.form.kapasitas)} onChange={v=>setModal(m=>({...m,form:{...m.form,kapasitas:v}}))} type="number" />
          <DropDown label="Hubungkan ke Angkatan (opsional)" value={String(modal.form.angkatan_id||'')} onChange={v=>setModal(m=>({...m,form:{...m.form,angkatan_id:v}}))}
            options={[{value:'',label:'— Tidak dihubungkan —'},...angkatanList.map((a:any)=>({value:String(a.id),label:a.nama}))]} />
        </div>
      </Modal>

      <ConfirmDialog open={confirm.open} title="Hapus Kelas" message={`Hapus kelas "${confirm.nama}"? Semua data denah, jadwal, jurnal dan absensi kelas ini akan ikut terhapus.`}
        onConfirm={handleDelete} onCancel={()=>setConfirm({open:false,id:null,nama:''})} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: DENAH TEMPAT DUDUK
// ═══════════════════════════════════════════════════════════════════════════
function TabDenah({ kelasList, selectedKelas, setSelectedKelas, showToast }: any) {
  const [kelas, setKelas] = useState<any>(selectedKelas)
  const [seats, setSeats] = useState<any[]>([])
  const [siswaList, setSiswaList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dragSiswa, setDragSiswa] = useState<any|null>(null)
  const [cols] = useState(6)

  useEffect(()=>{ if(kelas) loadDenah() },[kelas])

  const loadDenah = async () => {
    setLoading(true)
    const [d, s] = await Promise.all([denahApi.get(kelas.id), kelasApi.siswa(kelas.id)])
    const seatArr = Array.isArray(d)?d:[]
    const siswa = Array.isArray(s)?s:[]
    // Fill empty grid
    const kap = kelas.kapasitas || 32
    const rows = Math.ceil(kap / cols)
    const grid:any[] = []
    for (let r=1;r<=rows;r++) for (let c=1;c<=cols;c++) {
      if ((r-1)*cols+c > kap) continue
      const found = seatArr.find((x:any)=>x.baris===r&&x.kolom===c)
      grid.push(found || { baris:r, kolom:c, siswa_id:null, nama_siswa:null, jk:null })
    }
    setSeats(grid)
    setSiswaList(siswa)
    setLoading(false)
  }

  const handleAuto = async () => {
    setLoading(true)
    await denahApi.auto(kelas.id)
    await loadDenah()
    showToast('Denah otomatis dibuat')
  }

  const handleSave = async () => {
    setSaving(true)
    await denahApi.save(kelas.id, seats.map(s=>({baris:s.baris,kolom:s.kolom,siswa_id:s.siswa_id||null})))
    showToast('Denah disimpan')
    setSaving(false)
  }

  const dropOnSeat = (targetSeat: any) => {
    if (!dragSiswa) return
    setSeats(prev => {
      const next = prev.map(s => ({...s}))
      // Remove dragSiswa from any seat
      next.forEach(s=>{ if(s.siswa_id===dragSiswa.id){s.siswa_id=null;s.nama_siswa=null;s.jk=null} })
      // If target already has someone, swap
      const target = next.find(s=>s.baris===targetSeat.baris&&s.kolom===targetSeat.kolom)
      if (!target) return prev
      target.siswa_id = dragSiswa.id
      target.nama_siswa = dragSiswa.nama
      target.jk = dragSiswa.jk
      return next
    })
    setDragSiswa(null)
  }

  const clearSeat = (seat:any) => {
    setSeats(prev=>prev.map(s=>s.baris===seat.baris&&s.kolom===seat.kolom?{...s,siswa_id:null,nama_siswa:null,jk:null}:s))
  }

  const assignedIds = new Set(seats.filter(s=>s.siswa_id).map(s=>s.siswa_id))
  const unassigned = siswaList.filter((s:any)=>!assignedIds.has(s.id))
  const rows = Math.max(...seats.map(s=>s.baris),1)

  if (!kelas) return <KelasSelector kelasList={kelasList} onSelect={k=>{setKelas(k);setSelectedKelas(k)}} title="Denah Tempat Duduk" />

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={()=>{setKelas(null);setSelectedKelas(null)}} className="flex items-center gap-1 text-sm text-blue-600 hover:underline"><ChevronLeft className="w-4 h-4"/>Ganti Kelas</button>
        <h2 className="font-bold text-gray-800 text-lg">{kelas.nama}</h2>
        <div className="flex-1"/>
        <Button variant="ghost" onClick={handleAuto} icon={<Shuffle className="w-4 h-4"/>} loading={loading}>Acak Otomatis</Button>
        <Button onClick={handleSave} icon={<Save className="w-4 h-4"/>} loading={saving}>Simpan Denah</Button>
      </div>

      <div className="flex gap-4">
        {/* Grid Denah */}
        <div className="flex-1 overflow-auto">
          <div className="mb-2 text-center">
            <div className="inline-block bg-gray-800 text-white text-xs px-6 py-1 rounded">PAPAN TULIS / GURU</div>
          </div>
          {loading ? <div className="text-center py-8 text-gray-400">Memuat...</div> :
            <div className="grid gap-2" style={{gridTemplateColumns:`repeat(${cols},minmax(0,1fr))`}}>
              {Array.from({length:rows},(_,ri)=>ri+1).map(r=>
                Array.from({length:cols},(_,ci)=>ci+1).map(c=>{
                  const seat = seats.find(s=>s.baris===r&&s.kolom===c)
                  if (!seat) return null
                  return (
                    <div key={`${r}-${c}`}
                      onDragOver={e=>e.preventDefault()}
                      onDrop={()=>dropOnSeat(seat)}
                      className={clsx('border-2 rounded-lg p-2 min-h-[64px] text-center text-xs transition-all cursor-pointer',
                        seat.siswa_id
                          ? seat.jk==='P'?'border-pink-300 bg-pink-50':'border-blue-300 bg-blue-50'
                          : 'border-dashed border-gray-300 bg-gray-50 hover:border-blue-300'
                      )}
                      onClick={()=>{ if(seat.siswa_id) clearSeat(seat) }}
                    >
                      {seat.siswa_id
                        ? <><div className="font-semibold text-gray-800 leading-tight truncate">{seat.nama_siswa?.split(' ')[0]}</div>
                            <div className="text-gray-500 mt-0.5 truncate">{seat.nama_siswa?.split(' ').slice(1).join(' ')}</div>
                            <div className="text-[10px] mt-1 text-gray-400">{seat.jk==='P'?'♀ P':'♂ L'}</div></>
                        : <div className="text-gray-300 mt-3">Kosong<br/><span className="text-[10px]">{r}-{c}</span></div>
                      }
                    </div>
                  )
                })
              )}
            </div>
          }
        </div>

        {/* Sidebar: Siswa belum duduk */}
        <div className="w-48 shrink-0">
          <p className="text-xs font-bold text-gray-500 uppercase mb-2">Belum duduk ({unassigned.length})</p>
          <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
            {unassigned.map((s:any)=>(
              <div key={s.id} draggable
                onDragStart={()=>setDragSiswa(s)}
                className={clsx('px-2 py-1.5 rounded-lg text-xs cursor-grab border select-none',
                  s.jk==='P'?'bg-pink-50 border-pink-200 text-pink-800':'bg-blue-50 border-blue-200 text-blue-800')}>
                {s.nama}
              </div>
            ))}
            {unassigned.length===0 && <p className="text-xs text-gray-400">Semua siswa sudah duduk ✓</p>}
          </div>
          <p className="text-[10px] text-gray-400 mt-3">Drag siswa ke kursi. Klik kursi berisi siswa untuk kosongkan.</p>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: JADWAL PELAJARAN
// ═══════════════════════════════════════════════════════════════════════════
function TabJadwal({ kelasList, selectedKelas, setSelectedKelas, mapelList, showToast }: any) {
  const [kelas, setKelas] = useState<any>(selectedKelas)
  const [jadwal, setJadwal] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editCell, setEditCell] = useState<{hari:string;jam:number}|null>(null)
  const [cellForm, setCellForm] = useState<any>({nama_mapel:'',guru:'',jam_mulai:'',jam_selesai:'',ruangan:''})
  const MAX_JAM = 10

  useEffect(()=>{ if(kelas) loadJadwal() },[kelas])

  const loadJadwal = async () => {
    setLoading(true)
    const r = await jadwalApi.get(kelas.id)
    setJadwal(Array.isArray(r)?r:[])
    setLoading(false)
  }

  const getCell = (hari:string, jam:number) => jadwal.find(j=>j.hari===hari&&j.jam_ke===jam)

  const openCell = (hari:string, jam:number) => {
    const c = getCell(hari,jam)
    setCellForm(c?{nama_mapel:c.nama_mapel||'',guru:c.guru||'',jam_mulai:c.jam_mulai||'',jam_selesai:c.jam_selesai||'',ruangan:c.ruangan||''}:{nama_mapel:'',guru:'',jam_mulai:'',jam_selesai:'',ruangan:''})
    setEditCell({hari,jam})
  }

  const saveCell = () => {
    const {hari,jam} = editCell!
    setJadwal(prev=>{
      const next = prev.filter(j=>!(j.hari===hari&&j.jam_ke===jam))
      if (cellForm.nama_mapel.trim()) next.push({hari,jam_ke:jam,...cellForm})
      return next
    })
    setEditCell(null)
  }

  const handleSave = async () => {
    setSaving(true)
    await jadwalApi.save(kelas.id, jadwal)
    showToast('Jadwal disimpan')
    setSaving(false)
  }

  const mapelOpt = [
    {value:'',label:'— Pilih mapel —'},
    ...mapelList.map((m:any)=>({value:m.nama,label:m.nama}))
  ]

  if (!kelas) return <KelasSelector kelasList={kelasList} onSelect={k=>{setKelas(k);setSelectedKelas(k)}} title="Jadwal Pelajaran" />

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={()=>{setKelas(null);setSelectedKelas(null)}} className="flex items-center gap-1 text-sm text-blue-600 hover:underline"><ChevronLeft className="w-4 h-4"/>Ganti Kelas</button>
        <h2 className="font-bold text-gray-800 text-lg">Jadwal — {kelas.nama}</h2>
        <div className="flex-1"/>
<button onClick={async()=>{const r:any=await pdfCetakApi.jadwal(kelas.id);if(!r?.ok)alert(r?.error||'Gagal')}}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-800">
          <Printer className="w-3.5 h-3.5"/> Cetak PDF
        </button>
        <Button onClick={handleSave} icon={<Save className="w-4 h-4"/>} loading={saving}>Simpan Jadwal</Button>
      </div>

      {loading ? <div className="text-center py-8 text-gray-400">Memuat...</div> :
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="px-3 py-2 text-left w-16">Jam</th>
                {HARI.map(h=><th key={h} className="px-3 py-2 text-center">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {Array.from({length:MAX_JAM},(_,i)=>i+1).map(jam=>(
                <tr key={jam} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 text-center font-bold text-gray-500">{jam}</td>
                  {HARI.map(hari=>{
                    const c = getCell(hari,jam)
                    return (
                      <td key={hari} className="px-1 py-1 border-l">
                        <button onClick={()=>openCell(hari,jam)} className={clsx('w-full text-left px-2 py-2 rounded-lg transition-colors text-xs min-h-[48px]',
                          c?'bg-blue-50 hover:bg-blue-100':'hover:bg-gray-100')}>
                          {c?<><div className="font-semibold text-blue-800">{c.nama_mapel}</div>
                              <div className="text-gray-500">{c.guru}</div>
                              {c.jam_mulai&&<div className="text-gray-400">{c.jam_mulai}–{c.jam_selesai}</div>}</>
                           :<span className="text-gray-300">+</span>}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 mt-2">Klik sel untuk mengisi jadwal. Kosongkan nama mapel untuk menghapus.</p>
        </div>
      }

      {editCell && (
        <Modal open={true} title={`Jam ${editCell.jam} — ${editCell.hari}`}
          onClose={()=>setEditCell(null)}
          footer={<><Button variant="ghost" onClick={()=>setEditCell(null)}>Batal</Button><Button onClick={saveCell}>Simpan</Button></>}>
          <div className="space-y-3">
            <DropDown label="Mata Pelajaran" value={cellForm.nama_mapel} onChange={v=>setCellForm((f:any)=>({...f,nama_mapel:v}))} options={mapelOpt}/>
            <TextInput label="Atau ketik nama mapel" value={cellForm.nama_mapel} onChange={v=>setCellForm((f:any)=>({...f,nama_mapel:v}))} placeholder="Nama mata pelajaran"/>
            <TextInput label="Nama Guru" value={cellForm.guru} onChange={v=>setCellForm((f:any)=>({...f,guru:v}))} placeholder="Nama guru pengampu"/>
            <div className="grid grid-cols-2 gap-2">
              <TextInput label="Jam Mulai" value={cellForm.jam_mulai} onChange={v=>setCellForm((f:any)=>({...f,jam_mulai:v}))} placeholder="07:00" type="time"/>
              <TextInput label="Jam Selesai" value={cellForm.jam_selesai} onChange={v=>setCellForm((f:any)=>({...f,jam_selesai:v}))} placeholder="07:45" type="time"/>
            </div>
            <TextInput label="Ruangan" value={cellForm.ruangan} onChange={v=>setCellForm((f:any)=>({...f,ruangan:v}))} placeholder="Lab IPA, Lap. Olahraga, dll"/>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: JURNAL KELAS
// ═══════════════════════════════════════════════════════════════════════════
function TabJurnal({ kelasList, selectedKelas, setSelectedKelas, mapelList, showToast }: any) {
  const [kelas, setKelas] = useState<any>(selectedKelas)
  const [jurnal, setJurnal] = useState<any[]>([])
  const [bulan, setBulan] = useState(thisMonth())
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<{open:boolean;mode:'add'|'edit';form:any}>({open:false,mode:'add',form:{}})
  const [confirm, setConfirm] = useState<{open:boolean;id:number|null}>({open:false,id:null})
  const [saving, setSaving] = useState(false)

  const EMPTY = { kelas_id:0, tanggal:today(), jam_ke:1, nama_mapel:'', guru:'', materi:'', catatan:'' }

  useEffect(()=>{ if(kelas) load() },[kelas,bulan])

  const load = async () => {
    setLoading(true)
    const r = await jurnalApi.list(kelas.id, bulan)
    setJurnal(Array.isArray(r)?r:[])
    setLoading(false)
  }

  const handleSave = async () => {
    if (!modal.form.materi?.trim()) { showToast('Materi wajib diisi','error'); return }
    setSaving(true)
    try {
      const d = { ...modal.form, kelas_id: kelas.id }
      if (modal.mode==='add') await jurnalApi.add(d)
      else await jurnalApi.update(modal.form.id, d)
      setModal(m=>({...m,open:false}))
      showToast(modal.mode==='add'?'Jurnal ditambahkan':'Jurnal diperbarui')
      load()
    } catch { showToast('Gagal menyimpan','error') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirm.id) return
    await jurnalApi.delete(confirm.id)
    setConfirm({open:false,id:null})
    showToast('Entri jurnal dihapus')
    load()
  }

  const mapelOpt = [{value:'',label:'— Pilih —'},...mapelList.map((m:any)=>({value:m.nama,label:m.nama}))]

  // Group by tanggal
  const grouped = jurnal.reduce((acc:any,j:any)=>{
    if (!acc[j.tanggal]) acc[j.tanggal]=[]
    acc[j.tanggal].push(j)
    return acc
  },{})

  if (!kelas) return <KelasSelector kelasList={kelasList} onSelect={k=>{setKelas(k);setSelectedKelas(k)}} title="Jurnal Kelas" />

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={()=>{setKelas(null);setSelectedKelas(null)}} className="flex items-center gap-1 text-sm text-blue-600 hover:underline"><ChevronLeft className="w-4 h-4"/>Ganti Kelas</button>
        <h2 className="font-bold text-gray-800 text-lg">Jurnal — {kelas.nama}</h2>
        <div className="flex-1"/>
        <input type="month" value={bulan} onChange={e=>setBulan(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"/>
<button onClick={async()=>{const r:any=await pdfCetakApi.jurnal(kelas.id,bulan);if(!r?.ok)alert(r?.error||'Gagal')}}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-800">
          <Printer className="w-3.5 h-3.5"/> Cetak PDF
        </button>
        <Button onClick={()=>setModal({open:true,mode:'add',form:{...EMPTY}})} icon={<Plus className="w-4 h-4"/>}>Tambah Entri</Button>
      </div>

      {loading ? <div className="text-center py-8 text-gray-400">Memuat...</div>
        : Object.keys(grouped).length===0
          ? <div className="text-center py-16 text-gray-400"><BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30"/><p>Belum ada entri jurnal bulan ini.</p></div>
          : <div className="space-y-4">
              {Object.keys(grouped).sort().reverse().map(tgl=>(
                <div key={tgl} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b font-semibold text-gray-700 text-sm">
                    📅 {new Date(tgl).toLocaleDateString('id-ID',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
                  </div>
                  <div className="divide-y">
                    {grouped[tgl].map((j:any)=>(
                      <div key={j.id} className="px-4 py-3 flex gap-3">
                        <div className="w-16 text-center shrink-0">
                          <div className="bg-blue-100 text-blue-700 rounded-lg py-1 text-xs font-bold">Jam {j.jam_ke}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          {j.nama_mapel && <div className="font-semibold text-gray-800">{j.nama_mapel}</div>}
                          {j.guru && <div className="text-sm text-gray-500">Guru: {j.guru}</div>}
                          <div className="text-sm text-gray-700 mt-1">{j.materi}</div>
                          {j.catatan && <div className="text-xs text-gray-500 mt-1 italic">{j.catatan}</div>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={()=>setModal({open:true,mode:'edit',form:{...j}})} className="p-1 hover:bg-gray-100 rounded"><Pencil className="w-3.5 h-3.5 text-gray-400"/></button>
                          <button onClick={()=>setConfirm({open:true,id:j.id})} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-400"/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
      }

      <Modal open={modal.open} title={modal.mode==='add'?'Tambah Entri Jurnal':'Edit Entri Jurnal'}
        onClose={()=>setModal(m=>({...m,open:false}))}
        footer={<><Button variant="ghost" onClick={()=>setModal(m=>({...m,open:false}))}>Batal</Button><Button onClick={handleSave} loading={saving}>Simpan</Button></>}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <TextInput label="Tanggal *" value={modal.form.tanggal} onChange={v=>setModal(m=>({...m,form:{...m.form,tanggal:v}}))} type="date"/>
            <TextInput label="Jam Ke" value={String(modal.form.jam_ke||1)} onChange={v=>setModal(m=>({...m,form:{...m.form,jam_ke:Number(v)}}))} type="number"/>
          </div>
          <DropDown label="Mata Pelajaran" value={modal.form.nama_mapel||''} onChange={v=>setModal(m=>({...m,form:{...m.form,nama_mapel:v}}))} options={mapelOpt}/>
          <TextInput label="Nama Guru" value={modal.form.guru||''} onChange={v=>setModal(m=>({...m,form:{...m.form,guru:v}}))} placeholder="Guru pengampu"/>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Materi / Kegiatan *</label>
            <textarea value={modal.form.materi||''} onChange={e=>setModal(m=>({...m,form:{...m.form,materi:e.target.value}}))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              rows={3} placeholder="Uraikan materi yang disampaikan"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catatan (opsional)</label>
            <textarea value={modal.form.catatan||''} onChange={e=>setModal(m=>({...m,form:{...m.form,catatan:e.target.value}}))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              rows={2} placeholder="Catatan tambahan, kejadian khusus, dll"/>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={confirm.open} title="Hapus Entri Jurnal" message="Hapus entri jurnal ini?"
        onConfirm={handleDelete} onCancel={()=>setConfirm({open:false,id:null})} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: ABSENSI HARIAN
// ═══════════════════════════════════════════════════════════════════════════
function TabAbsensi({ kelasList, selectedKelas, setSelectedKelas, showToast }: any) {
  const [kelas, setKelas] = useState<any>(selectedKelas)
  const [mode, setMode] = useState<'input'|'rekap'>('input')
  const [tanggal, setTanggal] = useState(today())
  const [bulan, setBulan] = useState(thisMonth())
  const [siswa, setSiswa] = useState<any[]>([])
  const [rekap, setRekap] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(()=>{ if(kelas&&mode==='input') loadAbsensi() },[kelas,tanggal,mode])
  useEffect(()=>{ if(kelas&&mode==='rekap') loadRekap() },[kelas,bulan,mode])

  const loadAbsensi = async () => {
    setLoading(true)
    const r = await absensiApi.get(kelas.id, tanggal)
    setSiswa(Array.isArray(r)?r:[])
    setLoading(false)
  }

  const loadRekap = async () => {
    setLoading(true)
    const r = await absensiApi.rekap(kelas.id, bulan)
    setRekap(Array.isArray(r)?r:[])
    setLoading(false)
  }

  const setStatus = (siswaId:number, status:string) => {
    setSiswa(prev=>prev.map(s=>s.id===siswaId?{...s,status}:s))
  }

  const setKet = (siswaId:number, ket:string) => {
    setSiswa(prev=>prev.map(s=>s.id===siswaId?{...s,keterangan:ket}:s))
  }

  const handleSave = async () => {
    setSaving(true)
    await absensiApi.save(kelas.id, tanggal, siswa.map(s=>({siswa_id:s.id,status:s.status,keterangan:s.keterangan||''})))
    showToast('Absensi disimpan')
    setSaving(false)
  }

  const setAllStatus = (status:string) => setSiswa(prev=>prev.map(s=>({...s,status})))

  const stats = { H:siswa.filter(s=>s.status==='H').length, S:siswa.filter(s=>s.status==='S').length, I:siswa.filter(s=>s.status==='I').length, A:siswa.filter(s=>s.status==='A').length }

  if (!kelas) return <KelasSelector kelasList={kelasList} onSelect={k=>{setKelas(k);setSelectedKelas(k)}} title="Absensi Harian" />

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={()=>{setKelas(null);setSelectedKelas(null)}} className="flex items-center gap-1 text-sm text-blue-600 hover:underline"><ChevronLeft className="w-4 h-4"/>Ganti Kelas</button>
        <h2 className="font-bold text-gray-800 text-lg">Absensi — {kelas.nama}</h2>
        <div className="flex-1"/>
        <div className="flex bg-gray-100 rounded-lg p-0.5 text-sm">
          <button onClick={()=>setMode('input')} className={clsx('px-3 py-1 rounded-md',mode==='input'?'bg-white shadow text-blue-700 font-medium':'text-gray-500')}>Input Harian</button>
          <button onClick={()=>setMode('rekap')} className={clsx('px-3 py-1 rounded-md',mode==='rekap'?'bg-white shadow text-blue-700 font-medium':'text-gray-500')}>Rekap Bulanan</button>
        </div>
      </div>

      {mode==='input' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Tanggal:</label>
              <input type="date" value={tanggal} onChange={e=>setTanggal(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"/>
            </div>
            <div className="flex gap-1">
              {Object.entries(STATUS_LABEL).map(([s,l])=>(
                <button key={s} onClick={()=>setAllStatus(s)} className={clsx('text-xs px-2 py-1 rounded',STATUS_COLOR[s])}>Semua {l}</button>
              ))}
            </div>
            <div className="flex-1"/>
            {mode==='input' && <div className="flex gap-3 text-sm">
              {Object.entries(stats).map(([s,n])=>(
                <span key={s} className={clsx('px-2 py-0.5 rounded-full font-medium',STATUS_COLOR[s])}>{s}: {n}</span>
              ))}
            </div>}
            <Button onClick={handleSave} icon={<Save className="w-4 h-4"/>} loading={saving}>Simpan Absensi</Button>
          </div>

          {loading ? <div className="text-center py-8 text-gray-400">Memuat...</div>
            : siswa.length===0
              ? <div className="text-center py-12 text-gray-400"><Users className="w-12 h-12 mx-auto mb-3 opacity-30"/><p>Tidak ada siswa di kelas ini.</p></div>
              : <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left w-8 font-medium text-gray-600">No</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Nama Siswa</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-600">Status</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {siswa.map((s:any,i:number)=>(
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-400 text-center">{i+1}</td>
                          <td className="px-3 py-2 font-medium text-gray-800">{s.nama}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1 justify-center">
                              {Object.keys(STATUS_LABEL).map(st=>(
                                <button key={st} onClick={()=>setStatus(s.id,st)}
                                  className={clsx('w-8 h-8 rounded-lg text-xs font-bold transition-all',
                                    s.status===st?STATUS_COLOR[st]+' ring-2 ring-offset-1 ring-current':'bg-gray-100 text-gray-400 hover:bg-gray-200')}>
                                  {st}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {s.status!=='H' && (
                              <input value={s.keterangan||''} onChange={e=>setKet(s.id,e.target.value)}
                                className="border border-gray-200 rounded px-2 py-1 text-xs w-full" placeholder="Keterangan..."/>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
          }
        </div>
      )}

      {mode==='rekap' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input type="month" value={bulan} onChange={e=>setBulan(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"/>
            <button onClick={loadRekap} className="p-1.5 rounded-lg hover:bg-gray-100"><RefreshCw className="w-4 h-4 text-gray-500"/></button>
          </div>
          {loading ? <div className="text-center py-8 text-gray-400">Memuat...</div>
            : <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left">No</th>
                      <th className="px-3 py-2 text-left">Nama Siswa</th>
                      <th className="px-3 py-2 text-center">Hadir</th>
                      <th className="px-3 py-2 text-center">Sakit</th>
                      <th className="px-3 py-2 text-center">Izin</th>
                      <th className="px-3 py-2 text-center">Alpha</th>
                      <th className="px-3 py-2 text-center">Total Hari</th>
                      <th className="px-3 py-2 text-center">% Hadir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rekap.map((s:any,i:number)=>{
                      const pct = s.total>0?Math.round((s.H/s.total)*100):0
                      return (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-400 text-center">{i+1}</td>
                          <td className="px-3 py-2 font-medium">{s.nama}</td>
                          <td className="px-3 py-2 text-center"><span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium',STATUS_COLOR.H)}>{s.H}</span></td>
                          <td className="px-3 py-2 text-center"><span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium',STATUS_COLOR.S)}>{s.S}</span></td>
                          <td className="px-3 py-2 text-center"><span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium',STATUS_COLOR.I)}>{s.I}</span></td>
                          <td className="px-3 py-2 text-center"><span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium',STATUS_COLOR.A)}>{s.A}</span></td>
                          <td className="px-3 py-2 text-center text-gray-600">{s.total}</td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                <div className={clsx('h-1.5 rounded-full',pct>=80?'bg-green-500':pct>=60?'bg-yellow-500':'bg-red-500')} style={{width:`${pct}%`}}/>
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
          }
        </div>
      )}
    </div>
  )
}

// ─── Shared: Kelas Selector ──────────────────────────────────────────────────
function KelasSelector({ kelasList, onSelect, title }: { kelasList:any[]; onSelect:(k:any)=>void; title:string }) {
  return (
    <div className="text-center py-12">
      <Users className="w-12 h-12 mx-auto mb-4 text-gray-300"/>
      <h3 className="font-semibold text-gray-700 mb-1">Pilih Kelas untuk {title}</h3>
      <p className="text-sm text-gray-400 mb-6">Kelas mana yang ingin dibuka?</p>
      {kelasList.length===0
        ? <p className="text-gray-400 text-sm">Belum ada kelas. Buat kelas di tab Data Kelas.</p>
        : <div className="flex flex-wrap gap-2 justify-center">
            {kelasList.map(k=>(
              <button key={k.id} onClick={()=>onSelect(k)}
                className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-medium hover:bg-blue-100 transition-colors">
                {k.nama}
              </button>
            ))}
          </div>
      }
    </div>
  )
}
