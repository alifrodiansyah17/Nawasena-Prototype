/* Lapisan data: semua komunikasi ke Supabase lewat sini.
 * Kalau NAWASENA_CONFIG.MODE_DEMO = true, api-demo.js yang dipakai (tanpa server). */
(function () {
  'use strict';

  // Pembersih teks laporan (sama dengan supabase/functions/laporan-lengkap/_shared/rapikan.ts), supaya laporan
  // yang sudah tersimpan juga bersih: kode internal kuis "(E & Cs)" / "kuis To dan St" dan kurung siku di angka "[32]".
  var KODE = '(?:Cs|Ex|Ag|St|To|R|I|A|S|E|C|O)', SAMBUNG = '\\s*(?:&|dan|,|/)\\s*';
  var KURUNG_KODE = new RegExp('\\s*\\((?:sesuai |dari |lihat )?(?:kuis |hasil kuis )?' + KODE + '(?:' + SAMBUNG + KODE + ')*\\)', 'g');
  var KUIS_KODE = new RegExp('\\b(kuis|hasil kuis)\\s+' + KODE + '(?:' + SAMBUNG + KODE + ')*\\b', 'g');
  var KURUNG_ANGKA = /\[\s*((?:[-+]?(?:IDR|Rp|USD|\$)?\s?[-+]?\d[\d.,]*\s?(?:%|[KMBkmb]|rb|jt|juta|miliar|M)?))\s*\]/g;
  function rapikanLaporan(x) {
    if (typeof x === 'string') {
      return x.replace(KURUNG_KODE, '').replace(KUIS_KODE, '$1').replace(KURUNG_ANGKA, '$1')
        .replace(/ {2,}/g, ' ').replace(/\s+([.,;:!?])/g, '$1');
    }
    if (Array.isArray(x)) return x.map(rapikanLaporan);
    if (x && typeof x === 'object') { var o = {}; Object.keys(x).forEach(function (k) { o[k] = rapikanLaporan(x[k]); }); return o; }
    return x;
  }
  var C = window.NAWASENA_CONFIG;
  if (C.MODE_DEMO) return; // api-demo.js akan mengisi window.API

  // Sesi login disimpan di browser (localStorage), jadi pindah ke aplikasi lain atau tab yang dimuat ulang
  // tidak membuat pengguna harus minta kode email lagi. Keamanannya dijaga oleh keluar otomatis kalau
  // tidak ada aktivitas selama BATAS_DIAM_MENIT (lihat app.js: awasiDiam), dicek juga saat aplikasi dibuka lagi.
  var penyimpanan = (function () {
    var mem = {};
    try {
      window.localStorage.setItem('_cek', '1'); window.localStorage.removeItem('_cek');
      // pindahkan sesi yang masih aktif dari versi sebelumnya (sessionStorage), supaya tidak perlu login ulang
      try {
        var lama = window.sessionStorage.getItem('nawasena-sesi');
        if (lama && !window.localStorage.getItem('nawasena-sesi')) window.localStorage.setItem('nawasena-sesi', lama);
        window.sessionStorage.removeItem('nawasena-sesi');
      } catch (e) { /* abaikan */ }
      return window.localStorage;
    }
    catch (e) { return { getItem: function (k) { return k in mem ? mem[k] : null; }, setItem: function (k, v) { mem[k] = String(v); }, removeItem: function (k) { delete mem[k]; } }; }
  })();
  // Bersihkan sesi lama dengan nama kunci bawaan Supabase (versi pertama aplikasi).
  try {
    for (var i = window.localStorage.length - 1; i >= 0; i--) {
      var kunci = window.localStorage.key(i);
      if (/^sb-.*-auth-token/.test(kunci)) window.localStorage.removeItem(kunci);
    }
  } catch (e) { /* abaikan */ }
  var sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'implicit', storage: penyimpanan, storageKey: 'nawasena-sesi' }
  });

  function cek(r) {
    if (r && r.error) {
      var m = r.error.message || String(r.error);
      throw new Error(m);
    }
    return r ? r.data : null;
  }

  async function fungsi(nama, body) {
    var s = (await sb.auth.getSession()).data.session;
    var res = await fetch(C.SUPABASE_URL + '/functions/v1/' + nama, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': C.SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + (s ? s.access_token : C.SUPABASE_ANON_KEY)
      },
      body: JSON.stringify(body || {})
    });
    var data = {};
    try { data = await res.json(); } catch (e) { /* kosong */ }
    if (!res.ok && res.status !== 202) { var er = new Error(data.galat || ('Server sedang sibuk (' + res.status + ')')); er.kode = data.kode || ''; throw er; }
    return data;
  }

  function uid() { return API._uid; }

  var API = {
    _uid: null,

    async sesi() {
      var s = (await sb.auth.getSession()).data.session;
      API._uid = s ? s.user.id : null;
      return s ? { id: s.user.id, email: s.user.email } : null;
    },
    padaSesiBerubah(cb) {
      sb.auth.onAuthStateChange(function (ev, s) {
        API._uid = s ? s.user.id : null;
        cb(ev, s ? { id: s.user.id, email: s.user.email } : null);
      });
    },
    async keluar() { await sb.auth.signOut(); API._uid = null; },

    // ---------- daftar & masuk
    async cekKontak(email, hp) {
      return cek(await sb.rpc('cek_kontak', { p_email: email, p_hp: hp }));
    },
    async kirimKodeDaftar(email) {
      cek(await sb.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true } }));
    },
    async cekKodeDaftar(email, kode) {
      var d = cek(await sb.auth.verifyOtp({ email: email, token: kode, type: 'email' }));
      API._uid = d.user.id;
      return d.user;
    },
    // ---------- kode referral ambassador
    async cekKodeReferral(kode) { return cek(await sb.rpc('cek_kode_referral', { p_kode: kode })); },
    // Satu kotak kode: voucher atau kode referral ambassador (tidak digabung)
    async pakaiKodeReferral(kode) { return cek(await sb.rpc('pakai_kode', { p_kode: kode })); },
    // Order dibuat (atau dilanjutkan) saat membuka instruksi bayar
    async buatPesanan(metode) { return cek(await sb.rpc('buat_pesanan', { p_metode: metode || 'qris' })); },
    async simpanProfil(nama, tglLahir, hp, setuju) {
      var r = await sb.rpc('simpan_profil', { p_nama: nama, p_tgl_lahir: tglLahir, p_hp: hp, p_setuju: !!setuju });
      // database belum diperbarui (kolom persetujuan belum ada): pakai fungsi lama
      if (r.error && /Could not find the function|PGRST202/i.test((r.error.message || '') + (r.error.code || ''))) {
        r = await sb.rpc('simpan_profil', { p_nama: nama, p_tgl_lahir: tglLahir, p_hp: hp });
      }
      return cek(r);
    },
    async daftarSandi(email, sandi) {
      var d = cek(await sb.auth.signUp({ email: email, password: sandi }));
      if (!d.session) throw new Error('Akun belum bisa dibuat: "Confirm email" di Supabase masih aktif. Matikan dulu (lihat README).');
      API._uid = d.user.id;
      return d.user;
    },
    async masukSandi(akun, sandi) {
      var d = await fungsi('masuk', { aksi: 'sandi', akun: akun, sandi: sandi });
      cek(await sb.auth.setSession({ access_token: d.access_token, refresh_token: d.refresh_token }));
      await API.sesi();
    },
    // ---------- login baru: password + verifikasi dua langkah (edge function `login`)
    async _pasangSesi(d) {
      if (d && d.access_token) {
        cek(await sb.auth.setSession({ access_token: d.access_token, refresh_token: d.refresh_token }));
        await API.sesi();
      }
      return d;
    },
    async loginSandi(akun, sandi) { return API._pasangSesi(await fungsi('login', { aksi: 'sandi', peran: 'pengguna', akun: akun, sandi: sandi })); },
    async loginVerifikasi(tantangan, kode) { return API._pasangSesi(await fungsi('login', { aksi: 'verifikasi', tantangan: tantangan, kode: kode })); },
    async loginKirimUlang(tantangan) { return fungsi('login', { aksi: 'kirim_ulang', tantangan: tantangan }); },
    async daftarKirim(email) { return fungsi('login', { aksi: 'daftar_kirim', email: email }); },
    async daftarCek(tantangan, kode, sandi) {
      var d = await API._pasangSesi(await fungsi('login', { aksi: 'daftar_cek', tantangan: tantangan, kode: kode, sandi: sandi }));
      return { id: API._uid, email: (await sb.auth.getUser()).data.user.email, d: d };
    },
    async resetKirim(akun) { return fungsi('login', { aksi: 'reset_kirim', akun: akun }); },
    async resetCek(tantangan, kode, sandi) { return API._pasangSesi(await fungsi('login', { aksi: 'reset_cek', tantangan: tantangan, kode: kode, sandi: sandi })); },
    async statusKeamanan() { return cek(await sb.rpc('status_keamanan')); },
    async totpMulai() { return fungsi('login', { aksi: 'totp_mulai' }); },
    async totpAktifkan(tantangan, kode) { return fungsi('login', { aksi: 'totp_aktifkan', tantangan: tantangan, kode: kode }); },
    async totpMatikan(kode) { return fungsi('login', { aksi: 'totp_matikan', kode: kode }); },
    async gantiSandi(lama, baru) { return fungsi('login', { aksi: 'ganti_sandi', sandi_lama: lama, sandi_baru: baru }); },

    async kirimKodeMasuk(akun) { return fungsi('masuk', { aksi: 'kirim', akun: akun }); },
    async cekKodeMasuk(akun, kode) {
      var d = await fungsi('masuk', { aksi: 'cek', akun: akun, kode: kode });
      cek(await sb.auth.setSession({ access_token: d.access_token, refresh_token: d.refresh_token }));
      await API.sesi();
    },

    // ---------- muat semua data pengguna
    async muat() {
      var u = uid();
      var r = await Promise.all([
        sb.from('profil').select('*').eq('id', u).maybeSingle(),
        sb.from('cv').select('*').eq('user_id', u).maybeSingle(),
        sb.from('lampiran').select('*').eq('user_id', u).order('dibuat'),
        sb.from('jawaban').select('*').eq('user_id', u).maybeSingle(),
        sb.from('laporan').select('*').eq('user_id', u).maybeSingle(),
        sb.from('laporan_lengkap').select('*').eq('user_id', u).maybeSingle(),
        sb.from('pesanan').select('*').eq('user_id', u).order('dibuat', { ascending: false }).limit(1)
      ]);
      var lap = cek(r[4]), lengkap = cek(r[5]);
      var ref = { kode: null, potongan: 0 };
      try { var ir = await sb.rpc('info_referral'); if (!ir.error && ir.data) ref = ir.data; } catch (e) { /* fungsi belum ada: tanpa potongan */ }
      if (lap && lap.bagian1) lap.bagian1 = rapikanLaporan(lap.bagian1);
      if (lengkap && lengkap.bagian) lengkap.bagian = rapikanLaporan(lengkap.bagian);
      return {
        profil: cek(r[0]), cv: cek(r[1]), lampiran: cek(r[2]) || [], jawaban: cek(r[3]),
        laporan: lap, lengkap: lengkap, pesanan: (cek(r[6]) || [])[0] || null, referral: ref
      };
    },

    // ---------- CV & lampiran
    async unggahBerkas(bucket, file, awalan) {
      var ext = (file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '');
      var path = uid() + '/' + awalan + '-' + Date.now() + '.' + ext;
      cek(await sb.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type || undefined }));
      return path;
    },
    async simpanCVUnggah(file, teks) {
      var path = await API.unggahBerkas('cv', file, 'cv');
      return cek(await sb.from('cv').upsert({
        user_id: uid(), sumber: 'unggah', file_path: path, nama_file: file.name, teks: teks, susun: null,
        diubah: new Date().toISOString()
      }).select().single());
    },
    async simpanCVSusun(susun, teks) {
      return cek(await sb.from('cv').upsert({
        user_id: uid(), sumber: 'susun', file_path: null, nama_file: null, teks: teks, susun: susun,
        diubah: new Date().toISOString()
      }).select().single());
    },
    async simpanLampiran(jenis, file, teks) {
      var path = await API.unggahBerkas('lampiran', file, jenis);
      return cek(await sb.from('lampiran').insert({ user_id: uid(), jenis: jenis, file_path: path, nama_file: file.name, teks: teks }).select().single());
    },
    async simpanTautan(tautan) {
      return cek(await sb.from('lampiran').insert({ user_id: uid(), jenis: 'tautan', tautan: tautan }).select().single());
    },
    async hapusLampiran(id) {
      cek(await sb.from('lampiran').delete().eq('id', id));
      // tandai data berubah supaya analisis disusun ulang
      await sb.from('cv').update({ diubah: new Date().toISOString() }).eq('user_id', uid());
    },
    async profilCV(susun) { return fungsi('profil-cv', { susun: susun }); },
    async saranTarget() { return fungsi('saran-target', {}); },

    // ---------- kuis & analisis
    async simpanJawaban(data, hal, selesai) {
      var row = { user_id: uid(), data: data, hal: hal, diubah: new Date().toISOString() };
      if (selesai) row.selesai = new Date().toISOString();
      cek(await sb.from('jawaban').upsert(row));
    },
    async simpanTarget(target, jenis) {
      cek(await sb.from('jawaban').update({ target: target, target_jenis: jenis, diubah: new Date().toISOString() }).eq('user_id', uid()));
    },
    async mulaiAnalisis() { return fungsi('analisis', {}); },
    async mintaLaporanLengkap() { return fungsi('laporan-lengkap', {}); },
    // Refund: syarat + refund terakhir, pengajuan (lewat fungsi server, ada email), dan "Coba lagi" analisis yang tertunda
    async infoRefund() { return cek(await sb.rpc('info_refund')); },
    async ajukanRefund(d) { return fungsi('refund', Object.assign({ aksi: 'ajukan' }, d)); },
    async cobaLagiAnalisis() { return cek(await sb.rpc('coba_lagi_analisis')); },

    // ---------- pembayaran
    async kirimBukti(file, metode) {
      var path = await API.unggahBerkas('bukti', file, 'bukti');
      return cek(await sb.rpc('kirim_bukti', { p_metode: metode, p_bukti_path: path, p_bukti_nama: file.name }));
    },

    // ---------- masukan
    async kirimMasukan(jenis, data) {
      cek(await sb.from('masukan').insert({ user_id: uid(), jenis: jenis, data: data }));
    },

    // ---------- pantau perubahan (realtime + cadangan polling)
    pantau(cb) {
      var u = uid();
      if (!u) return function () {};
      var ch = sb.channel('nawasena-' + u);
      ['pesanan', 'laporan', 'laporan_lengkap', 'refund'].forEach(function (t) {
        ch.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: 'user_id=eq.' + u }, function () { cb(t); });
      });
      ch.subscribe();
      return function () { sb.removeChannel(ch); };
    },

    async urlBerkas(bucket, path) {
      var d = cek(await sb.storage.from(bucket).createSignedUrl(path, 600));
      return d.signedUrl;
    }
  };

  window.API = API;
  window.SB = sb;
})();
