export interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'operator'
}

export interface Sekolah {
  id: number
  nama: string
  nss: string
  npsn: string
  kepala: string
  nip: string
  alamat: string
  kota: string
  provinsi: string
  kode_pos: string
  telp: string
  email_sekolah: string
  website: string
  tahun_ajaran: string
  tgl_lulus: string
  bobot_raport: number
  bobot_ujian: number
  jenjang: string
  logo_sekolah?: string
  logo_kemdikbud?: string
  logo_garuda?: string
  program_keahlian?: string
  kompetensi_keahlian?: string
  keputusan_kepala?: string
  no_sk?: string
  kabupaten?: string
  tgl_rapat?: string
  jenis_kekhususan?: string
  nama_singkat?: string
  yayasan?: string
  jenis_sekolah?: string
  alamat2?: string
  no_skkb?: string
  pdf_ukuran?: string  // 'A4' | 'F4'
  // PDF margin (disimpan dalam pt, ditampilkan dalam cm di UI)
  pdf_margin_left?: number
  pdf_margin_right?: number
  pdf_margin_top?: number
  pdf_margin_bottom?: number
  // Kop surat
  kop_font_family?: string
  kop_font_nama?: number
  kop_font_yayasan?: number
  kop_font_jenis?: number
  kop_show_logo_kanan?: number
  // SKL
  judul_skl?: string
  paragraf_pembuka_skl?: string
  paragraf_penutup_skl?: string
  judul_sk_kelulusan?: string
  paragraf_pembuka_sk?: string
  paragraf_penutup_sk?: string
}

export interface Semester {
  id: number
  label: string
  urutan: number
  is_ujian: number
}

export interface Siswa {
  id: number
  no_urut: number
  nism: string
  nisn: string
  nama: string
  jk: 'Laki-laki' | 'Perempuan'
  tempat_lahir: string
  tgl_lahir: string
  // Orang tua
  ortu: string          // nama ayah (utama, backward compat)
  nama_ibu: string
  // Identitas tambahan
  agama: string
  kewarganegaraan: string
  anak_ke: string
  asal_sekolah: string
  tahun_masuk: string
  kelas: string
  // Kontak
  no_hp_ortu: string
  alamat: string
  // Dokumen
  peserta_am: string
  no_peserta: string
  blanko: string
  no_skl?: string
  no_skkb?: string
  jenis_kekhususan?: string
  // Media
  foto?: string
  // Computed
  jml_nilai?: number
}

export interface Mapel {
  id: number
  nama: string
  kelompok: 'A' | 'B'
  urutan: number
  is_mulok: number
  jml_nilai?: number
}

export interface Nilai {
  id: number
  siswa_id: number
  mapel_id: number
  semester_id: number
  nilai_p: number | null
  nilai_k: number | null
  nilai_ujian: number | null
}

export interface Angkatan {
  id: number
  nama: string
  tahun_lulus: string
  keterangan: string
  is_aktif: number
  jml_siswa?: number
}

export interface RankingRow {
  id: number
  nama: string
  nisn: string
  kelas: string
  rata_raport: number | null
  nilai_ujian: number | null
  nilai_ijazah: number | null
  ranking: number | null
  lengkap: boolean
}

export interface RekapRow {
  id: number
  no_urut: number
  nama: string
  nisn: string
  jml_nilai: number
  nilai_ijazah: number | null
  lengkap: boolean
  detail_kelengkapan?: { semester_id: number; label: string; lengkap: boolean }[]
}
