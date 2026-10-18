/* MODE DEMO: meniru server di dalam browser supaya aplikasi bisa dicoba tanpa Supabase dan tanpa AI.
 * Kode OTP demo selalu 123456. Laporan memakai contoh di contoh-laporan.js.
 * Untuk mencoba alur pembayaran, panggil di console: DEMO.konfirmasi() atau DEMO.tolak('alasan'). */
(function () {
  'use strict';
  var C = window.NAWASENA_CONFIG;
  if (!C.MODE_DEMO) return;

  var tunda = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var db = { profil: null, cv: null, lampiran: [], jawaban: null, laporan: null, lengkap: null, pesanan: null };
  var pendengar = [];
  var beri = function (t) { pendengar.forEach(function (cb) { cb(t); }); };
  var calon = null; // email yang sedang daftar/masuk

  var API = {
    _uid: null,
    async sesi() { await tunda(150); return API._uid ? { id: API._uid, email: db.profil && db.profil.email } : null; },
    padaSesiBerubah() {},
    async keluar() { API._uid = null; },
    async cekKontak(email, hp) { await tunda(300); return { email_terpakai: false, hp_terpakai: false }; },
    async kirimKodeDaftar(email) { await tunda(500); calon = email; },
    async cekKodeDaftar(email, kode) {
      await tunda(400);
      if (kode !== '123456') throw new Error('Kodenya salah atau sudah kedaluwarsa');
      API._uid = 'demo-user';
      return { id: API._uid, email: email };
    },
    async simpanProfil(nama, tgl, hp) {
      await tunda(300);
      db.profil = { id: API._uid, nama: nama, tgl_lahir: tgl, hp: hp, email: calon || 'demo@email.com' };
      return db.profil;
    },
    async kirimKodeMasuk(akun) { await tunda(400); if (!db.profil) throw new Error('Email atau nomor ini belum terdaftar. Coba daftar dulu ya.'); return { tujuan: 'de***@email.com' }; },
    async cekKodeMasuk(akun, kode) { await tunda(400); if (kode !== '123456') throw new Error('Kodenya salah'); API._uid = 'demo-user'; },
    async muat() { await tunda(200); return JSON.parse(JSON.stringify(db)); },
    async unggahBerkas() { await tunda(500); return 'demo/berkas'; },
    async simpanCVUnggah(file, teks) { await tunda(700); db.cv = { sumber: 'unggah', nama_file: file.name, teks: teks, file_path: 'demo/cv.pdf' }; return db.cv; },
    async simpanCVSusun(susun, teks) { await tunda(500); db.cv = { sumber: 'susun', susun: susun, teks: teks }; return db.cv; },
    async simpanLampiran(jenis, file, teks) { await tunda(500); var l = { id: String(Date.now()), jenis: jenis, nama_file: file.name, teks: teks }; db.lampiran.push(l); return l; },
    async simpanTautan(t) { await tunda(300); var l = { id: String(Date.now()), jenis: 'tautan', tautan: t }; db.lampiran.push(l); return l; },
    async hapusLampiran(id) { db.lampiran = db.lampiran.filter(function (l) { return l.id !== id; }); },
    async profilCV(susun) {
      await tunda(1200);
      var p = (susun.pendidikan || [])[0] || {};
      return { profil: (p.gelar ? 'Lulusan ' + p.gelar + (p.kampus ? ' ' + p.kampus : '') + '. ' : '') +
        'Terbiasa mengerjakan proyek dan organisasi dengan hasil yang terukur. Tertarik ke ' + (susun.posisi || 'peran analis') + '.' };
    },
    async simpanJawaban(data, hal, selesai) { await tunda(200); db.jawaban = Object.assign({}, db.jawaban || {}, { data: data, hal: hal, selesai: selesai ? new Date().toISOString() : null }); },
    async daftarSandi(email, sandi) { await tunda(400); calon = email; API._uid = 'demo-user'; return { id: API._uid, email: email }; },
    async masukSandi(akun, sandi) { await tunda(400); if (!db.profil) throw new Error('Email atau nomor ini belum terdaftar. Coba daftar dulu ya.'); API._uid = 'demo-user'; },
    async saranTarget() {
      await tunda(900);
      return { opsi: [
        { t: 'Financial Analyst', k: 'memakai pengalaman model keuangan di CV-mu' }, { t: 'Project Control', k: 'cocok dengan sukamu mengatur dan rapi' },
        { t: 'Management Trainee', k: 'kuat mengambil alih dan tenang ditekan' }, { t: 'Risk Management', k: 'nyambung dengan magang risikomu' },
        { t: 'Business Analyst', k: 'suka mengulik sebab dan pola' }, { t: 'Valuation & Advisory', k: 'dekat dengan proyek valuasimu' },
        { t: 'Learning & Development', k: 'peka pada orang dan suka menjelaskan' }, { t: 'Operations', k: 'nyaman dengan aturan dan urutan jelas' },
        { t: 'Corporate Strategy', k: 'gabungan angka dan pengambilan keputusan' }, { t: 'Supply Chain', k: 'suka merapikan alur kerja' }] };
    },
    async simpanTarget(target, jenis) { await tunda(200); db.jawaban = Object.assign({}, db.jawaban || {}, { target: target, target_jenis: jenis }); },
    async mulaiAnalisis() {
      var sidik = JSON.stringify([db.cv && db.cv.teks, db.jawaban && db.jawaban.data, db.jawaban && db.jawaban.target, (db.lampiran || []).map(function (l) { return l.id; })]);
      if (db.laporan && db.laporan.status === 'siap' && db.laporan.sidik === sidik) return { status: 'siap' };
      db.laporan = { status: 'proses' };
      setTimeout(function () {
        db.laporan = { status: 'siap', sidik: sidik, bagian1: Object.assign({}, window.CONTOH_LAPORAN.bagian1, { contoh: true }), skor: window.CONTOH_LAPORAN.skor };
        beri('laporan');
      }, 6000);
      return { status: 'proses' };
    },
    async mintaLaporanLengkap() {
      if (!db.pesanan || db.pesanan.status !== 'ok') throw new Error('Pembayaran belum dikonfirmasi');
      db.lengkap = { status: 'proses', bagian: {} };
      setTimeout(function () { db.lengkap = { status: 'siap', bagian: lengkapDemo() }; beri('laporan_lengkap'); }, 5000);
      return { status: 'proses' };
    },
    async kirimBukti(file, metode) {
      await tunda(800);
      db.pesanan = { id: 'p1', kode: 'NWS-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-0421', nominal: C.HARGA,
        metode: metode, status: 'menunggu', bukti_nama: file.name, dibuat: new Date().toISOString(), dikirim: new Date().toISOString() };
      return db.pesanan;
    },
    async kirimMasukan() { await tunda(300); },
    pantau(cb) { pendengar.push(cb); return function () { pendengar = pendengar.filter(function (x) { return x !== cb; }); }; },
    async urlBerkas() { return '#'; }
  };

  // Sama seperti server: label kelompok arah mengikuti jenis pertanyaan target.
  function lengkapDemo() {
    var b = JSON.parse(JSON.stringify(window.CONTOH_LAPORAN.lengkap));
    var j = db.jawaban || {}, jenis = j.target ? j.target_jenis : null;
    var r = b.rencana || {};
    (r.arah || []).forEach(function (a, i) {
      a.kel = !jenis ? '' : (jenis === 'pekerjaan' ? (i < 3 ? 'Sesuai keinginanmu' : 'Sudah terbentuk di kamu')
        : (i < 1 ? 'Sesuai target karirmu' : 'Relevan dengan karirmu sekarang'));
    });
    return b;
  }

  window.DEMO = {
    konfirmasi: function () { db.pesanan.status = 'ok'; db.pesanan.dicek = new Date().toISOString(); db.lengkap = { status: 'proses', bagian: {} }; beri('pesanan');
      setTimeout(function () { db.lengkap = { status: 'siap', bagian: lengkapDemo() }; beri('laporan_lengkap'); }, 4000); },
    tolak: function (a) { db.pesanan.status = 'tolak'; db.pesanan.alasan = a || 'Nominal di bukti bayar belum sama dengan total pesanan.'; beri('pesanan'); },
    db: db
  };
  window.API = API;
})();
