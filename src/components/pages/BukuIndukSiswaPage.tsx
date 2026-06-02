import { useState, useEffect, useCallback } from 'react'
import { BookMarked, Plus, Pencil, Trash2, Eye, X, ChevronLeft } from 'lucide-react'
import { Button, Modal, Input, Select, ConfirmDialog, SearchBar, PageHeader, Badge } from '../ui'
import { siswaApi, angkatanApi, pdfCetakApi } from '../../lib/api'
import { clsx } from 'clsx'

const AGAMA_OPT = ['Islam','Kristen','Katolik','Hindu','Buddha','Konghucu'].map(v=>({value:v,label:v}))
const JK_OPT = [{value:'L',label:'Laki-laki'},{value:'P',label:'Perempuan'}]
const STATUS_OPT = ['Kandung','Tiri','Angkat'].map(v=>({value:v,label:v}))

const EMPTY: any = {
  nama:'', jk:'L', nisn:'', nism:'', nik:'',
  tempat_lahir:'', tgl_lahir:'', agama:'Islam',
  anak_ke:'', jml_saudara:'',
  alamat:'', rt:'', rw:'', kelurahan:'', kecamatan:'', kabupaten:'', provinsi:'', kode_pos:'', no_hp:'',
  nama_ayah:'', pekerjaan_ayah:'', pendidikan_ayah:'',
  nama_ibu:'', pekerjaan_ibu:'', pendidikan_ibu:'',
  no_hp_ortu:'', alamat_ortu:'',
  nama_wali:'', pekerjaan_wali:'', no_hp_wali:'',
  status_anak: 'Kandung',
  asal_sekolah:'', tahun_masuk:'', kelas:'', no_induk:'',
  keterangan:''
}

