/* Aplikasi pengguna Nawasena — state, alur, dan nilai untuk template layar. */
(function () {
  'use strict';
  var C = window.NAWASENA_CONFIG, D = window.DATA, API = window.API;
  var ITEMS = D.ITEMS;
  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  // ------------------------------------------------------------------ util
  function rp(n) { return 'Rp' + Number(n || 0).toLocaleString('id-ID'); }
  function tglIndo(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear();
  }
  function jamIndo(iso) {
    var d = new Date(iso);
    return String(d.getHours()).padStart(2, '0') + '.' + String(d.getMinutes()).padStart(2, '0');
  }
  function umur(tgl) {
    if (!tgl) return 0;
    var t = new Date(tgl + 'T00:00:00'), n = new Date();
    var u = n.getFullYear() - t.getFullYear();
    if (n.getMonth() < t.getMonth() || (n.getMonth() === t.getMonth() && n.getDate() < t.getDate())) u--;
    return u;
  }
  function levelDari(tgl) { var u = umur(tgl); return u <= 25 ? 'entry' : (u <= 30 ? 'mid' : 'senior'); }
  function emailValid(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim()); }
  function hpDigit(h) { return String(h || '').replace(/\D/g, ''); }
  function fmtHp(h) {
    var d = hpDigit(h);
    if (d.charAt(0) === '0') d = '62' + d.slice(1);
    if (d.charAt(0) === '8') d = '62' + d;
    var r = d.slice(2);
    return d ? '+62 ' + r.slice(0, 3) + '-' + r.slice(3, 7) + '-' + r.slice(7) : '';
  }
  function huruf1(t) { t = String(t || '').trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''; }
  function svgData(svg) {
    svg = svg || '';
    if (svg && svg.indexOf('xmlns=') < 0) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function ukuran(b) { return b > 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }

  var elToast = document.getElementById('toast');
  var elSibuk = document.getElementById('sibuk');
  var timerToast = null;
  function toast(pesan, jenis) {
    elToast.textContent = pesan;
    elToast.className = 'tampil' + (jenis === 'ok' ? ' ok' : '');
    clearTimeout(timerToast);
    timerToast = setTimeout(function () { elToast.className = ''; }, 4200);
  }
  // Urutan alur untuk menentukan arah animasi (layar lebih awal = gerak mundur)
  var URUTAN_LAYAR = ['muat', 'landing', 'masuk', 'daftar', 'masukKode', 'cekcv', 'unggah', 'susun', 'lampiran', 'previewcv',
    'intro', 'soal', 'target', 'proses', 'hasil', 'paywall', 'bayar', 'instruksi', 'menunggu', 'ditolak', 'berhasil', 'laporan'];
  var GERAK_HEMAT = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  var JEDA_KODE_MS = 60 * 1000;

  function sibuk(on, teks) {
    elSibuk.querySelector('span').textContent = teks || 'Tunggu sebentar…';
    elSibuk.className = on ? 'tampil' : '';
  }

  // Baca teks dari PDF di browser (pdf.js dimuat saat pertama dipakai)
  var pdfSiap = null;
  function muatPdfJs() {
    if (pdfSiap) return pdfSiap;
    pdfSiap = new Promise(function (ok, gagal) {
      var s = document.createElement('script');
      s.src = 'aset/vendor/pdf-3.11.174.min.js';
      s.onload = function () {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'aset/vendor/pdf.worker-3.11.174.min.js';
        ok(window.pdfjsLib);
      };
      s.onerror = function () { gagal(new Error('Gagal memuat pembaca PDF')); };
      document.head.appendChild(s);
    });
    return pdfSiap;
  }
  async function bacaPdf(file) {
    var lib = await muatPdfJs();
    var buf = await file.arrayBuffer();
    var doc = await lib.getDocument({ data: buf }).promise;
    var out = [];
    for (var i = 1; i <= Math.min(doc.numPages, 12); i++) {
      var page = await doc.getPage(i);
      var tc = await page.getTextContent();
      var baris = '', yAkhir = null;
      tc.items.forEach(function (it) {
        var y = it.transform ? Math.round(it.transform[5]) : null;
        if (yAkhir !== null && y !== null && Math.abs(y - yAkhir) > 2) baris += '\n';
        else if (baris && !/\s$/.test(baris)) baris += ' ';
        baris += it.str;
        yAkhir = y;
      });
      out.push(baris);
    }
    return out.join('\n\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  // Pemilih berkas tersembunyi (satu untuk semua)
  var inputBerkas = document.getElementById('pilihBerkas');
  function pilihBerkas(accept, cb) {
    inputBerkas.value = '';
    inputBerkas.accept = accept;
    inputBerkas.onchange = function () { var f = inputBerkas.files && inputBerkas.files[0]; if (f) cb(f); };
    inputBerkas.click();
  }

  // ------------------------------------------------------------------ Susun CV: bentuk data
  function cvKosong(p) {
    return {
      nama: '', kota: '', hp: p ? fmtHp(p.hp) : '', email: p ? p.email : '', linkedin: '', posisi: '',
      pendidikan: [{ gelar: '', kampus: '', kota: '', lulus: '', ipk: '' }],
      kerja: [], organisasi: [], keahlian: [], tools: [], bahasa: [],
      sertifikasi: [{ nama: '', penerbit: '', tahun: '' }],
      profil: '', profilSendiri: ''
    };
  }
  function entriKosong() { return { jabatan: '', tempat: '', mulai: '', selesai: '', apa: '', berapa: '', hasil: '' }; }
  function bulir(e) {
    var a = huruf1(e.apa);
    if (!a) return '';
    var t = a;
    if (String(e.berapa || '').trim()) t += ' (' + e.berapa.trim() + ')';
    if (String(e.hasil || '').trim()) t += ', ' + e.hasil.trim();
    return t.replace(/[.\s]+$/, '') + '.';
  }
  function teksCV(c) {
    var o = [c.nama, [c.kota, c.hp, c.email, c.linkedin].filter(Boolean).join(' | ')];
    if (c.posisi) o.push('Posisi yang dituju: ' + c.posisi);
    var prof = c.profilSendiri || c.profil;
    if (prof) o.push('\nPROFIL\n' + prof);
    var p = (c.pendidikan || []).filter(function (x) { return x.gelar || x.kampus; });
    if (p.length) o.push('\nPENDIDIKAN\n' + p.map(function (x) { return [x.gelar, x.kampus, x.kota, x.lulus, x.ipk ? 'IPK ' + x.ipk : ''].filter(Boolean).join(' | '); }).join('\n'));
    function blok(judul, arr) {
      arr = (arr || []).filter(function (x) { return x.jabatan || x.tempat || x.apa; });
      if (arr.length) o.push('\n' + judul + '\n' + arr.map(function (x) {
        return [x.jabatan, x.tempat, [x.mulai, x.selesai].filter(Boolean).join(' - ')].filter(Boolean).join(' | ') + (bulir(x) ? '\n- ' + bulir(x) : '');
      }).join('\n'));
    }
    blok('PENGALAMAN KERJA', c.kerja); blok('ORGANISASI DAN PROYEK', c.organisasi);
    var k = [];
    if (c.keahlian.length) k.push('Teknis: ' + c.keahlian.join(', '));
    if (c.tools.length) k.push('Tools: ' + c.tools.join(', '));
    if (c.bahasa.length) k.push('Bahasa: ' + c.bahasa.join(', '));
    if (k.length) o.push('\nKEAHLIAN\n' + k.join('\n'));
    var s = (c.sertifikasi || []).filter(function (x) { return x.nama; });
    if (s.length) o.push('\nSERTIFIKASI\n' + s.map(function (x) { return [x.nama, x.penerbit, x.tahun].filter(Boolean).join(' | '); }).join('\n'));
    return o.join('\n');
  }
  var PILIHAN_SKILL = {
    keahlian: ['Analisis data', 'Analisis proses', 'Riset pengguna', 'Penulisan laporan', 'Manajemen proyek', 'Desain grafis', 'Public speaking', 'Penjualan'],
    tools: ['Excel lanjutan', 'Google Sheets', 'SQL dasar', 'Canva', 'Figma', 'Notion', 'Python dasar', 'Power BI'],
    bahasa: ['Indonesia - penutur asli', 'Inggris - profesional', 'Inggris - dasar']
  };

  // ------------------------------------------------------------------ aplikasi
  var App = {
    s: {
      layar: 'muat', layarSebelum: '', user: null,
      profil: null, cvRow: null, lampiran: [], jawaban: null, laporan: null, lengkap: null, pesanan: null,
      nama: '', tglLahir: '', hp: '', email: '', akun: '', otp: ['', '', '', '', '', ''], kodeMode: 'masuk', kontakTampil: '',
      cvFileNama: '', cvFileInfo: '', lampFileNama: '', lampTautan: '',
      cv: null, cvStep: 1, entri: entriKosong(), skillKetik: { keahlian: '', tools: '', bahasa: '' }, profilMemuat: false,
      jawab: [], hal: 0, tick: 0, target: '',
      bayar: 'qris', bukti: null, salin: false, simpanQr: false,
      bagian: 0, peran: -1,
      butuh: -1, hargaVote: -1, tier: -1, sudahKirim: false, ideKirim: false, harap: '',
      bintang: 0, tingkat: {}, masukan: '', nilaiKirim: false
    },

    set: function (o) {
      var gantiLayar = o.layar && o.layar !== this.s.layar;
      var gantiBagian = (o.bagian !== undefined && o.bagian !== this.s.bagian) || (o.peran !== undefined && o.peran !== this.s.peran);
      var gerak = this.arahGerak(o, gantiLayar, gantiBagian);
      if (gantiLayar) this.s.layarSebelum = this.s.layar;
      Object.assign(this.s, o);
      this.render();
      if (gerak) this.animasiLayar(gerak);
      if (gantiLayar || gantiBagian) {
        document.querySelectorAll('#app .scroll').forEach(function (el) { el.scrollTop = 0; });
        window.scrollTo(0, 0);
      }
      if (gantiLayar) this.masukLayar(this.s.layar);
    },

    render: function () { this.rt.render(this.vals()); },

    // ------------------------------------------------------------ motion pindah layar
    // Maju = konten masuk dari kanan, mundur (Kembali) = dari kiri. Pindah halaman kuis,
    // langkah CV, atau bagian laporan cukup menggeser isi area gulirnya.
    arahGerak: function (o, gantiLayar, gantiBagian) {
      var s = this.s, banding = function (a, b) { return a < b ? 'mundur' : 'maju'; };
      if (gantiLayar) {
        if (s.layar === 'muat') return { arah: 'pudar', area: 'layar' };
        var i = URUTAN_LAYAR.indexOf(o.layar), j = URUTAN_LAYAR.indexOf(s.layar);
        return { arah: i >= 0 && j >= 0 ? banding(i, j) : 'maju', area: 'layar' };
      }
      if (o.hal !== undefined && o.hal !== s.hal) return { arah: banding(o.hal, s.hal), area: 'isi' };
      if (o.cvStep !== undefined && o.cvStep !== s.cvStep) return { arah: banding(o.cvStep, s.cvStep), area: 'isi' };
      if (gantiBagian) {
        var b = o.bagian !== undefined ? o.bagian : s.bagian;
        return { arah: b === s.bagian ? 'pudar' : banding(b, s.bagian), area: 'isi' };
      }
      return null;
    },
    animasiLayar: function (g) {
      if (!document.body.animate || GERAK_HEMAT.matches) return;
      var akar = document.querySelector('#layar > *'), el = akar;
      if (g.area === 'isi') { var gul = document.querySelectorAll('#app .scroll'); if (gul.length) el = gul[gul.length - 1]; }
      if (!el) return;
      var dx = g.arah === 'maju' ? 28 : g.arah === 'mundur' ? -28 : 0;
      if (g.area === 'isi') dx = dx * 0.7;
      if (el._anim) el._anim.cancel();
      el._anim = el.animate([
        { opacity: 0, transform: 'translate3d(' + dx + 'px, ' + (dx ? 0 : 8) + 'px, 0)' },
        { opacity: 1, transform: 'none' }
      ], { duration: g.area === 'isi' ? 240 : 300, easing: 'cubic-bezier(.2,.8,.2,1)' });
    },

    // dipanggil setiap pindah layar
    masukLayar: function (l) {
      var self = this;
      clearInterval(this._poll); this._poll = null;
      if (l === 'proses') this.jalanProses();
      if (l === 'menunggu' || l === 'berhasil' || (l === 'laporan' && !this.lengkapSiap())) {
        this._poll = setInterval(function () { self.segarkan(); }, 8000);
      }
      if (l === 'masukKode') this.jalankanHitungKode();
      if (l === 'masukKode') setTimeout(function () { var i = document.querySelector('[data-otp="0"]'); if (i) i.focus(); }, 60);
    },

    // ------------------------------------------------------------ mulai
    mulai: async function () {
      var self = this;
      // HP/tablet: layar versi HP. Komputer (≥ 1024px): layar versi desktop.
      var mq = window.matchMedia('(min-width: 1024px)');
      var pilihTpl = function () {
        var dk = mq.matches && document.getElementById('tpl-desktop');
        document.body.classList.toggle('desktop', !!dk);
        return document.getElementById(dk ? 'tpl-desktop' : 'tpl').innerHTML;
      };
      this.rt = new window.NawasenaRuntime(document.getElementById('app'), pilihTpl());
      var gantiUkuran = function () { self.rt.gantiTemplate(pilihTpl()); self.render(); };
      if (mq.addEventListener) mq.addEventListener('change', gantiUkuran); else if (mq.addListener) mq.addListener(gantiUkuran);
      this.render();
      try {
        var u = await API.sesi();
        if (u && this.terlaluLamaDiam()) { await API.keluar(); u = null; toast('Kamu sudah lama tidak aktif, silakan masuk lagi ya.'); }
        this.awasiDiam();
        if (u) { this.s.user = u; await this.muatData(); this.arahkan(); }
        else this.set({ layar: 'landing' });
      } catch (e) {
        console.error(e);
        this.set({ layar: 'landing' });
        toast('Koneksi ke server gagal. Coba muat ulang halaman.');
      }
      API.padaSesiBerubah(function (ev) { if (ev === 'SIGNED_OUT') self.set({ layar: 'landing', profil: null }); });
    },

    muatData: async function () {
      var d = await API.muat();
      this.s.profil = d.profil; this.s.cvRow = d.cv; this.s.lampiran = d.lampiran; this.s.jawaban = d.jawaban;
      this.s.laporan = d.laporan; this.s.lengkap = d.lengkap; this.s.pesanan = d.pesanan;
      if (d.jawaban && Array.isArray(d.jawaban.data)) { this.s.jawab = d.jawaban.data.slice(); this.s.hal = Math.min(5, d.jawaban.hal || 0); }
      if (d.jawaban && d.jawaban.target_jenis && !this.s.targetDiketik) this.s.target = d.jawaban.target || '';
      if (d.cv && d.cv.sumber === 'susun' && d.cv.susun) this.s.cv = d.cv.susun;
      if (!this.s.cv) this.s.cv = cvKosong(d.profil);
      if (d.cv && d.cv.sumber === 'unggah') { this.s.cvFileNama = d.cv.nama_file || 'CV.pdf'; this.s.cvFileInfo = 'sudah tersimpan'; }
      if (!this._lepas && API._uid) {
        var self = this;
        this._lepas = API.pantau(function () { self.segarkan(); });
      }
    },

    // Muat ulang data lalu sesuaikan layar tunggu
    segarkan: async function () {
      try { await this.muatData(); } catch (e) { return; }
      var s = this.s, p = s.pesanan;
      if (s.layar === 'proses' && s.laporan && s.laporan.status === 'siap') { this.set({ layar: 'hasil' }); return; }
      if (s.layar === 'menunggu' && p && p.status === 'ok') { this.set({ layar: 'berhasil' }); return; }
      if (s.layar === 'menunggu' && p && p.status === 'tolak') { this.set({ layar: 'ditolak' }); return; }
      if (s.layar === 'laporan' || s.layar === 'berhasil') this.pastikanLengkap();
      this.render();
    },

    // Tentukan layar dari data yang tersimpan
    arahkan: function () {
      var s = this.s, lv = levelDari(s.profil && s.profil.tgl_lahir);
      if (!s.profil) { this.set({ layar: 'daftar', email: (s.user && s.user.email) || s.email }); return; }
      if (!s.cvRow) { this.set({ layar: lv === 'entry' ? 'cekcv' : 'unggah' }); return; }
      if (!s.jawaban || !s.jawaban.selesai) { this.set({ layar: (s.jawab.filter(Boolean).length ? 'soal' : 'intro') }); return; }
      if (!s.laporan && !s.jawaban.target_jenis) { this.set({ layar: 'target' }); return; }
      if (!s.laporan || s.laporan.status !== 'siap') { this.set({ layar: 'proses' }); return; }
      var p = s.pesanan;
      if (p && p.status === 'ok') { this.set({ layar: 'laporan', bagian: 0, peran: -1 }); this.pastikanLengkap(); return; }
      this.set({ layar: 'hasil' });
      // Kalau sebelumnya pengguna mundur dan mengubah CV/jawaban lalu menutup aplikasi,
      // server menyusun ulang analisisnya; pindah ke layar proses kalau itu terjadi.
      var self = this;
      API.mulaiAnalisis().then(function (r) { if (r && r.status === 'proses' && self.s.layar === 'hasil') self.set({ layar: 'proses' }); }).catch(function () { /* abaikan */ });
    },

    lengkapSiap: function () { return !!(this.s.lengkap && this.s.lengkap.status === 'siap'); },
    pastikanLengkap: function () {
      var s = this.s;
      if (!s.pesanan || s.pesanan.status !== 'ok' || this.lengkapSiap()) return;
      var l = s.lengkap, macet = l && l.status === 'proses' && (Date.now() - new Date(l.diubah || 0).getTime() > 5 * 60 * 1000);
      if (!l || l.status === 'belum' || l.status === 'gagal' || macet) {
        if (this._mintaLengkap && Date.now() - this._mintaLengkap < 60000) return;
        this._mintaLengkap = Date.now();
        API.mintaLaporanLengkap().catch(function (e) { console.warn(e); });
      }
    },

    // ------------------------------------------------------------ handler kecil
    ke: function (l) { var self = this; return function () { self.set({ layar: l }); }; },
    isi: function (k) { var self = this; return function (e) { var o = {}; o[k] = e.target.value; self.s[k] = e.target.value; if (k === 'akun') self.render(); }; },
    pilih: function (k, v) { var self = this; return function () { var o = {}; o[k] = v; self.set(o); }; },
    aman: function (fn, teks) {
      var self = this;
      return async function (e) {
        if (self._sibuk) return;
        self._sibuk = true; sibuk(true, teks);
        try { await fn.call(self, e); }
        catch (err) { console.error(err); toast(pesanGalat(err)); }
        finally { self._sibuk = false; sibuk(false); }
      };
    },

    // ------------------------------------------------------------ daftar & masuk
    daftarLanjut: async function () {
      var s = this.s;
      var nama = String(s.nama || '').trim(), tgl = s.tglLahir, hp = hpDigit(s.hp), email = String(s.email || '').trim().toLowerCase();
      if (!nama) throw new Error('Isi nama panggilanmu dulu ya');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl || '') || umur(tgl) < 13 || umur(tgl) > 80) throw new Error('Tanggal lahirnya belum benar');
      if (hp.length < 10 || hp.length > 15) throw new Error('Nomor WhatsApp-nya belum benar');
      if (!emailValid(email)) throw new Error('Alamat email-nya belum benar');
      var k = await API.cekKontak(email, hp);
      if (k.hp_terpakai && !(s.profil)) throw new Error('Nomor WhatsApp ini sudah dipakai akun lain. Kalau itu kamu, pakai Login.');
      if (s.user && API._uid) {
        // sudah punya sesi (misalnya daftar sempat terputus): langsung simpan profil
        await this.simpanProfilDanLanjut();
        return;
      }
      if (k.email_terpakai) throw new Error('Email ini sudah terdaftar. Pakai Login ya.');
      if (!C.VERIFIKASI_EMAIL) {
        // Mode tanpa email: akun dibuat dengan kata sandi, langsung masuk.
        var sandi = String(s.sandi || '');
        if (sandi.length < 6) throw new Error('Kata sandinya minimal 6 huruf atau angka');
        var u0 = await API.daftarSandi(email, sandi);
        this.s.user = { id: u0.id, email: u0.email }; this.s.sandi = '';
        await this.simpanProfilDanLanjut();
        return;
      }
      await API.kirimKodeDaftar(email);
      this.s.kodeDikirim = Date.now();
      this.set({ layar: 'masukKode', kodeMode: 'daftar', kontakTampil: email, otp: ['', '', '', '', '', ''], email: email });
    },
    simpanProfilDanLanjut: async function () {
      var s = this.s;
      try {
        await API.simpanProfil(String(s.nama).trim(), s.tglLahir, hpDigit(s.hp));
      } catch (e) {
        if (/HP_TERPAKAI/.test(e.message)) { this.set({ layar: 'daftar' }); throw new Error('Nomor WhatsApp ini sudah dipakai akun lain.'); }
        throw e;
      }
      await this.muatData();
      this.arahkan();
    },
    kirimKodeMasuk: async function () {
      var a = String(this.s.akun || '').trim();
      if (!a) throw new Error('Isi email atau nomor HP dulu ya');
      var r = await API.kirimKodeMasuk(a);
      this.s.kodeDikirim = Date.now();
      this.set({ layar: 'masukKode', kodeMode: 'masuk', kontakTampil: r.tujuan || a, otp: ['', '', '', '', '', ''] });
    },
    masukSandi: async function () {
      var a = String(this.s.akun || '').trim(), sandi = String(this.s.sandi || '');
      if (!a) throw new Error('Isi email atau nomor HP dulu ya');
      if (!sandi) throw new Error('Isi kata sandinya dulu ya');
      await API.masukSandi(a, sandi);
      this.s.sandi = '';
      this.s.user = await API.sesi();
      await this.muatData();
      this.arahkan();
    },
    // Supabase hanya mengizinkan 1 email kode per 60 detik per alamat, jadi tombol kirim ulang
    // dikunci dengan hitung mundur. Setiap kode baru membuat kode lama tidak berlaku.
    sisaTungguKode: function () { return Math.max(0, Math.ceil((JEDA_KODE_MS - (Date.now() - (this.s.kodeDikirim || 0))) / 1000)); },
    kirimUlangKode: async function () {
      var sisa = this.sisaTungguKode();
      if (sisa > 0) { toast('Tunggu ' + sisa + ' detik lagi ya, baru bisa minta kode baru.'); return; }
      if (this.s.kodeMode === 'daftar') await API.kirimKodeDaftar(this.s.email);
      else await API.kirimKodeMasuk(this.s.akun);
      this.s.kodeDikirim = Date.now();
      this.set({ otp: ['', '', '', '', '', ''] });
      this.jalankanHitungKode();
      toast('Kode baru sudah dikirim. Pakai kode dari email yang paling baru ya.', 'ok');
    },
    jalankanHitungKode: function () {
      var self = this;
      clearInterval(this._hitungKode);
      this._hitungKode = setInterval(function () {
        if (self.s.layar !== 'masukKode' || self.sisaTungguKode() <= 0) clearInterval(self._hitungKode);
        if (self.s.layar === 'masukKode') self.render();
      }, 1000);
    },
    cekKode: async function () {
      var kode = this.s.otp.join('');
      if (kode.length < 6) throw new Error('Kodenya 6 angka');
      if (this.s.kodeMode === 'daftar') {
        var u = await API.cekKodeDaftar(this.s.email, kode);
        this.s.user = { id: u.id, email: u.email };
        await this.simpanProfilDanLanjut();
      } else {
        await API.cekKodeMasuk(this.s.akun, kode);
        this.s.user = await API.sesi();
        await this.muatData();
        this.arahkan();
      }
    },
    isiOtp: function (i) {
      var self = this;
      return function (e) {
        var v = String(e.target.value || '').replace(/\D/g, '');
        var a = self.s.otp.slice();
        if (v.length > 1) { // tempel kode utuh
          v.slice(0, 6 - i).split('').forEach(function (c, k) { a[i + k] = c; });
        } else a[i] = v;
        self.set({ otp: a });
        var lanjut = Math.min(5, i + Math.max(1, v.length));
        if (v) { var n = document.querySelector('[data-otp="' + lanjut + '"]'); if (n) n.focus(); }
        if (a.join('').length === 6) self.aman(self.cekKode, 'Mengecek kode…')();
      };
    },

    // ------------------------------------------------------------ CV unggah & lampiran
    pilihCV: function () {
      var self = this;
      pilihBerkas('application/pdf', function (f) { self.aman(function () { return self.prosesCV(f); }, 'Membaca CV-mu…')(); });
    },
    prosesCV: async function (f) {
      if (f.size > 5 * 1048576) throw new Error('Ukuran file maksimal 5 MB');
      if (!/pdf$/i.test(f.type) && !/\.pdf$/i.test(f.name)) throw new Error('Untuk sekarang CV-nya harus PDF ya');
      var teks = await bacaPdf(f);
      if (teks.replace(/\s/g, '').length < 200) {
        throw new Error('Isi CV ini tidak terbaca (sepertinya hasil scan atau gambar). Coba ekspor ulang ke PDF dari Word/Google Docs, atau susun CV bareng kami.');
      }
      var row = await API.simpanCVUnggah(f, teks);
      this.set({ cvRow: row, cvFileNama: f.name, cvFileInfo: ukuran(f.size) + ' · selesai diunggah' });
    },
    lanjutDariUnggah: function () {
      if (!this.s.cvRow) { toast('Pilih file CV-mu dulu ya'); return; }
      this.set({ layar: 'lampiran' });
    },
    pilihLampiran: function () {
      var self = this;
      pilihBerkas('application/pdf', function (f) {
        self.aman(async function () {
          if (f.size > 5 * 1048576) throw new Error('Ukuran file maksimal 5 MB');
          var teks = '';
          try { teks = await bacaPdf(f); } catch (e) { teks = ''; }
          var jenis = levelDari(self.s.profil.tgl_lahir) === 'entry' ? 'transkrip' : 'portofolio';
          var l = await API.simpanLampiran(jenis, f, teks);
          self.set({ lampiran: self.s.lampiran.concat([l]), lampFileNama: f.name });
        }, 'Mengunggah…')();
      });
    },
    lampiranLanjut: async function () {
      var t = String(this.s.lampTautan || '').trim();
      if (t) {
        if (!/^https?:\/\//i.test(t)) t = 'https://' + t;
        var l = await API.simpanTautan(t);
        this.s.lampiran = this.s.lampiran.concat([l]);
        this.s.lampTautan = '';
      }
      this.set({ layar: 'intro' });
    },

    // ------------------------------------------------------------ Susun CV
    cabangCV: function (punya) { var self = this; return function () { self.set({ layar: punya ? 'unggah' : 'susun', cvStep: 1 }); }; },
    isiCV: function (path) {
      var self = this;
      return function (e) {
        var p = path.split('.'), o = self.s.cv;
        for (var i = 0; i < p.length - 1; i++) o = o[p[i]];
        o[p[p.length - 1]] = e.target.value;
        self.render();
      };
    },
    isiEntri: function (k) { var self = this; return function (e) { self.s.entri[k] = e.target.value; self.render(); }; },
    simpanEntri: function (tambahLagi) {
      var e = this.s.entri, kunci = this.s.cvStep === 3 ? 'kerja' : 'organisasi';
      var terisi = (e.jabatan || e.tempat || e.apa);
      if (terisi) {
        if (this._editIdx != null) this.s.cv[kunci][this._editIdx] = Object.assign({}, e);
        else this.s.cv[kunci].push(Object.assign({}, e));
      }
      this._editIdx = null;
      this.s.entri = entriKosong();
      if (tambahLagi) { if (!terisi) toast('Isi dulu yang ini ya'); this.render(); }
      return terisi;
    },
    ubahEntri: function (kunci, i) {
      var self = this;
      return function () {
        self._editIdx = i;
        self.set({ entri: Object.assign({}, self.s.cv[kunci][i]) });
      };
    },
    hapusEntri: function (kunci, i) {
      var self = this;
      return function () { self.s.cv[kunci].splice(i, 1); if (self._editIdx === i) { self._editIdx = null; self.s.entri = entriKosong(); } self.render(); };
    },
    togelSkill: function (k, t) {
      var self = this;
      return function () {
        var a = self.s.cv[k], i = a.indexOf(t);
        if (i >= 0) a.splice(i, 1); else a.push(t);
        self.render();
      };
    },
    tambahSkillKetik: function (k) {
      var t = String(this.s.skillKetik[k] || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      var a = this.s.cv[k];
      t.forEach(function (x) { if (a.indexOf(x) < 0) a.push(x); });
      this.s.skillKetik[k] = '';
    },
    cvMaju: async function () {
      var s = this.s, c = s.cv, st = s.cvStep;
      if (st === 1) {
        if (!String(c.nama).trim()) throw new Error('Isi nama lengkapmu dulu ya');
        if (!emailValid(c.email)) throw new Error('Email di CV belum benar');
      }
      if (st === 2 && !String(c.pendidikan[0].gelar).trim() && !String(c.pendidikan[0].kampus).trim()) throw new Error('Isi pendidikan terakhirmu dulu ya');
      if (st === 3 || st === 4) this.simpanEntri(false);
      if (st === 4 && !c.organisasi.length && !c.kerja.length) throw new Error('Isi minimal satu pengalaman, organisasi, atau proyek ya');
      if (st === 5) ['keahlian', 'tools', 'bahasa'].forEach(this.tambahSkillKetik, this);
      if (st === 6) { /* opsional */ }
      if (st >= 7) {
        var teks = teksCV(c), r0 = s.cvRow;
        // Balik untuk mengecek saja (tidak ada yang berubah): tidak perlu disimpan ulang,
        // supaya analisis yang sudah jadi tidak dihitung ulang.
        var sama = r0 && r0.sumber === 'susun' && r0.teks === teks && JSON.stringify(r0.susun) === JSON.stringify(c);
        var row = sama ? r0 : await API.simpanCVSusun(c, teks);
        this.set({ cvRow: row, layar: 'previewcv' });
        return;
      }
      var ke = st + 1;
      if (ke === 3 || ke === 4) { this._editIdx = null; s.entri = entriKosong(); }
      this.set({ cvStep: ke });
      if (ke === 7 && !c.profil) this.tulisProfil();
    },
    tulisProfil: async function () {
      var self = this;
      this.set({ profilMemuat: true });
      try { var r = await API.profilCV(this.s.cv); this.s.cv.profil = r.profil || ''; }
      catch (e) { toast('Draf profil belum bisa ditulis. Kamu bisa menulis sendiri di bawah.'); }
      finally { self.set({ profilMemuat: false }); }
    },
    cvMundur: function () {
      var s = this.s;
      if (s.cvStep <= 1) { this.set({ layar: 'cekcv' }); return; }
      if (s.cvStep === 3 || s.cvStep === 4) this.simpanEntri(false);
      this.set({ cvStep: s.cvStep - 1 });
    },

    // ------------------------------------------------------------ kuis
    jawabItem: function (i, n) {
      var self = this;
      return function () { var j = self.s.jawab.slice(); j[i] = n; self.set({ jawab: j }); };
    },
    halMaju: async function () {
      var s = this.s, awal = s.hal * 6;
      var kosong = 0;
      for (var k = 0; k < 6; k++) if (!s.jawab[awal + k]) kosong++;
      if (kosong) {
        this.set({ tandaKosong: true });
        setTimeout(function () { var el = document.querySelector('[data-kosong="1"]'); if (el && el.parentNode) el.parentNode.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 50);
        throw new Error(kosong === 1 ? 'Masih ada 1 kalimat yang belum dijawab. Sudah kami tandai merah.' : 'Masih ada ' + kosong + ' kalimat yang belum dijawab. Sudah kami tandai merah.');
      }
      var akhir = s.hal >= 5;
      var data = []; for (var i = 0; i < 36; i++) data.push(s.jawab[i] || null);
      var jw = s.jawaban, sudahSelesai = !!(jw && jw.selesai);
      // Kuis yang sudah selesai dan sedang ditinjau ulang: simpan hanya kalau ada jawaban yang berubah
      if (!sudahSelesai || JSON.stringify(data) !== JSON.stringify((jw && jw.data) || [])) {
        await API.simpanJawaban(data, akhir ? 5 : s.hal + 1, akhir || sudahSelesai);
        if (sudahSelesai) this.s.jawaban = Object.assign({}, jw, { data: data });
      }
      if (akhir) { this.s.jawaban = Object.assign({}, this.s.jawaban || {}, { data: data, selesai: (jw && jw.selesai) || new Date().toISOString() }); this.set({ layar: 'target' }); }
      else this.set({ hal: s.hal + 1, tandaKosong: false });
      var gul = document.querySelector('#app .scroll'); if (gul) gul.scrollTop = 0;
    },
    halMundur: function () {
      if (this.s.hal <= 0) this.set({ layar: 'intro', tandaKosong: false });
      else this.set({ hal: this.s.hal - 1, tandaKosong: false });
      var gul = document.querySelector('#app .scroll'); if (gul) gul.scrollTop = 0;
    },

    // ------------------------------------------------------------ target karir (opsional, sesudah kuis)
    // Pertanyaan ikut level dari usia (lama kerja baru terbaca dari CV saat analisis):
    // 'pekerjaan' untuk yang baru mulai, 'role' untuk yang sudah bekerja.
    jenisTarget: function () { return levelDari(this.s.profil && this.s.profil.tgl_lahir) === 'entry' ? 'pekerjaan' : 'role'; },
    simpanTarget: async function (lewati) {
      var teks = lewati ? '' : String(this.s.target || '').replace(/\s+/g, ' ').trim();
      if (!lewati && teks.length < 3) throw new Error('Tulis dulu gambarannya, atau pilih lewati');
      if (teks.length > 300) throw new Error('Cukup tulis singkat saja ya, maksimal 300 huruf');
      var jenis = this.jenisTarget(), jw = this.s.jawaban || {};
      if (!(jw.target_jenis === jenis && (jw.target || '') === teks)) await API.simpanTarget(teks, jenis);
      this.s.target = teks; this.s.targetDiketik = false;
      this.s.jawaban = Object.assign({}, this.s.jawaban || {}, { target: teks, target_jenis: jenis });
      this.set({ layar: 'proses' });
    },

    // ------------------------------------------------------------ proses analisis
    jalanProses: function () {
      var self = this;
      clearInterval(this._tick);
      this.s.tick = 0; this.s.galatProses = '';
      this.render();
      this._tick = setInterval(function () {
        if (self.s.layar !== 'proses') { clearInterval(self._tick); return; }
        if (self.s.tick < 3) self.set({ tick: self.s.tick + 1 });
      }, 5000);
      var cek = async function () {
        if (self.s.layar !== 'proses') return;
        try { await self.muatData(); } catch (e) { /* coba lagi */ }
        var l = self.s.laporan;
        if (l && l.status === 'siap') { self.set({ layar: 'hasil' }); return; }
        if (l && l.status === 'gagal') { self.set({ galatProses: 'Analisisnya belum berhasil. Coba sekali lagi ya.' }); return; }
        setTimeout(cek, 4000);
      };
      API.mulaiAnalisis().then(function (r) {
        if (r && r.catatan) toast(r.catatan);
        setTimeout(cek, r && r.status === 'siap' ? 0 : 3000);
      })
        .catch(function (e) { self.set({ galatProses: pesanGalat(e) }); });
    },

    // ------------------------------------------------------------ bayar
    pilihBukti: function () {
      var self = this;
      pilihBerkas('image/jpeg,image/png,application/pdf', function (f) {
        if (f.size > 5 * 1048576) { toast('Ukuran file maksimal 5 MB'); return; }
        if (!/(jpe?g|png|pdf)$/i.test(f.type) && !/\.(jpe?g|png|pdf)$/i.test(f.name)) { toast('File harus JPG, PNG, atau PDF'); return; }
        self.set({ bukti: f });
      });
    },
    kirimBukti: async function () {
      if (!this.s.bukti) throw new Error('Unggah bukti pembayarannya dulu ya');
      var p = await API.kirimBukti(this.s.bukti, this.s.bayar);
      this.set({ pesanan: p, bukti: null, layar: p.status === 'ok' ? 'berhasil' : 'menunggu' });
    },
    salinNomor: function () {
      var self = this;
      try { navigator.clipboard.writeText(C.BANK_NOMOR); } catch (e) { /* abaikan */ }
      self.set({ salin: true });
    },
    simpanQris: function () {
      var a = document.createElement('a');
      a.href = C.QRIS_GAMBAR; a.download = 'QRIS-Nawasena.png';
      document.body.appendChild(a); a.click(); a.remove();
      this.set({ simpanQr: true });
    },
    keBayar: function () {
      var p = this.s.pesanan;
      if (p && p.status === 'ok') { this.set({ layar: 'laporan', bagian: 0, peran: -1 }); this.pastikanLengkap(); return; }
      if (p && p.status === 'menunggu') { this.set({ layar: 'menunggu' }); return; }
      if (p && p.status === 'tolak') { this.set({ layar: 'ditolak' }); return; }
      this.set({ layar: 'paywall' });
    },

    // ------------------------------------------------------------ masukan
    kirimButuh: async function () {
      var b = D.BUTUH[this.s.butuh], t = b.tiers && this.s.tier >= 0 ? b.tiers[this.s.tier].kode : null;
      await API.kirimMasukan('kebutuhan', { pilih: b.pilih, tawaran: b.nama, tier: t, harga: this.s.hargaVote >= 0 ? D.HARGA_OPSI[this.s.hargaVote] : null });
      this.set({ sudahKirim: true });
    },
    kirimIde: async function (lewati) {
      if (!lewati && String(this.s.harap || '').trim()) await API.kirimMasukan('ide', { teks: this.s.harap.trim() });
      this.set({ ideKirim: true });
    },
    kirimNilai: async function () {
      var t = Object.keys(this.s.tingkat).map(function (i) { return D.TINGKATKAN[i]; });
      await API.kirimMasukan('penilaian', { bintang: this.s.bintang, perbaiki: t, teks: String(this.s.masukan || '').trim() });
      this.set({ nilaiKirim: true });
    },

    bukaCetak: function (jenis) { window.open('cetak.html?jenis=' + jenis, '_blank'); },
    // ------------------------------------------------------------ keluar otomatis kalau lama tidak aktif
    batasDiamMs: function () { return (Number(C.BATAS_DIAM_MENIT) || 30) * 60 * 1000; },
    catatAktif: function () { try { window.sessionStorage.setItem('nws_aktif', String(Date.now())); } catch (e) { this._aktif = Date.now(); } },
    terlaluLamaDiam: function () {
      var t = 0;
      try { t = Number(window.sessionStorage.getItem('nws_aktif') || 0); } catch (e) { t = this._aktif || 0; }
      return t > 0 && Date.now() - t > this.batasDiamMs();
    },
    awasiDiam: function () {
      var self = this, terakhir = 0;
      var tandai = function () { var n = Date.now(); if (n - terakhir > 15000) { terakhir = n; self.catatAktif(); } };
      ['click', 'keydown', 'touchstart', 'input', 'scroll'].forEach(function (ev) { window.addEventListener(ev, tandai, { passive: true, capture: true }); });
      this.catatAktif();
      var periksa = async function () {
        if (!self.s.user || !self.terlaluLamaDiam()) return;
        await self.keluar();
        toast('Kamu otomatis keluar karena tidak ada aktivitas selama ' + (Number(C.BATAS_DIAM_MENIT) || 30) + ' menit. Silakan masuk lagi ya.');
      };
      setInterval(periksa, 60000);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) periksa(); });
    },

    keluar: async function () {
      await API.keluar();
      if (this._lepas) { this._lepas(); this._lepas = null; }
      this.s = Object.assign(this.s, { profil: null, cvRow: null, jawaban: null, laporan: null, lengkap: null, pesanan: null, jawab: [], hal: 0, target: '', targetDiketik: false, cv: null, user: null });
      this.set({ layar: 'landing' });
    }
  };

  function pesanGalat(e) {
    var m = (e && e.message) || String(e);
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Koneksi internetmu sepertinya putus. Coba lagi ya.';
    if (/Token has expired|invalid.*otp|otp.*invalid|otp_expired/i.test(m)) return 'Kodenya salah atau sudah tidak berlaku. Pakai kode dari email yang paling baru ya.';
    var dtk = /after (\d+) seconds?/i.exec(m);
    if (dtk) return 'Tunggu ' + dtk[1] + ' detik lagi ya, baru bisa minta kode baru.';
    if (/rate limit|security purposes/i.test(m)) return 'Tunggu sekitar satu menit sebelum minta kode lagi ya.';
    return m;
  }

  window.App = App;
  window.NawasenaUtil = { rp: rp, tglIndo: tglIndo, jamIndo: jamIndo, levelDari: levelDari, umur: umur, bulir: bulir, teksCV: teksCV, huruf1: huruf1, svgData: svgData, PILIHAN_SKILL: PILIHAN_SKILL, toast: toast };
})();
