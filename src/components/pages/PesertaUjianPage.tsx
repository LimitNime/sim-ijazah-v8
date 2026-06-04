import { useState, useEffect, useCallback } from 'react'
import { Users, Save, RefreshCw, Printer, Hash, Search } from 'lucide-react'
import { Button, PageHeader, Select, SearchBar, TextInput, DropDown } from '../ui'
import { kartuUjianApi, pesertaApi, pdfCetakApi, kelasApi } from '../../lib/api'
import { clsx } from 'clsx'

export function PesertaUjianPage({ showToast }: { showToast:(msg:string,type?:any)=>void }) {
  const [configList, setConfigList]   = useState<any[]>([])
  const [kelasList, setKelasList]     = useState<any[]>([])
  const [selConfig, setSelConfig]     = useState<string>('')
  const [selKelas, setSelKelas]       = useState<string>('')
  const [peserta, setPeserta]         = useState<any[]>([])
  const [q, setQ]                     = useState('')
  const [loading, setLoading]         = useState(false)
  const [saving, setSaving]           = useState(false)
  const [printing, setPrinting]       = useState(false)
  const [autoLoading, setAutoLoading] = useState(false)
  const [changed, setChanged]         = useState<Set<number>>(new Set())

  useEffect(() => {
    kartuUjianApi.list().then((r:any) => setConfigList(Array.isArray(r)?r:[]))
    kelasApi.list().then((r:any) => setKelasList(Array.isArray(r)?r:[]))
  }, [])

  const load = useCallback(async () => {
    if (!selConfig) return
    setLoading(true)
    setChanged(new Set())
    const r = await pesertaApi.list(Number(selConfig))
    setPeserta(Array.isArray(r)?r:[])
    setLoading(false)
  }, [selConfig])

  useEffect(() => { load() }, [load])

  const setField = (siswaId:number, key:string, val:string) => {
    setPeserta(prev => prev.map(p => p.id===siswaId ? {...p,[key]:val} : p))
    setChanged(prev => new Set(prev).add(siswaId))
  }

  const setRuangAll = (ruang:string) => {
    setPeserta(prev => prev.map(p => ({...p, ruang})))
    setChanged(new Set(peserta.map(p=>p.id)))
  }

  const handleSave = async () => {
    if (!selConfig) return
    setSaving(true)
    const rows = peserta.filter(p => changed.has(p.id)).map(p => ({
      siswa_id: p.id, no_peserta: p.no_peserta||'', ruang: p.ruang||'', kursi: p.kursi||'', keterangan: p.keterangan||''
    }))
    await pesertaApi.saveBulk(Number(selConfig), rows)
    setChanged(new Set())
    showToast(`${rows.length} data peserta disimpan`)
    setSaving(false)
  }

  const handleAutoNo = async () => {
    if (!selConfig) return
    setAutoLoading(true)
    await pesertaApi.autoNo(Number(selConfig))
    showToast('Nomor peserta di-generate otomatis')
    load()
    setAutoLoading(false)
  }

  const handleCetak = async () => {
    if (!selConfig) return
    setPrinting(true)
    const r:any = await pdfCetakApi.kartuUjianPeserta(Number(selConfig))
    if (!r?.ok) showToast(r?.error||'Gagal cetak','error')
    else showToast('PDF Kartu Ujian dibuka')
    setPrinting(false)
  }

  const handleCetakKelas = async () => {
    if (!selConfig || !selKelas) { showToast('Pilih kelas terlebih dahulu','error'); return }
    setPrinting(true)
    const r:any = await pdfCetakApi.kartuUjian(Number(selConfig), Number(selKelas))
    if (!r?.ok) showToast(r?.error||'Gagal cetak','error')
    else showToast('PDF Kartu Ujian (per kelas) dibuka')
    setPrinting(false)
  }

  const cfg = configList.find(c=>String(c.id)===selConfig)

  const filtered = peserta.filter(p =>
    !q || p.nama?.toLowerCase().includes(q.toLowerCase()) ||
    (p.no_peserta||'').includes(q) || (p.ruang||'').toLowerCase().includes(q.toLowerCase())
  )

  const ruangGroups = [...new Set(peserta.map(p=>p.ruang||'').filter(Boolean))]

  const configOpt = [{value:'',label:'— Pilih Ujian —'},...configList.map((c:any)=>({value:String(c.id),label:`${c.nama_ujian} (${c.tahun_ajaran})`}))]
  const kelasOpt  = [{value:'',label:'— Semua Kelas —'},...kelasList.map((k:any)=>({value:String(k.id),label:k.nama}))]

  return (
    <div className="space-y-4">
      <PageHeader title="Peserta Ujian" subtitle="Atur nomor peserta, ruang ujian, dan cetak kartu per kelas / semua"/>

      {/* Pilih ujian */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <DropDown label="Pilih Ujian" value={selConfig} onChange={v=>{setSelConfig(v);setSelKelas('')}} options={configOpt}/>
        </div>
        <div>
          <Select label="Filter / Cetak Per Kelas" value={selKelas} onChange={setSelKelas} options={kelasOpt}/>
        </div>
      </div>

      {!selConfig
        ? <div className="text-center py-20 text-gray-400"><Users className="w-16 h-16 mx-auto mb-4 opacity-20"/><p className="font-semibold">Pilih ujian untuk mengelola peserta</p></div>
        : (
          <>
            {/* Info bar */}
            {cfg && (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex-wrap">
                <div className="flex-1">
                  <p className="font-bold text-blue-800">{cfg.nama_ujian}</p>
                  <p className="text-sm text-blue-600">{cfg.jenis_ujian} · {cfg.tahun_ajaran} · Semester {cfg.semester}</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <Users className="w-4 h-4"/>
                  <span>{peserta.length} peserta</span>
                </div>
                {ruangGroups.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {ruangGroups.map(r=>(
                      <span key={r} className="px-2 py-0.5 bg-blue-200 text-blue-800 text-xs rounded-full font-medium">Ruang {r}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Action bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex-1 max-w-xs">
                <SearchBar value={q} onChange={setQ} placeholder="Cari nama, no peserta, ruang..."/>
              </div>

              {/* Isi ruang massal */}
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-600">Isi ruang semua:</span>
                <input value="" onBlur={e=>{if(e.target.value.trim())setRuangAll(e.target.value.trim())}}
                  onChange={()=>{}}
                  onKeyDown={e=>{if(e.key==='Enter'){setRuangAll((e.target as HTMLInputElement).value.trim());(e.target as HTMLInputElement).value=''}}}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-20" placeholder="Ruang..."/>
              </div>

              {changed.size > 0 && <span className="text-xs text-amber-600 font-medium">⚠ {changed.size} belum disimpan</span>}
              <div className="flex-1"/>

              <button onClick={handleAutoNo} disabled={autoLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-50">
                <Hash className="w-4 h-4"/> {autoLoading?'Generate...':'Auto No. Peserta'}
              </button>
              <button onClick={load} className="p-1.5 hover:bg-gray-100 rounded-lg"><RefreshCw className="w-4 h-4 text-gray-500"/></button>
              <Button onClick={handleSave} loading={saving} icon={<Save className="w-4 h-4"/>}>Simpan</Button>
              {selKelas
                ? <button onClick={handleCetakKelas} disabled={printing}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    <Printer className="w-4 h-4"/> {printing?'Mencetak...':'Cetak Kelas Ini'}
                  </button>
                : <button onClick={handleCetak} disabled={printing}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-700 text-white text-sm rounded-lg hover:bg-blue-800 disabled:opacity-50">
                    <Printer className="w-4 h-4"/> {printing?'Mencetak...':'Cetak Semua Kartu'}
                  </button>
              }
            </div>

            {/* Tabel peserta */}
            {loading
              ? <div className="text-center py-12 text-gray-400">Memuat...</div>
              : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800 text-white">
                      <tr>
                        {['No','Nama Siswa','L/P','NISN / NIS','No. Peserta','Kelas','Ruang','Kursi','Keterangan'].map(h=>(
                          <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filtered.map((p:any, i:number) => {
                        const isDirty = changed.has(p.id)
                        return (
                          <tr key={p.id} className={clsx(i%2===0?'bg-white':'bg-gray-50/40', isDirty&&'bg-amber-50/50')}>
                            <td className="px-3 py-2 text-gray-400 text-center text-xs">{i+1}</td>
                            <td className="px-3 py-2 font-semibold text-gray-900 whitespace-nowrap">{p.nama}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={clsx('text-xs font-bold', p.jk==='P'?'text-pink-600':'text-blue-600')}>{p.jk}</span>
                            </td>
                            <td className="px-3 py-2 text-gray-500 font-mono text-xs">{p.nisn||p.nism||'—'}</td>
                            <td className="px-2 py-1.5">
                              <input value={p.no_peserta||''} onChange={e=>setField(p.id,'no_peserta',e.target.value)}
                                className="border border-gray-200 rounded px-2 py-1 text-xs w-28 font-mono focus:ring-1 focus:ring-blue-500 outline-none"/>
                            </td>
                            <td className="px-3 py-2 text-gray-600 text-xs">{p.kelas||'—'}</td>
                            <td className="px-2 py-1.5">
                              <input value={p.ruang||''} onChange={e=>setField(p.id,'ruang',e.target.value)}
                                className="border border-gray-200 rounded px-2 py-1 text-xs w-20 focus:ring-1 focus:ring-blue-500 outline-none"/>
                            </td>
                            <td className="px-2 py-1.5">
                              <input value={p.kursi||''} onChange={e=>setField(p.id,'kursi',e.target.value)}
                                className="border border-gray-200 rounded px-2 py-1 text-xs w-14 text-center focus:ring-1 focus:ring-blue-500 outline-none"/>
                            </td>
                            <td className="px-2 py-1.5">
                              <input value={p.keterangan||''} onChange={e=>setField(p.id,'keterangan',e.target.value)}
                                className="border border-gray-200 rounded px-2 py-1 text-xs w-full focus:ring-1 focus:ring-blue-500 outline-none"
                                placeholder="Opsional"/>
                            </td>
                          </tr>
                        )
                      })}
                      {filtered.length === 0 && (
                        <tr><td colSpan={9} className="text-center py-10 text-gray-400">Tidak ada peserta</td></tr>
                      )}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t">
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-xs text-gray-500 font-medium">
                          Total: {filtered.length} peserta ditampilkan {q && `(filter: "${q}")`}
                        </td>
                        <td colSpan={5} className="px-3 py-2 text-xs text-gray-500">
                          {ruangGroups.length > 0 && `Ruang: ${ruangGroups.join(', ')}`}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
            }
          </>
        )
      }
    </div>
  )
}
