const api = (window as any).api

export const authApi = {
  login: (email: string, password: string) => api?.auth.login(email, password) ?? null,
}
export const kleperApi = {
  list:    (q?:string)     => api?.kleper.list(q),
  byHuruf: (huruf:string)  => api?.kleper.byHuruf(huruf),
}
export const guruApi = {
  list:       (q?:string)       => api?.guru.list(q),
  get:        (id:number)       => api?.guru.get(id),
  add:        (d:any)           => api?.guru.add(d),
  update:     (id:number, d:any)=> api?.guru.update(id, d),
  delete:     (id:number)       => api?.guru.delete(id),
  uploadFoto: (id:number)       => api?.guru.uploadFoto(id),
}
export const absensiGuruApi = {
  get:   (tanggal:string)           => api?.absensiGuru.get(tanggal),
  save:  (tanggal:string, rows:any[]) => api?.absensiGuru.save(tanggal, rows),
  rekap: (bulan?:string)            => api?.absensiGuru.rekap(bulan),
}
export const jamMengajarApi = {
  list:   (ta?:string) => api?.jamMengajar.list(ta),
  save:   (d:any)      => api?.jamMengajar.save(d),
  delete: (id:number)  => api?.jamMengajar.delete(id),
}
export const skTugasApi = {
  list:   ()           => api?.skTugas.list(),
  save:   (d:any)      => api?.skTugas.save(d),
  delete: (id:number)  => api?.skTugas.delete(id),
}
export const pdfCetakApi = {
  bukuKleper:     ()                         => api?.pdfCetak.bukuKleper(),
  bukuIndukSiswa: (angkatan_id?: number)     => api?.pdfCetak.bukuIndukSiswa(angkatan_id),
  leger:          (kelas_id: number)         => api?.pdfCetak.leger(kelas_id),
  bukuIndukGuru:  ()                         => api?.pdfCetak.bukuIndukGuru(),
  absensiGuru:    (bulan?: string)           => api?.pdfCetak.absensiGuru(bulan),
  jadwal:         (kelas_id: number)         => api?.pdfCetak.jadwal(kelas_id),
  jurnal:         (kelas_id: number, bulan?: string) => api?.pdfCetak.jurnal(kelas_id, bulan),
  absensiSiswa:   (kelas_id: number, bulan?: string) => api?.pdfCetak.absensiSiswa(kelas_id, bulan),
  surat:          (params: any)              => api?.pdfCetak.surat(params),
}
export const legerApi = {
  get: (kelas_id:number) => api?.leger.get(kelas_id),
}
export const suratApi = {
  getSiswa: (id:number) => api?.surat.getSiswa(id),
  list:     ()          => api?.surat.list(),
  saveLog:  (d:any)     => api?.surat.saveLog(d),
}
export const kelasApi = {
  list:   ()        => api?.kelas.list(),
  get:    (id:number) => api?.kelas.get(id),
  add:    (d:any)   => api?.kelas.add(d),
  update: (id:number, d:any) => api?.kelas.update(id, d),
  delete: (id:number) => api?.kelas.delete(id),
  siswa:  (id:number) => api?.kelas.siswa(id),
}
export const denahApi = {
  get:  (kelas_id:number)               => api?.denah.get(kelas_id),
  save: (kelas_id:number, seats:any[])  => api?.denah.save(kelas_id, seats),
  auto: (kelas_id:number)               => api?.denah.auto(kelas_id),
}
export const jadwalApi = {
  get:  (kelas_id:number)              => api?.jadwal.get(kelas_id),
  save: (kelas_id:number, rows:any[])  => api?.jadwal.save(kelas_id, rows),
}
export const jurnalApi = {
  list:   (kelas_id:number, bulan?:string) => api?.jurnal.list(kelas_id, bulan),
  add:    (d:any)          => api?.jurnal.add(d),
  update: (id:number, d:any) => api?.jurnal.update(id, d),
  delete: (id:number)      => api?.jurnal.delete(id),
}
export const absensiApi = {
  get:   (kelas_id:number, tanggal:string)           => api?.absensi.get(kelas_id, tanggal),
  save:  (kelas_id:number, tanggal:string, rows:any[]) => api?.absensi.save(kelas_id, tanggal, rows),
  rekap: (kelas_id:number, bulan?:string)            => api?.absensi.rekap(kelas_id, bulan),
}

