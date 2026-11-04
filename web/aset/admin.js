/* Backoffice Nawasena: login admin + RBAC (menu sesuai role), sesi maks. 24 jam, Authorize order.
 * Modul lain menempel ke window.BO: admin-voucher.js, admin-keuangan.js, admin-amb.js, admin-akun.js, admin-audit.js. */
(function () {
  'use strict';
  var C = window.NAWASENA_CONFIG;
  var BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var ALASAN = ['Nominal tidak sesuai tagihan', 'Bukti tidak terbaca', 'Dana belum masuk ke rekening', 'Bukti untuk pesanan lain'];
  var LBL = { belum_bayar: 'Belum bayar', menunggu: 'Menunggu', ok: 'Terkonfirmasi', tolak: 'Ditolak', kedaluwarsa: 'Kedaluwarsa' };
  var PST = { belum_bayar: 'color: #075985; background: #E0F2FE;', menunggu: 'color: #0F172A; background: #FEF9C3;', ok: 'color: #15803D; background: #DCFCE7;',
    tolak: 'color: #991B1B; background: #FEE2E2;', kedaluwarsa: 'color: #475569; background: #F1F5F9;' };
  var pillBase = 'justify-self: start; display: inline-flex; align-items: center; font-size: 10.5px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; border-radius: 999px; padding: 4px 10px; white-space: nowrap; ';
  var baruOn = 'font-size: 9.5px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: #FFFFFF; background: #0284C7; border-radius: 999px; padding: 2px 7px; flex-shrink: 0;';
  var SESI_MS = 24 * 3600 * 1000;
  // Menu backoffice (urutan tampil) → kunci izin di role
  var MENU = [
    { id: 'order', label: 'Authorize order', ikon: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18"/>' },
    { id: 'voucher', label: 'Voucher', ikon: '<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="2 2"/>' },
    { id: 'keuangan', label: 'Laporan keuangan', ikon: '<path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M22 19H2"/>' },
    { id: 'ambassador', label: 'Ambassador', ikon: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18.5 14.6c1.8.8 2.8 2.6 3 5.4"/>' },
    { id: 'akun', label: 'Akun & role', ikon: '<path d="M12 3l8 4v5c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V7z"/><path d="M9 12l2 2 4-4"/>' },
    { id: 'audit', label: 'Audit trail', ikon: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>' }
  ];

  function rp(n) { return 'Rp' + Number(n || 0).toLocaleString('id-ID'); }
  function wib(iso) { var d = new Date(iso); return new Date(d.getTime() + (7 * 60 + d.getTimezoneOffset()) * 60000); }
  function kunciHari(iso) { var d = wib(iso); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
  function tgl(iso) { var d = wib(iso); return d.getDate() + ' ' + BULAN[d.getMonth()]; }
  function jam(iso) { var d = wib(iso); return String(d.getHours()).padStart(2, '0') + '.' + String(d.getMinutes()).padStart(2, '0'); }
  function tglJam(iso) { return iso ? tgl(iso) + ' ' + wib(iso).getFullYear() + ', ' + jam(iso) : ''; }
  function csv(baris, nama) {
    var isi = baris.map(function (b) { return b.map(function (x) { return '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + isi], { type: 'text/csv' }));
    a.download = nama; a.click();
  }

  var elToast = document.getElementById('toast'), elSibuk = document.getElementById('sibuk'), tT;
  function toast(m, ok) { elToast.textContent = m; elToast.className = 'tampil' + (ok ? ' ok' : ''); clearTimeout(tT); tT = setTimeout(function () { elToast.className = ''; }, 4500); }
  function sibuk(on) { elSibuk.className = on ? 'tampil' : ''; }

  var sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'nawasena-admin' } });

  var BO = {
    MENU: MENU,
    s: { layar: 'muat', emailAdmin: '', sandiAdmin: '', galatMasuk: '', adminNama: '', peranNama: '', izin: {}, sesiMulai: null, view: 'order', filter: 'menunggu', pilih: null,
      tolakBuka: false, alasan: -1, cari: '', rows: [], admins: {}, buktiUrl: {}, baru: {}, kwitansi: {}, kwitansiUrl: {}, riwayat: {}, riwayatId: null },
    set: function (o) { Object.assign(this.s, o); this.rt.render(this.vals()); },
    boleh: function (menu, aksi) { var x = this.s.izin[menu]; return !!(x && x.indexOf(aksi || 'r') >= 0); },

    mulai: async function () {
      this.rt = new window.NawasenaRuntime(document.getElementById('app'), document.getElementById('tpl').innerHTML);
      this.set({});
      var s = (await sb.auth.getSession()).data.session;
      if (s) await this.setelahMasuk(s.user); else this.set({ layar: 'masuk' });
    },
    masuk: async function () {
      this.set({ galatMasuk: '' });
      // Email selalu huruf kecil tanpa spasi; kalau gagal dan sandinya berspasi di ujung, coba sekali tanpa spasi itu.
      var email = String(this.s.emailAdmin || '').trim().toLowerCase(), sandi = String(this.s.sandiAdmin || '');
      if (!email || !sandi) { this.set({ galatMasuk: 'Isi email dan kata sandinya dulu.' }); return; }
      var r = await sb.auth.signInWithPassword({ email: email, password: sandi });
      if (r.error && sandi.trim() !== sandi) r = await sb.auth.signInWithPassword({ email: email, password: sandi.trim() });
      if (r.error) {
        var m = r.error.message || '';
        this.set({ galatMasuk: /rate|too many/i.test(m) ? 'Terlalu sering mencoba. Tunggu beberapa menit lalu coba lagi.'
          : /confirm/i.test(m) ? 'Email akun ini belum dikonfirmasi. Hubungi Super admin.'
          : /banned/i.test(m) ? 'Akun ini sudah tidak punya akses backoffice.'
          : 'Email atau kata sandi salah. Tekan ikon mata untuk mengecek kata sandi yang terketik (huruf besar/kecil berpengaruh).' });
        return;
      }
      this.s.sandiAdmin = '';
      await this.setelahMasuk(r.data.user, true);
    },
    keluar: async function (pesan, aksi) {
      try { await sb.rpc('catat_aktivitas', { p_menu: 'sistem', p_aksi: aksi || 'logout', p_ringkas: pesan || null }); } catch (e) { /* abaikan */ }
      await sb.auth.signOut();
      if (pesan) { try { sessionStorage.setItem('bo-pesan', pesan); } catch (e) { /* abaikan */ } }
      location.reload();
    },
    setelahMasuk: async function (user, baruMasuk) {
      var pr = await sb.rpc('profil_admin');
      var a = pr.data;
      if (pr.error || !a) { await sb.auth.signOut(); this.set({ layar: 'masuk', galatMasuk: 'Akun ini belum terdaftar sebagai admin backoffice.' }); return; }
      if (!a.aktif) { await sb.auth.signOut(); this.set({ layar: 'masuk', galatMasuk: 'Akun ini sedang dinonaktifkan. Hubungi Super admin.' }); return; }
      if (!a.sesi_ok) {
        await sb.auth.signOut();
        this.set({ layar: 'masuk', galatMasuk: 'Sesimu sudah lebih dari 24 jam. Masuk lagi ya.' }); return;
      }
      if (baruMasuk) { try { await sb.rpc('catat_aktivitas', { p_menu: 'sistem', p_aksi: 'login', p_ringkas: null }); } catch (e) { /* abaikan */ } }
      var izin = a.izin || {};
      var ad = await sb.from('admin').select('user_id, nama, email');
      var map = {}; (ad.data || []).forEach(function (x) { map[x.user_id] = x.nama || x.email || 'Admin'; });
      var pertama = MENU.filter(function (m) { return (izin[m.id] || []).indexOf('r') >= 0; })[0];
      this.s.admins = map; this.s.uid = user.id; this.s.izin = izin; this.s.sesiMulai = a.sesi_mulai;
      if (!pertama) { await sb.auth.signOut(); this.set({ layar: 'masuk', galatMasuk: 'Role akun ini belum punya akses ke menu mana pun.' }); return; }
      this.set({ layar: 'bo', adminNama: a.nama || a.email, peranNama: a.peran || '', view: pertama.id });
      this.jagaSesi();
      await this.keView(pertama.id);
      var self = this;
      if (this.boleh('order')) {
        sb.channel('bo-pesanan').on('postgres_changes', { event: '*', schema: 'public', table: 'pesanan' }, function (p) {
          if (p.new && p.new.status === 'menunggu' && (!p.old || p.old.status !== 'menunggu')) self.s.baru[p.new.id] = true;
          if (self.s.view === 'order') self.muat();
        }).subscribe();
        setInterval(function () { if (self.s.view === 'order') self.muat(); }, 30000);
      }
    },
    // Logout otomatis 24 jam setelah login (server juga menolak akses sesudahnya)
    jagaSesi: function () {
      var self = this, mulai = this.s.sesiMulai ? new Date(this.s.sesiMulai).getTime() : Date.now();
      clearInterval(this._sesi);
      this._sesi = setInterval(function () {
        if (Date.now() - mulai >= SESI_MS) { clearInterval(self._sesi); self.keluar('Sesi 24 jam habis, silakan masuk lagi.', 'sesi_habis'); }
        else if (self.s.view) self.rt.render(self.vals());
      }, 60000);
    },
    keView: async function (id) {
      if (!this.boleh(id)) return;
      this.set({ view: id });
      if (id === 'order') await this.muat();
      if (id === 'voucher' && this.muatVoucher) await this.muatVoucher();
      if (id === 'keuangan' && this.muatKeu) await this.muatKeu();
      if (id === 'ambassador' && this.muatAmb) await this.muatAmb();
      if (id === 'akun' && this.muatAkun) await this.muatAkun();
      if (id === 'audit' && this.muatAudit) await this.muatAudit();
    },
    catatEkspor: function (menu, ringkas) { sb.rpc('catat_aktivitas', { p_menu: menu, p_aksi: 'ekspor', p_ringkas: ringkas }).then(function () {}, function () {}); },

    // ---------------------------------------------------------------- Authorize order
    muat: async function () {
      try { await sb.rpc('kedaluwarsakan_pesanan', {}); } catch (e) { /* abaikan */ }
      var r = await sb.from('pesanan').select('*, profil(nama, email)').order('dibuat', { ascending: false }).limit(2000);
      if (r.error) { toast(r.error.message); return; }
      var rows = r.data || [], self = this;
      if (!this.s.pilih || !rows.some(function (x) { return x.id === self.s.pilih; })) {
        var m = rows.filter(function (x) { return x.status === 'menunggu'; });
        this.s.pilih = (m[m.length - 1] || rows[0] || {}).id || null;
      }
      this.set({ rows: rows });
      this.siapkanBukti(); this.muatRiwayat();
    },
    muatRiwayat: async function () {
      var id = this.s.pilih; if (!id) return;
      var r = await sb.from('riwayat_pesanan').select('*').eq('pesanan_id', id).order('waktu', { ascending: true });
      if (!r.error) { this.s.riwayat[id] = r.data || []; this.set({}); }
    },
    siapkanBukti: async function () {
      var d = this.cari(this.s.pilih);
      if (!d || !d.bukti_path || this.s.buktiUrl[d.id]) return;
      var r = await sb.storage.from('bukti').createSignedUrl(d.bukti_path, 900);
      if (!r.error) { this.s.buktiUrl[d.id] = r.data.signedUrl; this.set({}); }
    },
    cari: function (id) { return this.s.rows.filter(function (x) { return x.id === id; })[0]; },
    // Receipt pembayaran: dipilih admin, dibaca jadi base64, dikirim bersama aksi "ok" (wajib) atau "kwitansi".
    pilihKwitansi: function () {
      var self = this, d = this.cari(this.s.pilih); if (!d) return;
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'application/pdf,image/png,image/jpeg';
      inp.onchange = function () {
        var f = inp.files && inp.files[0]; if (!f) return;
        if (!/^(application\/pdf|image\/png|image\/jpeg)$/.test(f.type)) { toast('Receipt harus PDF, JPG, atau PNG'); return; }
        if (f.size > 5 * 1024 * 1024) { toast('Receipt maksimal 5 MB'); return; }
        var r = new FileReader();
        r.onload = function () {
          var data = String(r.result || '').split(',')[1] || '';
          self.s.kwitansi[d.id] = { nama: f.name, tipe: f.type, data: data, ukuran: f.size };
          self.set({});
        };
        r.onerror = function () { toast('File tidak terbaca, coba lagi'); };
        r.readAsDataURL(f);
      };
      inp.click();
    },
    siapkanKwitansi: async function () {
      var d = this.cari(this.s.pilih);
      if (!d || !d.kwitansi_path || this.s.kwitansiUrl[d.id]) return;
      var r = await sb.storage.from('kwitansi').createSignedUrl(d.kwitansi_path, 900);
      if (!r.error) { this.s.kwitansiUrl[d.id] = r.data.signedUrl; this.set({}); }
    },
    aksi: async function (aksi, alasan) {
      var d = this.cari(this.s.pilih); if (!d) return;
      var kw = this.s.kwitansi[d.id];
      if ((aksi === 'ok' || aksi === 'kwitansi') && !kw) { toast('Unggah receipt pembayaran dulu. Receipt wajib sebelum konfirmasi.'); return; }
      sibuk(true);
      try {
        var s = (await sb.auth.getSession()).data.session;
        var res = await fetch(C.SUPABASE_URL + '/functions/v1/konfirmasi', {
          method: 'POST', headers: { 'Content-Type': 'application/json', apikey: C.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + s.access_token },
          body: JSON.stringify({ pesanan_id: d.id, aksi: aksi, alasan: alasan, kwitansi: kw ? { nama: kw.nama, tipe: kw.tipe, data: kw.data } : undefined })
        });
        var j = await res.json().catch(function () { return {}; });
        if (!res.ok) throw new Error(j.galat || ('Gagal (' + res.status + ')'));
        delete this.s.baru[d.id]; delete this.s.kwitansi[d.id]; delete this.s.kwitansiUrl[d.id];
        var surel = j.email === false ? ' Tapi email receipt belum terkirim, cek pengaturan SMTP.' : '';
        toast(aksi === 'ok' ? 'Pembayaran dikonfirmasi dan receipt dikirim ke email pengguna.' + surel
          : aksi === 'kwitansi' ? 'Receipt tersimpan dan dikirim ke email pengguna.' + surel
          : (aksi === 'tolak' ? 'Penolakan terkirim ke pengguna.' : 'Dikembalikan ke Menunggu.'), !surel);
        this.s.tolakBuka = false; this.s.alasan = -1;
        await this.muat();
      } catch (e) { toast(e.message); }
      finally { sibuk(false); }
    },

    vals: function () {
      var self = this, s = this.s, v = {};
      v.layarMuat = s.layar === 'muat'; v.layarMasuk = s.layar === 'masuk'; v.layarBo = s.layar === 'bo';
      if (s.layar === 'masuk' && !s.galatMasuk) { try { var ps = sessionStorage.getItem('bo-pesan'); if (ps) { s.galatMasuk = ps; sessionStorage.removeItem('bo-pesan'); } } catch (e) { /* abaikan */ } }
      v.emailAdmin = s.emailAdmin; v.sandiAdmin = s.sandiAdmin; v.galatMasuk = s.galatMasuk;
      v.setEmailAdmin = function (e) { self.s.emailAdmin = e.target.value; };
      v.sandiTipe = s.lihatSandi ? 'text' : 'password';
      v.lihatSandiKlik = function () { self.set({ lihatSandi: !s.lihatSandi }); };
      v.lihatSandiLabel = s.lihatSandi ? 'Sembunyikan kata sandi' : 'Lihat kata sandi';
      v.mataBuka = !s.lihatSandi; v.mataTutup = !!s.lihatSandi;
      v.setSandiAdmin = function (e) { self.s.sandiAdmin = e.target.value; };
      v.masukAdminKlik = function () { sibuk(true); self.masuk().finally(function () { sibuk(false); }); };
      if (s.layar !== 'bo') return v;

      v.adminNama = s.adminNama; v.peranNama = s.peranNama; v.adminInisial = String(s.adminNama || 'A').charAt(0).toUpperCase();
      v.keluarKlik = function () { self.keluar(); };
      var sisa = s.sesiMulai ? SESI_MS - (Date.now() - new Date(s.sesiMulai).getTime()) : SESI_MS;
      v.sesiSisa = 'Sesi berakhir ' + (sisa > 3600000 ? 'dalam ' + Math.floor(sisa / 3600000) + ' jam' : 'dalam ' + Math.max(1, Math.ceil(sisa / 60000)) + ' menit');
      v.hargaTeks = rp(C.HARGA);
      var nMenunggu = s.rows.filter(function (r) { return r.status === 'menunggu'; }).length;
      // menu samping: hanya yang boleh dibuka role ini
      v.m = {};
      MENU.forEach(function (m) {
        var on = s.view === m.id;
        v.m[m.id] = { ada: self.boleh(m.id), pick: function () { self.keView(m.id); },
          badge: m.id === 'order' && nMenunggu ? String(nMenunggu) : '', adaBadge: m.id === 'order' && nMenunggu > 0,
          st: 'display: flex; align-items: center; gap: 11px; padding: 10px 12px; border-radius: 11px; font-size: 14px; font-weight: 600; cursor: pointer; ' + (on ? 'background: #38BDF8; color: #0F172A;' : 'color: #FFFFFF;') };
      });
      v.viewOrder = s.view === 'order'; v.viewVoucher = s.view === 'voucher'; v.viewKeu = s.view === 'keuangan';
      v.viewAmb = s.view === 'ambassador'; v.viewAkun = s.view === 'akun'; v.viewAudit = s.view === 'audit';
      v.keViewOrder = function () { self.keView('order'); };
      if (v.viewAmb && self.valsAmb) self.valsAmb(v);
      if (v.viewVoucher && self.valsVoucher) self.valsVoucher(v);
      if (v.viewKeu && self.valsKeu) self.valsKeu(v);
      if (v.viewAkun && self.valsAkun) self.valsAkun(v);
      if (v.viewAudit && self.valsAudit) self.valsAudit(v);
      if (v.viewOrder) self.valsOrder(v);
      return v;
    },

    valsOrder: function (v) {
      var self = this, s = this.s;
      var bisaUbah = this.boleh('order', 'u');
      var semua = s.rows, hariIni = kunciHari(new Date().toISOString()), kini = Date.now();
      var hit = { menunggu: 0, belum_bayar: 0, ok: 0, tolak: 0, kedaluwarsa: 0, semua: semua.length }, okHari = 0, uHari = 0, expHari = 0, palingLama = null;
      semua.forEach(function (r) {
        hit[r.status] = (hit[r.status] || 0) + 1;
        if (r.status === 'ok' && r.dicek && kunciHari(r.dicek) === hariIni) { okHari++; uHari += r.nominal; }
        if (r.status === 'kedaluwarsa' && r.kedaluwarsa && kunciHari(r.kedaluwarsa) === hariIni) expHari++;
        if (r.status === 'menunggu' && (!palingLama || (r.dikirim || r.dibuat) < palingLama)) palingLama = r.dikirim || r.dibuat;
      });
      v.nMenunggu = String(hit.menunggu); v.nOkHari = String(okHari); v.uangHari = rp(uHari);
      v.nBelumBayar = String(hit.belum_bayar); v.nExpHari = String(expHari);
      v.lamaTeks = palingLama ? 'Paling lama masuk ' + tgl(palingLama) + ', ' + jam(palingLama) : 'Semua sudah dicek';
      v.tabs = [['menunggu', 'Menunggu dicek'], ['belum_bayar', 'Belum bayar'], ['ok', 'Terkonfirmasi'], ['tolak', 'Ditolak'], ['kedaluwarsa', 'Kedaluwarsa'], ['semua', 'Semua']].map(function (t) {
        var on = s.filter === t[0];
        return { label: t[1], n: String(hit[t[0]] || 0), pick: function () { self.set({ filter: t[0] }); },
          st: 'height: 34px; padding: 0 11px; border-radius: 10px; display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; ' + (on ? 'background: #38BDF8; color: #0F172A;' : 'background: transparent; color: #64748B;'),
          nst: 'font-size: 11px; font-weight: 800; border-radius: 999px; padding: 1px 7px; ' + (on ? 'background: #FFFFFF; color: #0F172A;' : 'background: #F1F5F9; color: #1E293B;') };
      });
      v.cari = s.cari; v.setCari = function (e) { self.s.cari = e.target.value; self.set({}); };
      var q = String(s.cari || '').toLowerCase().trim();
      var tampil = semua.filter(function (r) {
        if (s.filter !== 'semua' && r.status !== s.filter) return false;
        if (!q) return true;
        return [r.kode, r.profil && r.profil.nama, r.profil && r.profil.email, r.nominal, r.kode_voucher].join(' ').toLowerCase().indexOf(q) >= 0;
      });
      if (s.filter === 'menunggu') tampil = tampil.slice().sort(function (a, b) { return (a.dikirim || a.dibuat) < (b.dikirim || b.dibuat) ? -1 : 1; }); // paling lama di atas
      v.rows = tampil.slice(0, 500).map(function (r) {
        var sel = s.pilih === r.id, w = r.dikirim || r.dibuat;
        return { tgl: tgl(w), jam: jam(w), nama: r.profil ? r.profil.nama : '-', email: r.profil ? r.profil.email : '', pesanan: r.kode,
          metodeK: r.metode === 'qris' ? 'QRIS' : 'Transfer', nominal: rp(r.nominal),
          pick: function () { self.set({ pilih: r.id, tolakBuka: false, alasan: -1 }); self.siapkanBukti(); self.siapkanKwitansi(); self.muatRiwayat(); },
          baruSt: s.baru[r.id] ? baruOn : 'display: none;', nomSt: 'font-size: 13px; font-weight: 700; color: #1E293B;',
          pill: LBL[r.status] || r.status, pillSt: pillBase + (PST[r.status] || ''),
          st: 'display: grid; grid-template-columns: 64px minmax(0,1fr) 128px 70px 84px 116px; gap: 10px; align-items: center; padding: 12px 18px; border-bottom: 1px solid #F1F5F9; cursor: pointer; '
            + (sel ? 'background: #F0F9FF; box-shadow: inset 3px 0 0 #009FE3;' : (s.baru[r.id] ? 'background: #F0FDF4;' : '')) };
      });
      v.kosong = tampil.length === 0;

      var d = this.cari(s.pilih) || { profil: {} };
      var st = d.status || 'menunggu';
      v.adaPilih = !!d.id; v.tanpaPilih = !d.id;
      v.dNama = d.profil ? d.profil.nama : '-'; v.dEmail = d.profil ? d.profil.email : ''; v.dPesanan = d.kode || '';
      v.dMetode = d.metode === 'transfer' ? 'Transfer bank' : 'QRIS'; v.dFile = d.bukti_nama || '';
      v.dTujuan = d.metode === 'transfer' ? C.BANK_NAMA + ' · ' + C.BANK_NOMOR : 'QRIS ' + C.QRIS_NAMA + ' · NMID ' + C.QRIS_NMID;
      v.dTagihan = rp(d.nominal || C.HARGA);
      v.dRincian = [d.harga ? 'Harga ' + rp(d.harga) : '', d.potongan ? 'potongan ' + (d.kode_voucher ? 'voucher ' + d.kode_voucher : 'referral') + ' −' + rp(d.potongan) : '',
        d.kode_unik != null ? 'kode unik +' + d.kode_unik : ''].filter(Boolean).join(' · ');
      v.dWaktu = d.dikirim ? tglJam(d.dikirim) : 'Belum ada bukti';
      v.dDibuat = d.dibuat ? tglJam(d.dibuat) : '';
      v.dBatas = d.kedaluwarsa ? tglJam(d.kedaluwarsa) + (st === 'belum_bayar' ? ' (sisa ' + Math.max(0, Math.round((new Date(d.kedaluwarsa).getTime() - kini) / 60000)) + ' menit)' : '') : '–';
      v.dBuktiUrl = s.buktiUrl[d.id] || '';
      v.dAdaBukti = !!d.bukti_path; v.dTanpaBukti = !d.bukti_path;
      v.dGambar = !!v.dBuktiUrl && !/\.pdf$/i.test(d.bukti_path || '');
      v.dBukanGambar = !!d.bukti_path && !v.dGambar;
      v.bukaBukti = function () { if (v.dBuktiUrl) window.open(v.dBuktiUrl, '_blank'); else toast('Bukti belum termuat'); };
      v.dPill = LBL[st] || st; v.dPillSt = pillBase + (PST[st] || '');
      v.dMenunggu = st === 'menunggu' && !!d.id && bisaUbah; v.dMenungguLihat = st === 'menunggu' && !!d.id && !bisaUbah;
      v.dOk = st === 'ok'; v.dTolak = st === 'tolak'; v.dBelumBayar = st === 'belum_bayar' && !!d.id; v.dKedaluwarsa = st === 'kedaluwarsa';
      v.dOleh = (s.admins[d.dicek_oleh] || 'admin') + (d.dicek ? ' · ' + tgl(d.dicek) + ', ' + jam(d.dicek) : '');
      v.dAlasan = d.alasan || '';
      // Batalkan hanya keputusan sendiri, paling lama 15 menit (server juga menolak di luar itu).
      v.bisaBatal = bisaUbah && (st === 'ok' || st === 'tolak') && !!d.id && d.dicek_oleh === s.uid && !!d.dicek && (kini - new Date(d.dicek).getTime() < 15 * 60000);
      v.batalkan = function () { if (window.confirm('Kembalikan pesanan ini ke Menunggu?')) self.aksi('batal'); };
      v.tolakBuka = s.tolakBuka; v.tolakTutup = !s.tolakBuka;
      var kw = s.kwitansi[d.id];
      v.kwAda = !!kw; v.kwKosong = !kw;
      v.kwNama = kw ? kw.nama : ''; v.kwUkuran = kw ? (kw.ukuran < 1048576 ? Math.max(1, Math.round(kw.ukuran / 1024)) + ' KB' : (kw.ukuran / 1048576).toFixed(1) + ' MB') : '';
      v.kwSt = 'border: 2px dashed ' + (kw ? '#0284C7' : '#7DD3FC') + '; background: ' + (kw ? '#F0F9FF' : '#F8FAFC') + '; border-radius: 12px; padding: 14px; display: flex; align-items: center; gap: 12px; cursor: pointer;';
      v.pilihKwitansi = function () { self.pilihKwitansi(); };
      v.dKwitansi = !!d.kwitansi_path; v.dTanpaKwitansi = st === 'ok' && !d.kwitansi_path && bisaUbah;
      v.dKwitansiNama = d.kwitansi_nama || 'receipt';
      v.dKwitansiInfo = d.kwitansi_terkirim ? 'Terkirim ke ' + v.dEmail + ' · ' + tgl(d.kwitansi_terkirim) + ', ' + jam(d.kwitansi_terkirim) : 'Tersimpan, email belum terkirim';
      v.bukaKwitansi = function () { var u = s.kwitansiUrl[d.id]; if (u) window.open(u, '_blank'); else { toast('Receipt sedang dimuat, coba lagi'); self.siapkanKwitansi(); } };
      v.kirimKwitansi = function () { if (window.confirm('Simpan receipt dan kirim ke ' + v.dEmail + '?')) self.aksi('kwitansi'); };
      v.konfirmasiSt = 'flex: 1; height: 48px; border-radius: 9999px; font-size: 14px; font-weight: 700; font-family: Nunito, sans-serif; display: flex; align-items: center; justify-content: center; gap: 7px; '
        + (kw ? 'background: #16A34A; color: #FFFFFF; box-shadow: 0 6px 14px rgba(22,163,74,0.25); cursor: pointer;' : 'background: #E2E8F0; color: #64748B; cursor: not-allowed;');
      v.konfirmasi = function () {
        if (!kw) { toast('Unggah receipt pembayaran dulu. Receipt wajib sebelum konfirmasi.'); return; }
        if (window.confirm('Konfirmasi pembayaran ' + d.kode + ' (' + v.dNama + ') sebesar ' + v.dTagihan + ' dan kirim receipt ke ' + v.dEmail + '?')) self.aksi('ok');
      };
      v.bukaTolak = function () { self.set({ tolakBuka: true, alasan: -1 }); };
      v.tutupTolak = function () { self.set({ tolakBuka: false, alasan: -1 }); };
      v.kirimTolak = function () { if (s.alasan >= 0) self.aksi('tolak', ALASAN[s.alasan]); };
      v.alasanList = ALASAN.map(function (a, i) {
        var on = s.alasan === i;
        return { label: a, pick: function () { self.set({ alasan: i }); },
          st: 'padding: 7px 11px; border-radius: 999px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1.5px solid ' + (on ? '#0284C7; background: #FEF9C3; color: #0F172A;' : '#E2E8F0; background: #FFFFFF; color: #64748B;') };
      });
      v.kirimTolakSt = 'height: 42px; padding: 0 16px; border-radius: 12px; display: flex; align-items: center; font-size: 14px; font-weight: 700; '
        + (s.alasan >= 0 ? 'background: #0284C7; color: #FFFFFF; cursor: pointer;' : 'background: #E2E8F0; color: #64748B; cursor: not-allowed;');
      // riwayat status order
      var JENIS = { user: 'Pengguna', admin: 'Admin', sistem: 'Sistem' };
      v.dRiwayat = (s.riwayat[d.id] || []).map(function (h) {
        return { waktu: tglJam(h.waktu), status: LBL[h.status_baru] || h.status_baru, catatan: h.catatan || '',
          oleh: h.oleh_jenis === 'admin' ? (s.admins[h.oleh] || 'Admin') : (JENIS[h.oleh_jenis] || ''),
          dotSt: 'width: 10px; height: 10px; border-radius: 999px; flex-shrink: 0; margin-top: 4px; ' + (PST[h.status_baru] || 'background: #CBD5E1;').replace(/color: [^;]+;/, '') };
      });
      v.dRiwayatKosong = v.dRiwayat.length === 0;
    }
  };
  window.BO = BO;
  window.BOUtil = { sb: sb, rp: rp, tgl: tgl, jam: jam, tglJam: tglJam, wib: wib, kunciHari: kunciHari, csv: csv, toast: toast, sibuk: sibuk, LBL: LBL, PST: PST, pillBase: pillBase };
  // Mulai setelah semua modul (admin-*.js) termuat
  window.addEventListener('DOMContentLoaded', function () { BO.mulai(); });
})();
