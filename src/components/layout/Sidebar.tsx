import React, { useState } from 'react'
import {
  LayoutDashboard, School, Users, BookOpen, Settings,
  PenLine, Printer, GraduationCap, LogOut, ChevronRight,
  BarChart2, Upload, FileSpreadsheet, Hash
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '../../hooks/useAuth'

export type PageKey =
  | 'dashboard' | 'sekolah' | 'siswa' | 'mapel'
  | 'semester' | 'nilai' | 'rekap-nilai' | 'import-nilai'
  | 'rekap-cetak' | 'angkatan' | 'penomoran-surat'

interface NavItem {
  key: PageKey
  label: string
  icon: React.ReactNode
  group?: string
}

const NAV: NavItem[] = [
  { key: 'dashboard',   label: 'Dashboard',        icon: <LayoutDashboard className="w-4 h-4" />, group: 'MENU UTAMA' },
  { key: 'sekolah',     label: 'Data Sekolah',      icon: <School className="w-4 h-4" /> },
  { key: 'siswa',       label: 'Data Siswa',         icon: <Users className="w-4 h-4" /> },
  { key: 'mapel',       label: 'Mata Pelajaran',     icon: <BookOpen className="w-4 h-4" /> },
  { key: 'semester',    label: 'Konfigurasi SMT',    icon: <Settings className="w-4 h-4" /> },
  { key: 'angkatan',    label: 'Angkatan',           icon: <GraduationCap className="w-4 h-4" /> },
  { key: 'nilai',       label: 'Input Nilai',         icon: <PenLine className="w-4 h-4" />, group: 'NILAI' },
  { key: 'rekap-nilai', label: 'Rekap Nilai',         icon: <BarChart2 className="w-4 h-4" /> },
  { key: 'import-nilai',    label: 'Import Nilai',        icon: <Upload className="w-4 h-4" /> },
  { key: 'penomoran-surat', label: 'Penomoran Surat',     icon: <Hash className="w-4 h-4" /> },
  { key: 'rekap-cetak', label: 'Rekap & Cetak PDF',  icon: <Printer className="w-4 h-4" /> },
]

interface SidebarProps {
  active: PageKey
  onNavigate: (key: PageKey) => void
}

export function Sidebar({ active, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth()

  return (
    <aside className="w-56 min-h-screen bg-zinc-900 flex flex-col select-none shrink-0">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight">SIM Ijazah</p>
            <p className="text-zinc-500 text-[10px] leading-tight mt-0.5">Sistem Informasi Nilai</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {NAV.map((item, idx) => {
          const showGroup = item.group && (idx === 0 || NAV[idx - 1].group !== item.group)
          return (
            <React.Fragment key={item.key}>
              {showGroup && (
                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest px-3 pt-4 pb-1.5">
                  {item.group}
                </p>
              )}
              <button
                onClick={() => onNavigate(item.key)}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 text-left',
                  active === item.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                )}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="flex-1 truncate">{item.label}</span>
                {active === item.key && <ChevronRight className="w-3 h-3 shrink-0" />}
              </button>
            </React.Fragment>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-zinc-800">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-zinc-800 transition-colors group">
          <div className="w-7 h-7 bg-blue-700 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
            {user?.name?.[0]?.toUpperCase() ?? 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-zinc-200 text-xs font-semibold truncate">{user?.name}</p>
            <p className="text-zinc-500 text-[10px] capitalize">{user?.role}</p>
          </div>
          <button onClick={logout} title="Keluar"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-red-400">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
