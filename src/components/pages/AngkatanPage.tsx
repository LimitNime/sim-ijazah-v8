import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Users, GraduationCap, UserPlus, UserMinus, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button, Modal, Input, Select, Textarea, ConfirmDialog, Badge, PageHeader, StatCard, SearchBar, Table , InfoTooltip } from '../ui'
import { angkatanApi, siswaApi, exportApi } from '../../lib/api'
import type { Angkatan, Siswa } from '../../types'

const STATUS_OPT = [{ value: '1', label: 'Aktif' }, { value: '0', label: 'Selesai' }]
const EMPTY = { nama: '', tahun_lulus: '', keterangan: '', is_aktif: 1 }

export function AngkatanPage({ showToast }: { showToast: (msg: string, type?: any) => void }) {
  const [angkatan, setAngkatan]   = useState<Angkatan[]>([])
  const [selAngkatan, setSelAngkatan] = useState<Angkatan | null>(null)
  const [anggota, setAnggota]     = useState<Siswa[]>([])
  const [allSiswa, setAllSiswa]   = useState<Siswa[]>([])
  const [loading, setLoading]     = useState(true)
  const [exporting, setExporting] = useState(false)
  const [qAngkatan, setQAngkatan] = useState('')
  const [qSiswa, setQSiswa]       = useState('')
  const [qAll, setQAll]           = useState('')
  const [modal, setModal]         = useState<{ open: boolean; mode: 'add'|'edit'; form: any }>({ open: false, mode: 'add', form: { ...EMPTY } })
  const [modalTambah, setModalTambah] = useState(false)
  const [confirm, setConfirm]     = useState<{ open: boolean; id: number|null; nama: string }>({ open: false, id: null, nama: '' })
  const [selectedAnggota, setSelectedAnggota] = useState<number[]>([])
  const [selectedAll, setSelectedAll]         = useState<number[]>([])
  const [saving, setSaving]       = useState(false)

  const loadAngkatan = useCallback(async () => {
    setLoading(true)
    try { setAngkatan(await angkatanApi.list() || []) }
    finally { setLoading(false) }
  }, [])

  const loadAnggota = useCallback(async (id: number) => {
    setAnggota(await angkatanApi.getSiswa(id) || [])
  }, [])

  useEffect(() => { loadAngkatan() }, [loadAngkatan])
  useEffect(() => { siswaApi.list().then(d => setAllSiswa(d || [])) }, [])

  const onSelectAngkatan = (a: Angkatan) => {
    setSelAngkatan(a); setSelectedAnggota([])
    loadAnggota(a.id)
  }

  const stats = {
    total: angkatan.length,
    aktif: angkatan.filter(a => a.is_aktif).length,
    siswa: angkatan.reduce((s, a) => s + (a.jml_siswa ?? 0), 0),
  }

  const filteredAngkatan = angkatan.filter(a => !qAngkatan || a.nama.toLowerCase().includes(qAngkatan.toLowerCase()))
  const filteredAnggota  = anggota.filter(s => !qSiswa || s.nama.toLowerCase().includes(qSiswa.toLowerCase()) || (s.nisn||'').includes(qSiswa))
  const anggotaIds = new Set(anggota.map(s => s.id))
  const filteredAll = allSiswa.filter(s => !anggotaIds.has(s.id) && (!qAll || s.nama.toLowerCase().includes(qAll.toLowerCase()) || (s.nisn||'').includes(qAll)))

  const set = (k: string, v: any) => setModal(m => ({ ...m, form: { ...m.form, [k]: v } }))

  const handleSave = async () => {
    if (!modal.form.nama?.trim()) { showToast('Nama angkatan wajib diisi', 'error'); return }
    setSaving(true)
    try {
      const payload = { ...modal.form, is_aktif: Number(modal.form.is_aktif) }
      if (modal.mode === 'add') await angkatanApi.add(payload)
      else await angkatanApi.update(modal.form.id, payload)
      setModal(m => ({ ...m, open: false }))
      showToast(modal.mode === 'add' ? 'Angkatan ditambahkan' : 'Angkatan diperbarui')
      loadAngkatan()
    } catch { showToast('Gagal menyimpan', 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirm.id) return
    try {
      await angkatanApi.delete(confirm.id)
      if (selAngkatan?.id === confirm.id) { setSelAngkatan(null); setAnggota([]) }
      showToast('Angkatan dihapus'); loadAngkatan()
    } catch { showToast('Gagal menghapus', 'error') }
    finally { setConfirm({ open: false, id: null, nama: '' }) }
  }

  const tambahSiswa = async () => {
    if (!selAngkatan || selectedAll.length === 0) return
    await angkatanApi.tambahSiswa(selAngkatan.id, selectedAll)
    showToast(`${selectedAll.length} siswa ditambahkan`)
    setSelectedAll([]); setModalTambah(false)
    loadAnggota(selAngkatan.id); loadAngkatan()
  }

  const hapusSiswa = async () => {
    if (!selAngkatan || selectedAnggota.length === 0) return
    await angkatanApi.hapusSiswa(selAngkatan.id, selectedAnggota)
    showToast(`${selectedAnggota.length} siswa dikeluarkan`)
    setSelectedAnggota([]); loadAnggota(selAngkatan.id); loadAngkatan()
  }

  const doExport = async () => {
    if (!selAngkatan) return
    setExporting(true)
    try {
      const res = await exportApi.excelAngkatan(selAngkatan.id)
      if (res?.ok) showToast(`Export Excel berhasil: ${selAngkatan.nama}`)
      else showToast(res?.error || 'Gagal export', 'error')
    } catch { showToast('Fitur export hanya tersedia di desktop app', 'warning') }
    finally { setExporting(false) }
  }

  const toggleAnggota = (id: number) => setSelectedAnggota(p => p.includes(id) ? p.filter(x=>x!==id) : [...p, id])
  const toggleAll     = (id: number) => setSelectedAll(p => p.includes(id) ? p.filter(x=>x!==id) : [...p, id])

  const angkatanColumns = [
    { key:'nama', header:'Nama Angkatan',
      render:(r:Angkatan) => <span className="font-semibold text-gray-900">{r.nama}</span> },
    { key:'tahun_lulus', header:'Tahun', width:'75px', align:'center' as const,
      render:(r:Angkatan) => <span className="text-sm text-gray-500">{r.tahun_lulus||'-'}</span> },
    { key:'is_aktif', header:'Status', width:'85px', align:'center' as const,
      render:(r:Angkatan) => <Badge color={r.is_aktif?'green':'gray'}>{r.is_aktif?'Aktif':'Selesai'}</Badge> },
    { key:'jml_siswa', header:'Siswa', width:'60px', align:'center' as const,
      render:(r:Angkatan) => <span className="font-semibold text-blue-600">{r.jml_siswa??0}</span> },
    { key:'aksi', header:'', width:'72px', align:'center' as const,
      render:(r:Angkatan) => (
        <div className="flex items-center justify-center gap-1">
          <button onClick={e=>{e.stopPropagation();setModal({open:true,mode:'edit',form:{...r}})}}
            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
            <Pencil className="w-3.5 h-3.5"/>
          </button>
          <button onClick={e=>{e.stopPropagation();setConfirm({open:true,id:r.id,nama:r.nama})}}
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
            <Trash2 className="w-3.5 h-3.5"/>
          </button>
        </div>
      )},
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Angkatan Kelulusan" subtitle="Kelola angkatan dan export nilai per angkatan"
        actions={<Button icon={<Plus className="w-4 h-4"/>} onClick={()=>setModal({open:true,mode:'add',form:{...EMPTY}})}>Tambah Angkatan</Button>} />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Angkatan"       value={stats.total} icon={<GraduationCap className="w-5 h-5"/>} color="text-blue-600"/>
        <StatCard label="Angkatan Aktif"       value={stats.aktif} icon={<GraduationCap className="w-5 h-5"/>} color="text-emerald-600"/>
        <StatCard label="Total Siswa Terdaftar" value={stats.siswa} icon={<Users className="w-5 h-5"/>}        color="text-purple-600"/>
      </div>

      <div className="flex gap-4">
        {/* LEFT */}
        <div className="w-80 shrink-0 flex flex-col gap-2">
          <SearchBar value={qAngkatan} onChange={setQAngkatan} placeholder="Cari angkatan..."/>
          <Table columns={angkatanColumns} data={filteredAngkatan} keyFn={r=>r.id} loading={loading}
            selectedKey={selAngkatan?.id} onRowClick={onSelectAngkatan} emptyText="Belum ada angkatan"/>
        </div>

        {/* RIGHT */}
        <div className="flex-1 flex flex-col gap-3">
          {!selAngkatan ? (
            <div className="card flex items-center justify-center h-64 text-gray-400">
              <div className="text-center">
                <GraduationCap className="w-10 h-10 mx-auto mb-2 text-gray-300"/>
                <p className="font-medium">Pilih angkatan di sebelah kiri</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header detail */}
              <div className="card px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-bold text-gray-900">{selAngkatan.nama}</p>
                  <p className="text-xs text-gray-500">
                    {selAngkatan.tahun_lulus ? `Tahun Lulus: ${selAngkatan.tahun_lulus}  ·  ` : ''}
                    {anggota.length} siswa terdaftar
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="success" icon={exporting ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileSpreadsheet className="w-4 h-4"/>}
                    onClick={doExport} disabled={exporting || anggota.length === 0}>
                    {exporting ? 'Mengexport...' : 'Export Excel Nilai'}
                  </Button>
                  <Button variant="secondary" icon={<UserPlus className="w-4 h-4"/>}
                    onClick={()=>{setQAll('');setSelectedAll([]);setModalTambah(true)}}>
                    Tambah Siswa
                  </Button>
                  <Button variant="danger" icon={<UserMinus className="w-4 h-4"/>}
                    onClick={hapusSiswa} disabled={selectedAnggota.length===0}>
                    Keluarkan ({selectedAnggota.length})
                  </Button>
                </div>
              </div>

              <SearchBar value={qSiswa} onChange={setQSiswa} placeholder="Cari anggota..."/>

              {/* Tabel anggota */}
              <div className="card overflow-hidden flex-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="w-10 px-3 py-3">
                        <input type="checkbox" className="rounded"
                          checked={selectedAnggota.length===filteredAnggota.length&&filteredAnggota.length>0}
                          onChange={e=>setSelectedAnggota(e.target.checked?filteredAnggota.map(s=>s.id):[])}/>
                      </th>
                      <th className="text-left px-3 py-3 text-xs font-bold text-gray-500 uppercase">No</th>
                      <th className="text-left px-3 py-3 text-xs font-bold text-gray-500 uppercase">Nama Siswa</th>
                      <th className="text-left px-3 py-3 text-xs font-bold text-gray-500 uppercase">NISN</th>
                      <th className="text-left px-3 py-3 text-xs font-bold text-gray-500 uppercase">NISM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredAnggota.length===0
                      ? <tr><td colSpan={5} className="text-center py-10 text-gray-400 text-sm">
                          Belum ada anggota. Klik "Tambah Siswa".
                        </td></tr>
                      : filteredAnggota.map((s,i) => (
                        <tr key={s.id} className={selectedAnggota.includes(s.id)?'bg-red-50':i%2===0?'bg-white':'bg-gray-50/50'}>
                          <td className="px-3 py-2.5 text-center">
                            <input type="checkbox" className="rounded accent-red-500"
                              checked={selectedAnggota.includes(s.id)} onChange={()=>toggleAnggota(s.id)}/>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-400 font-mono">{s.no_urut}</td>
                          <td className="px-3 py-2.5 font-semibold text-gray-900">{s.nama}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">{s.nisn||'-'}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">{s.nism||'-'}</td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal angkatan */}
      <Modal open={modal.open} onClose={()=>setModal(m=>({...m,open:false}))}
        title={modal.mode==='add'?'Tambah Angkatan':'Edit Angkatan'}
        footer={<>
          <Button variant="secondary" onClick={()=>setModal(m=>({...m,open:false}))}>Batal</Button>
          <Button loading={saving} onClick={handleSave}>Simpan</Button>
        </>}>
        <div className="flex flex-col gap-4">
          <Input label="Nama Angkatan *" value={modal.form.nama||''} onChange={e=>set('nama',e.target.value)}
            placeholder="Contoh: Angkatan ke-15 / Angkatan 2025"/>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Tahun Lulus" value={modal.form.tahun_lulus||''} onChange={e=>set('tahun_lulus',e.target.value)} placeholder="2025"/>
            <Select label="Status" value={String(modal.form.is_aktif??1)} onChange={e=>set('is_aktif',Number(e.target.value))} options={STATUS_OPT}/>
          </div>
          <Textarea label="Keterangan" value={modal.form.keterangan||''} onChange={e=>set('keterangan',e.target.value)}
            placeholder="Catatan tambahan..." rows={3}/>
        </div>
      </Modal>

      {/* Modal tambah siswa */}
      <Modal open={modalTambah} onClose={()=>setModalTambah(false)} size="lg"
        title={`Tambah Siswa ke ${selAngkatan?.nama}`}
        footer={<>
          <Button variant="secondary" onClick={()=>setModalTambah(false)}>Batal</Button>
          <Button onClick={tambahSiswa} disabled={selectedAll.length===0}>
            Tambahkan ({selectedAll.length}) Siswa
          </Button>
        </>}>
        <div className="flex flex-col gap-3">
          <SearchBar value={qAll} onChange={setQAll} placeholder="Cari siswa..."/>
          <p className="text-xs text-gray-400">Siswa yang sudah terdaftar tidak ditampilkan.</p>
          <div className="border border-gray-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="w-10 px-3 py-2.5">
                    <input type="checkbox" className="rounded"
                      checked={selectedAll.length===filteredAll.length&&filteredAll.length>0}
                      onChange={e=>setSelectedAll(e.target.checked?filteredAll.map(s=>s.id):[])}/>
                  </th>
                  <th className="text-left px-3 py-2.5 text-xs font-bold text-gray-500">Nama Siswa</th>
                  <th className="text-left px-3 py-2.5 text-xs font-bold text-gray-500">NISN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredAll.length===0
                  ? <tr><td colSpan={3} className="text-center py-8 text-gray-400 text-sm">Tidak ada siswa</td></tr>
                  : filteredAll.map((s,i)=>(
                    <tr key={s.id} className={selectedAll.includes(s.id)?'bg-blue-50':i%2===0?'bg-white':'bg-gray-50/40'}>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" className="rounded accent-blue-600"
                          checked={selectedAll.includes(s.id)} onChange={()=>toggleAll(s.id)}/>
                      </td>
                      <td className="px-3 py-2 font-semibold text-gray-900">{s.no_urut}. {s.nama}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 font-mono">{s.nisn||'-'}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={confirm.open}
        onConfirm={handleDelete} onCancel={()=>setConfirm({open:false,id:null,nama:''})}
        title="Hapus Angkatan" message={`Hapus angkatan "${confirm.nama}"? Data siswa di angkatan ini juga akan dihapus.`} danger/>
    </div>
  )
}
