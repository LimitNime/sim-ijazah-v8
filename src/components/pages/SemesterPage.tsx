import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Calendar, AlertTriangle } from 'lucide-react'
import { Button, Modal, Input, Select, ConfirmDialog, PageHeader, SectionCard, Table, Badge , InfoTooltip } from '../ui'
import { semesterApi } from '../../lib/api'
import type { Semester } from '../../types'

const EMPTY = { label: '', urutan: 1, is_ujian: 0 }
const JENIS_OPT = [{ value: '0', label: 'Semester Raport' }, { value: '1', label: 'Ujian / UM (semester terakhir)' }]

export function SemesterPage({ showToast }: { showToast: (msg: string, type?: any) => void }) {
  const [data, setData] = useState<Semester[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; mode: 'add' | 'edit'; form: any }>({ open: false, mode: 'add', form: { ...EMPTY } })
  const [confirm, setConfirm] = useState<{ open: boolean; id: number | null; label: string }>({ open: false, id: null, label: '' })
  const [selected, setSelected] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await semesterApi.list() || []) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    const maxUrut = data.length > 0 ? Math.max(...data.map(s => s.urutan)) + 1 : 1
    setModal({ open: true, mode: 'add', form: { ...EMPTY, urutan: maxUrut } })
  }

  const openEdit = (row: Semester) => setModal({ open: true, mode: 'edit', form: { ...row } })

  const handleSave = async () => {
    if (!modal.form.label?.trim()) { showToast('Label semester wajib diisi', 'error'); return }
    setSaving(true)
    try {
      const payload = { ...modal.form, is_ujian: Number(modal.form.is_ujian) }
      if (modal.mode === 'add') await semesterApi.add(payload)
      else await semesterApi.update(modal.form.id, payload)
      setModal(m => ({ ...m, open: false }))
      showToast(modal.mode === 'add' ? 'Semester ditambahkan' : 'Semester diperbarui')
      load()
    } catch { showToast('Gagal menyimpan', 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirm.id) return
    if (data.length <= 1) { showToast('Harus ada minimal 1 semester', 'error'); return }
    try {
      await semesterApi.delete(confirm.id)
      showToast('Semester dihapus')
      load()
    } catch { showToast('Gagal menghapus', 'error') }
    finally { setConfirm({ open: false, id: null, label: '' }) }
  }

  const move = async (direction: -1 | 1) => {
    if (!selected) return
    const idx = data.findIndex(s => s.id === selected)
    if (idx < 0) return
    const ni = idx + direction
    if (ni < 0 || ni >= data.length) return
    const ids = data.map(s => s.id)
    ;[ids[idx], ids[ni]] = [ids[ni], ids[idx]]
    await semesterApi.reorder(ids)
    load()
  }

  const set = (k: string, v: any) => setModal(m => ({ ...m, form: { ...m.form, [k]: v } }))

  const columns = [
    { key: 'urutan', header: 'Urutan', width: '80px', align: 'center' as const,
      render: (r: Semester) => <span className="font-mono text-xs text-gray-400">{r.urutan}</span> },
    { key: 'label', header: 'Label Semester',
      render: (r: Semester) => <span className="font-semibold text-gray-900">{r.label}</span> },
    { key: 'is_ujian', header: 'Jenis', width: '160px', align: 'center' as const,
      render: (r: Semester) => r.is_ujian
        ? <Badge color="yellow">Ujian / UM</Badge>
        : <Badge color="blue">Raport</Badge> },
    { key: 'aksi', header: 'Aksi', width: '96px', align: 'center' as const,
      render: (r: Semester) => (
        <div className="flex items-center justify-center gap-1">
          <button onClick={e => { e.stopPropagation(); openEdit(r) }}
            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={e => { e.stopPropagation(); setConfirm({ open: true, id: r.id, label: r.label }) }}
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )},
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Konfigurasi Semester" subtitle="Atur semester sesuai jenjang sekolah"
        actions={<Button icon={<Plus className="w-4 h-4"/>} onClick={openAdd}>Tambah Semester</Button>} />

      {/* Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
        <div className="text-sm text-amber-800">
          <strong>Catatan:</strong> Semester bertanda <Badge color="yellow">Ujian / UM</Badge> digunakan sebagai nilai ujian akhir.
          Semester lainnya dihitung sebagai nilai raport. Urutan menentukan tampilan di Input Nilai.
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Button variant="secondary" icon={<ArrowUp className="w-4 h-4"/>} onClick={() => move(-1)} disabled={!selected}>Naik</Button>
        <Button variant="secondary" icon={<ArrowDown className="w-4 h-4"/>} onClick={() => move(1)} disabled={!selected}>Turun</Button>
        <span className="text-xs text-gray-400 ml-2">Klik baris untuk memilih, lalu Naik/Turun untuk mengubah urutan</span>
      </div>

      <Table columns={columns} data={data} keyFn={r => r.id} loading={loading}
        selectedKey={selected} onRowClick={r => setSelected(r.id === selected ? null : r.id)}
        emptyText="Belum ada semester." />

      {/* Modal */}
      <Modal open={modal.open} onClose={() => setModal(m => ({ ...m, open: false }))}
        title={modal.mode === 'add' ? 'Tambah Semester' : 'Edit Semester'}
        footer={<>
          <Button variant="secondary" onClick={() => setModal(m => ({ ...m, open: false }))}>Batal</Button>
          <Button loading={saving} onClick={handleSave}>Simpan</Button>
        </>}>
        <div className="flex flex-col gap-4">
          <Input label="Label Semester *" value={modal.form.label || ''} onChange={e => set('label', e.target.value)}
            placeholder="Contoh: Semester 1 (Ganjil)" />
          <div className="grid grid-cols-2 gap-4">
            <Input label={<span className="flex items-center gap-1">Urutan <InfoTooltip text="Urutan tampil semester di tabel dan template Excel. Semester ujian biasanya diurutkan paling akhir." /></span>}  type="number" value={modal.form.urutan || 1} onChange={e => set('urutan', Number(e.target.value))} />
            <Select label="Jenis" value={String(modal.form.is_ujian ?? 0)} onChange={e => set('is_ujian', Number(e.target.value))} options={JENIS_OPT} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={confirm.open}
        onConfirm={handleDelete} onCancel={() => setConfirm({ open: false, id: null, label: '' })}
        title="Hapus Semester"
        message={`Hapus "${confirm.label}"? Semua data nilai pada semester ini juga akan terhapus.`} danger />
    </div>
  )
}
