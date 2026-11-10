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
  var urut = 0;     // urutan order harian (demo)
  function segarkanOrder() {
    var p = db.pesanan, pot = (db.referral && db.referral.potongan) || 0;
    if (p && p.status === 'belum_bayar') { p.potongan = pot; p.nominal = C.HARGA - pot + (p.kode_unik || 0); }
  }

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
    async cekKodeReferral(kode) { await tunda(250); var k = String(kode || '').trim().toUpperCase(); return k === 'RANI24' ? { valid: true, kode: k, potongan: 5000 } : { valid: false }; },
    // Demo: RANI24 = kode referral (potongan Rp5.000), HEMAT10 = voucher 10%
    async pakaiKodeReferral(kode) {
      await tunda(300); var k = String(kode || '').trim().toUpperCase();
      if (!k) { db.referral = { kode: null, potongan: 0 }; segarkanOrder(); return { valid: false, dihapus: true }; }
      if (k === 'HEMAT10') db.referral = { kode: k, potongan: Math.round(C.HARGA * 0.1), jenis: 'voucher' };
      else if (k === 'RANI24') db.referral = { kode: k, potongan: 5000, jenis: 'referral' };
      else throw new Error('Kode ' + k + ' tidak ditemukan atau sudah tidak berlaku');
      segarkanOrder();
      return { valid: true, kode: k, potongan: db.referral.potongan, jenis: db.referral.jenis };
    },
    async buatPesanan(metode) {
      await tunda(400);
      var p = db.pesanan;
      if (p && p.status === 'belum_bayar' && new Date(p.kedaluwarsa) <= new Date()) p.status = 'kedaluwarsa';
      if (p && ['ok', 'menunggu', 'belum_bayar', 'tolak'].indexOf(p.status) >= 0) { p.metode = metode; return p; }
      urut += 1;
      var w = new Date(Date.now() + 7 * 3600000), dd = String(w.getUTCDate()).padStart(2, '0'), mm = String(w.getUTCMonth() + 1).padStart(2, '0');
      var pot = (db.referral && db.referral.potongan) || 0;
      db.pesanan = { id: 'p' + urut, kode: 'NWS' + dd + mm + String(w.getUTCFullYear()).slice(2) + String(urut).padStart(3, '0'),
        harga: C.HARGA, potongan: pot, kode_unik: urut, nominal: C.HARGA - pot + urut, metode: metode, status: 'belum_bayar',
        dibuat: new Date().toISOString(), kedaluwarsa: new Date(Date.now() + 3600000).toISOString() };
      return db.pesanan;
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
      if (!db.pesanan || db.pesanan.status === 'ok') await API.buatPesanan(metode);
      Object.assign(db.pesanan, { metode: metode, status: 'menunggu', bukti_nama: file.name, dikirim: new Date().toISOString(), alasan: null });
      return db.pesanan;
    },
    async kirimMasukan() { await tunda(300); },
    // ---- refund (meniru syarat_refund / ajukan_refund di server)
    async infoRefund() { await tunda(100); return { syarat: syaratDemo(), refund: db.refund ? Object.assign({}, db.refund) : null }; },
    async ajukanRefund(d) {
      await tunda(600);
      var sy = syaratDemo();
      if (!sy.boleh) throw new Error('Order ini tidak memenuhi syarat refund');
      var ke = db.refund && db.refund.pesanan_id === sy.pesanan_id ? (db.refund.ke || 1) + 1 : 1;
      db.refund = { id: 'rf-' + Date.now(), ke: ke, kode: 'RF-' + sy.kode_order + (ke > 1 ? '-' + ke : ''), pesanan_id: sy.pesanan_id, alasan: sy.alasan,
        nominal: sy.nominal, status: 'diajukan', tujuan_jenis: d.jenis, tujuan_nama: d.nama, nomor_akhir: String(d.nomor).slice(-4), tujuan_pemilik: d.pemilik,
        milik_lain: !!d.milik_lain, diajukan: new Date().toISOString(), batas_sla: new Date(Date.now() + 864e5).toISOString() };
      return { id: db.refund.id, kode: db.refund.kode, status: 'diajukan', batas_sla: db.refund.batas_sla };
    },
    async cobaLagiAnalisis() { await tunda(300); if (db.lengkap) { db.lengkap.percobaan = 0; db.lengkap.status = 'gagal'; } },
    pantau(cb) { pendengar.push(cb); return function () { pendengar = pendengar.filter(function (x) { return x !== cb; }); }; },
    async urlBerkas() { return '#'; }
  };

  function syaratDemo() {
    var p = db.pesanan, l = db.lengkap, aktif = db.refund && p && db.refund.pesanan_id === p.id && db.refund.status !== 'ditolak';
    if (!p || aktif) return { boleh: false };
    if (p.status === 'tolak' && /^Nominal tidak sesuai/i.test(p.alasan || '') && p.nominal_bukti > 0)
      return { boleh: true, alasan: 'nominal', nominal: p.nominal_bukti, pesanan_id: p.id, kode_order: p.kode };
    if (p.status === 'ok' && l && (l.percobaan || 0) >= 3 && l.status === 'gagal')
      return { boleh: true, alasan: 'analisis', nominal: p.nominal, pesanan_id: p.id, kode_order: p.kode };
    return { boleh: false };
  }

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
    kedaluwarsa: function () { if (db.pesanan) { db.pesanan.kedaluwarsa = new Date(Date.now() - 1000).toISOString(); db.pesanan.status = 'kedaluwarsa'; beri('pesanan'); } },
    tolak: function (a) { db.pesanan.status = 'tolak'; db.pesanan.alasan = a || 'Nominal di bukti bayar belum sama dengan total pesanan.'; beri('pesanan'); },
    // Refund: DEMO.tolakNominal(149000) lalu ajukan dari layar ditolak; DEMO.gagalAnalisis() untuk status Tertunda
    tolakNominal: function (n) { db.pesanan.status = 'tolak'; db.pesanan.alasan = 'Nominal tidak sesuai tagihan'; db.pesanan.nominal_bukti = n || (db.pesanan.nominal - 1000); beri('pesanan'); },
    gagalAnalisis: function () { db.lengkap = { status: 'gagal', percobaan: 3, bagian: {}, diubah: new Date().toISOString() }; beri('laporan_lengkap'); },
    prosesRefund: function () { Object.assign(db.refund, { status: 'diproses', diproses: new Date().toISOString() }); beri('refund'); },
    selesaiRefund: function () { Object.assign(db.refund, { status: 'selesai', selesai: new Date().toISOString(), tanggal_transfer: new Date().toISOString().slice(0, 10), bukti_path: 'demo/bukti.pdf' });
      db.pesanan.status = 'direfund'; beri('refund'); },
    tolakRefund: function (a) { Object.assign(db.refund, { status: 'ditolak', ditolak: new Date().toISOString(), alasan_tolak: a || 'Nama pemilik rekening tidak sesuai' }); beri('refund'); },
    db: db
  };
  window.API = API;
})();
