import { useEffect, useState } from 'react'
import { Users, BookOpen, PenLine, GraduationCap, Folder } from 'lucide-react'
import { StatCard, SectionCard , InfoTooltip } from '../ui'
import { appApi, sekolahApi } from '../../lib/api'
import type { Sekolah } from '../../types'
import type { PageKey } from '../layout/Sidebar'

interface Props {
  onNavigate: (key: PageKey) => void
}

export function DashboardPage({ onNavigate }: Props) {
  const [stats, setStats] = useState({ siswa: 0, mapel: 0, nilai: 0, angkatan: 0 })
  const [sekolah, setSekolah] = useState<Sekolah | null>(null)
  const [paths, setPaths] = useState<{ dbPath: string; outputPath: string } | null>(null)

  useEffect(() => {
    appApi.stats().then(setStats)
    sekolahApi.get().then(setSekolah)
    appApi.getPaths().then(setPaths)
  }, [])

  const quickActions: { label: string; desc: string; key: PageKey; color: string }[] = [
    { label: 'Data Siswa',     desc: 'Tambah dan kelola siswa',      key: 'siswa',    color: 'bg-blue-50 hover:bg-blue-100 text-blue-700' },
    { label: 'Input Nilai',    desc: 'Input nilai per siswa',         key: 'nilai',    color: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700' },
    { label: 'Rekap Nilai',    desc: 'Lihat kelengkapan nilai siswa', key: 'rekap-nilai',  color: 'bg-amber-50 hover:bg-amber-100 text-amber-700' },
    { label: 'Import Nilai',   desc: 'Import nilai dari Excel',       key: 'import-nilai', color: 'bg-cyan-50 hover:bg-cyan-100 text-cyan-700' },
    { label: 'Rekap & Cetak', desc: 'Export dan cetak dokumen',       key: 'rekap-cetak',  color: 'bg-purple-50 hover:bg-purple-100 text-purple-700' },
    { label: 'Angkatan',       desc: 'Kelola angkatan kelulusan',     key: 'angkatan', color: 'bg-amber-50 hover:bg-amber-100 text-amber-700' },
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* Banner */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-600 rounded-2xl p-6 text-white shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest mb-1">Selamat Datang</p>
            <h2 className="text-xl font-black tracking-tight">{sekolah?.nama || '—'}</h2>
            <p className="text-blue-200 text-sm mt-1">
              Tahun Ajaran {sekolah?.tahun_ajaran || '—'} &nbsp;·&nbsp; {sekolah?.jenjang || 'MI'}
            </p>
          </div>
          <GraduationCap className="w-12 h-12 text-blue-400/50" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Siswa" sub={<InfoTooltip text="Jumlah siswa yang terdaftar di semua angkatan." />}      value={stats.siswa}    icon={<Users className="w-5 h-5" />}       color="text-blue-600" />
        <StatCard label="Mata Pelajaran"   value={stats.mapel}    icon={<BookOpen className="w-5 h-5" />}    color="text-emerald-600" />
        <StatCard label="Data Nilai"       value={stats.nilai}    icon={<PenLine className="w-5 h-5" />}     color="text-purple-600" />
        <StatCard label="Angkatan"         value={stats.angkatan} icon={<GraduationCap className="w-5 h-5"/>} color="text-amber-600" />
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Quick actions */}
        <SectionCard title="Akses Cepat">
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map(a => (
              <button key={a.key} onClick={() => onNavigate(a.key)}
                className={`${a.color} p-3 rounded-xl text-left transition-colors`}>
                <p className="font-semibold text-sm">{a.label}</p>
                <p className="text-xs opacity-70 mt-0.5">{a.desc}</p>
              </button>
            ))}
          </div>
        </SectionCard>

        {/* System info */}
        <SectionCard title="Informasi Sistem">
          <div className="flex flex-col gap-3">
            {[
              { label: 'Nama Sekolah',   value: sekolah?.nama },
              { label: 'Tahun Ajaran',   value: sekolah?.tahun_ajaran },
              { label: 'Bobot Raport',   value: sekolah ? `${sekolah.bobot_raport}%` : null },
              { label: 'Bobot Ujian',    value: sekolah ? `${sekolah.bobot_ujian}%` : null },
              { label: 'Versi Aplikasi', value: 'SIM Ijazah v2.0' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-xs font-semibold text-gray-400 w-28 shrink-0">{label}</span>
                <span className="text-sm text-gray-700 truncate">{value || '—'}</span>
              </div>
            ))}
            {paths && (
              <button onClick={() => appApi.openOutput()}
                className="flex items-center gap-2 mt-1 text-xs text-blue-600 hover:text-blue-800 transition-colors">
                <Folder className="w-3.5 h-3.5" />
                Buka Folder Output
              </button>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
