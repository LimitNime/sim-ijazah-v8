import { useState, useEffect, useCallback } from 'react'
import { CreditCard, Plus, Pencil, Trash2, Printer, Users, ChevronRight, FileText } from 'lucide-react'
import { Button, Modal, Input, Select, ConfirmDialog, PageHeader, Badge } from '../ui'
import { kartuUjianApi, kelasApi, angkatanApi, pdfCetakApi } from '../../lib/api'
import { clsx } from 'clsx'

const JENIS_OPT = ['PAS','PAT','UTS','UAS','UKK','Try Out','Ujian Praktek','Lainnya'].map(v=>({value:v,label:v}))
const SEM_OPT   = ['Ganjil','Genap'].map(v=>({value:v,label:v}))

const JENIS_COLOR: Record<string,string> = {
  PAS:'bg-blue-100 text-blue-800', PAT:'bg-green-100 text-green-800',
  UTS:'bg-yellow-100 text-yellow-800', UAS:'bg-orange-100 text-orange-800',
  'Try Out':'bg-purple-100 text-purple-800', default:'bg-gray-100 text-gray-700'
}
const tglFmt = (t:string) => { try { return t ? new Date(t).toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}) : '—' } catch { return t } }

const EMPTY = { nama_ujian:'', jenis_ujian:'PAS', tahun_ajaran:'', semester:'Ganjil', tgl_mulai:'', tgl_selesai:'', lokasi:'', keterangan:'', angkatan_id:'', ruang_default:'' }

