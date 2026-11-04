/* Backoffice: voucher code (generate kode, potongan Rp/%, masa berlaku, kuota).
 * Pengguna memasukkan kode voucher di halaman pembayaran aplikasi (kotak yang sama dengan kode referral; tidak digabung). */
(function () {
  'use strict';
  var BO = window.BO, U = window.BOUtil, C = window.NAWASENA_CONFIG;
  if (!BO || !U) return;
  var sb = U.sb, rp = U.rp, toast = U.toast, sibuk = U.sibuk;
  var ABJAD = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function acak(n) { var s = ''; for (var i = 0; i < n; i++) s += ABJAD.charAt(Math.floor(Math.random() * ABJAD.length)); return s; }
  // datetime-local (dibaca sebagai WIB) <-> ISO
  function keIsoWib(x) { return x ? new Date(x + ':00+07:00').toISOString() : null; }
  function dariIsoWib(iso) { if (!iso) return ''; var d = new Date(new Date(iso).getTime() + 7 * 3600000); return d.toISOString().slice(0, 16); }
  function potongan(v) { return Math.min(v.jenis === 'persen' ? Math.round(C.HARGA * v.nilai / 100) : v.nilai, C.HARGA - 1000); }
  function statusV(v, rk) {
    var kini = Date.now(), pakai = Number(rk.terpakai || 0) + Number(rk.berjalan || 0);
    if (!v.aktif) return ['nonaktif', 'Nonaktif', 'color: #475569; background: #F1F5F9;'];
    if (new Date(v.mulai).getTime() > kini) return ['belum', 'Belum mulai', 'color: #075985; background: #E0F2FE;'];
    if (new Date(v.berakhir).getTime() < kini) return ['lewat', 'Kedaluwarsa', 'color: #991B1B; background: #FEE2E2;'];
    if (v.kuota && pakai >= v.kuota) return ['habis', 'Kuota habis', 'color: #92400E; background: #FEF3C7;'];
    return ['aktif', 'Aktif', 'color: #15803D; background: #DCFCE7;'];
  }

  Object.assign(BO.s, { voucher: [], vRekap: {}, vPilih: null, vForm: null, vCari: '', vFilter: 'semua' });

  Object.assign(BO, {
    muatVoucher: async function () {
      var r = await Promise.all([sb.from('voucher').select('*').order('dibuat', { ascending: false }), sb.rpc('rekap_voucher')]);
      if (r[0].error) { toast(r[0].error.message); return; }
      var rk = {}; (r[1].data || []).forEach(function (x) { rk[x.voucher_id] = x; });
      var s = this.s; s.voucher = r[0].data || []; s.vRekap = rk;
      if (!s.vPilih || !s.voucher.some(function (v) { return v.id === s.vPilih; })) s.vPilih = s.voucher[0] ? s.voucher[0].id : null;
      this.set({});
    },
    bukaFormVoucher: function (v) {
      var besok = new Date(Date.now() + 30 * 86400000);
      this.set({ vForm: v ? { id: v.id, kode: v.kode, nama: v.nama || '', jenis: v.jenis, nilai: String(v.nilai), kuota: v.kuota ? String(v.kuota) : '',
          mulai: dariIsoWib(v.mulai), berakhir: dariIsoWib(v.berakhir), catatan: v.catatan || '', aktif: v.aktif }
        : { id: null, kode: acak(8), nama: '', jenis: 'nominal', nilai: '10000', kuota: '', mulai: dariIsoWib(new Date().toISOString()), berakhir: dariIsoWib(besok.toISOString()), catatan: '', aktif: true } });
    },
    simpanVoucher: async function () {
      var f = this.s.vForm;
      var kode = String(f.kode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!/^[A-Z0-9]{4,20}$/.test(kode)) { toast('Kode voucher 4–20 huruf/angka tanpa spasi'); return; }
      var nilai = Math.round(Number(String(f.nilai).replace(/[^\d]/g, '')));
      if (f.jenis === 'persen' && !(nilai >= 1 && nilai <= 90)) { toast('Potongan persen 1–90%'); return; }
      if (f.jenis === 'nominal' && !(nilai >= 1000 && nilai <= C.HARGA - 1000)) { toast('Potongan Rp1.000 sampai ' + rp(C.HARGA - 1000)); return; }
      var kuota = String(f.kuota || '').trim() ? Math.round(Number(f.kuota)) : null;
      if (kuota !== null && !(kuota > 0)) { toast('Kuota harus angka lebih dari 0, atau kosongkan untuk tanpa batas'); return; }
      if (!f.mulai || !f.berakhir) { toast('Isi masa berlaku voucher'); return; }
      var mulai = keIsoWib(f.mulai), berakhir = keIsoWib(f.berakhir);
      if (new Date(berakhir) <= new Date(mulai)) { toast('Tanggal berakhir harus setelah tanggal mulai'); return; }
      var data = { kode: kode, nama: String(f.nama || '').trim() || null, jenis: f.jenis, nilai: nilai, kuota: kuota, mulai: mulai, berakhir: berakhir,
        catatan: String(f.catatan || '').trim() || null, aktif: !!f.aktif };
      sibuk(true);
      try {
        var r = f.id ? await sb.from('voucher').update(data).eq('id', f.id).select().single()
          : await sb.from('voucher').insert(Object.assign({ dibuat_oleh: this.s.uid }, data)).select().single();
        if (r.error) throw new Error(/duplicate|unique/i.test(r.error.message) ? 'Kode ' + kode + ' sudah dipakai voucher lain' : r.error.message);
        toast(f.id ? 'Voucher ' + kode + ' disimpan' : 'Voucher ' + kode + ' dibuat', true);
        this.s.vForm = null; this.s.vPilih = r.data.id;
        await this.muatVoucher();
      } catch (e) { toast(e.message); } finally { sibuk(false); }
    },
    aktifkanVoucher: async function (v, aktif) {
      sibuk(true);
      try {
        var r = await sb.from('voucher').update({ aktif: aktif }).eq('id', v.id);
        if (r.error) throw r.error;
        toast(aktif ? 'Voucher ' + v.kode + ' diaktifkan' : 'Voucher ' + v.kode + ' dinonaktifkan. Kode tidak bisa dipakai lagi.', true);
        await this.muatVoucher();
      } catch (e) { toast(e.message); } finally { sibuk(false); }
    },
    hapusVoucher: async function (v) {
      sibuk(true);
      try {
        var r = await sb.from('voucher').delete().eq('id', v.id);
        if (r.error) throw new Error(/foreign key|violates/i.test(r.error.message) ? 'Voucher ' + v.kode + ' sudah pernah dipakai di order, jadi tidak bisa dihapus. Nonaktifkan saja.' : r.error.message);
        toast('Voucher ' + v.kode + ' dihapus', true);
        this.s.vPilih = null; await this.muatVoucher();
      } catch (e) { toast(e.message); } finally { sibuk(false); }
    },

    valsVoucher: function (v) {
      var self = this, s = this.s;
      var bc = this.boleh('voucher', 'c'), bu = this.boleh('voucher', 'u'), bd = this.boleh('voucher', 'd');
      v.vBolehBuat = bc;
      var isi = function (k) { return function (e) { self.s.vForm[k] = e.target.value; self.set({}); }; };
      var hit = { semua: 0, aktif: 0, belum: 0, lewat: 0, habis: 0, nonaktif: 0 }, totalPot = 0, totalPakai = 0;
      var baris = s.voucher.map(function (x) {
        var rk = s.vRekap[x.id] || {}, st = statusV(x, rk);
        hit.semua++; hit[st[0]]++; totalPot += Number(rk.potongan || 0); totalPakai += Number(rk.terpakai || 0);
        return { x: x, rk: rk, st: st };
      });
      v.vNAktif = String(hit.aktif); v.vNSemua = String(hit.semua); v.vTotalPakai = String(totalPakai); v.vTotalPot = rp(totalPot);
      v.vTabs = [['semua', 'Semua'], ['aktif', 'Aktif'], ['belum', 'Belum mulai'], ['habis', 'Kuota habis'], ['lewat', 'Kedaluwarsa'], ['nonaktif', 'Nonaktif']].map(function (t) {
        var on = s.vFilter === t[0];
        return { label: t[1], n: String(hit[t[0]] || 0), pick: function () { self.set({ vFilter: t[0] }); },
          st: 'height: 34px; padding: 0 11px; border-radius: 10px; display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; ' + (on ? 'background: #38BDF8; color: #0F172A;' : 'color: #64748B;') };
      });
      v.vCari = s.vCari; v.setVCari = function (e) { self.s.vCari = e.target.value; self.set({}); };
      var q = String(s.vCari || '').toLowerCase().trim();
      v.vRows = baris.filter(function (b) { return (s.vFilter === 'semua' || b.st[0] === s.vFilter) && (!q || [b.x.kode, b.x.nama, b.x.catatan].join(' ').toLowerCase().indexOf(q) >= 0); })
        .map(function (b) {
          var x = b.x, sel = s.vPilih === x.id, pakai = Number(b.rk.terpakai || 0);
          return { kode: x.kode, nama: x.nama || '–', pot: x.jenis === 'persen' ? x.nilai + '%' : rp(x.nilai),
            masa: U.tgl(x.mulai) + ' – ' + U.tgl(x.berakhir) + ' ' + U.wib(x.berakhir).getFullYear(),
            kuota: (x.kuota ? pakai + ' / ' + x.kuota : pakai + ' / ∞') + (Number(b.rk.berjalan || 0) ? ' (+' + b.rk.berjalan + ' berjalan)' : ''),
            pill: b.st[1], pillSt: U.pillBase + b.st[2],
            pick: function () { self.set({ vPilih: x.id, vForm: null }); },
            st: 'display: grid; grid-template-columns: 104px minmax(80px,1fr) 70px 150px 130px 104px; gap: 10px; align-items: center; padding: 12px 18px; border-bottom: 1px solid #F1F5F9; cursor: pointer; ' + (sel ? 'background: #F0F9FF; box-shadow: inset 3px 0 0 #009FE3;' : '') };
        });
      v.vKosong = v.vRows.length === 0;
      v.tambahVoucherKlik = function () { self.bukaFormVoucher(null); };

      var F = s.vForm;
      v.vFormBuka = !!F; v.vDetail = !F && !!s.vPilih; v.vTanpa = !F && !s.vPilih;
      if (F) {
        v.vfJudul = F.id ? 'Ubah voucher' : 'Voucher baru';
        v.vfKode = F.kode; v.setVfKode = function (e) { self.s.vForm.kode = String(e.target.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20); };
        v.acakKodeKlik = function () { self.s.vForm.kode = acak(8); self.set({}); };
        v.vfNama = F.nama; v.setVfNama = isi('nama');
        v.vfNilai = F.nilai; v.setVfNilai = isi('nilai');
        v.vfKuota = F.kuota; v.setVfKuota = isi('kuota');
        v.vfMulai = F.mulai; v.setVfMulai = isi('mulai');
        v.vfBerakhir = F.berakhir; v.setVfBerakhir = isi('berakhir');
        v.vfCatatan = F.catatan; v.setVfCatatan = isi('catatan');
        var chip = function (on) { return 'flex: 1; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; cursor: pointer; border: 1.5px solid ' + (on ? '#0284C7; background: #F0F9FF; color: #0284C7;' : '#E2E8F0; background: #FFFFFF; color: #64748B;'); };
        v.vfRpSt = chip(F.jenis === 'nominal'); v.vfPersenSt = chip(F.jenis === 'persen');
        v.pilihRpKlik = function () { self.s.vForm.jenis = 'nominal'; self.set({}); };
        v.pilihPersenKlik = function () { self.s.vForm.jenis = 'persen'; self.set({}); };
        v.vfNilaiLabel = F.jenis === 'persen' ? 'Potongan (%)' : 'Potongan (Rp)';
        v.vfNilaiPh = F.jenis === 'persen' ? 'mis. 20' : 'mis. 10000';
        v.vfAktifSt = chip(F.aktif); v.vfAktifLabel = F.aktif ? 'Aktif' : 'Nonaktif';
        v.togelAktifKlik = function () { self.s.vForm.aktif = !self.s.vForm.aktif; self.set({}); };
        var nil = Math.round(Number(String(F.nilai).replace(/[^\d]/g, ''))) || 0;
        var pot = nil ? potongan({ jenis: F.jenis, nilai: nil }) : 0;
        v.vfPratinjau = nil ? 'Potongan ' + rp(pot) + ' → pengguna bayar ' + rp(C.HARGA - pot) + ' + kode unik 3 digit' : 'Isi besar potongannya';
        v.simpanVoucherKlik = function () { self.simpanVoucher(); };
        v.batalVoucherKlik = function () { self.set({ vForm: null }); };
      }
      var b = baris.filter(function (x) { return x.x.id === s.vPilih; })[0];
      if (!F && b) {
        var x = b.x, rk = b.rk;
        v.vdKode = x.kode; v.vdNama = x.nama || 'Tanpa nama'; v.vdPill = b.st[1]; v.vdPillSt = U.pillBase + b.st[2];
        v.vdPot = x.jenis === 'persen' ? x.nilai + '% (' + rp(potongan(x)) + ')' : rp(x.nilai);
        v.vdBayar = rp(C.HARGA - potongan(x)) + ' + kode unik';
        v.vdMasa = U.tglJam(x.mulai) + ' – ' + U.tglJam(x.berakhir) + ' WIB';
        v.vdKuota = x.kuota ? String(x.kuota) + ' kali' : 'Tanpa batas';
        v.vdTerpakai = String(rk.terpakai || 0); v.vdBerjalan = String(rk.berjalan || 0);
        v.vdSisa = x.kuota ? String(Math.max(0, x.kuota - Number(rk.terpakai || 0) - Number(rk.berjalan || 0))) : '∞';
        v.vdTotalPot = rp(rk.potongan || 0);
        v.vdCatatan = x.catatan || ''; v.vdAdaCatatan = !!x.catatan;
        v.vdDibuat = U.tglJam(x.dibuat) + ' oleh ' + (s.admins[x.dibuat_oleh] || 'admin');
        v.vdBolehUbah = bu; v.vdBolehHapus = bd; v.vdAktif = x.aktif && bu; v.vdNonaktif = !x.aktif && bu;
        v.ubahVoucherKlik = function () { self.bukaFormVoucher(x); };
        v.nonaktifVoucherKlik = function () { if (window.confirm('Nonaktifkan voucher ' + x.kode + '? Kodenya langsung tidak bisa dipakai pengguna.')) self.aktifkanVoucher(x, false); };
        v.aktifVoucherKlik = function () { self.aktifkanVoucher(x, true); };
        v.hapusVoucherKlik = function () { if (window.confirm('Hapus voucher ' + x.kode + ' permanen? Voucher yang sudah pernah dipakai tidak bisa dihapus.')) self.hapusVoucher(x); };
        v.salinVoucherKlik = function () { try { navigator.clipboard.writeText(x.kode); toast('Kode ' + x.kode + ' disalin', true); } catch (e) { window.prompt('Salin kode:', x.kode); } };
      }
      return v;
    }
  });
})();
