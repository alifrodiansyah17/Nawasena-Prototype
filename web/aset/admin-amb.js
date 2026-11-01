/* Backoffice: program ambassador referral.
 * Data utama di proyek Supabase aplikasi (ambassador, target_ambassador, pembayaran_komisi, rekap_ambassador()).
 * Jumlah isian kuesioner microsite diambil dari proyek Supabase microsite lewat rekap_referral() (hanya angka per kode).
 * Target microsite = satu angka per ambassador (ambassador.target_microsite), dibandingkan dengan total isian sejak awal. */
(function () {
  'use strict';
  var BO = window.BO, U = window.BOUtil, C = window.NAWASENA_CONFIG;
  if (!BO || !U) return;
  var sb = U.sb, rp = U.rp, tgl = U.tgl, toast = U.toast, sibuk = U.sibuk;
  var URL_MICROSITE = C.MICROSITE_URL || 'https://nawasena.me';
  var URL_APP = C.APP_URL || 'https://apps.nawasena.info';

  function hariIniISO() { var d = new Date(Date.now() + 7 * 3600000); return d.toISOString().slice(0, 10); }
  function tglPendek(d) { return d ? tgl(d + 'T00:00:00+07:00') : ''; }
  // Kode dari nama depan (maks. 6 huruf) + 2 angka; angka dipilih sekali per form supaya kode tidak berubah tiap ketikan
  function buatKode(nama, ada, akhir) {
    var dasar = String(nama || '').trim().split(/\s+/)[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'NWS';
    if (dasar.length < 2) dasar = (dasar + 'NWS').slice(0, 3);
    var k = dasar + (akhir || '');
    for (var i = 0; ada[k] && i < 90; i++) k = dasar + String(10 + Math.floor(Math.random() * 90));
    return k;
  }
  async function micrositeRekap(dari, sampai) {
    if (!C.MICROSITE_SUPABASE_URL || !C.MICROSITE_KEY) return {};
    var h = { 'Content-Type': 'application/json', apikey: C.MICROSITE_KEY };
    if (/^eyJ/.test(C.MICROSITE_KEY)) h.Authorization = 'Bearer ' + C.MICROSITE_KEY;
    var r = await fetch(C.MICROSITE_SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/rekap_referral', {
      method: 'POST', headers: h, body: JSON.stringify({ p_dari: dari || null, p_sampai: sampai || null })
    });
    if (!r.ok) throw new Error('Data microsite belum bisa diambil (' + r.status + ')');
    var map = {}; (await r.json()).forEach(function (x) { map[x.kode] = Number(x.jumlah) || 0; });
    return map;
  }

  Object.assign(BO.s, {
    amb: [], ambRekap: {}, ambMicroTotal: {}, ambGalatMicro: '',
    ambPilih: null, ambCari: '', ambForm: null, ambPaid: [], ambBayar: [], ambDetailId: null,
    tTarget: '', kForm: { jumlah: '', tanggal: '', catatan: '' }, sForm: null
  });

  Object.assign(BO, {
    muatAmb: async function () {
      var s = this.s;
      var r = await Promise.all([
        sb.from('ambassador').select('*').order('dibuat', { ascending: false }),
        sb.rpc('rekap_ambassador')
      ]);
      if (r[0].error) { toast(r[0].error.message); return; }
      var rekap = {}; (r[1].data || []).forEach(function (x) { rekap[x.ambassador_id] = x; });
      s.amb = r[0].data || []; s.ambRekap = rekap;
      if (!s.ambPilih || !s.amb.some(function (a) { return a.id === s.ambPilih; })) s.ambPilih = s.amb[0] ? s.amb[0].id : null;
      // isian microsite: total sejak awal per kode
      try { s.ambMicroTotal = await micrositeRekap(null, null); s.ambGalatMicro = ''; }
      catch (e) { s.ambGalatMicro = e.message; }
      this.set({});
      await this.muatDetailAmb();
    },
    muatDetailAmb: async function () {
      var s = this.s, id = s.ambPilih;
      if (!id) { this.set({ ambPaid: [], ambBayar: [] }); return; }
      var r = await Promise.all([
        sb.from('pesanan').select('kode, nominal, potongan, komisi, dicek, profil(nama, email)').eq('ambassador_id', id).eq('status', 'ok').order('dicek', { ascending: false }),
        sb.from('pembayaran_komisi').select('*').eq('ambassador_id', id).order('dibayar', { ascending: false })
      ]);
      this.set({ ambPaid: r[0].data || [], ambBayar: r[1].data || [], ambDetailId: id });
    },
    pilihAmb: function (id) { this.set({ ambPilih: id, ambForm: null, sForm: null, tTarget: '', kForm: { jumlah: '', tanggal: '', catatan: '' } }); this.muatDetailAmb(); },
    bukaFormAmb: function () {
      var ada = {}; this.s.amb.forEach(function (a) { ada[a.kode] = 1; });
      this.set({ ambForm: { nama: '', email: '', hp: '', kampus: '', kode: '', komisi: '5000', potongan: '5000', target: '', catatan: '', _ada: ada,
        _akhir: String(10 + Math.floor(Math.random() * 90)) } });
    },
    simpanAmb: async function () {
      var f = this.s.ambForm, s = this.s;
      var nama = String(f.nama || '').trim();
      if (!nama) { toast('Nama ambassador wajib diisi'); return; }
      var kode = String(f.kode || '').trim().toUpperCase() || buatKode(nama, f._ada, f._akhir);
      if (!/^[A-Z0-9]{4,12}$/.test(kode)) { toast('Kode 4–12 huruf/angka tanpa spasi, mis. RANI24'); return; }
      var komisi = Math.round(Number(f.komisi)), potongan = Math.round(Number(f.potongan));
      if (!(komisi >= 0)) { toast('Komisi harus angka'); return; }
      if (!(potongan >= 0 && potongan < C.HARGA)) { toast('Potongan harus di bawah harga ' + rp(C.HARGA)); return; }
      var target = String(f.target || '').trim() ? Math.round(Number(f.target)) : null;
      if (target !== null && !(target > 0)) { toast('Target isian microsite harus angka lebih dari 0, atau kosongkan'); return; }
      sibuk(true);
      try {
        var r = await sb.from('ambassador').insert({ kode: kode, nama: nama, email: String(f.email || '').trim().toLowerCase() || null,
          hp: String(f.hp || '').replace(/\D/g, '') || null, kampus: String(f.kampus || '').trim() || null, catatan: String(f.catatan || '').trim() || null,
          komisi: komisi, potongan: potongan, target_microsite: target, dibuat_oleh: s.uid }).select().single();
        if (r.error) throw new Error(/duplicate|unique/i.test(r.error.message) ? 'Kode ' + kode + ' sudah dipakai ambassador lain' : r.error.message);
        toast('Ambassador ' + nama + ' dibuat dengan kode ' + kode, true);
        this.s.ambForm = null; this.s.ambPilih = r.data.id;
        await this.muatAmb();
      } catch (e) { toast(e.message); } finally { sibuk(false); }
    },
    simpanSetelanAmb: async function () {
      var f = this.s.sForm, id = this.s.ambPilih;
      var komisi = Math.round(Number(f.komisi)), potongan = Math.round(Number(f.potongan));
      if (!(komisi >= 0) || !(potongan >= 0 && potongan < C.HARGA)) { toast('Cek lagi nominal komisi dan potongannya'); return; }
      sibuk(true);
      try {
        var r = await sb.from('ambassador').update({ komisi: komisi, potongan: potongan, email: String(f.email || '').trim().toLowerCase() || null,
          hp: String(f.hp || '').replace(/\D/g, '') || null, kampus: String(f.kampus || '').trim() || null, catatan: String(f.catatan || '').trim() || null }).eq('id', id);
        if (r.error) throw r.error;
        toast('Data ambassador disimpan. Komisi baru berlaku untuk paid user berikutnya.', true);
        this.s.sForm = null; await this.muatAmb();
      } catch (e) { toast(e.message); } finally { sibuk(false); }
    },
    aktifkanAmb: async function (aktif) {
      sibuk(true);
      try {
        var r = await sb.from('ambassador').update({ aktif: aktif }).eq('id', this.s.ambPilih);
        if (r.error) throw r.error;
        toast(aktif ? 'Ambassador diaktifkan lagi' : 'Ambassador dinonaktifkan. Kodenya tidak bisa dipakai user baru.', true);
        await this.muatAmb();
      } catch (e) { toast(e.message); } finally { sibuk(false); }
    },
    hapusAmb: async function () {
      sibuk(true);
      try {
        var r = await sb.rpc('hapus_ambassador', { p_id: this.s.ambPilih });
        if (r.error) throw new Error(String(r.error.message || '').replace(/^TERPAKAI:\s*/, ''));
        var d = r.data || {};
        toast('Ambassador ' + d.nama + ' (' + d.kode + ') dihapus' + (d.user_dilepas ? '. Kodenya dilepas dari ' + d.user_dilepas + ' user.' : '.'), true);
        this.s.ambPilih = null; this.s.sForm = null;
        await this.muatAmb();
      } catch (e) { toast(e.message); } finally { sibuk(false); }
    },
    simpanTarget: async function () {
      var t = String(this.s.tTarget || '').trim(), n = t ? Math.round(Number(t)) : null;
      if (n !== null && !(n > 0)) { toast('Target harus angka lebih dari 0, atau kosongkan untuk menghapus target'); return; }
      sibuk(true);
      try {
        var r = await sb.from('ambassador').update({ target_microsite: n }).eq('id', this.s.ambPilih);
        if (r.error) throw r.error;
        toast(n ? 'Target ' + n + ' isian microsite disimpan' : 'Target dihapus', true);
        this.s.tTarget = ''; await this.muatAmb();
      } catch (e) { toast(e.message); } finally { sibuk(false); }
    },
    catatKomisi: async function () {
      var f = this.s.kForm, n = Math.round(Number(String(f.jumlah).replace(/\D/g, '')));
      if (!(n > 0)) { toast('Isi jumlah komisi yang dibayar'); return; }
      sibuk(true);
      try {
        var r = await sb.from('pembayaran_komisi').insert({ ambassador_id: this.s.ambPilih, jumlah: n, dibayar: f.tanggal || hariIniISO(),
          catatan: String(f.catatan || '').trim() || null, dibuat_oleh: this.s.uid });
        if (r.error) throw r.error;
        toast('Pembayaran komisi ' + rp(n) + ' dicatat', true);
        this.s.kForm = { jumlah: '', tanggal: '', catatan: '' }; await this.muatAmb();
      } catch (e) { toast(e.message); } finally { sibuk(false); }
    },
    salinTeks: function (t) {
      var ok = function () { toast('Link disalin', true); };
      try { navigator.clipboard.writeText(t).then(ok, function () { window.prompt('Salin link ini:', t); }); } catch (e) { window.prompt('Salin link ini:', t); }
    },

    valsAmb: function (v) {
      var self = this, s = this.s;
      var kotak = 'height: 40px; border: 1.5px solid #E2E8F0; border-radius: 10px; padding: 0 12px; font-size: 13.5px; color: #1E293B; background: #FFFFFF; width: 100%;';
      v.kotakSt = kotak;
      var isi = function (obj, k) { return function (e) { self.s[obj][k] = e.target.value; }; };
      var hariIni = hariIniISO();

      // ringkasan
      var aktif = s.amb.filter(function (a) { return a.aktif; }).length, paid = 0, sisa = 0, isiSemua = 0, targetSemua = 0;
      var baris = s.amb.map(function (a) {
        var rk = s.ambRekap[a.id] || {}, total = (s.ambMicroTotal[a.kode] || 0) + (a.tautan ? s.ambMicroTotal[String(a.tautan).toUpperCase()] || 0 : 0), target = a.target_microsite || 0;
        var komisi = Number(rk.komisi || 0), dibayar = Number(rk.dibayar || 0);
        paid += Number(rk.paid || 0); sisa += Math.max(0, komisi - dibayar); isiSemua += total;
        if (a.aktif) targetSemua += target;
        var persen = target ? Math.min(100, Math.round(total / target * 100)) : 0, sel = s.ambPilih === a.id;
        return { a: a, rk: rk, target: target, total: total, komisi: komisi, dibayar: dibayar, sel: sel, persen: persen };
      });
      v.ambNAktif = String(aktif); v.ambNSemua = String(s.amb.length);
      v.ambMicroRingkas = targetSemua ? isiSemua + ' / ' + targetSemua : String(isiSemua);
      v.ambPaidTotal = String(paid); v.ambSisaTotal = rp(sisa);
      v.ambGalatMicro = s.ambGalatMicro; v.adaGalatMicro = !!s.ambGalatMicro;

      var q = String(s.ambCari || '').toLowerCase().trim();
      v.ambCari = s.ambCari; v.setAmbCari = function (e) { self.s.ambCari = e.target.value; self.set({}); };
      v.ambRows = baris.filter(function (b) { return !q || [b.a.kode, b.a.nama, b.a.kampus].join(' ').toLowerCase().indexOf(q) >= 0; }).map(function (b) {
        var warna = b.persen >= 100 ? '#16A34A' : b.persen >= 50 ? '#0284C7' : '#CA8A04';
        return {
          kode: b.a.kode, nama: b.a.nama, kampus: b.a.kampus || '–',
          micro: b.target ? b.total + ' / ' + b.target : b.total + ' isian',
          microSub: b.target ? (b.persen >= 100 ? 'target tercapai' : b.persen + '% dari target') : 'belum ada target',
          barSt: 'height: 6px; border-radius: 999px; background: ' + warna + '; width: ' + (b.target ? b.persen : 0) + '%;',
          paid: String(b.rk.paid || 0), daftar: String(b.rk.pendaftar || 0), komisi: rp(b.komisi), sisa: rp(Math.max(0, b.komisi - b.dibayar)),
          sisaSt: 'font-size: 13px; font-weight: 700; color: ' + (b.komisi - b.dibayar > 0 ? '#B45309' : '#64748B') + ';',
          pill: b.a.aktif ? 'Aktif' : 'Nonaktif',
          pillSt: 'justify-self: start; font-size: 10.5px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; border-radius: 999px; padding: 3px 9px; '
            + (b.a.aktif ? 'color: #15803D; background: #DCFCE7;' : 'color: #64748B; background: #F1F5F9;'),
          st: 'display: grid; grid-template-columns: 92px minmax(0,1fr) 130px 70px 96px 96px; gap: 10px; align-items: center; padding: 12px 18px; border-bottom: 1px solid #F1F5F9; cursor: pointer; '
            + (b.sel ? 'background: #F0F9FF; box-shadow: inset 3px 0 0 #009FE3;' : ''),
          pick: function () { self.pilihAmb(b.a.id); }
        };
      });
      v.ambKosong = v.ambRows.length === 0;
      v.tambahAmbKlik = function () { self.bukaFormAmb(); };

      // form tambah
      var F = s.ambForm;
      v.formAmb = !!F; v.detailAmb = !F && !!s.ambPilih; v.tanpaAmb = !F && !s.ambPilih;
      if (F) {
        v.fTarget = F.target; v.setFTarget = isi('ambForm', 'target');
        v.fNama = F.nama; v.fEmail = F.email; v.fHp = F.hp; v.fKampus = F.kampus; v.fKode = F.kode; v.fKomisi = F.komisi; v.fPotongan = F.potongan; v.fCatatan = F.catatan;
        v.setFNama = function (e) { F.nama = e.target.value; if (!F._kodeManual) { F.kode = F.nama.trim() ? buatKode(F.nama, F._ada, F._akhir) : ''; self.set({}); } };
        v.setFKode = function (e) { F.kode = String(e.target.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12); F._kodeManual = true; };
        v.setFEmail = isi('ambForm', 'email'); v.setFHp = isi('ambForm', 'hp'); v.setFKampus = isi('ambForm', 'kampus');
        v.setFKomisi = isi('ambForm', 'komisi'); v.setFPotongan = isi('ambForm', 'potongan'); v.setFCatatan = isi('ambForm', 'catatan');
        v.simpanAmbKlik = function () { self.simpanAmb(); };
        v.batalAmbKlik = function () { self.set({ ambForm: null }); };
        v.fHargaUser = rp(C.HARGA - (Number(F.potongan) || 0));
      }

      // detail
      var b = baris.filter(function (x) { return x.sel; })[0];
      if (!F && b) {
        var a = b.a;
        v.dAmbNama = a.nama; v.dAmbKode = a.kode; v.dAmbKampus = a.kampus || 'Kampus/instansi belum diisi';
        v.dAmbKontak = [a.email, a.hp].filter(Boolean).join(' · ') || 'Kontak belum diisi';
        v.dAmbAktif = a.aktif; v.dAmbNonaktif = !a.aktif;
        v.nonaktifkanKlik = function () { if (window.confirm('Nonaktifkan ' + a.nama + '? Kodenya tidak bisa dipakai user baru, data lama tetap tersimpan.')) self.aktifkanAmb(false); };
        v.aktifkanKlik = function () { self.aktifkanAmb(true); };
        v.hapusAmbKlik = function () {
          if (window.confirm('Hapus ambassador ' + a.nama + ' (' + a.kode + ') secara permanen?\n\nKodenya langsung tidak berlaku dan dilepas dari akun user yang memakainya. Ambassador yang sudah punya paid user atau catatan komisi tidak bisa dihapus — nonaktifkan saja.')) self.hapusAmb();
        };
        v.linkMicro = URL_MICROSITE.replace(/\/$/, '') + (a.tautan ? '/' + a.tautan : '/?ref=' + a.kode);
        v.linkApp = URL_APP.replace(/\/$/, '') + (a.tautan ? '/' + a.tautan : '/?ref=' + a.kode);
        v.salinMicroKlik = function () { self.salinTeks(v.linkMicro); };
        v.salinAppKlik = function () { self.salinTeks(v.linkApp); };
        v.dAmbSetelan = 'Komisi ' + rp(a.komisi) + ' per paid user · potongan user ' + rp(a.potongan) + ' (bayar ' + rp(C.HARGA - a.potongan) + ')';
        // ubah setelan
        v.sFormBuka = !!s.sForm; v.sFormTutup = !s.sForm;
        v.ubahSetelanKlik = function () { self.set({ sForm: { komisi: String(a.komisi), potongan: String(a.potongan), email: a.email || '', hp: a.hp || '', kampus: a.kampus || '', catatan: a.catatan || '' } }); };
        if (s.sForm) {
          v.sKomisi = s.sForm.komisi; v.sPotongan = s.sForm.potongan; v.sEmail = s.sForm.email; v.sHp = s.sForm.hp; v.sKampus = s.sForm.kampus; v.sCatatan = s.sForm.catatan;
          v.setSKomisi = isi('sForm', 'komisi'); v.setSPotongan = isi('sForm', 'potongan'); v.setSEmail = isi('sForm', 'email');
          v.setSHp = isi('sForm', 'hp'); v.setSKampus = isi('sForm', 'kampus'); v.setSCatatan = isi('sForm', 'catatan');
          v.simpanSetelanKlik = function () { self.simpanSetelanAmb(); };
          v.batalSetelanKlik = function () { self.set({ sForm: null }); };
        }
        // microsite: total isian sejak awal dibanding target
        v.dMicroTotal = String(b.total);
        v.dTargetAda = !!b.target; v.dTargetKosong = !b.target;
        if (b.target) {
          v.dTargetTeks = b.total + ' dari ' + b.target + ' isian';
          v.dTargetPersen = b.persen + '%';
          v.dTargetBarSt = 'height: 10px; border-radius: 999px; width: ' + b.persen + '%; background: ' + (b.persen >= 100 ? '#16A34A' : '#0284C7') + ';';
          v.dTargetSisa = b.total >= b.target ? 'Target tercapai' : 'Kurang ' + (b.target - b.total) + ' isian lagi';
        }
        v.tTarget = s.tTarget; v.setTTarget = function (e) { self.s.tTarget = e.target.value; };
        v.tTargetPh = b.target ? String(b.target) : 'mis. 50';
        v.simpanTargetKlik = function () { self.simpanTarget(); };
        // paid user & komisi
        var siap = s.ambDetailId === a.id;
        v.dPaidList = (siap ? s.ambPaid : []).map(function (p) {
          return { nama: p.profil ? p.profil.nama : '-', email: p.profil ? p.profil.email : '', kode: p.kode, tgl: p.dicek ? tgl(p.dicek) : '',
            bayar: rp(p.nominal), komisi: p.komisi != null ? rp(p.komisi) : '–' };
        });
        v.dPaidKosong = v.dPaidList.length === 0;
        v.dDaftar = String(b.rk.pendaftar || 0); v.dPaid = String(b.rk.paid || 0);
        v.dKomisi = rp(b.komisi); v.dDibayar = rp(b.dibayar); v.dSisa = rp(Math.max(0, b.komisi - b.dibayar));
        v.dBayarList = (siap ? s.ambBayar : []).map(function (k) { return { tgl: tglPendek(k.dibayar), jumlah: rp(k.jumlah), catatan: k.catatan || '' }; });
        v.dBayarKosong = v.dBayarList.length === 0;
        v.kJumlah = s.kForm.jumlah; v.kTanggal = s.kForm.tanggal || hariIni; v.kCatatan = s.kForm.catatan;
        v.setKJumlah = isi('kForm', 'jumlah'); v.setKTanggal = isi('kForm', 'tanggal'); v.setKCatatan = isi('kForm', 'catatan');
        v.isiSisaKlik = function () { self.s.kForm.jumlah = String(Math.max(0, b.komisi - b.dibayar)); self.set({}); };
        v.catatKomisiKlik = function () { self.catatKomisi(); };
      }
      return v;
    }
  });
})();