export const sekolahApi = {
  get:        ()              => api?.sekolah.get(),
  save:       (d:any)         => api?.sekolah.save(d),
  uploadLogo: (field: string) => api?.sekolah.uploadLogo(field),
  removeLogo: (field: string) => api?.sekolah.removeLogo(field),
  uploadKop:  ()              => api?.sekolah.uploadKop(),
  hapusKop:   ()              => api?.sekolah.hapusKop(),
}
export const semesterApi = {
  list:    ()             => api?.semester.list() ?? [],
  add:     (d:any)        => api?.semester.add(d),
  update:  (id:number,d:any) => api?.semester.update(id,d),
  delete:  (id:number)    => api?.semester.delete(id),
  reorder: (ids:number[]) => api?.semester.reorder(ids),
}
export const siswaApi = {
  list:            (q?:string)              => api?.siswa.list(q) ?? [],
  get:             (id:number)             => api?.siswa.get(id),
  add:             (d:any)                 => api?.siswa.add(d),
  update:          (id:number,d:any)       => api?.siswa.update(id,d),
  delete:          (id:number)             => api?.siswa.delete(id),
  stats:           ()                      => api?.siswa.stats() ?? { total:0, dengan_nilai:0 },
  generateNoSkl:   (opts:any)             => api?.siswa.generateNoSkl(opts),
  updateNoSkl:     (id:number,v:string)   => api?.siswa.updateNoSkl(id,v),
  uploadFoto:      (id:number)            => api?.siswa.uploadFoto(id),
  removeFoto:      (id:number)            => api?.siswa.removeFoto(id),
  importExcel:     ()                     => api?.siswa.importExcel(),
  downloadTemplate:()                     => api?.siswa.downloadTemplate(),
}
export const dbApi = {
  backup:  () => api?.db.backup(),
  restore: () => api?.db.restore(),
}
export const mapelApi = {
  list:        ()             => api?.mapel.list() ?? [],
  add:         (d:any)        => api?.mapel.add(d),
  update:      (id:number,d:any) => api?.mapel.update(id,d),
  delete:      (id:number)    => api?.mapel.delete(id),
  reorder:     (ids:number[]) => api?.mapel.reorder(ids),
  seedDefault: ()             => api?.mapel.seedDefault(),
}
export const nilaiApi = {
  getSiswa:        (id:number)  => api?.nilai.getSiswa(id) ?? [],
  saveBatch:       (rows:any[]) => api?.nilai.saveBatch(rows),
  rekap:           ()           => api?.nilai.rekap() ?? [],
  rekapSiswa:      (id:number)  => api?.nilai.rekapSiswa(id) ?? [],
  rekapAngkatan:   (id:number)  => api?.nilai.rekapAngkatan(id) ?? [],
  importTemplate:  ()           => api?.nilai.importTemplate(),
  importNilai:     ()           => api?.nilai.importNilai(),
  ranking: (angkatan_id?: number|null): Promise<any[]> => api?.nilai.ranking(angkatan_id ?? null) ?? Promise.resolve([]),
}
export const angkatanApi = {
  list:        ()                        => api?.angkatan.list() ?? [],
  add:         (d:any)                   => api?.angkatan.add(d),
  update:      (id:number,d:any)         => api?.angkatan.update(id,d),
  delete:      (id:number)               => api?.angkatan.delete(id),
  getSiswa:    (id:number)               => api?.angkatan.getSiswa(id) ?? [],
  tambahSiswa: (id:number,ids:number[])  => api?.angkatan.tambahSiswa(id,ids),
  hapusSiswa:  (id:number,ids:number[])  => api?.angkatan.hapusSiswa(id,ids),
}
export const nomorSuratApi = {
  getAll:  ()              => api?.nomorSurat?.getAll() ?? {},
  save:    (field: string, value: string) => api?.nomorSurat?.save(field, value),
  saveAll: (data: any)    => api?.nomorSurat?.saveAll(data),
}
export const exportApi = {
  excelAngkatan: (angkatan_id?: number|null)  => api?.export?.excelAngkatan(angkatan_id ?? null),
  excelSiswa:    (siswa_id: number)           => api?.export?.excelSiswa(siswa_id),
  excelRekap:    ()                           => api?.export?.excelRekap(),
  excelRanking:  ()                           => api?.export?.excelRanking(),
}
export const pdfApi = {
  skl:         (angkatan_id?: number|null) => api?.pdf.skl(angkatan_id ?? null),
  dkn:         (angkatan_id?: number|null) => api?.pdf.dkn(angkatan_id ?? null),
  nilaiIjazah: (angkatan_id?: number|null) => api?.pdf.nilaiIjazah(angkatan_id ?? null),
  ijazah:      (angkatan_id?: number|null) => api?.pdf.ijazah(angkatan_id ?? null),
  transkrip:   (angkatan_id?: number|null) => api?.pdf.transkrip(angkatan_id ?? null),
  skKelulusan: (angkatan_id?: number|null) => api?.pdf.skKelulusan(angkatan_id ?? null),
  skkb:        (angkatan_id?: number|null) => api?.pdf.skkb(angkatan_id ?? null),
  // Per siswa
  sklSiswa:        (siswa_id: number) => api?.pdf.sklSiswa(siswa_id),
  transkripSiswa:  (siswa_id: number) => api?.pdf.transkripSiswa(siswa_id),
  nilaiIjazahSiswa:(siswa_id: number) => api?.pdf.nilaiIjazahSiswa(siswa_id),
  ijazahSiswa:     (siswa_id: number) => api?.pdf.ijazahSiswa(siswa_id),
  skkbSiswa:       (siswa_id: number) => api?.pdf.skkbSiswa(siswa_id),
}
export const appApi = {
  getPaths:   () => api?.app.getPaths(),
  openOutput: () => api?.app.openOutput(),
  stats:      () => api?.app.stats() ?? { siswa:0, mapel:0, nilai:0, angkatan:0 },
}
