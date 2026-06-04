import { useState, useEffect, useCallback } from 'react'
import { DollarSign, Plus, Pencil, Trash2, Printer, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
import { Button, Modal, Input, Select, ConfirmDialog, PageHeader, TextInput, DropDown } from '../ui'
import { bosApi, pdfCetakApi } from '../../lib/api'
import { clsx } from 'clsx'

const SEM_OPT = ['Ganjil','Genap'].map(v=>({value:v,label:v}))

// Komponen BOS standar Kemdikbud
const KOMPONEN_BOS = [
  'Pengembangan Kompetensi Lulusan',
  'Pengembangan Standar Isi',
  'Pengembangan Standar Proses',
  'Pengembangan Standar Penilaian Pendidikan',
  'Pengembangan Pendidik dan Tenaga Kependidikan',
  'Pengembangan Sarana dan Prasarana Sekolah',
  'Pengembangan Standar Pengelolaan',
  'Pengembangan Standar Pembiayaan',
  'Kegiatan Lainnya',
]

const fmtRp = (n: number) => {
  if (!n && n !== 0) return '—'
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)
}

const EMPTY = { komponen:'', sub_komponen:'', anggaran:0, realisasi:0, tahun:'', semester:'Ganjil', keterangan:'' }

export function RekapBOSPage({ showToast }: { showToast:(msg:string,type?:any)=>void }) {
  const currentYear = new Date().getFullYear()
  const [tahun, setTahun] = useState(String(currentYear))
  const [semester, setSemester] = useState('Ganjil')
  const [data, setData] = useState<any[]>([])
  const [summary, setSummary] = useState<any[]>([])
  const [modal, setModal] = useState<{open:boolean;mode:'add'|'edit';form:any}>({open:false,mode:'add',form:{...EMPTY}})
  const [confirm, setConfirm] = useState<{open:boolean;id:number|null}>({open:false,id:null})
  const [saving, setSaving] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeKomponen, setActiveKomponen] = useState<string|null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [r, s] = await Promise.all([bosApi.list(tahun, semester), bosApi.summary(tahun, semester)])
    setData(Array.isArray(r)?r:[])
    setSummary(Array.isArray(s)?s:[])
    setLoading(false)
  }, [tahun, semester])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!modal.form.komponen?.trim()) { showToast('Komponen wajib diisi','error'); return }
    setSaving(true)
    try {
      await bosApi.save({ ...modal.form, tahun, semester, anggaran: Number(modal.form.anggaran)||0, realisasi: Number(modal.form.realisasi)||0 })
      setModal(m=>({...m,open:false}))
      showToast(modal.mode==='add'?'Data ditambahkan':'Data diperbarui')
      load()
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirm.id) return
    await bosApi.delete(confirm.id)
    setConfirm({open:false,id:null})
    showToast('Data dihapus')
    load()
  }

  const handlePrint = async () => {
    setPrinting(true)
    const r: any = await pdfCetakApi.rekapBOS(tahun, semester)
    if (!r?.ok) showToast(r?.error||'Gagal cetak','error')
    else showToast('PDF Rekap BOS dibuka')
    setPrinting(false)
  }

  // Totals
  const totalAnggaran = data.reduce((a,r)=>a+(r.anggaran||0),0)
  const totalRealisasi = data.reduce((a,r)=>a+(r.realisasi||0),0)
  const serapan = totalAnggaran > 0 ? Math.round((totalRealisasi/totalAnggaran)*100) : 0

  const kompOpt = [{value:'',label:'— Pilih komponen —'},...KOMPONEN_BOS.map(v=>({value:v,label:v}))]

  // Group data by komponen
  const grouped = data.reduce((acc:any,r:any)=>{ if(!acc[r.komponen])acc[r.komponen]=[]; acc[r.komponen].push(r); return acc },{})

  return (
    <div className="space-y-4">
      <PageHeader title="Rekap BOS" subtitle="Rencana anggaran dan realisasi Dana BOS"
        actions={
          <div className="flex gap-2">
            <button onClick={handlePrint} disabled={printing}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50">
              <Printer className="w-4 h-4"/> {printing?'Membuat...':'Cetak PDF'}
            </button>
            <Button onClick={()=>setModal({open:true,mode:'add',form:{...EMPTY,tahun,semester}})} icon={<Plus className="w-4 h-4"/>}>Tambah</Button>
          </div>
        }
      />

      {/* Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Tahun:</label>
          <input value={tahun} onChange={e=>setTahun(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-24" placeholder="2024"/>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {SEM_OPT.map(s=>(
            <button key={s.value} onClick={()=>setSemester(s.value)}
              className={clsx('px-3 py-1 rounded-md text-sm font-medium transition-all',
                semester===s.value?'bg-white text-blue-700 shadow-sm':'text-gray-500')}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase">Total Anggaran</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{fmtRp(totalAnggaran)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase">Total Realisasi</p>
          <p className="text-xl font-bold text-blue-700 mt-1">{fmtRp(totalRealisasi)}</p>
        </div>
        <div className={clsx('rounded-xl border p-4', serapan>=80?'bg-green-50 border-green-200':serapan>=50?'bg-yellow-50 border-yellow-200':'bg-red-50 border-red-200')}>
          <p className="text-xs text-gray-500 font-semibold uppercase">Serapan</p>
          <div className="flex items-center gap-2 mt-1">
            <p className={clsx('text-xl font-bold', serapan>=80?'text-green-700':serapan>=50?'text-yellow-700':'text-red-700')}>{serapan}%</p>
            {serapan>=80?<TrendingUp className="w-5 h-5 text-green-600"/>:serapan>=50?<TrendingUp className="w-5 h-5 text-yellow-600"/>:<TrendingDown className="w-5 h-5 text-red-500"/>}
          </div>
          <div className="mt-2 bg-gray-200 rounded-full h-2">
            <div className={clsx('h-2 rounded-full transition-all',serapan>=80?'bg-green-500':serapan>=50?'bg-yellow-500':'bg-red-500')} style={{width:`${Math.min(serapan,100)}%`}}/>
          </div>
        </div>
      </div>

      {/* Tabel per komponen */}
      {loading
        ? <div className="text-center py-12 text-gray-400">Memuat...</div>
        : data.length === 0
          ? (
            <div className="text-center py-16 text-gray-400">
              <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30"/>
              <p className="font-semibold">Belum ada data BOS</p>
              <p className="text-sm mt-1">Tambahkan komponen anggaran untuk {semester} {tahun}</p>
            </div>
          )
          : (
            <div className="space-y-3">
              {Object.keys(grouped).map((komp, ki) => {
                const rows = grouped[komp]
                const subTotal = { anggaran: rows.reduce((a:number,r:any)=>a+(r.anggaran||0),0), realisasi: rows.reduce((a:number,r:any)=>a+(r.realisasi||0),0) }
                const pct = subTotal.anggaran > 0 ? Math.round((subTotal.realisasi/subTotal.anggaran)*100) : 0
                const isOpen = activeKomponen === komp
                return (
                  <div key={komp} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {/* Komponen header */}
                    <button onClick={()=>setActiveKomponen(isOpen?null:komp)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">{ki+1}</div>
                        <div className="text-left">
                          <p className="font-semibold text-gray-800 text-sm">{komp}</p>
                          <p className="text-xs text-gray-500">{rows.length} sub-komponen · Serapan {pct}%</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-right hidden sm:block">
                          <p className="text-gray-500 text-xs">Anggaran</p>
                          <p className="font-semibold">{fmtRp(subTotal.anggaran)}</p>
                        </div>
                        <div className="text-right hidden sm:block">
                          <p className="text-gray-500 text-xs">Realisasi</p>
                          <p className={clsx('font-semibold', pct>=80?'text-green-700':pct>=50?'text-yellow-700':'text-red-600')}>{fmtRp(subTotal.realisasi)}</p>
                        </div>
                        <span className="text-gray-400 text-lg">{isOpen?'▲':'▼'}</span>
                      </div>
                    </button>

                    {/* Sub-komponen rows */}
                    {isOpen && (
                      <div className="border-t">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              {['Sub Komponen','Anggaran','Realisasi','Sisa','Serapan','Aksi'].map(h=>(
                                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {rows.map((r:any,i:number)=>{
                              const sisa = (r.anggaran||0)-(r.realisasi||0)
                              const rPct = r.anggaran>0?Math.round((r.realisasi/r.anggaran)*100):0
                              return (
                                <tr key={r.id} className={i%2===0?'bg-white':'bg-gray-50/40'}>
                                  <td className="px-3 py-2.5">
                                    <p className="font-medium text-gray-800">{r.sub_komponen||'—'}</p>
                                    {r.keterangan&&<p className="text-xs text-gray-400 italic">{r.keterangan}</p>}
                                  </td>
                                  <td className="px-3 py-2.5 font-mono text-xs text-gray-700">{fmtRp(r.anggaran)}</td>
                                  <td className="px-3 py-2.5 font-mono text-xs text-blue-700 font-semibold">{fmtRp(r.realisasi)}</td>
                                  <td className={clsx('px-3 py-2.5 font-mono text-xs font-semibold', sisa<0?'text-red-600':sisa===0?'text-gray-500':'text-green-700')}>{fmtRp(Math.abs(sisa))}{sisa<0?' (lebih)':''}</td>
                                  <td className="px-3 py-2.5">
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 bg-gray-200 rounded-full h-1.5 min-w-[40px]">
                                        <div className={clsx('h-1.5 rounded-full',rPct>=80?'bg-green-500':rPct>=50?'bg-yellow-500':'bg-red-500')} style={{width:`${Math.min(rPct,100)}%`}}/>
                                      </div>
                                      <span className="text-xs text-gray-600 w-8 shrink-0">{rPct}%</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <div className="flex gap-1">
                                      <button onClick={()=>setModal({open:true,mode:'edit',form:{...r}})} className="p-1.5 hover:bg-gray-100 rounded-lg"><Pencil className="w-3.5 h-3.5 text-gray-500"/></button>
                                      <button onClick={()=>setConfirm({open:true,id:r.id})} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400"/></button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                          <tfoot className="bg-blue-50 border-t-2 border-blue-200">
                            <tr>
                              <td className="px-3 py-2 font-bold text-blue-800 text-xs">Subtotal {komp.split(' ').slice(-2).join(' ')}</td>
                              <td className="px-3 py-2 font-mono font-bold text-xs text-blue-800">{fmtRp(subTotal.anggaran)}</td>
                              <td className="px-3 py-2 font-mono font-bold text-xs text-blue-800">{fmtRp(subTotal.realisasi)}</td>
                              <td className="px-3 py-2 font-mono font-bold text-xs text-blue-800">{fmtRp(subTotal.anggaran-subTotal.realisasi)}</td>
                              <td className="px-3 py-2 font-bold text-blue-800 text-xs">{pct}%</td>
                              <td/>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Grand total */}
              <div className="bg-blue-700 rounded-xl p-4 flex flex-wrap gap-6 text-white">
                <div><p className="text-blue-200 text-xs">TOTAL ANGGARAN</p><p className="font-bold text-lg">{fmtRp(totalAnggaran)}</p></div>
                <div><p className="text-blue-200 text-xs">TOTAL REALISASI</p><p className="font-bold text-lg">{fmtRp(totalRealisasi)}</p></div>
                <div><p className="text-blue-200 text-xs">SISA ANGGARAN</p><p className={clsx('font-bold text-lg', totalAnggaran-totalRealisasi<0?'text-red-300':'text-green-300')}>{fmtRp(Math.abs(totalAnggaran-totalRealisasi))}</p></div>
                <div><p className="text-blue-200 text-xs">SERAPAN</p><p className={clsx('font-bold text-lg',serapan>=80?'text-green-300':serapan>=50?'text-yellow-300':'text-red-300')}>{serapan}%</p></div>
              </div>
            </div>
          )
      }

      {/* Form Modal */}
      <Modal open={modal.open} title={modal.mode==='add'?'Tambah Data BOS':'Edit Data BOS'}
        onClose={()=>setModal(m=>({...m,open:false}))}
        footer={<><Button variant="ghost" onClick={()=>setModal(m=>({...m,open:false}))}>Batal</Button><Button onClick={handleSave} loading={saving}>Simpan</Button></>}>
        <div className="space-y-3">
          <DropDown label="Komponen *" value={modal.form.komponen||''} onChange={v=>setModal(m=>({...m,form:{...m.form,komponen:v}}))} options={kompOpt}/>
          <TextInput label="Sub Komponen" value={modal.form.sub_komponen||''} onChange={v=>setModal(m=>({...m,form:{...m.form,sub_komponen:v}}))} placeholder="Mis: Pembelian ATK, Pembayaran Listrik, dst"/>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Anggaran (Rp)</label>
              <input type="number" value={modal.form.anggaran||0} onChange={e=>setModal(m=>({...m,form:{...m.form,anggaran:e.target.value}}))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"/>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Realisasi (Rp)</label>
              <input type="number" value={modal.form.realisasi||0} onChange={e=>setModal(m=>({...m,form:{...m.form,realisasi:e.target.value}}))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"/>
            </div>
          </div>
          <TextInput label="Keterangan" value={modal.form.keterangan||''} onChange={v=>setModal(m=>({...m,form:{...m.form,keterangan:v}}))} placeholder="Opsional"/>
        </div>
      </Modal>

      <ConfirmDialog open={confirm.open} title="Hapus Data BOS" danger message="Hapus data BOS ini?"
        onConfirm={handleDelete} onCancel={()=>setConfirm({open:false,id:null})}/>
    </div>
  )
}
