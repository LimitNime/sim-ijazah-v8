import { useState } from 'react'
import { Download, Upload, CheckCircle, XCircle, AlertCircle, FileSpreadsheet, Info } from 'lucide-react'
import { Button, PageHeader , InfoTooltip } from '../ui'
import { nilaiApi } from '../../lib/api'

interface PreviewRow {
  baris: number
  nama: string
  nisn: string
  status: 'ok' | 'error' | 'warning'
  pesan?: string
  data?: any
}

export function ImportNilaiPage({ showToast }: { showToast: (msg: string, type?: any) => void }) {
  const [step, setStep]               = useState<1|2|3>(1)
  const [preview, setPreview]         = useState<PreviewRow[]>([])
  const [importing, setImporting]     = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [result, setResult]           = useState<{ imported: number; skipped: number; errors: number } | null>(null)

  const handleDownloadTemplate = async () => {
    setDownloading(true)
    try {
      const res = await nilaiApi.importTemplate() as any
      if (res?.ok) showToast('Template berhasil didownload — buka file Excel, isi nilai, lalu import kembali')
      else showToast(res?.message || 'Gagal download template', 'error')
    } catch { showToast('Fitur ini hanya tersedia di aplikasi desktop', 'warning') }
    finally { setDownloading(false) }
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      const res = await nilaiApi.importNilai() as any
      if (res?.ok) {
        setResult({ imported: res.imported || 0, skipped: res.skipped || 0, errors: res.errors || 0 })
        setStep(3)
        showToast(`Import selesai: ${res.imported} nilai berhasil disimpan`)
      } else {
        showToast(res?.message || 'Gagal import', 'error')
      }
    } catch { showToast('Fitur ini hanya tersedia di aplikasi desktop', 'warning') }
    finally { setImporting(false) }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Import Nilai" subtitle="Download template, isi nilai, lalu upload kembali ke sistem"/>

      {/* Step indicator */}
      <div className="card px-6 py-4">
        <div className="flex items-center gap-0">
          {[
            { n:1, label:'Download Template' },
            { n:2, label:'Preview & Validasi' },
            { n:3, label:'Selesai' },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center flex-1">
              <div className={[
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors',
                step > s.n ? 'bg-emerald-500 text-white' : step === s.n ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'
              ].join(' ')}>
                {step > s.n ? <CheckCircle className="w-4 h-4"/> : s.n}
              </div>
              <span className={['text-xs ml-2 font-medium', step >= s.n ? 'text-gray-700' : 'text-gray-400'].join(' ')}>{s.label}</span>
              {i < 2 && <div className={['flex-1 h-0.5 mx-3', step > s.n ? 'bg-emerald-300' : 'bg-gray-200'].join(' ')}/>}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Download Template */}
      {step <= 2 && (
        <div className="card p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-6 h-6 text-emerald-600"/>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 mb-1">Langkah 1 — Download Template Excel</h3>
              <p className="text-sm text-gray-500 mb-3">
                Template sudah berisi daftar siswa, mapel, dan semester yang ada di sistem.
                Isi kolom nilai sesuai semester, lalu simpan file.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 mb-4">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5"/>
                  <div>
                    <p className="font-semibold mb-1">Aturan pengisian template:</p>
                    <ul className="space-y-0.5 list-disc list-inside">
                      <li>Jangan ubah kolom NISN, Nama Siswa, dan Mata Pelajaran</li>
                      <li>Untuk semester raport: isi kolom <strong>Nilai P</strong> (Nilai Pengetahuan) saja (0–100)</li>
                      <li>Untuk semester ujian: isi kolom <strong>Nilai Ujian</strong> (0–100)</li>
                      <li>Kosongkan sel jika nilai belum ada, jangan isi 0</li>
                      <li>Jangan ubah format atau tambah/hapus baris/kolom</li>
                    </ul>
                  </div>
                </div>
              </div>
              <Button icon={<Download className="w-4 h-4"/>} loading={downloading} onClick={handleDownloadTemplate}>
                Download Template Excel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 1-2: Upload */}
      {step <= 2 && (
        <div className="card p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
              <Upload className="w-6 h-6 text-blue-600"/>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 mb-1">Langkah 2 — Import File yang Sudah Diisi</h3>
              <p className="text-sm text-gray-500 mb-4">
                Pilih file Excel template yang sudah diisi. Sistem akan memvalidasi terlebih dahulu sebelum menyimpan.
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" icon={<Upload className="w-4 h-4"/>} onClick={() => { setStep(2); handleImport() }} loading={importing}>
                  Pilih File & Import
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Hasil */}
      {step === 3 && result && (
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-500"/>
            <div>
              <h3 className="font-bold text-gray-900">Import Selesai</h3>
              <p className="text-sm text-gray-500">Data nilai telah diperbarui di sistem</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-emerald-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-extrabold text-emerald-600">{result.imported}</p>
              <p className="text-xs text-emerald-700 font-medium mt-1">Nilai Berhasil Disimpan</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-extrabold text-amber-600">{result.skipped}</p>
              <p className="text-xs text-amber-700 font-medium mt-1">Dilewati (sel kosong)</p>
            </div>
            <div className="bg-red-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-extrabold text-red-500">{result.errors}</p>
              <p className="text-xs text-red-600 font-medium mt-1">Gagal / Error</p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => { setStep(1); setResult(null) }}>
            Import Lagi
          </Button>
        </div>
      )}
    </div>
  )
}
