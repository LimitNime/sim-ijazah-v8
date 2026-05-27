const api = (window as any).api

export const authApi = {
  login: (email: string, password: string) => api?.auth.login(email, password) ?? null,
}
export const sekolahApi = {
  get:        ()              => api?.sekolah.get(),
  save:       (d:any)         => api?.sekolah.save(d),
  uploadLogo: (field: string) => api?.sekolah.uploadLogo(field),
  removeLogo: (field: string) => api?.sekolah.removeLogo(field),
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
  excelAngkatan: (angkatan_id: number | null) => api?.export?.excelAngkatan(angkatan_id),
  excelSiswa:    (siswa_id: number)           => api?.export?.excelSiswa(siswa_id),
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
