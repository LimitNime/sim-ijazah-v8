const { contextBridge, ipcRenderer } = require('electron')
// Wrap invoke agar error IPC tidak throw DOMException ke renderer
// Selalu return { ok: false, error: msg } jika IPC gagal
const invoke = async (ch, ...a) => {
  try {
    return await ipcRenderer.invoke(ch, ...a)
  } catch (e) {
    // IPC error (structured clone, handler crash, dll) - kembalikan plain error object
    return { ok: false, error: String(e && e.message ? e.message : e), _ipc_error: true }
  }
}

contextBridge.exposeInMainWorld('api', {
  auth:     { login: (e,p) => invoke('auth:login',e,p) },
  sekolah:  {
    get:         ()      => invoke('sekolah:get'),
    save:        d       => invoke('sekolah:save', d),
    uploadLogo:  field   => invoke('sekolah:upload_logo', field),
    removeLogo:  field   => invoke('sekolah:remove_logo', field),
    uploadKop:   ()      => invoke('sekolah:upload_kop'),
    hapusKop:    ()      => invoke('sekolah:hapus_kop'),
  },
  semester: {
    list:    ()        => invoke('semester:list'),
    add:     d         => invoke('semester:add',d),
    update:  (id,d)    => invoke('semester:update',id,d),
    delete:  id        => invoke('semester:delete',id),
    reorder: ids       => invoke('semester:reorder',ids),
  },
  siswa: {
    list:            q       => invoke('siswa:list',q),
    get:             id      => invoke('siswa:get',id),
    add:             d       => invoke('siswa:add',d),
    update:          (id,d)  => invoke('siswa:update',id,d),
    delete:          id      => invoke('siswa:delete',id),
    generateNoSkl:   opts    => invoke('siswa:generate_no_skl', opts),
    updateNoSkl:     (id,v)  => invoke('siswa:update_no_skl', id, v),
    uploadFoto:      id      => invoke('siswa:upload_foto', id),
    removeFoto:      id      => invoke('siswa:remove_foto', id),
    importExcel:     ()      => invoke('siswa:import_excel'),
    downloadTemplate:()      => invoke('siswa:download_template'),
    stats:           ()      => invoke('siswa:stats'),
  },
  mapel: {
    list:        ()     => invoke('mapel:list'),
    add:         d      => invoke('mapel:add',d),
    update:      (id,d) => invoke('mapel:update',id,d),
    delete:      id     => invoke('mapel:delete',id),
    reorder:     ids    => invoke('mapel:reorder',ids),
    seedDefault: ()     => invoke('mapel:seed_default'),
  },
  nilai: {
    getSiswa:       id   => invoke('nilai:get_siswa',id),
    saveBatch:      rows => invoke('nilai:save_batch',rows),
    rekap:          ()   => invoke('nilai:rekap'),
    ranking:        (angkatan_id) => invoke('nilai:ranking', angkatan_id ?? null),
    rekapSiswa:     id   => invoke('nilai:rekap_siswa',id),
    rekapAngkatan:  id   => invoke('nilai:rekap_angkatan',id),
    importTemplate: ()   => invoke('nilai:import_template'),
    importNilai:    ()   => invoke('nilai:import_nilai'),
  },
  angkatan: {
    list:        ()       => invoke('angkatan:list'),
    add:         d        => invoke('angkatan:add',d),
    update:      (id,d)   => invoke('angkatan:update',id,d),
    delete:      id       => invoke('angkatan:delete',id),
    getSiswa:    id       => invoke('angkatan:siswa',id),
    tambahSiswa: (id,ids) => invoke('angkatan:tambah_siswa',id,ids),
    hapusSiswa:  (id,ids) => invoke('angkatan:hapus_siswa',id,ids),
  },
  nomorSurat: {
    getAll:  ()           => invoke('nomor_surat:get_all'),
    save:    (field, val) => invoke('nomor_surat:save', field, val),
    saveAll: data         => invoke('nomor_surat:save_all', data),
  },
  export: {
    excelAngkatan: (id)        => invoke('export:excel_angkatan', id ?? null),
    excelSiswa:    siswa_id    => invoke('export:excel_siswa', siswa_id),
    excelRekap:    ()          => invoke('export:excel_rekap'),
    excelRanking:  ()          => invoke('export:excel_ranking'),
  },
  pdf: {
    skl:             angkatan_id => invoke('pdf:skl', angkatan_id),
    dkn:             angkatan_id => invoke('pdf:dkn', angkatan_id),
    nilaiIjazah:     angkatan_id => invoke('pdf:nilai_ijazah', angkatan_id),
    ijazah:          angkatan_id => invoke('pdf:ijazah', angkatan_id),
    transkrip:       angkatan_id => invoke('pdf:transkrip', angkatan_id),
    skKelulusan:     angkatan_id => invoke('pdf:sk_kelulusan', angkatan_id),
    skkb:            angkatan_id => invoke('pdf:skkb', angkatan_id),
    // Per siswa
    sklSiswa:         id => invoke('pdf:skl_siswa', id),
    transkripSiswa:   id => invoke('pdf:transkrip_siswa', id),
    nilaiIjazahSiswa: id => invoke('pdf:nilai_ijazah_siswa', id),
    ijazahSiswa:      id => invoke('pdf:ijazah_siswa', id),
    skkbSiswa:        id => invoke('pdf:skkb_siswa', id),
  },
  kelas: {
    list:    ()        => invoke('kelas:list'),
    get:     id        => invoke('kelas:get', id),
    add:     d         => invoke('kelas:add', d),
    update:  (id, d)   => invoke('kelas:update', id, d),
    delete:  id        => invoke('kelas:delete', id),
    siswa:   id        => invoke('kelas:siswa', id),
  },
  denah: {
    get:   kelas_id          => invoke('denah:get', kelas_id),
    save:  (kelas_id, seats) => invoke('denah:save', kelas_id, seats),
    auto:  kelas_id          => invoke('denah:auto', kelas_id),
  },
  jadwal: {
    get:   kelas_id        => invoke('jadwal:get', kelas_id),
    save:  (kelas_id, rows) => invoke('jadwal:save', kelas_id, rows),
  },
  jurnal: {
    list:   (kelas_id, bulan) => invoke('jurnal:list', kelas_id, bulan),
    add:    d                 => invoke('jurnal:add', d),
    update: (id, d)           => invoke('jurnal:update', id, d),
    delete: id                => invoke('jurnal:delete', id),
  },
  absensi: {
    get:   (kelas_id, tanggal) => invoke('absensi:get', kelas_id, tanggal),
    save:  (kelas_id, tanggal, rows) => invoke('absensi:save', kelas_id, tanggal, rows),
    rekap: (kelas_id, bulan)   => invoke('absensi:rekap', kelas_id, bulan),
  },
  db: {
    backup:  () => invoke('db:backup'),
    restore: () => invoke('db:restore'),
  },
  app: {
    getPaths:   () => invoke('app:get_paths'),
    openOutput: () => invoke('app:open_output'),
    stats:      () => invoke('stats:dashboard'),
  },
})
