/* Nilai yang dibaca template layar (renderVals). Semua teks dimasukkan sebagai teks biasa. */
(function () {
  'use strict';
  var App = window.App, C = window.NAWASENA_CONFIG, D = window.DATA, U = window.NawasenaUtil;
  var ITEMS = D.ITEMS, SKALA4 = ['Bukan aku', 'Aku banget'];
  var LAYAR = ['muat', 'landing', 'masuk', 'masukKode', 'daftar', 'cekcv', 'unggah', 'lampiran', 'susun', 'previewcv',
    'intro', 'soal', 'target', 'proses', 'hasil', 'paywall', 'bayar', 'instruksi', 'menunggu', 'ditolak', 'berhasil', 'laporan'];

  function lengkapContoh(s) { var b = s.lengkap && s.lengkap.bagian; return !!(b && b.rencana && b.rencana.contoh); }

  // ikon tipe karir (garis tegak = keahlian, garis mendatar = keluasan)
  var BENTUK = [
    { k: 'I', nama: 'I-shape', sub: '· Spesialis murni', arti: 'Sangat dalam di satu bidang dan jarang keluar dari situ.', d: ['M24 8v32'] },
    { k: '—', nama: 'Generalis', sub: '', arti: 'Paham banyak bidang, tapi belum dalam di satu pun. Wajar di awal karir.', d: ['M8 12h32'] },
    { k: 'T', nama: 'T-shape', sub: '· Spesialis yang nyambung', arti: 'Dalam di satu bidang, dan paham bidang di sekitarnya, jadi enak diajak kerja lintas tim.', d: ['M8 10h32', 'M24 10v30'] },
    { k: 'V', nama: 'V-shape', sub: '· Spesialis yang melebar', arti: 'Dalam di satu bidang, lalu keahliannya ikut merembet ke bidang sebelah karena rasa ingin tahu.', d: ['M8 10l16 30 16-30'] },
    { k: 'π', nama: 'π-shape', sub: '· Dua keahlian', arti: 'Dalam di dua bidang sekaligus, misalnya produk dan data, atau hukum dan teknologi.', d: ['M8 10h32', 'M17 10v30', 'M31 10v30'] },
    { k: 'M', nama: 'M-shape', sub: '· Banyak keahlian', arti: 'Dalam di tiga bidang atau lebih. Biasanya terbentuk setelah bertahun-tahun berpindah peran.', d: ['M8 10h32', 'M11 10v30', 'M24 10v24', 'M37 10v30'] },
    { k: 'X', nama: 'X-shape', sub: '· Spesialis yang memimpin', arti: 'Keahlian seperti T, ditambah kemampuan menyatukan orang dan tim ke satu arah.', d: ['M10 8l28 32', 'M38 8L10 40'] }
  ];
  var CONTOH_BENTUK = { 'I': 'Peneliti, aktuaris, engineer spesialis', '—': 'Management trainee, staf operasional', 'T': 'Financial analyst, product manager',
    'V': 'Analis yang belajar engineering', 'π': 'Product manager AI, konsultan spesialis', 'M': 'Principal, arsitek solusi', 'X': 'Head of Product, engineering manager' };
  function ikonBentuk(k, warna) {
    var b = BENTUK.filter(function (x) { return x.k === k; })[0] || BENTUK[1];
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">' + b.d.map(function (d) {
      return '<path d="' + d + '" stroke="' + warna + '" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
    }).join('') + '</svg>';
    return U.svgData(svg);
  }
  function jalanBentuk(judul) {
    var m = /jadi\s+(I|T|V|π|M|X)\b/.exec(judul || '') || /\b(T|V|π|M|X)\b/.exec(judul || '');
    return m ? m[1] : null;
  }
  // Urutan tumbuhnya tipe karir: generalis → I/T → V/π → M/X. Tujuan tidak boleh mundur dari posisi sekarang.
  var TINGKAT_BENTUK = { '—': 0, 'I': 1, 'T': 1, 'V': 2, 'π': 2, 'M': 3, 'X': 3 };
  function bentukMaju(k, dari) {
    if (!(k in TINGKAT_BENTUK)) return dari;
    return (dari in TINGKAT_BENTUK) && TINGKAT_BENTUK[k] < TINGKAT_BENTUK[dari] ? dari : k;
  }
  function namaBentuk(k) { var b = BENTUK.filter(function (x) { return x.k === k; })[0]; return b ? b.nama : k; }
  var TEMPAT_WARNA = { 'Paling cocok': ['#16A34A', '#0F172A'], 'Cocok': ['#009FE3', '#FFFFFF'], 'Perlu ditimbang': ['#CCA700', '#0F172A'], 'Kurang cocok': ['#CCA700', '#0F172A'] };
  var UBIN_WARNA = ['#0284C7', '#16A34A', '#009FE3'];

  function wa(pesan) { return 'https://wa.me/' + C.WHATSAPP + '?text=' + encodeURIComponent(pesan); }

  App.vals = function () {
    var self = this, s = this.s, v = {};
    var profil = s.profil || {}, lv = U.levelDari(profil.tgl_lahir);
    var lap = s.laporan || {}, b1 = lap.bagian1 || {};
    v.modeContoh = !!(b1.contoh || (lengkapContoh(s)));
    var lengkap = (s.lengkap && s.lengkap.bagian) || {};
    var siap = this.lengkapSiap();
    var p = s.pesanan;

    LAYAR.forEach(function (n) { v['is_' + n] = (s.layar === n); });
    ['landing', 'daftar', 'masuk', 'bayar', 'instruksi', 'paywall'].forEach(function (n) { v['go_' + n] = self.ke(n); });
    v.waBase = 'https://wa.me/' + C.WHATSAPP;
    v.hargaTeks = U.rp(C.HARGA);
    v.janjiCek = C.JANJI_CEK;
    v.modeUjiCoba = !!C.MODE_UJI_COBA;
    v.keluarKlik = this.aman(function () { if (window.confirm('Keluar dari akunmu di perangkat ini?')) return self.keluar(); });

    // ---------------------------------------------------------------- daftar & masuk
    v.mulaiDaftar = function () { self.set({ layar: 'daftar' }); };
    v.nama = s.nama; v.tglLahir = s.tglLahir; v.hp = s.hp; v.email = s.email;
    v.setNama = this.isi('nama'); v.setTgl = this.isi('tglLahir'); v.setHp = this.isi('hp'); v.setEmail = this.isi('email');
    v.tglMaks = new Date().toISOString().slice(0, 10);
    v.daftarLanjutKlik = this.aman(this.daftarLanjut, C.VERIFIKASI_EMAIL ? 'Mengirim kode…' : 'Membuat akunmu…');
    // persetujuan pengolahan data pribadi (UU PDP)
    var tandaSetuju = s.tandaSetuju && !s.setuju;
    v.setujuCentang = !!s.setuju; v.setujuAria = s.setuju ? 'true' : 'false';
    v.toggleSetuju = function (e) {
      if (e && e.target && e.target.closest && e.target.closest('a')) return;   // klik tautan kebijakan: jangan ubah centang
      self.set({ setuju: !s.setuju, tandaSetuju: false });
    };
    v.setujuWadah = 'display: flex; gap: 12px; align-items: flex-start; border-radius: 12px; padding: 14px; cursor: pointer; '
      + 'background: ' + (s.setuju ? '#F0F9FF' : '#F8FAFC') + '; border: 1.5px solid ' + (tandaSetuju ? '#DC2626' : s.setuju ? '#009FE3' : '#E2E8F0') + ';';
    v.setujuKotak = 'width: 22px; height: 22px; flex-shrink: 0; margin-top: 1px; border-radius: 6px; display: flex; align-items: center; justify-content: center; '
      + 'background: ' + (s.setuju ? '#009FE3' : '#FFFFFF') + '; border: 1.5px solid ' + (tandaSetuju ? '#DC2626' : s.setuju ? '#009FE3' : '#94A3B8') + ';';
    v.emailTampil = profil.email || s.email || 'emailmu';
    v.namaTampil = profil.nama || s.nama || 'Kamu';

    var ak = String(s.akun || '').trim();
    v.akun = s.akun; v.setAkun = this.isi('akun');
    var sandiMode = !C.VERIFIKASI_EMAIL;
    v.modeSandi = sandiMode;
    v.sandi = s.sandi || ''; v.setSandi = function (e) { s.sandi = e.target.value; };
    v.catatanEmail = sandiMode ? 'Kami pakai buat menghubungimu soal laporan dan pembayaran' : 'Ini juga yang kamu pakai buat masuk lagi nanti';
    v.labelKirim = sandiMode ? 'Masuk' : 'Kirim kodenya ke email';
    v.catatanMasuk = sandiMode
      ? 'Lupa kata sandi? Chat kami lewat tombol Bantuan di atas, nanti kami bantu atur ulang.'
      : 'Tidak usah ingat kata sandi. Kami kirim kode 6 angka ke email yang kamu daftarkan, itu saja yang dipakai buat masuk.';
    v.kirimKodeMasukKlik = this.aman(sandiMode ? this.masukSandi : this.kirimKodeMasuk, sandiMode ? 'Masuk…' : 'Mengirim kode…');
    var daftarMode = s.kodeMode === 'daftar';
    v.kodeAtas = daftarMode ? 'Langkah 1 dari 4' : 'Login';
    v.kontakTampil = s.kontakTampil || ak;
    v.kodeGantiTanya = daftarMode ? 'Salah tulis email?' : 'Salah email atau nomor?';
    v.kodeGantiLabel = daftarMode ? 'Ganti email' : 'Ganti email atau nomor HP';
    v.kodeKembali = function () { self.set({ layar: daftarMode ? 'daftar' : 'masuk' }); };
    v.kodeTombol = daftarMode ? 'Verifikasi dan lanjut' : 'Login dan lihat punyaku';
    v.kirimUlangKlik = this.aman(this.kirimUlangKode, 'Mengirim ulang…');
    var sisaKode = this.sisaTungguKode();
    v.kirimUlangLabel = sisaKode > 0 ? 'Kirim ulang dalam ' + sisaKode + ' detik' : 'Kirim ulang kodenya';
    v.kirimUlangGaya = sisaKode > 0 ? 'color: #94A3B8; font-weight: 700; cursor: default;' : 'color: #0284C7; font-weight: 700;';
    v.cekKodeKlik = this.aman(this.cekKode, 'Mengecek kode…');
    // Satu kotak isian tak terlihat menutupi 6 kotak tampilan: tombol hapus, tempel, dan isi otomatis
    // dari SMS/email jalan seperti kotak teks biasa.
    v.otpNilai = s.otp.join('');
    v.adaOtp = v.otpNilai.length > 0;
    v.isiOtpKlik = this.isiOtp();
    v.hapusOtp = function () { self.set({ otp: ['', '', '', '', '', ''] }); var i = document.querySelector('[data-otp-input]'); if (i) i.focus(); };
    v.otpBoxes = s.otp.map(function (val, i) {
      var aktif = (val === '' && s.otp.slice(0, i).every(function (x) { return x !== ''; }));
      return { v: val,
        st: 'flex: 1 1 0; min-width: 0; height: 58px; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; '
          + 'font-family: Nunito, sans-serif; color: #0284C7; background: #FFFFFF; '
          + 'border-radius: 12px; border: 1.5px solid ' + (aktif || val ? '#009FE3' : '#CBD5E1') + '; '
          + (aktif ? 'box-shadow: 0 0 0 3px rgba(0,159,227,0.14);' : '') };
    });

    // ---------------------------------------------------------------- CV
    v.punyaCV = this.cabangCV(true); v.belumCV = this.cabangCV(false);
    v.adaCVFile = !!(s.cvRow && s.cvRow.sumber === 'unggah'); v.belumCVFile = !v.adaCVFile;
    v.cvFileNama = s.cvFileNama; v.cvFileInfo = s.cvFileInfo;
    v.pilihCVKlik = function () { self.pilihCV(); };
    v.lanjutUnggahKlik = function () { self.lanjutDariUnggah(); };
    v.kembaliDariUnggah = function () { if (lv === 'entry') self.set({ layar: 'cekcv' }); else U.toast('CV-mu dibutuhkan untuk menyusun peta potensimu'); };
    v.lampiranJudul = (lv === 'entry') ? 'Ada transkrip atau sertifikat?' : 'Ada contoh hasil kerjamu?';
    v.lampiranSub = (lv === 'entry')
      ? 'Opsional. Kalau ada, pemetaan arah karirmu jadi lebih tepat.'
      : 'Opsional, tapi disarankan. Portofolio bikin pemetaan arah karirmu jauh lebih akurat.';
    v.lampiranTautan = (lv === 'entry') ? 'drive.google.com/...' : 'behance.net/namakamu';
    v.lampiranList = (s.lampiran || []).map(function (l) {
      return { nama: l.tautan ? l.tautan : (l.nama_file || 'Berkas'), hapus: self.aman(async function () { await window.API.hapusLampiran(l.id); self.set({ lampiran: self.s.lampiran.filter(function (x) { return x.id !== l.id; }) }); }) };
    });
    v.pilihLampiranKlik = function () { self.pilihLampiran(); };
    v.lampTautan = s.lampTautan; v.setTautan = this.isi('lampTautan');
    v.lampiranLanjutKlik = this.aman(this.lampiranLanjut, 'Menyimpan…');
    v.lewatiLampiran = function () { self.set({ layar: 'intro' }); };
    v.kembaliLampiran = function () { self.set({ layar: s.cvRow && s.cvRow.sumber === 'susun' ? 'previewcv' : 'unggah' }); };

    // ---------------------------------------------------------------- Susun CV
    var c = s.cv || {};
    var L = D.CV_LANGKAH[s.cvStep - 1] || D.CV_LANGKAH[0];
    v.cvJudul = L.judul; v.cvSub = L.sub; v.cvCatatan = L.catatan; v.adaCatatanCV = !!L.catatan;
    v.cvNo = 'Langkah ' + L.no + ' dari 7'; v.cvOpsional = L.opsional;
    v.cvBar = 'width: ' + Math.round(L.no / 7 * 100) + '%; height: 100%; background: #009FE3; border-radius: 999px; transition: width .35s cubic-bezier(.2,.8,.2,1);';
    v.adaContohCV = L.contoh.length > 0; v.cvContoh = L.contoh;
    var JALUR_FIELD = {
      1: ['nama', 'kota', 'hp', 'email', 'linkedin'],
      2: ['pendidikan.0.gelar', 'pendidikan.0.kampus', 'pendidikan.0.kota', 'pendidikan.0.lulus', 'pendidikan.0.ipk'],
      6: ['sertifikasi.0.nama', 'sertifikasi.0.penerbit', 'sertifikasi.0.tahun']
    }[L.no] || [];
    function ambil(path) { return path.split('.').reduce(function (o, k) { return o == null ? '' : o[k]; }, c); }
    v.cvFields = L.fields.map(function (f, i) {
      var path = JALUR_FIELD[i];
      return { label: f.label, ph: f.ph, helper: f.helper, v: path ? ambil(path) || '' : '', on: path ? self.isiCV(path) : null,
        tipe: /email/i.test(f.label) ? 'email' : (/HP/i.test(f.label) ? 'tel' : 'text') };
    });
    if (L.no === 1) v.cvFields.push({ label: 'Posisi yang kamu incar', ph: 'Business Analyst', helper: 'Boleh dikosongi kalau belum tahu', v: c.posisi || '', on: self.isiCV('posisi'), tipe: 'text' });
    v.kindFields = (L.kind === 'fields'); v.kindKerja = (L.kind === 'kerja');
    v.kindOrg = (L.kind === 'org'); v.kindSkill = (L.kind === 'skill'); v.kindProfil = (L.kind === 'profil');
    v.cvTerakhir = (s.cvStep === 7); v.cvBelumAkhir = (s.cvStep !== 7);
    v.cvUrutan = D.CV_URUTAN.map(function (t, i) { return { no: String(i + 1), nama: t }; });
    v.cvMajuKlik = this.aman(this.cvMaju, s.cvStep === 7 ? 'Menyimpan CV-mu…' : 'Menyimpan…');
    v.cvMundurKlik = function () { self.cvMundur(); };
    v.entri = s.entri;
    ['jabatan', 'tempat', 'mulai', 'selesai', 'apa', 'berapa', 'hasil'].forEach(function (k) { v['setE_' + k] = self.isiEntri(k); });
    var e = s.entri;
    v.bulirJadi = U.bulir({ apa: e.apa || 'mengurus akun Instagram himpunan', berapa: e.berapa || '3 konten seminggu selama 2 tahun', hasil: e.hasil || 'pengikut naik dari 800 ke 2.100' });
    var kunciEntri = s.cvStep === 3 ? 'kerja' : 'organisasi';
    v.entriList = (c[kunciEntri] || []).map(function (x, i) {
      if (self._editIdx === i) return null;
      return { judul: [x.jabatan, x.tempat].filter(Boolean).join(' · ') || U.bulir(x), sub: [x.mulai, x.selesai].filter(Boolean).join(' – '),
        ubah: self.ubahEntri(kunciEntri, i), hapus: self.hapusEntri(kunciEntri, i) };
    }).filter(Boolean);
    v.tambahEntriKlik = function () { self.simpanEntri(true); };
    v.tambahEntriLabel = s.cvStep === 3 ? '+ Simpan dan tambah pengalaman lain' : '+ Simpan dan tambah satu lagi';
    ['keahlian', 'tools', 'bahasa'].forEach(function (g) {
      var dipilih = c[g] || [];
      var semua = U.PILIHAN_SKILL[g].concat(dipilih.filter(function (x) { return U.PILIHAN_SKILL[g].indexOf(x) < 0; }));
      v['chip_' + g] = semua.map(function (t) {
        var on = dipilih.indexOf(t) >= 0;
        return { t: (on ? '✓ ' : '+ ') + t, on: self.togelSkill(g, t),
          st: 'border: 1.5px solid ' + (on ? '#009FE3' : '#E2E8F0') + '; border-radius: 999px; padding: 9px 14px; font-size: 13px; font-weight: 600; color: '
            + (on ? '#0284C7' : '#334155') + '; background: ' + (on ? '#F5FBFF' : '#FFFFFF') + ';' };
      });
      v['ketik_' + g] = s.skillKetik[g];
      v['setKetik_' + g] = function (ev) { self.s.skillKetik[g] = ev.target.value; };
    });
    v.profilDraf = s.profilMemuat ? 'Lagi kami tulis dari isianmu…' : (c.profil || 'Belum ada draf. Tulis versimu di bawah ya.');
    v.profilSendiri = c.profilSendiri || ''; v.setProfilSendiri = this.isiCV('profilSendiri');
    // pratinjau CV
    var kontak = [c.kota, c.hp, c.email, c.linkedin].filter(Boolean).join('  |  ');
    function itemEntri(arr) {
      return (arr || []).filter(function (x) { return x.jabatan || x.tempat || x.apa; }).map(function (x) {
        return { kiri: [x.jabatan, x.tempat].filter(Boolean).join(' | '), kanan: [x.mulai, x.selesai].filter(Boolean).join(' - '), ket: '', bulir: U.bulir(x) };
      });
    }
    var bagianCV = [];
    var kerja = itemEntri(c.kerja); if (kerja.length) bagianCV.push({ judul: 'PENGALAMAN KERJA', item: kerja });
    var org = itemEntri(c.organisasi); if (org.length) bagianCV.push({ judul: 'ORGANISASI DAN PROYEK', item: org });
    var pend = (c.pendidikan || []).filter(function (x) { return x.gelar || x.kampus; }).map(function (x) {
      return { kiri: [x.gelar, [x.kampus, x.kota].filter(Boolean).join(', ')].filter(Boolean).join(' | '), kanan: x.lulus || '', ket: x.ipk ? 'IPK ' + x.ipk + '/4,00' : '', bulir: '' };
    });
    if (pend.length) bagianCV.push({ judul: 'PENDIDIKAN', item: pend });
    var ser = (c.sertifikasi || []).filter(function (x) { return x.nama; }).map(function (x) { return { kiri: [x.nama, x.penerbit].filter(Boolean).join(' | '), kanan: x.tahun || '', ket: '', bulir: '' }; });
    if (ser.length) bagianCV.push({ judul: 'SERTIFIKASI', item: ser });
    var kh = [];
    if ((c.keahlian || []).length) kh.push({ k: 'Teknis', v: c.keahlian.join(', ') });
    if ((c.tools || []).length) kh.push({ k: 'Tools', v: c.tools.join(', ') });
    if ((c.bahasa || []).length) kh.push({ k: 'Bahasa', v: c.bahasa.join(', ') });
    v.cvd = { nama: String(c.nama || profil.nama || '').toUpperCase(), posisi: c.posisi || '', kontak: kontak, profil: c.profilSendiri || c.profil || '',
      bagian: bagianCV, adaKeahlian: kh.length > 0, keahlian: kh };
    v.ubahCVKlik = function () { self.set({ layar: 'susun', cvStep: 1 }); };
    v.lanjutDariPreview = function () { self.set({ layar: 'intro' }); };

    // ---------------------------------------------------------------- kuis
    v.kembaliIntro = function () { self.set({ layar: s.cvRow && s.cvRow.sumber === 'susun' ? 'previewcv' : 'lampiran' }); };
    v.mulaiKuis = function () { self.set({ layar: 'soal' }); };
    var ha = D.HAL_ASESMEN[s.hal] || D.HAL_ASESMEN[0];
    v.halJudul = ha.judul;
    for (var hi = 1; hi <= 6; hi++) v['hp' + hi] = (s.hal === hi - 1);
    v.halBarW = 'width: ' + Math.round((s.hal + 1) / 6 * 100) + '%; height: 100%; background: ' + ha.warna + '; border-radius: 999px; transition: width .35s cubic-bezier(.2,.8,.2,1), background-color .3s ease;';
    v.halNo = 'Halaman ' + (s.hal + 1) + ' dari 6';
    v.halMajuKlik = this.aman(this.halMaju, s.hal >= 5 ? 'Menyimpan jawabanmu…' : 'Menyimpan…');
    v.halMundurKlik = function () { self.halMundur(); };
    v.halKembaliLabel = 'Kembali';

    // ---------------------------------------------------------------- target karir (sesudah kuis, opsional)
    var tgtKerja = self.jenisTarget() === 'pekerjaan', MAKS = self.MAKS_TARGET;
    var saran = s.saranTarget || {}, pilihan = s.targetPilih || [];
    var ketik = String(s.target || '').trim() ? 1 : 0;
    v.target = s.target;
    v.setTarget = function (e) {
      var lama = String(s.target || '').trim() ? 1 : 0, baru = String(e.target.value || '').trim() ? 1 : 0;
      s.target = e.target.value; s.targetDiketik = true;
      if (lama !== baru) self.render();   // perbarui hitungan pilihan
    };
    v.tgtJudul = tgtKerja ? 'Pekerjaan seperti apa yang ingin kamu coba cari tahu?' : 'Role apa yang ingin kamu capai berikutnya?';
    v.tgtSub = tgtKerja ? 'Pilihannya kami sesuaikan dengan latar belakang di CV-mu dan jawaban kuismu. Boleh pilih lebih dari satu, atau tulis sendiri.'
      : 'Pilihannya kami sesuaikan dengan keahlian di CV-mu dan jawaban kuismu. Boleh pilih lebih dari satu, atau tulis sendiri.';
    v.tgtPh = tgtKerja ? 'Ceritakan pekerjaan yang kamu bayangkan' : 'Tulis role yang kamu incar';
    v.tgtTulisJudul = (saran.opsi && saran.opsi.length) ? 'Atau tulis sendiri (opsional)' : 'Tulis sendiri';
    v.tgtPilihJudul = tgtKerja ? 'Pilihan yang cocok dengan latar belakang dan minatmu' : 'Pilihan yang cocok dengan keahlian dan cara kerjamu';
    v.tgtInfo = tgtKerja
      ? 'Kalau diisi, 3 dari 6 arah karir di laporanmu mengikuti pilihanmu. 3 lainnya dari kemampuan yang sudah terbentuk di kamu.'
      : 'Tiap role yang kamu pilih (maksimal ' + MAKS + ') dibahas sebagai satu arah karir di laporanmu. Sisanya diisi arah yang paling relevan dengan karir dan gaya kerjamu sekarang.';
    v.tgtKini = saran.peran_kini || ''; v.tgtKiniAda = !tgtKerja && !!saran.peran_kini;
    v.tgtMemuat = !!s.saranMemuat && !(saran.opsi && saran.opsi.length);
    v.tgtBayang = [1, 2, 3, 4, 5, 6];
    var jumlah = pilihan.length + ketik;
    v.tgtHitung = jumlah ? jumlah + ' dari maks ' + MAKS + ' dipilih' : 'Maksimal ' + MAKS;
    // pilihan dari CV (atau bawaan kalau belum ada), ditambah pilihan tersimpan yang tidak ada di daftar
    // hanya pilihan yang disesuaikan dengan CV dan kuis; kalau belum bisa dibuat, pengguna menulis sendiri
    var opsi = (saran.opsi && saran.opsi.length) ? saran.opsi.slice() : [];
    v.tgtGagal = !v.tgtMemuat && !opsi.length && !!s.saranGagal;
    v.tgtCobaLagi = function () { self.muatSaranTarget(true); self.render(); };
    v.tgtAdaOpsi = !v.tgtMemuat && !v.tgtGagal;
    var ada = {}; opsi.forEach(function (o) { ada[o.t.toLowerCase()] = 1; });
    pilihan.forEach(function (t) { if (!ada[t.toLowerCase()]) opsi.push({ t: t, k: '' }); });
    v.tgtOpsi = opsi.map(function (o) {
      var on = pilihan.some(function (t) { return t.toLowerCase() === o.t.toLowerCase(); });
      return {
        t: o.t, k: o.k, pilih: on, aria: on ? 'true' : 'false',
        st: 'display: flex; gap: 12px; align-items: flex-start; border-radius: 12px; padding: 12px 14px; cursor: pointer; '
          + 'background: ' + (on ? '#F0F9FF' : '#FFFFFF') + '; border: 1.5px solid ' + (on ? '#009FE3' : '#E2E8F0') + ';',
        kotak: 'width: 20px; height: 20px; flex-shrink: 0; margin-top: 1px; border-radius: 6px; display: flex; align-items: center; justify-content: center; '
          + 'background: ' + (on ? '#009FE3' : '#FFFFFF') + '; border: 1.5px solid ' + (on ? '#009FE3' : '#94A3B8') + ';',
        pick: function () { self.pilihTarget(o.t); }
      };
    });
    v.lanjutTarget = this.aman(function () { return self.simpanTarget(false); }, 'Menyimpan…');
    v.lewatiTarget = this.aman(function () { return self.simpanTarget(true); }, 'Menyimpan…');
    v.kembaliKeSoal = function () { self.set({ layar: 'soal', hal: 5 }); };
    v.tgtLewati = tgtKerja ? 'Lewati, aku belum kebayang' : 'Lewati pertanyaan ini';
    var DIAM = [26, 31, 36, 41];
    [0, 1, 2, 3, 4, 5].forEach(function (k) {
      var idx = s.hal * 6 + k, pf = 'q' + k;
      v[pf + 'teks'] = ITEMS[idx];
      v[pf + 'ikon'] = 'width: 34px; height: 34px; flex-shrink: 0; border-radius: 11px; display: flex; align-items: center; justify-content: center; color: ' + ha.warna + '; background: ' + ha.warna + '1F;';
      var kosong = !!(s.tandaKosong && !s.jawab[idx]);
      v[pf + 'kosong'] = kosong;
      v[pf + 'kartu'] = 'border: ' + (kosong ? '2px solid #DC2626' : '1.5px solid ' + (s.jawab[idx] ? ha.warna + '4D' : '#E2E8F0'))
        + '; background: ' + (kosong ? '#FEF2F2' : (s.jawab[idx] ? ha.warna + '08' : '#FFFFFF'))
        + '; border-radius: 12px; padding: 16px 16px 14px; display: flex; flex-direction: column; gap: 14px; scroll-margin-top: 16px;';
      for (var n = 1; n <= 4; n++) {
        var sel = (s.jawab[idx] === n), d = DIAM[n - 1];
        v[pf + 's' + n] = 'width: ' + d + 'px; height: ' + d + 'px; border-radius: 999px; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: all .15s ease; '
          + (sel ? 'border: 2px solid ' + ha.warna + '; background: ' + ha.warna + ';' : 'border: 2px solid #CBD5E1; background: #FFFFFF;');
        v[pf + 'c' + n] = sel;
        v[pf + 'p' + n] = self.jawabItem(idx, n);
      }
    });
    v.skalaKiri = SKALA4[0]; v.skalaKanan = SKALA4[1];

    // ---------------------------------------------------------------- proses
    var nm = ['Lagi baca CV-mu', 'Lagi baca jawabanmu', 'Mencocokkan ke ratusan arah kerja', 'Menyusun peta potensimu'];
    v.proses = nm.map(function (t, i) {
      var st = i < s.tick ? 'done' : (i === s.tick ? 'now' : 'next');
      return { nama: t, done: st === 'done', now: st === 'now', next: st === 'next',
        tx: 'font-size: 14px; font-weight: ' + (st === 'next' ? '500' : (st === 'now' ? '700' : '600')) + '; color: ' + (st === 'next' ? '#64748B' : (st === 'now' ? '#0284C7' : '#1E293B')) + ';' };
    });
    v.galatProses = s.galatProses || '';
    v.ulangProses = function () { self.jalanProses(); };

    // ---------------------------------------------------------------- Bagian 1 (hasil & laporan)
    var ark = b1.arketipe || {};
    v.arkNama = ark.nama || ''; v.arkSub = ark.sub || ''; v.arkTeks = ark.teks || '';
    v.maskotSrc = U.svgData((window.MASKOT || {})[ark.maskot] || (window.MASKOT || {}).analyst || '');
    v.identitas = U.identitasDari(b1) + (lap.diubah ? ' · ' + U.tglIndo(lap.diubah) : '');
    v.paling = (b1.paling || []).map(function (x) { return { j: x.j, c: x.c, p: x.p }; });
    v.dilatih = (b1.dilatih || []).map(function (x) { return { j: x.j, p: x.p }; });
    var tn = b1.tokoh_nyata || {}, tf = b1.tokoh_fiksi || {};
    v.tokohNama = tn.nama; v.tokohPeran = tn.peran; v.tokohWhy = tn.why;
    v.fiksiNama = tf.nama; v.fiksiAsal = tf.asal; v.fiksiWhy = tf.why;
    v.ctaHasil = p && p.status === 'ok' ? 'Baca peta potensimu' : (p ? 'Lihat status pembayaran' : 'Raih karirmu sekarang');
    v.keBayar = function () { self.keBayar(); };
    v.keHasil = function () { self.set({ layar: 'hasil' }); };
    // Dari hasil boleh mundur lagi sampai ke CV: target → kuis → intro → lampiran/preview CV → unggah/susun CV.
    // Kalau ada yang diubah, analisis otomatis disusun ulang saat lanjut lagi.
    v.kembaliDariHasil = function () { self.set({ layar: 'target' }); };

    // ---------------------------------------------------------------- bayar
    var sudahSusun = s.cvRow && s.cvRow.sumber === 'susun';
    v.paketNama = sudahSusun ? 'Peta potensimu + CV rapi' : 'Peta potensimu lengkap';
    v.paketSub = sudahSusun ? '6 bagian peta potensimu + CV rapi, sekali bayar' : '6 bagian peta potensimu, sekali bayar';
    v.metode = D.BAYAR.map(function (b) {
      var sel = (s.bayar === b[0]);
      return { nama: b[1], sub: b[2], sel: sel, pick: self.pilih('bayar', b[0]),
        st: 'border-radius: 12px; padding: 15px 16px; background: #FFFFFF; cursor: pointer; display: flex; align-items: center; gap: 13px; min-height: 68px; border: 1.5px solid '
          + (sel ? '#009FE3; box-shadow: 0 0 0 3px rgba(0,159,227,0.12);' : '#E2E8F0;'),
        radio: 'width: 22px; height: 22px; border-radius: 999px; background: #FFFFFF; flex-shrink: 0; border: ' + (sel ? '6.5px solid #009FE3;' : '2px solid #E2E8F0;') };
    });
    var qris = (s.bayar !== 'transfer');
    v.isQris = qris; v.isTransfer = !qris;
    v.metodeNama = (p && s.layar !== 'instruksi' ? (p.metode === 'transfer' ? 'Transfer bank' : 'QRIS') : (qris ? 'QRIS' : 'Transfer bank'));
    v.qrisGambar = C.QRIS_GAMBAR; v.qrisNama = C.QRIS_NAMA; v.qrisNmid = C.QRIS_NMID;
    v.bankNama = C.BANK_NAMA; v.nomorLabel = 'Nomor rekening'; v.nomorIsi = C.BANK_NOMOR; v.atasNama = C.BANK_ATAS_NAMA;
    v.simpanLabel = s.simpanQr ? 'Gambar QR tersimpan' : 'Simpan gambar QR';
    v.simpanQrKlik = function () { self.simpanQris(); };
    v.salinNomorKlik = function () { self.salinNomor(); };
    v.salinLabel = s.salin ? 'Tersalin' : 'Salin';
    v.buktiAda = !!s.bukti; v.belumBukti = !s.bukti;
    v.buktiNama = s.bukti ? s.bukti.name : ''; v.buktiInfo = s.bukti ? (Math.max(1, Math.round(s.bukti.size / 1024)) + ' KB · siap dikirim') : '';
    v.pilihBuktiKlik = function () { self.pilihBukti(); };
    v.kirimBuktiKlik = this.aman(this.kirimBukti, 'Mengirim bukti…');
    v.kirimSt = 'width: 100%; height: 54px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; font-family: Nunito, sans-serif; '
      + (s.bukti ? 'background: #FFD100; color: #0F172A; box-shadow: 0 6px 16px rgba(255,209,0,0.35); cursor: pointer;' : 'background: #FFD100; color: #0F172A; opacity: 0.4; cursor: not-allowed;');
    v.keMetode = function () { self.set({ layar: 'bayar' }); };
    v.psKode = p ? p.kode : ''; v.psJumlah = U.rp(p ? p.nominal : C.HARGA);
    v.psKirim = p ? U.tglIndo(p.dikirim || p.dibuat) + ', ' + U.jamIndo(p.dikirim || p.dibuat) : '';
    v.psCek = p && p.dicek ? U.tglIndo(p.dicek) + ', ' + U.jamIndo(p.dicek) : '';
    v.psAlasan = p ? (p.alasan || 'Bukti pembayaran belum bisa kami cocokkan.') : '';
    v.unggahUlangKlik = function () { self.set({ layar: 'instruksi', bukti: null, salin: false }); };
    v.bacaLaporanKlik = function () { self.set({ layar: 'laporan', bagian: 0, peran: -1 }); self.pastikanLengkap(); };

    // ---------------------------------------------------------------- laporan: navigasi
    var akt = D.BAGIAN[s.bagian - 1];
    D.BAGIAN.forEach(function (b, i) {
      var n = i + 1, sel = (s.bagian === n), w = b.warna || '#0284C7';
      v['pick' + n] = self.pilih('bagian', n);
      // gaya menu samping laporan (tampilan komputer)
      v['sb' + n + 'kot'] = 'width: 26px; height: 26px; flex-shrink: 0; border-radius: 9px; display: flex; align-items: center; justify-content: center; color: '
        + (sel ? '#FFFFFF' : w) + '; background: ' + (sel ? w : w + '1A') + ';';
      v['sb' + n + 'st'] = 'display: flex; align-items: center; gap: 11px; padding: 11px 13px; border-radius: 12px; cursor: pointer; ' + (sel ? 'background: #E0F2FE;' : 'background: transparent;');
      v['sb' + n + 'tx'] = 'font-size: 13.5px; line-height: 1.3; font-weight: ' + (sel ? '700' : '500') + '; color: ' + (sel ? '#0F172A' : '#64748B') + ';';
    });
    for (var i = 0; i <= 8; i++) v['b' + i] = (s.bagian === i);
    for (var j = 2; j <= 6; j++) v['c' + j] = v['b' + j] && siap;
    v.bTunggu = s.bagian >= 2 && s.bagian <= 6 && !siap;
    var gagal = !!(s.lengkap && s.lengkap.status === 'gagal');
    v.lengkapGagal = gagal; v.lengkapBelum = !siap;
    v.tungguJudul = gagal ? 'Penyusunannya tersendat' : 'Bagian ini sedang disusun';
    v.tungguTeks = gagal ? 'Ada kendala waktu menyusun bagian ini. Coba susun lagi, atau chat kami kalau masih gagal.'
      : 'Bagian 2–6 sedang kami susun dari CV dan jawabanmu. Biasanya siap dalam beberapa menit, halaman ini ikut berubah sendiri.';
    v.ulangLengkapKlik = this.aman(async function () { self._mintaLengkap = 0; await window.API.mintaLaporanLengkap(); await self.segarkan(); });
    var aktB = akt || D.BAGIAN[0];
    v.bagNama = aktB.nama; v.bagSub = aktB.sub;
    v.judulBagian = akt ? akt.nama : 'Daftar isi';
    v.noBagian = akt ? ('Bagian ' + akt.no) : (s.bagian === 8 ? 'Unduhan' : 'Peta potensimu');
    v.keDaftarIsi = this.pilih('bagian', 0);
    v.keUnduh = this.pilih('bagian', 8);
    // panel samping peta (komputer): posisi baca dan bagian berikutnya
    var noAkt = akt ? s.bagian : 0, berikut = D.BAGIAN[noAkt];
    v.rail = {
      posisi: noAkt ? 'Bagian ' + noAkt + ' dari 6' : (s.bagian === 8 ? 'Unduhan' : 'Peta potensimu'),
      judul: noAkt ? akt.nama : (s.bagian === 8 ? 'Simpan hasilmu biar bisa dibaca lagi' : 'Enam bagian, baca berurutan atau loncat sesukamu'),
      seg: D.BAGIAN.map(function (b, i) { return { st: 'flex: 1; height: 6px; border-radius: 999px; background: ' + (i < noAkt ? '#009FE3' : '#E0F2FE') + ';' }; }),
      adaLanjut: s.bagian !== 8,
      lanjutLabel: noAkt ? (berikut ? 'Lanjut ke bagian berikutnya' : 'Sudah sampai akhir') : 'Mulai dari sini',
      lanjutNama: berikut ? berikut.nama : 'Unduh peta potensimu',
      lanjutKlik: berikut ? this.pilih('bagian', noAkt + 1) : this.pilih('bagian', 8)
    };
    v.cvSendiri = !sudahSusun; v.cvDibuatkan = !!sudahSusun;
    v.labelUnduh = sudahSusun ? 'CV dan unduhan' : 'Unduhan';
    v.subUnduh = sudahSusun ? 'CV rapi + peta potensimu (PDF)' : 'Peta potensimu (PDF)';
    v.unduhCVKlik = function () { self.bukaCetak('cv'); };
    v.unduhLaporanKlik = function () { if (!siap) { U.toast('Tunggu sampai keenam bagian selesai disusun ya'); return; } self.bukaCetak('laporan'); };

    // ---------------------------------------------------------------- laporan: isi Bagian 2–6
    var r = lengkap.rencana || {}, A = lengkap.arahA || {}, B = lengkap.arahB || {};
    var b2 = r.b2 || {};
    var b2kamu = (b2.kamu in TINGKAT_BENTUK) ? b2.kamu : '—', b2tuju = bentukMaju(b2.tuju, b2kamu);
    v.l2 = {
      bentuk: BENTUK.map(function (x) {
        var kamu = b2kamu === x.k, tuju = b2tuju === x.k && !kamu;
        return { nama: x.nama, sub: x.sub, arti: x.arti, contoh: (b2.contoh && b2.contoh[x.k]) || CONTOH_BENTUK[x.k], kamu: kamu, tuju: tuju,
          ikon: ikonBentuk(x.k, kamu || tuju ? '#009FE3' : '#94A3B8'),
          st: (kamu ? 'border: 2px solid #009FE3; background: #F5FBFF;' : (tuju ? 'border: 1.5px dashed #009FE3; background: #FFFFFF;' : 'border: 1px solid #E2E8F0; background: #FFFFFF;'))
            + ' border-radius: 12px; padding: 12px 13px; display: flex; flex-direction: column; gap: 5px;' };
      }),
      ikonTegak: ikonBentuk('I', '#0284C7'), ikonDatar: ikonBentuk('—', '#0284C7'), ikonKamu: ikonBentuk(b2.kamu || '—', '#FFD100'),
      judul: b2.judul, teks: b2.teks, keahlian: b2.keahlian, keluasan: b2.keluasan, memimpin: b2.memimpin,
      catatan: String(b2.catatan || '').replace(/^\s*yang perlu kamu timbang\s*(adalah|:)?\s*/i, ''),
      jalan: (b2.jalan || []).map(function (x) {
        var bt = bentukMaju(x.bentuk || jalanBentuk(x.judul) || b2tuju, b2kamu);
        return { judul: x.judul, teks: x.teks, ref: x.ref, ikon: ikonBentuk(bt, '#009FE3'),
          arah: bt === b2kamu ? 'Tetap ' + namaBentuk(bt) + ', makin dalam' : 'Menuju ' + namaBentuk(bt) };
      })
    };
    var b3 = r.b3 || {};
    v.l3 = {
      ubin: (b3.ubin || []).map(function (u, i) {
        var w = UBIN_WARNA[i % 3], panjang = String(u.angka || '').length > 6;
        return { angka: u.angka, label: u.label,
          st: 'flex-grow: 1; flex-basis: 0; min-width: 0; background: ' + w + '0F; border: 1px solid ' + w + '2E; border-radius: 12px; padding: 13px 12px;',
          angkaSt: 'font-family: Nunito, sans-serif; font-size: ' + (panjang ? '14px' : '21px') + '; font-weight: 800; color: ' + (panjang ? '#0F172A' : '#0284C7') + '; line-height: 1.15; letter-spacing: -0.01em;' };
      }),
      plus: b3.plus || [], minus: b3.minus || [], sorot: b3.sorot, cerita: b3.cerita || {}, tanyaLead: b3.tanya_lead,
      tanya: (b3.tanya || []).map(function (q, i) { return { no: String(i + 1), t: q.t, cek: q.cek, pakai: q.pakai, kurang: q.kurang }; })
    };
    var b4 = r.b4 || {};
    v.l4 = { pembuka: b4.pembuka, banding: b4.banding || [], segera: b4.segera || [], kuat: b4.kuat || [], sorot: b4.sorot };
    var peran = (A.peran || []).concat(B.peran || []);
    var rencanaArah = r.arah || [];
    var tempat = B.tempat || {};
    v.l5 = {
      benang: (r.b5 || {}).benang, kurang: (r.b5 || {}).kurang, tempatIntro: tempat.intro,
      tempat: (tempat.daftar || []).map(function (w) {
        var c2 = TEMPAT_WARNA[w.label] || TEMPAT_WARNA['Cocok'];
        return { nama: w.nama, label: w.label, teks: w.teks,
          st: 'border: 1px solid ' + c2[0] + '33; background: ' + c2[0] + '0A; border-radius: 12px; padding: 14px 15px;',
          labelSt: 'font-size: 10.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: ' + c2[1] + '; background: ' + c2[0] + '; border-radius: 999px; padding: 4px 10px;' };
      }),
      ciri: tempat.ciri || [], cocok: tempat.cocok || [], tanya: tempat.tanya || []
    };
    v.arahIntro = (r.b5 || {}).intro || '';
    var jw = s.jawaban || {};
    v.adaTarget = !!(jw.target && jw.target_jenis);
    v.targetLabel = jw.target_jenis === 'role' ? 'Role yang ingin kamu capai' : 'Pekerjaan yang kamu bayangkan';
    v.targetTeks = String(jw.target || '').split(/\s*;\s*/).filter(Boolean).join(' · ');
    var ANGKA = ['', 'Satu', 'Dua', 'Tiga'], angka = ['', 'satu', 'dua', 'tiga', 'empat', 'lima'];
    var nTgt = (r.arah || []).filter(function (a) { return a.kel === 'Sesuai target karirmu'; }).length || 1;
    if (v.adaTarget && s.bagian === 5) v.bagSub = jw.target_jenis === 'role'
      ? ANGKA[nTgt] + ' sesuai target karirmu, ' + angka[6 - nTgt] + ' yang relevan dengan karirmu sekarang, plus tempat kerja yang paling pas'
      : 'Tiga sesuai keinginanmu, tiga yang sudah terbentuk di kamu, plus tempat kerja yang paling pas';
    var KEL_DEPAN = { 'Sesuai keinginanmu': 1, 'Sesuai target karirmu': 1 };
    var kelGaya = function (kel) {
      return kel ? 'font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; margin-top: 5px; color: ' + (KEL_DEPAN[kel] ? '#0284C7' : '#15803D') + ';' : 'display: none;';
    };
    v.arahList = peran.map(function (x, k) {
      var kel = (rencanaArah[k] || {}).kel || '';
      return { no: String(k + 1), nama: x.nama, fam: x.fam, fun: x.fun, pick: self.pilih('peran', k), kel: kel,
        kelSt: kelGaya(kel) };
    });
    v.adaPeran = (s.peran >= 0 && !!peran[s.peran]); v.belumPeran = !v.adaPeran;
    v.keArahList = this.pilih('peran', -1);
    var pr = peran[s.peran >= 0 ? s.peran : 0] || {};
    var kelP = (rencanaArah[s.peran] || {}).kel;
    v.pNo = String((s.peran >= 0 ? s.peran : 0) + 1); v.pNama = pr.nama; v.pFun = pr.fun; v.pComp = pr.comp; v.pPunya = pr.punya;
    v.pWhy = pr.why; v.pDay = pr.day; v.pChal = pr.chal; v.pPath = pr.path; v.pPrep = pr.prep;
    v.pEyebrow = 'Arah ' + v.pNo + ' dari 6 · ' + (kelP ? kelP + ' · ' : '') + (pr.fam || '');
    v.pGaji = (pr.gaji || []).map(function (g) { return { k: g.k, val: g.v }; });
    v.pInd = (pr.ind || []).map(function (g) { return { k: g.k, val: g.v }; });
    var b6 = B.b6 || {};
    v.l6 = { langkah: (b6.langkah || []).map(function (t, i) { return { n: String(i + 1), p: t }; }), batas: b6.batas, tutup: b6.tutup };

    // ---------------------------------------------------------------- kartu kebutuhan & penilaian
    v.butuhBelum = (s.butuh < 0);
    v.butuhAda = (s.butuh >= 0 && !s.sudahKirim);
    v.butuhIde = (!!s.sudahKirim && !s.ideKirim);
    v.butuhSudah = !!s.ideKirim;
    var bb = D.BUTUH[s.butuh >= 0 ? s.butuh : 0];
    v.kabarSudah = !!s.ideKirim && bb.status === 'belum';
    v.cukupSudah = !!s.ideKirim && bb.status === 'siap';
    v.butuhList = D.BUTUH.map(function (b, i) {
      return { no: b.no, pilih: b.pilih, on: function () { self.set({ butuh: i, hargaVote: -1, tier: -1, sudahKirim: false, ideKirim: false, harap: '' }); },
        st: 'border: 1.5px solid ' + (s.butuh === i ? '#009FE3' : '#E2E8F0') + '; border-radius: 12px; padding: 13px 15px; display: flex; align-items: center; gap: 11px; background: ' + (s.butuh === i ? '#F5FBFF' : '#FFFFFF') + ';' };
    });
    v.ofrNama = bb.nama; v.ofrApa = bb.apa; v.ofrKenapa = bb.kenapa; v.ofrAdaKenapa = !!bb.kenapa;
    v.ofrDetail = bb.detail.map(function (d) { return { k: d[0], v: d[1] }; }); v.ofrAdaDetail = bb.detail.length > 0;
    v.ofrBelum = (bb.status === 'belum');
    var tr = bb.tiers || [];
    v.ofrAdaTier = tr.length > 0;
    v.ofrTiers = tr.map(function (t, i) {
      var on = (s.tier === i);
      return { nama: t.nama, harga: t.harga, satuan: t.satuan, ringkas: t.ringkas, isi: t.isi.map(function (x) { return { t: x }; }), on: self.pilih('tier', i),
        st: 'border: 2px solid ' + (on ? '#009FE3' : '#E2E8F0') + '; border-radius: 12px; padding: 16px 17px; background: ' + (on ? '#F5FBFF' : '#FFFFFF') + '; display: flex; flex-direction: column; gap: 11px;',
        dot: 'width: 20px; height: 20px; flex-shrink: 0; border-radius: 999px; border: ' + (on ? '6px solid #009FE3' : '1.5px solid #CBD5E1') + ';' };
    });
    v.ofrAdaHarga = !!bb.harga; v.ofrHarga = bb.harga;
    v.ofrAksi = bb.status === 'belum' ? (tr.length && s.tier >= 0 ? 'Kabari aku kalau jalur ini sudah ada' : 'Kabari aku kalau sudah ada') : 'Lanjut';
    v.kirimButuhKlik = this.aman(this.kirimButuh, 'Mengirim…');
    v.harap = s.harap; v.setHarap = this.isi('harap');
    v.kirimIdeKlik = this.aman(function () { return self.kirimIde(false); }, 'Mengirim…');
    v.lewatiIdeKlik = function () { self.set({ ideKirim: true }); };
    v.ulangButuhKlik = function () { self.set({ butuh: -1, hargaVote: -1, tier: -1, sudahKirim: false, harap: '', ideKirim: false }); };
    v.hargaList = D.HARGA_OPSI.map(function (t, i) {
      return { t: t, on: self.pilih('hargaVote', i),
        st: 'flex-grow: 1; flex-basis: 0; text-align: center; padding: 9px 6px; border-radius: 11px; font-size: 12px; font-weight: 700; border: 1.5px solid '
          + (s.hargaVote === i ? '#009FE3' : '#E2E8F0') + '; color: ' + (s.hargaVote === i ? '#009FE3' : '#64748B') + '; background: ' + (s.hargaVote === i ? '#F5FBFF' : '#FFFFFF') + ';' };
    });
    v.bintangBelum = (s.bintang === 0) && !s.nilaiKirim;
    v.bintangAda = (s.bintang > 0) && !s.nilaiKirim;
    v.nilaiSudah = !!s.nilaiKirim;
    v.bintangKata = D.BINTANG_KATA[s.bintang] || '';
    v.bintangList = [1, 2, 3, 4, 5].map(function (n) {
      var isi = (n <= s.bintang);
      return { on: self.pilih('bintang', n), st: 'width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; color: ' + (isi ? '#FFD100' : '#E2E8F0') + ';',
        f: isi ? '#FFD100' : 'none', g: isi ? '#FFD100' : '#CBD5E1' };
    });
    v.tingkatList = D.TINGKATKAN.map(function (t, i) {
      var on = !!s.tingkat[i];
      return { t: t, on: function () { var tk = Object.assign({}, self.s.tingkat); if (tk[i]) delete tk[i]; else tk[i] = true; self.set({ tingkat: tk }); },
        st: 'border: 1.5px solid ' + (on ? '#009FE3' : '#E2E8F0') + '; border-radius: 999px; padding: 8px 14px; font-size: 12px; font-weight: 700; color: '
          + (on ? '#009FE3' : '#64748B') + '; background: ' + (on ? '#F5FBFF' : '#FFFFFF') + ';' };
    });
    v.masukan = s.masukan; v.setMasukan = this.isi('masukan');
    v.kirimNilaiKlik = this.aman(this.kirimNilai, 'Mengirim…');
    return v;
  };
})();
