import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, BookOpen, Layers, Star } from 'lucide-react'
import { StatCard, Table, Button, SearchBar, Modal, Input, Select, ConfirmDialog, Badge, PageHeader , InfoTooltip } from '../ui'
import { mapelApi } from '../../lib/api'
import type { Mapel } from '../../types'

const EMPTY = { nama: '', kelompok: 'A' as 'A'|'B', urutan: 1, is_mulok: 0 }
const KEL_OPT = [{ value: 'A', label: 'Kelompok A' }, { value: 'B', label: 'Kelompok B' }]
const MULOK_OPT = [{ value: '0', label: 'Wajib' }, { value: '1', label: 'Muatan Lokal' }]

export function MapelPage({ showToast }: { showToast: (msg: string, type?: any) => void }) {
  const [data, setData] = useState<Mapel[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; mode: 'add'|'edit'; form: any }>({ open: false, mode: 'add', form: { ...EMPTY } })
  const [confirm, setConfirm] = useState<{ open: boolean; id: number|null; nama: string }>({ open: false, id: null, nama: '' })
  const [selected, setSelected] = useState<number|null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await mapelApi.list() || []) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = data.filter(m =>
    !q || m.nama.toLowerCase().includes(q.toLowerCase())
  )

  const stats = {
    total: data.length,
    wajib: data.filter(m => !m.is_mulok).length,
    mulok: data.filter(m => m.is_mulok).length,
    ka: data.filter(m => m.kelompok === 'A').length,
    kb: data.filter(m => m.kelompok === 'B').length,
  }

  const openAdd = () => {
    const maxUrut = data.length > 0 ? Math.max(...data.map(m => m.urutan || 0)) + 1 : 1
    setModal({ open: true, mode: 'add', form: { ...EMPTY, urutan: maxUrut } })
  }

  const openEdit = (row: Mapel) => setModal({ open: true, mode: 'edit', form: { ...row } })

  const handleSave = async () => {
    if (!modal.form.nama?.trim()) { showToast('Nama mata pelajaran wajib diisi', 'error'); return }
    setSaving(true)
    try {
      const payload = { ...modal.form, is_mulok: Number(modal.form.is_mulok) }
      if (modal.mode === 'add') await mapelApi.add(payload)
      else await mapelApi.update(modal.form.id, payload)
      setModal(m => ({ ...m, open: false }))
      showToast(modal.mode === 'add' ? 'Mata pelajaran ditambahkan' : 'Mata pelajaran diperbarui')
      load()
    } catch { showToast('Gagal menyimpan', 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirm.id) return
    try {
      await mapelApi.delete(confirm.id)
      showToast('Mata pelajaran dihapus')
      load()
    } catch { showToast('Gagal menghapus', 'error') }
    finally { setConfirm({ open: false, id: null, nama: '' }) }
  }

  const move = async (direction: -1 | 1) => {
    if (!selected) return
    const idx = data.findIndex(m => m.id === selected)
    if (idx < 0) return
    const ni = idx + direction
    if (ni < 0 || ni >= data.length) return
    const ids = data.map(m => m.id)
    ;[ids[idx], ids[ni]] = [ids[ni], ids[idx]]
    await mapelApi.reorder(ids)
    load()
  }

  const seedDefault = async () => {
    const added = await mapelApi.seedDefault()
    showToast(added > 0 ? `${added} mapel default berhasil ditambahkan` : 'Semua mapel default sudah ada', added > 0 ? 'success' : 'info')
    load()
  }

  const set = (k: string, v: any) => setModal(m => ({ ...m, form: { ...m.form, [k]: v } }))

  const columns = [
    { key: 'urutan', header: 'No', width: '60px', align: 'center' as const,
      render: (r: Mapel) => <span className="font-mono text-xs text-gray-400">{r.urutan}</span> },
    { key: 'nama', header: 'Nama Mata Pelajaran',
      render: (r: Mapel) => <span className="font-semibold text-gray-900">{r.nama}</span> },
    { key: 'kelompok', header: 'Kelompok', width: '100px', align: 'center' as const,
      render: (r: Mapel) => <Badge color={r.kelompok === 'A' ? 'blue' : 'purple'}>Kelompok {r.kelompok}</Badge> },
    { key: 'is_mulok', header: 'Jenis', width: '110px', align: 'center' as const,
      render: (r: Mapel) => r.is_mulok
        ? <Badge color="yellow">Muatan Lokal</Badge>
        : <Badge color="green">Wajib</Badge> },
    { key: 'jml_nilai', header: 'Data Nilai', width: '100px', align: 'center' as const,
      render: (r: Mapel) => <span className="text-sm text-gray-500">{r.jml_nilai ?? 0}</span> },
    { key: 'aksi', header: 'Aksi', width: '96px', align: 'center' as const,
      render: (r: Mapel) => (
        <div className="flex items-center justify-center gap-1">
          <button onClick={e => { e.stopPropagation(); openEdit(r) }}
            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={e => { e.stopPropagation(); setConfirm({ open: true, id: r.id, nama: r.nama }) }}
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )},
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Mata Pelajaran" subtitle="Kelola daftar mata pelajaran"
        actions={<Button icon={<Plus className="w-4 h-4"/>} onClick={openAdd}>Tambah Mapel</Button>} />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Mapel"    value={stats.total} icon={<BookOpen className="w-5 h-5"/>} color="text-blue-600"/>
        <StatCard label="Wajib"          value={stats.wajib} icon={<Star className="w-5 h-5"/>} color="text-emerald-600"/>
        <StatCard label="Muatan Lokal"   value={stats.mulok} icon={<Layers className="w-5 h-5"/>} color="text-amber-600"/>
        <StatCard label="Kelompok A / B" value={`${stats.ka} / ${stats.kb}`} icon={<BookOpen className="w-5 h-5"/>} color="text-purple-600"/>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-48"><SearchBar value={q} onChange={setQ} placeholder="Cari mata pelajaran..." /></div>
        <Button variant="secondary" icon={<ArrowUp className="w-4 h-4"/>} onClick={() => move(-1)} disabled={!selected}>Naik</Button>
        <Button variant="secondary" icon={<ArrowDown className="w-4 h-4"/>} onClick={() => move(1)} disabled={!selected}>Turun</Button>
        <Button variant="secondary" onClick={seedDefault} title="Isi otomatis mapel standar MI/SD (Al-Qur'an Hadis, Akidah Akhlak, Fikih, dll)">+ Default Mapel</Button>
      </div>

      <Table columns={columns} data={filtered} keyFn={r => r.id} loading={loading}
        selectedKey={selected} onRowClick={r => setSelected(r.id === selected ? null : r.id)}
        emptyText="Belum ada mata pelajaran. Klik Tambah atau gunakan Default Mapel." />

      {/* Modal */}
      <Modal open={modal.open} onClose={() => setModal(m => ({ ...m, open: false }))}
        title={modal.mode === 'add' ? 'Tambah Mata Pelajaran' : 'Edit Mata Pelajaran'}
        footer={<>
          <Button variant="secondary" onClick={() => setModal(m => ({ ...m, open: false }))}>Batal</Button>
          <Button loading={saving} onClick={handleSave}>Simpan</Button>
        </>}>
        <div className="flex flex-col gap-4">
          <Input label="Nama Mata Pelajaran *" value={modal.form.nama || ''} onChange={e => set('nama', e.target.value)} placeholder="Contoh: Bahasa Indonesia" />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Kelompok" value={modal.form.kelompok || 'A'} onChange={e => set('kelompok', e.target.value)} options={KEL_OPT} />
            <Select label="Jenis" value={String(modal.form.is_mulok ?? 0)} onChange={e => set('is_mulok', Number(e.target.value))} options={MULOK_OPT} />
          </div>
          <Input label={<span className="flex items-center gap-1">Urutan <InfoTooltip text="Urutan tampil mapel di tabel DKN, Nilai Ijazah, dan Transkrip. Isi angka kecil untuk muncul lebih atas." position="bottom" /></span>}  type="number" value={modal.form.urutan || 1} onChange={e => set('urutan', Number(e.target.value))} />
        </div>
      </Modal>

      <ConfirmDialog open={confirm.open}
        onConfirm={handleDelete} onCancel={() => setConfirm({ open: false, id: null, nama: '' })}
        title="Hapus Mata Pelajaran"
        message={`Hapus "${confirm.nama}"? Semua data nilai mapel ini juga akan terhapus.`} danger />
    </div>
  )
}
