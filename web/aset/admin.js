/* Backoffice pembayaran Nawasena: login admin, cek bukti, konfirmasi/tolak, uang masuk. */
(function () {
  'use strict';
  var C = window.NAWASENA_CONFIG;
  var BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var ALASAN = ['Nominal tidak sesuai tagihan', 'Bukti tidak terbaca', 'Dana belum masuk ke rekening', 'Bukti untuk pesanan lain'];
  var LBL = { menunggu: 'Menunggu', ok: 'Terkonfirmasi', tolak: 'Ditolak' };
  var PST = { menunggu: 'color: #0F172A; background: #FFF3B0;', ok: 'color: #15803D; background: #DCFCE7;', tolak: 'color: #991B1B; background: #FEE2E2;' };
  var pillBase = 'justify-self: start; display: inline-flex; align-items: center; font-size: 10.5px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; border-radius: 999px; padding: 4px 10px; ';
  var baruOn = 'font-size: 9.5px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: #FFFFFF; background: #0284C7; border-radius: 999px; padding: 2px 7px; flex-shrink: 0;';

  function rp(n) { return 'Rp' + Number(n || 0).toLocaleString('id-ID'); }
  function wib(iso) { var d = new Date(iso); return new Date(d.getTime() + (7 * 60 + d.getTimezoneOffset()) * 60000); }
  function kunciHari(iso) { var d = wib(iso); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
  function tgl(iso) { var d = wib(iso); return d.getDate() + ' ' + BULAN[d.getMonth()]; }
  function jam(iso) { var d = wib(iso); return String(d.getHours()).padStart(2, '0') + '.' + String(d.getMinutes()).padStart(2, '0'); }

  var elToast = document.getElementById('toast'), elSibuk = document.getElementById('sibuk'), tT;
  function toast(m, ok) { elToast.textContent = m; elToast.className = 'tampil' + (ok ? ' ok' : ''); clearTimeout(tT); tT = setTimeout(function () { elToast.className = ''; }, 4000); }
  function sibuk(on) { elSibuk.className = on ? 'tampil' : ''; }

  var sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'nawasena-admin' } });

  var BO = {
    s: { layar: 'muat', emailAdmin: '', sandiAdmin: '', galatMasuk: '', adminNama: '', view: 'bayar', filter: 'menunggu', pilih: null,
      tolakBuka: false, alasan: -1, periode: 'minggu', cari: '', rows: [], admins: {}, buktiUrl: {}, baru: {} },
    set: function (o) { Object.assign(this.s, o); this.rt.render(this.vals()); },

    mulai: async function () {
      var self = this;
      this.rt = new window.NawasenaRuntime(document.getElementById('app'), document.getElementById('tpl').innerHTML);
      this.set({});
      var s = (await sb.auth.getSession()).data.session;
      if (s) await this.setelahMasuk(s.user); else this.set({ layar: 'masuk' });
    },
    masuk: async function () {
      this.set({ galatMasuk: '' });
      // Email selalu huruf kecil tanpa spasi (keyboard HP sering membuat huruf pertama kapital).
      // Kalau gagal dan kata sandinya berakhiran/berawalan spasi (sering terselip dari keyboard HP), coba sekali tanpa spasi itu.
      var email = String(this.s.emailAdmin || '').trim().toLowerCase(), sandi = String(this.s.sandiAdmin || '');
      if (!email || !sandi) { this.set({ galatMasuk: 'Isi email dan kata sandinya dulu.' }); return; }
      var r = await sb.auth.signInWithPassword({ email: email, password: sandi });
      if (r.error && sandi.trim() !== sandi) r = await sb.auth.signInWithPassword({ email: email, password: sandi.trim() });
      if (r.error) {
        var m = r.error.message || '';
        this.set({ galatMasuk: /rate|too many/i.test(m) ? 'Terlalu sering mencoba. Tunggu beberapa menit lalu coba lagi.'
          : /confirm/i.test(m) ? 'Email akun ini belum dikonfirmasi. Hubungi pemilik backoffice.'
          : 'Email atau kata sandi salah. Tekan ikon mata untuk mengecek kata sandi yang terketik (huruf besar/kecil berpengaruh).' });
        return;
      }
      await this.setelahMasuk(r.data.user);
    },
    setelahMasuk: async function (user) {
      var a = await sb.from('admin').select('user_id, nama');
      var saya = (a.data || []).filter(function (x) { return x.user_id === user.id; })[0];
      if (!saya) { await sb.auth.signOut(); this.set({ layar: 'masuk', galatMasuk: 'Akun ini belum terdaftar sebagai admin.' }); return; }
      var map = {}; (a.data || []).forEach(function (x) { map[x.user_id] = x.nama || 'Admin'; });
      this.s.admins = map;
      this.s.uid = user.id;
      this.set({ layar: 'bo', adminNama: saya.nama || user.email });
      await this.muat();
      var self = this;
      sb.channel('bo-pesanan').on('postgres_changes', { event: '*', schema: 'public', table: 'pesanan' }, function (p) {
        if (p.eventType === 'INSERT' || (p.new && p.new.status === 'menunggu')) self.s.baru[p.new.id] = true;
        self.muat();
      }).subscribe();
      setInterval(function () { self.muat(); }, 30000);
    },
    muat: async function () {
      var r = await sb.from('pesanan').select('*, profil(nama, email)').order('dikirim', { ascending: false }).limit(1000);
      if (r.error) { toast(r.error.message); return; }
      var rows = r.data || [];
      if (!this.s.pilih || !rows.some(function (x) { return x.id === BO.s.pilih; })) {
        var m = rows.filter(function (x) { return x.status === 'menunggu'; });
        this.s.pilih = (m[m.length - 1] || rows[0] || {}).id || null;
      }
      this.set({ rows: rows });
      this.siapkanBukti();
    },
    siapkanBukti: async function () {
      var d = this.cari(this.s.pilih);
      if (!d || !d.bukti_path || this.s.buktiUrl[d.id]) return;
      var r = await sb.storage.from('bukti').createSignedUrl(d.bukti_path, 900);
      if (!r.error) { this.s.buktiUrl[d.id] = r.data.signedUrl; this.set({}); }
    },
    cari: function (id) { return this.s.rows.filter(function (x) { return x.id === id; })[0]; },
    aksi: async function (aksi, alasan) {
      var d = this.cari(this.s.pilih); if (!d) return;
      sibuk(true);
      try {
        var s = (await sb.auth.getSession()).data.session;
        var res = await fetch(C.SUPABASE_URL + '/functions/v1/konfirmasi', {
          method: 'POST', headers: { 'Content-Type': 'application/json', apikey: C.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + s.access_token },
          body: JSON.stringify({ pesanan_id: d.id, aksi: aksi, alasan: alasan })
        });
        var j = await res.json().catch(function () { return {}; });
        if (!res.ok) throw new Error(j.galat || ('Gagal (' + res.status + ')'));
        delete this.s.baru[d.id];
        toast(aksi === 'ok' ? 'Pembayaran dikonfirmasi. Laporan pengguna sedang disusun.' : (aksi === 'tolak' ? 'Penolakan terkirim ke pengguna.' : 'Dikembalikan ke Menunggu.'), true);
        this.s.tolakBuka = false; this.s.alasan = -1;
        await this.muat();
      } catch (e) { toast(e.message); }
      finally { sibuk(false); }
    },
    unduhCsv: function (baris) {
      var isi = [['dikonfirmasi', 'pesanan', 'nama', 'email', 'metode', 'nominal', 'oleh']].concat(baris.map(function (r) {
        return [r.dicek, r.kode, r.profil && r.profil.nama, r.profil && r.profil.email, r.metode, r.nominal, BO.s.admins[r.dicek_oleh] || ''];
      })).map(function (b) { return b.map(function (x) { return '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['﻿' + isi], { type: 'text/csv' }));
      a.download = 'uang-masuk-nawasena.csv'; a.click();
    },

    vals: function () {
      var self = this, s = this.s, v = {};
      v.layarMuat = s.layar === 'muat'; v.layarMasuk = s.layar === 'masuk'; v.layarBo = s.layar === 'bo';
      v.emailAdmin = s.emailAdmin; v.sandiAdmin = s.sandiAdmin; v.galatMasuk = s.galatMasuk;
      v.setEmailAdmin = function (e) { self.s.emailAdmin = e.target.value; };
      v.sandiTipe = s.lihatSandi ? 'text' : 'password';
      v.lihatSandiKlik = function () { self.set({ lihatSandi: !s.lihatSandi }); };
      v.lihatSandiLabel = s.lihatSandi ? 'Sembunyikan kata sandi' : 'Lihat kata sandi';
      v.mataBuka = !s.lihatSandi; v.mataTutup = !!s.lihatSandi;
      v.setSandiAdmin = function (e) { self.s.sandiAdmin = e.target.value; };
      v.masukAdminKlik = function () { sibuk(true); self.masuk().finally(function () { sibuk(false); }); };
      if (s.layar !== 'bo') return v;

      v.adminNama = s.adminNama; v.adminInisial = String(s.adminNama || 'A').charAt(0).toUpperCase();
      v.keluarKlik = async function () { await sb.auth.signOut(); location.reload(); };
      v.hargaTeks = rp(C.HARGA);
      v.viewBayar = s.view === 'bayar'; v.viewUang = s.view === 'uang';
      v.keViewBayar = function () { self.set({ view: 'bayar' }); }; v.keViewUang = function () { self.set({ view: 'uang' }); };
      var mSt = function (on) { return 'display: flex; align-items: center; gap: 11px; padding: 10px 12px; border-radius: 11px; font-size: 14px; font-weight: 600; ' + (on ? 'background: #38BDF8; color: #0F172A;' : 'color: #FFFFFF;'); };
      v.mBayarSt = mSt(v.viewBayar); v.mUangSt = mSt(v.viewUang);

      var semua = s.rows, hariIni = kunciHari(new Date().toISOString());
      var hit = { menunggu: 0, ok: 0, tolak: 0, semua: semua.length }, okHari = 0, tolakHari = 0, uHari = 0, palingLama = null;
      semua.forEach(function (r) {
        hit[r.status]++;
        if (r.status === 'ok' && r.dicek && kunciHari(r.dicek) === hariIni) { okHari++; uHari += r.nominal; }
        if (r.status === 'tolak' && r.dicek && kunciHari(r.dicek) === hariIni) tolakHari++;
        if (r.status === 'menunggu' && (!palingLama || r.dikirim < palingLama)) palingLama = r.dikirim;
      });
      v.nMenunggu = String(hit.menunggu); v.nOkHari = String(okHari); v.nTolakHari = String(tolakHari); v.uangHari = rp(uHari);
      v.lamaTeks = palingLama ? 'Paling lama masuk ' + tgl(palingLama) + ', ' + jam(palingLama) : 'Semua sudah dicek';
      v.tabs = [['menunggu', 'Menunggu'], ['ok', 'Terkonfirmasi'], ['tolak', 'Ditolak'], ['semua', 'Semua']].map(function (t) {
        var on = s.filter === t[0];
        return { label: t[1], n: String(hit[t[0]]), pick: function () { self.set({ filter: t[0] }); },
          st: 'height: 36px; padding: 0 13px; border-radius: 10px; display: flex; align-items: center; gap: 7px; font-size: 13.5px; font-weight: 700; ' + (on ? 'background: #38BDF8; color: #0F172A;' : 'background: transparent; color: #64748B;'),
          nst: 'font-size: 11.5px; font-weight: 800; border-radius: 999px; padding: 1px 7px; ' + (on ? 'background: #FFFFFF; color: #0F172A;' : 'background: #F1F5F9; color: #1E293B;') };
      });
      v.cari = s.cari; v.setCari = function (e) { self.s.cari = e.target.value; self.set({}); };
      var q = String(s.cari || '').toLowerCase().trim();
      var tampil = semua.filter(function (r) {
        if (s.filter !== 'semua' && r.status !== s.filter) return false;
        if (!q) return true;
        return [r.kode, r.profil && r.profil.nama, r.profil && r.profil.email].join(' ').toLowerCase().indexOf(q) >= 0;
      });
      if (s.filter === 'menunggu') tampil = tampil.slice().reverse(); // yang paling lama di atas
      v.rows = tampil.map(function (r) {
        var sel = s.pilih === r.id;
        return { tgl: tgl(r.dikirim), jam: jam(r.dikirim), nama: r.profil ? r.profil.nama : '-', email: r.profil ? r.profil.email : '', pesanan: r.kode,
          metodeK: r.metode === 'qris' ? 'QRIS' : 'Transfer', nominal: rp(r.nominal),
          pick: function () { self.set({ pilih: r.id, tolakBuka: false, alasan: -1 }); self.siapkanBukti(); },
          baruSt: s.baru[r.id] ? baruOn : 'display: none;', nomSt: 'font-size: 13px; font-weight: 700; color: #1E293B;',
          pill: LBL[r.status], pillSt: pillBase + PST[r.status],
          st: 'display: grid; grid-template-columns: 64px minmax(0,1fr) 132px 78px 84px 112px; gap: 10px; align-items: center; padding: 13px 18px; border-bottom: 1px solid #F1F5F9; '
            + (sel ? 'background: #F5FBFF; box-shadow: inset 3px 0 0 #009FE3;' : (s.baru[r.id] ? 'background: #F0FDF4;' : '')) };
      });
      v.kosong = tampil.length === 0;

      var d = this.cari(s.pilih) || { profil: {} };
      var st = d.status || 'menunggu';
      v.dNama = d.profil ? d.profil.nama : '-'; v.dEmail = d.profil ? d.profil.email : ''; v.dPesanan = d.kode || '';
      v.dMetode = d.metode === 'transfer' ? 'Transfer bank' : 'QRIS'; v.dFile = d.bukti_nama || '';
      v.dTujuan = d.metode === 'transfer' ? C.BANK_NAMA + ' · ' + C.BANK_NOMOR : 'QRIS ' + C.QRIS_NAMA + ' · NMID ' + C.QRIS_NMID;
      v.dTagihan = rp(d.nominal || C.HARGA);
      v.dWaktu = d.dikirim ? tgl(d.dikirim) + ' ' + wib(d.dikirim).getFullYear() + ', ' + jam(d.dikirim) : '';
      v.dBuktiUrl = s.buktiUrl[d.id] || '';
      v.dGambar = !!v.dBuktiUrl && !/\.pdf$/i.test(d.bukti_path || '');
      v.dBukanGambar = !v.dGambar;
      v.bukaBukti = function () { if (v.dBuktiUrl) window.open(v.dBuktiUrl, '_blank'); else toast('Bukti belum termuat'); };
      v.dBeda = false; v.dBedaTeks = '';
      v.dPill = LBL[st]; v.dPillSt = pillBase + PST[st];
      v.dMenunggu = st === 'menunggu' && !!d.id; v.dOk = st === 'ok'; v.dTolak = st === 'tolak';
      v.dOleh = (s.admins[d.dicek_oleh] || 'admin') + (d.dicek ? ' · ' + tgl(d.dicek) + ', ' + jam(d.dicek) : '');
      v.dAlasan = d.alasan || '';
      // Batalkan hanya keputusan sendiri, paling lama 15 menit (server juga menolak di luar itu).
      v.bisaBatal = st !== 'menunggu' && !!d.id && d.dicek_oleh === s.uid && !!d.dicek && (Date.now() - new Date(d.dicek).getTime() < 15 * 60000);
      v.batalkan = function () { if (window.confirm('Kembalikan pesanan ini ke Menunggu?')) self.aksi('batal'); };
      v.tolakBuka = s.tolakBuka; v.tolakTutup = !s.tolakBuka;
      v.konfirmasi = function () { if (window.confirm('Konfirmasi pembayaran ' + d.kode + ' (' + v.dNama + ')?')) self.aksi('ok'); };
      v.bukaTolak = function () { self.set({ tolakBuka: true, alasan: -1 }); };
      v.tutupTolak = function () { self.set({ tolakBuka: false, alasan: -1 }); };
      v.kirimTolak = function () { if (s.alasan >= 0) self.aksi('tolak', ALASAN[s.alasan]); };
      v.alasanList = ALASAN.map(function (a, i) {
        var on = s.alasan === i;
        return { label: a, pick: function () { self.set({ alasan: i }); },
          st: 'padding: 7px 11px; border-radius: 999px; font-size: 12px; font-weight: 600; border: 1.5px solid ' + (on ? '#0284C7; background: #FFF3B0; color: #0F172A;' : '#E2E8F0; background: #FFFFFF; color: #64748B;') };
      });
      v.kirimTolakSt = 'height: 42px; padding: 0 16px; border-radius: 12px; display: flex; align-items: center; font-size: 14px; font-weight: 700; '
        + (s.alasan >= 0 ? 'background: #0284C7; color: #FFFFFF; cursor: pointer;' : 'background: #E2E8F0; color: #64748B; cursor: not-allowed;');

      // ---------------- uang masuk
      var sekarang = new Date(), PER = {
        hari: ['Hari ini', 0], minggu: ['7 hari terakhir', 6], bulan: ['30 hari terakhir', 29]
      };
      v.periode = ['hari', 'minggu', 'bulan'].map(function (p) {
        var on = s.periode === p;
        return { label: PER[p][0], pick: function () { self.set({ periode: p }); },
          st: 'height: 36px; padding: 0 14px; border-radius: 10px; display: flex; align-items: center; font-size: 13.5px; font-weight: 700; ' + (on ? 'background: #0284C7; color: #FFFFFF;' : 'background: #FFFFFF; color: #64748B; border: 1px solid #E2E8F0;') };
      });
      var mundur = PER[s.periode][1];
      var batas = new Date(sekarang.getTime() - mundur * 86400000);
      var kunciBatas = kunciHari(batas.toISOString());
      var ok = semua.filter(function (r) { return r.status === 'ok' && r.dicek && kunciHari(r.dicek) >= kunciBatas; })
        .sort(function (a, b) { return a.dicek < b.dicek ? 1 : -1; });
      var tot = 0, qr = 0, qn = 0, tf = 0, tn = 0, perH = {};
      ok.forEach(function (r) {
        tot += r.nominal;
        if (r.metode === 'qris') { qr += r.nominal; qn++; } else { tf += r.nominal; tn++; }
        var k = kunciHari(r.dicek); perH[k] = perH[k] || { t: 0, n: 0, iso: r.dicek }; perH[k].t += r.nominal; perH[k].n++;
      });
      v.uTotal = rp(tot); v.uJumlah = String(ok.length); v.uRentang = tgl(batas.toISOString()) + ' – ' + tgl(sekarang.toISOString()) + ' ' + sekarang.getFullYear();
      v.uQris = rp(qr); v.uQrisN = qn + ' pembayaran'; v.uTf = rp(tf); v.uTfN = tn + ' pembayaran';
      var maks = 0; Object.keys(perH).forEach(function (k) { maks = Math.max(maks, perH[k].t); });
      v.perHari = [];
      for (var i = 0; i <= mundur; i++) {
        var h = new Date(sekarang.getTime() - i * 86400000), k = kunciHari(h.toISOString()), x = perH[k] || { t: 0, n: 0 };
        v.perHari.push({ tgl: (i === 0 ? 'Hari ini, ' : '') + tgl(h.toISOString()), rp: rp(x.t), n: x.n + ' bayar', tip: rp(x.t) + ' dari ' + x.n + ' pembayaran',
          bar: 'height: 100%; border-radius: 4px; background: #009FE3; width: ' + (maks ? Math.max(x.t ? 3 : 0, Math.round(x.t / maks * 100)) : 0) + '%;' });
      }
      v.uRows = ok.map(function (r) {
        return { tgl: tgl(r.dicek), jam: jam(r.dicek), pesanan: r.kode, nama: r.profil ? r.profil.nama : '-', metodeK: r.metode === 'qris' ? 'QRIS' : 'Transfer', rp: rp(r.nominal),
          oleh: s.admins[r.dicek_oleh] || 'admin', baruSt: 'display: none;',
          st: 'display: grid; grid-template-columns: 96px 132px minmax(0,1fr) 84px 92px 120px; gap: 10px; align-items: center; padding: 12px 18px; border-bottom: 1px solid #F1F5F9;' };
      });
      v.uKosong = ok.length === 0;
      v.unduhCsv = function () { self.unduhCsv(ok); };
      return v;
    }
  };
  window.BO = BO;
  BO.mulai();
})();