function tglFmt(tgl: string) {
  if (!tgl) return '—'
  try { return new Date(tgl).toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' }) }
  catch { return tgl }
}

// ─── Detail View ─────────────────────────────────────────────────────────────
function DetailView({ siswa, onClose, onEdit }: { siswa: any; onClose: ()=>void; onEdit: ()=>void }) {
  const Section = ({ title, children }: any) => (
    <div className="mb-5">
      <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2 pb-1 border-b border-blue-100">{title}</h4>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">{children}</div>
    </div>
  )
  const Row = ({ label, value }: { label: string; value: any }) => (
    <><dt className="text-xs text-gray-500">{label}</dt><dd className="text-sm font-medium text-gray-800">{value || '—'}</dd></>
  )
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}/>
      <div className="relative ml-auto w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-700 text-white">
          <div>
            <h2 className="font-bold text-lg">{siswa.nama}</h2>
            <p className="text-blue-200 text-sm">Buku Induk Siswa</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onEdit} className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm flex items-center gap-1"><Pencil className="w-3.5 h-3.5"/>Edit</button>
            <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg"><X className="w-5 h-5"/></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <Section title="Identitas Siswa">
            <Row label="Nama Lengkap" value={siswa.nama}/>
            <Row label="Jenis Kelamin" value={siswa.jk === 'L' ? 'Laki-laki' : 'Perempuan'}/>
            <Row label="NISN" value={siswa.nisn}/>
            <Row label="NIS / NISM" value={siswa.nism}/>
            <Row label="NIK" value={siswa.nik}/>
            <Row label="Tempat Lahir" value={siswa.tempat_lahir}/>
            <Row label="Tanggal Lahir" value={tglFmt(siswa.tgl_lahir)}/>
            <Row label="Agama" value={siswa.agama}/>
            <Row label="Anak Ke" value={siswa.anak_ke}/>
            <Row label="Jumlah Saudara" value={siswa.jml_saudara}/>
            <Row label="Status Anak" value={siswa.status_anak}/>
          </Section>
          <Section title="Alamat Siswa">
            <Row label="Alamat" value={siswa.alamat}/>
            <Row label="RT/RW" value={siswa.rt && siswa.rw ? `${siswa.rt}/${siswa.rw}` : '—'}/>
            <Row label="Kelurahan/Desa" value={siswa.kelurahan}/>
            <Row label="Kecamatan" value={siswa.kecamatan}/>
            <Row label="Kabupaten/Kota" value={siswa.kabupaten}/>
            <Row label="Provinsi" value={siswa.provinsi}/>
            <Row label="Kode Pos" value={siswa.kode_pos}/>
            <Row label="No. HP" value={siswa.no_hp}/>
          </Section>
          <Section title="Data Orang Tua">
            <Row label="Nama Ayah" value={siswa.nama_ayah}/>
            <Row label="Pekerjaan Ayah" value={siswa.pekerjaan_ayah}/>
            <Row label="Pendidikan Ayah" value={siswa.pendidikan_ayah}/>
            <Row label="Nama Ibu" value={siswa.nama_ibu}/>
            <Row label="Pekerjaan Ibu" value={siswa.pekerjaan_ibu}/>
            <Row label="Pendidikan Ibu" value={siswa.pendidikan_ibu}/>
            <Row label="No. HP Ortu" value={siswa.no_hp_ortu}/>
            <Row label="Alamat Ortu" value={siswa.alamat_ortu}/>
          </Section>
          <Section title="Data Wali (jika ada)">
            <Row label="Nama Wali" value={siswa.nama_wali}/>
            <Row label="Pekerjaan Wali" value={siswa.pekerjaan_wali}/>
            <Row label="No. HP Wali" value={siswa.no_hp_wali}/>
          </Section>
          <Section title="Riwayat Sekolah">
            <Row label="Asal Sekolah" value={siswa.asal_sekolah}/>
            <Row label="Tahun Masuk" value={siswa.tahun_masuk}/>
            <Row label="Kelas" value={siswa.kelas}/>
            <Row label="No. Induk" value={siswa.no_induk}/>
          </Section>
          {siswa.keterangan && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs font-bold text-amber-700 mb-1">Keterangan</p>
              <p className="text-sm text-gray-700">{siswa.keterangan}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Form Modal ───────────────────────────────────────────────────────────────
function FormModal({ open, mode, form, setForm, onClose, onSave, saving }: any) {
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
  const F = ({ label, k, type='text', placeholder='' }: any) => (
    <Input label={label} value={form[k]||''} onChange={v=>set(k,v)} type={type} placeholder={placeholder}/>
  )
  return (
    <Modal open={open} title={mode==='add'?'Tambah Data Siswa':'Edit Data Siswa'} size="xl" onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Batal</Button><Button onClick={onSave} loading={saving}>Simpan</Button></>}>
      <div className="space-y-5">
        {/* Identitas */}
        <div>
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3">Identitas Siswa</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><F label="Nama Lengkap *" k="nama" placeholder="Nama lengkap sesuai akta"/></div>
            <Select label="Jenis Kelamin" value={form.jk||'L'} onChange={v=>set('jk',v)} options={JK_OPT}/>
            <Select label="Agama" value={form.agama||'Islam'} onChange={v=>set('agama',v)} options={AGAMA_OPT}/>
            <F label="NISN" k="nisn" placeholder="10 digit"/>
            <F label="NIS / NISM" k="nism"/>
            <F label="NIK" k="nik" placeholder="16 digit"/>
            <F label="Tempat Lahir" k="tempat_lahir"/>
            <F label="Tanggal Lahir" k="tgl_lahir" type="date"/>
            <F label="Anak Ke" k="anak_ke" type="number"/>
            <F label="Jumlah Saudara" k="jml_saudara" type="number"/>
            <Select label="Status Anak" value={form.status_anak||'Kandung'} onChange={v=>set('status_anak',v)} options={STATUS_OPT}/>
          </div>
        </div>
        {/* Alamat */}
        <div>
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3">Alamat Siswa</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><F label="Alamat Lengkap" k="alamat" placeholder="Jl. ..."/></div>
            <F label="RT" k="rt"/>
            <F label="RW" k="rw"/>
            <F label="Kelurahan/Desa" k="kelurahan"/>
            <F label="Kecamatan" k="kecamatan"/>
            <F label="Kabupaten/Kota" k="kabupaten"/>
            <F label="Provinsi" k="provinsi"/>
            <F label="Kode Pos" k="kode_pos"/>
            <F label="No. HP Siswa" k="no_hp"/>
          </div>
        </div>
        {/* Orang Tua */}
        <div>
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3">Data Orang Tua</p>
          <div className="grid grid-cols-2 gap-3">
            <F label="Nama Ayah" k="nama_ayah"/>
            <F label="Pekerjaan Ayah" k="pekerjaan_ayah"/>
            <F label="Pendidikan Ayah" k="pendidikan_ayah"/>
            <F label="Nama Ibu" k="nama_ibu"/>
            <F label="Pekerjaan Ibu" k="pekerjaan_ibu"/>
            <F label="Pendidikan Ibu" k="pendidikan_ibu"/>
            <F label="No. HP Orang Tua" k="no_hp_ortu"/>
            <div className="col-span-2"><F label="Alamat Orang Tua (jika beda)" k="alamat_ortu"/></div>
          </div>
        </div>
        {/* Wali */}
        <div>
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3">Data Wali (opsional)</p>
          <div className="grid grid-cols-2 gap-3">
            <F label="Nama Wali" k="nama_wali"/>
            <F label="Pekerjaan Wali" k="pekerjaan_wali"/>
            <F label="No. HP Wali" k="no_hp_wali"/>
          </div>
        </div>
        {/* Riwayat */}
        <div>
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3">Riwayat Sekolah</p>
          <div className="grid grid-cols-2 gap-3">
            <F label="Asal Sekolah" k="asal_sekolah"/>
            <F label="Tahun Masuk" k="tahun_masuk" placeholder="2022"/>
            <F label="Kelas" k="kelas" placeholder="VII A"/>
            <F label="No. Induk" k="no_induk"/>
            <div className="col-span-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Keterangan</label>
              <textarea value={form.keterangan||''} onChange={e=>set('keterangan',e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                rows={2} placeholder="Keterangan tambahan..."/>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function BukuIndukSiswaPage({ showToast }: { showToast: (msg: string, type?: any) => void }) {
  const [data, setData] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<{open:boolean;mode:'add'|'edit';form:any}>({open:false,mode:'add',form:{...EMPTY}})
  const [detail, setDetail] = useState<any|null>(null)
  const [confirm, setConfirm] = useState<{open:boolean;id:number|null;nama:string}>({open:false,id:null,nama:''})
  const [saving, setSaving] = useState(false)
  const [printing, setPrinting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await siswaApi.list(q) || []) }
    finally { setLoading(false) }
  }, [q])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!modal.form.nama?.trim()) { showToast('Nama siswa wajib diisi', 'error'); return }
    setSaving(true)
    try {
      if (modal.mode === 'add') await siswaApi.add(modal.form)
      else await siswaApi.update(modal.form.id, modal.form)
      setModal(m => ({ ...m, open: false }))
      showToast(modal.mode === 'add' ? 'Data siswa ditambahkan' : 'Data siswa diperbarui')
      load()
    } catch { showToast('Gagal menyimpan', 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirm.id) return
    await siswaApi.delete(confirm.id)
    setConfirm({ open: false, id: null, nama: '' })
    showToast('Data siswa dihapus')
    load()
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Buku Induk Siswa" subtitle="Data lengkap siswa format resmi"
        actions={<button onClick={async()=>{setPrinting(true);const r:any=await pdfCetakApi.bukuIndukSiswa();if(!r?.ok)showToast(r?.error||'Gagal','error');else showToast('PDF dibuka');setPrinting(false)}}
          disabled={printing} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50">
          <BookMarked className="w-4 h-4"/> {printing?'Membuat PDF...':'Cetak PDF'}
        </button>
        <Button onClick={() => setModal({ open: true, mode: 'add', form: { ...EMPTY } })} icon={<Plus className="w-4 h-4" />}>Tambah Siswa</Button>}
      />

      <div className="flex items-center gap-3">
        <div className="flex-1 max-w-sm">
          <SearchBar value={q} onChange={setQ} placeholder="Cari nama, NISN, NIS..." />
        </div>
        <span className="text-sm text-gray-500">{data.length} siswa</span>
      </div>

      {loading
        ? <div className="text-center py-12 text-gray-400">Memuat...</div>
        : data.length === 0
          ? <div className="text-center py-16 text-gray-400"><BookMarked className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Tidak ada data siswa</p></div>
          : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-2.5 text-left w-8 text-gray-500 font-semibold text-xs">No</th>
                    <th className="px-3 py-2.5 text-left text-gray-500 font-semibold text-xs">Nama Lengkap</th>
                    <th className="px-3 py-2.5 text-left text-gray-500 font-semibold text-xs">L/P</th>
                    <th className="px-3 py-2.5 text-left text-gray-500 font-semibold text-xs">NISN</th>
                    <th className="px-3 py-2.5 text-left text-gray-500 font-semibold text-xs">Tempat, Tgl Lahir</th>
                    <th className="px-3 py-2.5 text-left text-gray-500 font-semibold text-xs">Orang Tua</th>
                    <th className="px-3 py-2.5 text-left text-gray-500 font-semibold text-xs">Kelas</th>
                    <th className="px-3 py-2.5 text-center text-gray-500 font-semibold text-xs">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.map((s: any, i: number) => (
                    <tr key={s.id} className={clsx('hover:bg-blue-50 cursor-pointer', i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')}
                      onClick={() => setDetail(s)}>
                      <td className="px-3 py-2.5 text-gray-400 text-center">{i + 1}</td>
                      <td className="px-3 py-2.5 font-semibold text-gray-900">{s.nama}</td>
                      <td className="px-3 py-2.5">
                        <span className={clsx('text-xs font-bold', s.jk === 'P' ? 'text-pink-600' : 'text-blue-600')}>{s.jk || '—'}</span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 font-mono text-xs">{s.nisn || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-600 text-xs">{s.tempat_lahir && s.tgl_lahir ? `${s.tempat_lahir}, ${tglFmt(s.tgl_lahir)}` : '—'}</td>
                      <td className="px-3 py-2.5 text-gray-600 text-xs">{s.nama_ayah || s.nama_ibu || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-600 text-xs">{s.kelas || '—'}</td>
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => setDetail(s)} className="p-1.5 hover:bg-blue-100 rounded-lg"><Eye className="w-3.5 h-3.5 text-blue-500" /></button>
                          <button onClick={() => setModal({ open: true, mode: 'edit', form: { ...s } })} className="p-1.5 hover:bg-gray-100 rounded-lg"><Pencil className="w-3.5 h-3.5 text-gray-500" /></button>
                          <button onClick={() => setConfirm({ open: true, id: s.id, nama: s.nama })} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      }

      <FormModal open={modal.open} mode={modal.mode} form={modal.form}
        setForm={(fn: any) => setModal(m => ({ ...m, form: typeof fn === 'function' ? fn(m.form) : fn }))}
        onClose={() => setModal(m => ({ ...m, open: false }))}
        onSave={handleSave} saving={saving} />

      {detail && (
        <DetailView siswa={detail} onClose={() => setDetail(null)}
          onEdit={() => { setModal({ open: true, mode: 'edit', form: { ...detail } }); setDetail(null) }} />
      )}

      <ConfirmDialog open={confirm.open} title="Hapus Data Siswa" danger
        message={`Hapus data "${confirm.nama}" dari buku induk? Data nilai dan absensi tidak akan ikut terhapus.`}
        onConfirm={handleDelete} onCancel={() => setConfirm({ open: false, id: null, nama: '' })} />
    </div>
  )
}
