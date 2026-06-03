import { useState } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { useToast } from './hooks/useToast'
import { LoginPage } from './components/pages/LoginPage'
import { Sidebar, type PageKey } from './components/layout/Sidebar'
import { DashboardPage } from './components/pages/DashboardPage'
import { SekolahPage } from './components/pages/SekolahPage'
import { SiswaPage } from './components/pages/SiswaPage'
import { MapelPage } from './components/pages/MapelPage'
import { SemesterPage } from './components/pages/SemesterPage'
import { InputNilaiPage } from './components/pages/InputNilaiPage'
import { RekapCetakPage } from './components/pages/RekapCetakPage'
import { RekapNilaiPage } from './components/pages/RekapNilaiPage'
import { ImportNilaiPage } from './components/pages/ImportNilaiPage'
import { PenomoranSuratPage } from './components/pages/PenomoranSuratPage'
import { AngkatanPage } from './components/pages/AngkatanPage'
import { RankingPage } from './components/pages/RankingPage'
import { WaliKelasPage }      from './components/pages/WaliKelasPage'
import { BukuKleperPage }     from './components/pages/BukuKleperPage'
import { BukuIndukSiswaPage } from './components/pages/BukuIndukSiswaPage'
import { LegerNilaiPage }     from './components/pages/LegerNilaiPage'
import { SuratPage }          from './components/pages/SuratPage'
import { KepegawaianPage }    from './components/pages/KepegawaianPage'
import { KartuUjianPage }    from './components/pages/KartuUjianPage'
import { RekapBOSPage }      from './components/pages/RekapBOSPage'
import { PPDBPage }          from './components/pages/PPDBPage'
import { RaportPage }        from './components/pages/RaportPage'
import { PesertaUjianPage }  from './components/pages/PesertaUjianPage'
import { ToastContainer } from './components/ui'

function AppInner() {
  const { user } = useAuth()
  const [loggedIn, setLoggedIn] = useState(!!user)
  const [page, setPage] = useState<PageKey>('dashboard')
  const [pageParams, setPageParams] = useState<any>(null)
  const { toasts, show, remove } = useToast()

  const navigate = (key: PageKey, params?: any) => {
    setPage(key)
    setPageParams(params || null)
  }

  if (!loggedIn || !user) {
    return (
      <>
        <LoginPage onLogin={() => setLoggedIn(true)} />
        <ToastContainer toasts={toasts} remove={remove} />
      </>
    )
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard':    return <DashboardPage onNavigate={p => navigate(p as PageKey)} />
      case 'sekolah':      return <SekolahPage showToast={show} />
      case 'siswa':        return <SiswaPage showToast={show} />
      case 'mapel':        return <MapelPage showToast={show} />
      case 'semester':     return <SemesterPage showToast={show} />
      case 'nilai':        return <InputNilaiPage showToast={show} initialSiswaId={pageParams?.siswaId} />
      case 'rekap-nilai':  return <RekapNilaiPage showToast={show} onNavigate={(p, params) => navigate(p as any, params)} />
      case 'import-nilai': return <ImportNilaiPage showToast={show} />
      case 'penomoran-surat': return <PenomoranSuratPage showToast={show} />
      case 'rekap-cetak':  return <RekapCetakPage showToast={show} />
      case 'angkatan':     return <AngkatanPage showToast={show} />
      case 'ranking':      return <RankingPage showToast={show} />
      case 'wali-kelas':    return <WaliKelasPage showToast={show} />
      case 'buku-kleper':   return <BukuKleperPage showToast={show} />
      case 'buku-induk':    return <BukuIndukSiswaPage showToast={show} />
      case 'leger-nilai':   return <LegerNilaiPage showToast={show} />
      case 'surat':         return <SuratPage showToast={show} />
      case 'kepegawaian':   return <KepegawaianPage showToast={show} />
      case 'kartu-ujian':   return <KartuUjianPage showToast={show} />
      case 'peserta-ujian':  return <PesertaUjianPage showToast={show} />
      case 'rekap-bos':     return <RekapBOSPage showToast={show} />
      case 'ppdb':          return <PPDBPage showToast={show} />
      case 'raport':        return <RaportPage showToast={show} />
      default: return null
    }
  }

  return (
    <>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar active={page} onNavigate={p => navigate(p)} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-screen-xl mx-auto h-full">
            {renderPage()}
          </div>
        </main>
      </div>
      <ToastContainer toasts={toasts} remove={remove} />
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