// ─── Print Modal: pilih kelas/angkatan sebelum cetak ─────────────────────────
function PrintModal({ config, kelasList, angkatanList, onClose, showToast }: any) {
  const [mode, setMode] = useState<'angkatan'|'kelas'>('angkatan')
  const [kelasId, setKelasId] = useState<string>('')
  const [printing, setPrinting] = useState(false)
  const [preview, setPreview] = useState<any[]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)

  const filteredKelas = config.angkatan_id
    ? kelasList.filter((k:any) => k.angkatan_id === config.angkatan_id)
    : kelasList

  useEffect(() => { loadPreview() }, [mode, kelasId])

  const loadPreview = async () => {
    setLoadingPreview(true)
    const kid = mode === 'kelas' && kelasId ? Number(kelasId) : undefined
    const r = await kartuUjianApi.getSiswa(config.id, kid)
    setPreview(Array.isArray(r) ? r : [])
    setLoadingPreview(false)
  }

  const handleCetak = async () => {
    if (preview.length === 0) { showToast('Tidak ada siswa untuk dicetak', 'error'); return }
    setPrinting(true)
    try {
      const kid = mode === 'kelas' && kelasId ? Number(kelasId) : undefined
      const r: any = kid ? await pdfCetakApi.kartuUjian(config.id, kid) : await pdfCetakApi.kartuUjian(config.id)
      if (!r?.ok) showToast(r?.error || 'Gagal cetak PDF', 'error')
      else { showToast(`PDF Kartu Ujian dibuka — ${preview.length} kartu`); onClose() }
    } finally { setPrinting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b bg-blue-700 text-white rounded-t-2xl">
          <h2 className="font-bold text-lg">Cetak Kartu Ujian</h2>
          <p className="text-blue-200 text-sm">{config.nama_ujian}</p>
        </div>
        <div className="p-6 space-y-4">
          {/* Mode pilih */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Cetak untuk</p>
            <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
              <button onClick={()=>{setMode('angkatan');setKelasId('')}}
                className={clsx('flex-1 py-2 rounded-lg text-sm font-medium transition-all',
                  mode==='angkatan'?'bg-white text-blue-700 shadow-sm':'text-gray-500')}>
                Semua Angkatan
              </button>
              <button onClick={()=>setMode('kelas')}
                className={clsx('flex-1 py-2 rounded-lg text-sm font-medium transition-all',
                  mode==='kelas'?'bg-white text-blue-700 shadow-sm':'text-gray-500')}>
                Per Kelas
              </button>
            </div>
          </div>

          {mode === 'kelas' && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Pilih Kelas</p>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {filteredKelas.map((k:any) => (
                  <button key={k.id} onClick={()=>setKelasId(String(k.id))}
                    className={clsx('px-3 py-2 rounded-lg border text-sm font-medium text-left transition-all',
                      kelasId===String(k.id)?'border-blue-500 bg-blue-50 text-blue-700':'border-gray-200 hover:border-gray-300')}>
                    {k.nama}
                    {k.wali_kelas && <span className="block text-xs text-gray-400 font-normal">{k.wali_kelas}</span>}
                  </button>
                ))}
                {filteredKelas.length === 0 && <p className="text-xs text-gray-400 col-span-2 py-4 text-center">Belum ada kelas terdaftar</p>}
              </div>
            </div>
          )}

          {/* Preview jumlah siswa */}
          <div className={clsx('rounded-xl p-4 flex items-center gap-3', preview.length > 0 ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200')}>
            <Users className={clsx('w-8 h-8', preview.length > 0 ? 'text-green-600' : 'text-gray-400')} />
            <div>
              {loadingPreview
                ? <p className="text-sm text-gray-500">Menghitung siswa...</p>
                : <>
                    <p className="font-bold text-gray-800">{preview.length} siswa</p>
                    <p className="text-xs text-gray-500">
                      {mode === 'kelas' && kelasId
                        ? `Kelas: ${kelasList.find((k:any)=>String(k.id)===kelasId)?.nama || '—'}`
                        : config.angkatan_id
                          ? `Angkatan: ${config.nama_angkatan || '—'}`
                          : 'Semua siswa terdaftar'
                      }
                    </p>
                    {preview.length > 0 && (
                      <p className="text-xs text-green-600 mt-0.5">
                        {preview.slice(0,3).map((s:any)=>s.nama.split(' ')[0]).join(', ')}{preview.length>3?` +${preview.length-3} lainnya`:''}
                      </p>
                    )}
                  </>
              }
            </div>
          </div>

          {/* Info ujian */}
          <div className="bg-blue-50 rounded-xl p-3 text-xs space-y-1 text-gray-700">
            <div className="flex justify-between"><span className="text-gray-500">Jenis</span><span className="font-medium">{config.jenis_ujian}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Tahun Ajaran</span><span className="font-medium">{config.tahun_ajaran || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Tanggal</span><span className="font-medium">{config.tgl_mulai ? `${tglFmt(config.tgl_mulai)} – ${tglFmt(config.tgl_selesai)}` : '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Lokasi</span><span className="font-medium">{config.lokasi || '—'}</span></div>
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Batal</button>
          <button onClick={handleCetak} disabled={printing || preview.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            <Printer className="w-4 h-4"/>
            {printing ? 'Membuat PDF...' : `Cetak ${preview.length} Kartu`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function KartuUjianPage({ showToast }: { showToast:(msg:string,type?:any)=>void }) {
  const [configs, setConfigs] = useState<any[]>([])
  const [kelasList, setKelasList] = useState<any[]>([])
  const [angkatanList, setAngkatanList] = useState<any[]>([])
  const [modal, setModal] = useState<{open:boolean;mode:'add'|'edit';form:any}>({open:false,mode:'add',form:{...EMPTY}})
  const [printModal, setPrintModal] = useState<any>(null)
  const [confirm, setConfirm] = useState<{open:boolean;id:number|null;nama:string}>({open:false,id:null,nama:''})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [r, k, a] = await Promise.all([kartuUjianApi.list(), kelasApi.list(), angkatanApi.list()])
    setConfigs(Array.isArray(r)?r:[])
    setKelasList(Array.isArray(k)?k:[])
    setAngkatanList(Array.isArray(a)?a:[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!modal.form.nama_ujian?.trim()) { showToast('Nama ujian wajib diisi','error'); return }
    setSaving(true)
    try {
      const d = { ...modal.form, angkatan_id: modal.form.angkatan_id ? Number(modal.form.angkatan_id) : null, ruang_default: modal.form.ruang_default||'' }
      if (modal.mode==='add') await kartuUjianApi.add(d)
      else await kartuUjianApi.update(modal.form.id, d)
      setModal(m=>({...m,open:false}))
      showToast(modal.mode==='add'?'Ujian ditambahkan':'Ujian diperbarui')
      load()
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirm.id) return
    await kartuUjianApi.delete(confirm.id)
    setConfirm({open:false,id:null,nama:''})
    showToast('Data ujian dihapus')
    load()
  }

  const angkatanOpt = [{value:'',label:'— Semua Siswa —'},...angkatanList.map((a:any)=>({value:String(a.id),label:a.nama}))]

  return (
    <div className="space-y-4">
      <PageHeader title="Kartu Peserta Ujian" subtitle="Kelola ujian dan cetak kartu per kelas atau per angkatan"
        actions={<Button onClick={()=>setModal({open:true,mode:'add',form:{...EMPTY}})} icon={<Plus className="w-4 h-4"/>}>Tambah Ujian</Button>}
      />

      {loading
        ? <div className="text-center py-12 text-gray-400">Memuat...</div>
        : configs.length === 0
          ? (
            <div className="text-center py-20 text-gray-400">
              <CreditCard className="w-16 h-16 mx-auto mb-4 opacity-20"/>
              <p className="font-semibold mb-1">Belum ada konfigurasi ujian</p>
              <p className="text-sm">Klik Tambah Ujian untuk membuat kartu ujian pertama</p>
            </div>
          )
          : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {configs.map(cfg => {
                const color = JENIS_COLOR[cfg.jenis_ujian] || JENIS_COLOR.default
                return (
                  <div key={cfg.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                    {/* Header warna */}
                    <div className="px-5 py-4 bg-gradient-to-r from-blue-700 to-blue-600 text-white">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-lg leading-tight truncate">{cfg.nama_ujian}</h3>
                          <p className="text-blue-200 text-sm mt-0.5">{cfg.tahun_ajaran || '—'} · Semester {cfg.semester || '—'}</p>
                        </div>
                        <span className={clsx('ml-2 px-2 py-0.5 rounded-full text-xs font-bold shrink-0', color)}>
                          {cfg.jenis_ujian}
                        </span>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="px-5 py-3 space-y-1.5 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <span className="text-gray-400 text-xs w-20">Tanggal</span>
                        <span className="font-medium">
                          {cfg.tgl_mulai ? `${tglFmt(cfg.tgl_mulai)}${cfg.tgl_selesai ? ` – ${tglFmt(cfg.tgl_selesai)}` : ''}` : '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <span className="text-gray-400 text-xs w-20">Lokasi</span>
                        <span className="font-medium">{cfg.lokasi || '—'}</span>
                      </div>
                      {cfg.ruang_default && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <span className="text-gray-400 text-xs w-20">Ruang Default</span>
                          <span className="font-medium">{cfg.ruang_default}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-gray-600">
                        <span className="text-gray-400 text-xs w-20">Angkatan</span>
                        <span className="font-medium">{cfg.nama_angkatan || 'Semua Siswa'}</span>
                      </div>
                      {cfg.keterangan && (
                        <div className="flex items-start gap-2 text-gray-600">
                          <span className="text-gray-400 text-xs w-20 shrink-0">Catatan</span>
                          <span className="text-xs text-gray-500 italic">{cfg.keterangan}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="px-4 pb-4 flex gap-2">
                      <button onClick={()=>setPrintModal(cfg)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
                        <Printer className="w-4 h-4"/> Cetak Kartu
                      </button>
                      <button onClick={()=>setModal({open:true,mode:'edit',form:{...cfg,angkatan_id:cfg.angkatan_id||'',ruang_default:cfg.ruang_default||''}})}
                        className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50">
                        <Pencil className="w-4 h-4 text-gray-500"/>
                      </button>
                      <button onClick={()=>setConfirm({open:true,id:cfg.id,nama:cfg.nama_ujian})}
                        className="p-2.5 rounded-xl border border-red-100 hover:bg-red-50">
                        <Trash2 className="w-4 h-4 text-red-400"/>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
      }

      {/* Form Modal */}
      <Modal open={modal.open} title={modal.mode==='add'?'Tambah Konfigurasi Ujian':'Edit Konfigurasi Ujian'}
        onClose={()=>setModal(m=>({...m,open:false}))}
        footer={<><Button variant="ghost" onClick={()=>setModal(m=>({...m,open:false}))}>Batal</Button><Button onClick={handleSave} loading={saving}>Simpan</Button></>}>
        <div className="space-y-3">
          <Input label="Nama Ujian *" value={modal.form.nama_ujian} onChange={v=>setModal(m=>({...m,form:{...m.form,nama_ujian:v}}))} placeholder="Contoh: PAS Semester Ganjil 2024/2025"/>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Jenis Ujian" value={modal.form.jenis_ujian} onChange={v=>setModal(m=>({...m,form:{...m.form,jenis_ujian:v}}))} options={JENIS_OPT}/>
            <Select label="Semester" value={modal.form.semester} onChange={v=>setModal(m=>({...m,form:{...m.form,semester:v}}))} options={SEM_OPT}/>
          </div>
          <Input label="Tahun Ajaran" value={modal.form.tahun_ajaran} onChange={v=>setModal(m=>({...m,form:{...m.form,tahun_ajaran:v}}))} placeholder="2024/2025"/>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Tanggal Mulai" value={modal.form.tgl_mulai} onChange={v=>setModal(m=>({...m,form:{...m.form,tgl_mulai:v}}))} type="date"/>
            <Input label="Tanggal Selesai" value={modal.form.tgl_selesai} onChange={v=>setModal(m=>({...m,form:{...m.form,tgl_selesai:v}}))} type="date"/>
          </div>
          <Input label="Lokasi / Ruangan" value={modal.form.lokasi} onChange={v=>setModal(m=>({...m,form:{...m.form,lokasi:v}}))} placeholder="Aula, Kelas VII A, dst"/>
          <Input label="Ruang Default (berlaku untuk semua peserta jika tidak diisi manual)" value={modal.form.ruang_default||''} onChange={v=>setModal(m=>({...m,form:{...m.form,ruang_default:v}}))} placeholder="Ruang 1, Aula, Lab IPA..."/>
          <Select label="Angkatan (opsional — kosong = semua siswa)" value={String(modal.form.angkatan_id||'')} onChange={v=>setModal(m=>({...m,form:{...m.form,angkatan_id:v}}))} options={angkatanOpt}/>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Keterangan</label>
            <textarea value={modal.form.keterangan||''} onChange={e=>setModal(m=>({...m,form:{...m.form,keterangan:e.target.value}}))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none" rows={2}/>
          </div>
        </div>
      </Modal>

      {/* Print Modal */}
      {printModal && (
        <PrintModal config={printModal} kelasList={kelasList} angkatanList={angkatanList}
          onClose={()=>setPrintModal(null)} showToast={showToast}/>
      )}

      <ConfirmDialog open={confirm.open} title="Hapus Konfigurasi Ujian" danger
        message={`Hapus ujian "${confirm.nama}"? Data konfigurasi akan dihapus.`}
        onConfirm={handleDelete} onCancel={()=>setConfirm({open:false,id:null,nama:''})}/>
    </div>
  )
}
