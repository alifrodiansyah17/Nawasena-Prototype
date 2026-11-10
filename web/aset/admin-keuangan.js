/* Backoffice: laporan keuangan.
 *  - Semua transaksi (semua status) dan pemasukan sepanjang waktu, filter periode/status, unduh CSV
 *  - Rekonsiliasi dengan laporan eksternal (GoPay Merchant): unggah CSV apa pun, pilih kolomnya,
 *    lalu sistem mencocokkan nominal unik + waktu dan menandai selisih / order yang hilang. */
(function () {
  'use strict';
  var BO = window.BO, U = window.BOUtil, C = window.NAWASENA_CONFIG;
  if (!BO || !U) return;
  var sb = U.sb, rp = U.rp, toast = U.toast, sibuk = U.sibuk;
  var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var BLN_PANJANG = { jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, may: 4, jun: 5, jul: 6, agu: 7, aug: 7, agt: 7, sep: 8, okt: 9, oct: 9, nov: 10, des: 11, dec: 11 };
  var PERAN_KOLOM = [['nominal', 'Nominal', true], ['waktu', 'Waktu transaksi', true], ['ref', 'ID transaksi', false], ['status', 'Status', false]];
  var KAT = {
    cocok: ['Cocok', 'color: #15803D; background: #DCFCE7;', 'Ada di GoPay dan order sudah dikonfirmasi dengan nominal sama'],
    belum: ['Belum dikonfirmasi', 'color: #92400E; background: #FEF3C7;', 'Uang masuk di GoPay, tapi ordernya belum dikonfirmasi di backoffice'],
    asing: ['Tidak dikenal', 'color: #991B1B; background: #FEE2E2;', 'Ada di GoPay, tapi tidak ada order dengan nominal itu (missing order)'],
    hilang: ['Tidak ada di GoPay', 'color: #6B21A8; background: #F3E8FF;', 'Order QRIS dikonfirmasi, tapi tidak ditemukan di laporan GoPay'],
    abaikan: ['Diabaikan', 'color: #475569; background: #F1F5F9;', 'Status transaksi di laporan bukan sukses']
  };

  // ------------------------------------------------------------------ util
  function hariWib(iso) { return U.kunciHari(iso); }
  function isoHari(k) { var s = String(k); return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8); }
  function hariIni() { return hariWib(new Date().toISOString()); }
  function geserHari(n) { return hariWib(new Date(Date.now() - n * 86400000).toISOString()); }
  function parseCsv(teks) {
    teks = String(teks || '').replace(/^﻿/, '');
    var baris1 = teks.split(/\r?\n/)[0] || '';
    var sep = [';', ',', '\t', '|'].sort(function (a, b) { return baris1.split(b).length - baris1.split(a).length; })[0];
    var out = [], row = [], sel = '', kutip = false;
    for (var i = 0; i < teks.length; i++) {
      var c = teks[i];
      if (kutip) {
        if (c === '"') { if (teks[i + 1] === '"') { sel += '"'; i++; } else kutip = false; } else sel += c;
      } else if (c === '"') kutip = true;
      else if (c === sep) { row.push(sel); sel = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && teks[i + 1] === '\n') i++; row.push(sel); sel = ''; if (row.some(function (x) { return String(x).trim(); })) out.push(row); row = []; }
      else sel += c;
    }
    row.push(sel); if (row.some(function (x) { return String(x).trim(); })) out.push(row);
    return out;
  }
  function angkaRp(x) {
    // "Rp49.003" / "49,003" / "49003.00" / "49.003,00" / "IDR 49 003" → 49003
    var s = String(x == null ? '' : x).replace(/[^\d.,]/g, '');
    if (!/\d/.test(s)) return NaN;
    var titik = s.lastIndexOf('.'), koma = s.lastIndexOf(',');
    if (titik >= 0 && koma >= 0) {                       // dua jenis pemisah: yang terakhir adalah desimal
      var dsm = titik > koma ? '.' : ',';
      s = s.split(dsm === '.' ? ',' : '.').join('').replace(dsm, '.');
    } else if (titik >= 0 || koma >= 0) {                // satu jenis: desimal hanya kalau muncul sekali dan diikuti 1–2 digit
      var p = titik >= 0 ? '.' : ',', bagian = s.split(p);
      s = bagian.length === 2 && bagian[1].length <= 2 ? bagian[0] + '.' + bagian[1] : bagian.join('');
    }
    return Math.round(Number(s));
  }
  // Waktu tanpa zona dibaca sebagai WIB
  function waktu(x) {
    var s = String(x || '').trim(); if (!s) return null;
    var m, jamStr = function (h, mi, d) { return String(h || '0').padStart(2, '0') + ':' + String(mi || '0').padStart(2, '0') + ':' + String(d || '0').padStart(2, '0'); };
    if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) return new Date(s);
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s))) return new Date(m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0') + 'T' + jamStr(m[4], m[5], m[6]) + '+07:00');
    if ((m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[ ,T]+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?)?/.exec(s))) {
      var th = m[3].length === 2 ? '20' + m[3] : m[3];
      return new Date(th + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') + 'T' + jamStr(m[4], m[5], m[6]) + '+07:00');
    }
    if ((m = /^(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})(?:[ ,]+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?)?/.exec(s))) {
      var b = BLN_PANJANG[m[2].slice(0, 3).toLowerCase()]; if (b == null) return null;
      return new Date(m[3] + '-' + String(b + 1).padStart(2, '0') + '-' + m[1].padStart(2, '0') + 'T' + jamStr(m[4], m[5], m[6]) + '+07:00');
    }
    var d = new Date(s); return isNaN(d) ? null : d;
  }
  function tebakKolom(kepala) {
    var p = {}, h = kepala.map(function (x) { return String(x || '').toLowerCase(); });
    var cari = function (re, kecuali) { for (var i = 0; i < h.length; i++) if (re.test(h[i]) && !(kecuali && kecuali.test(h[i]))) return i; return -1; };
    p.nominal = cari(/gross|amount|nominal|jumlah|total|nilai|harga/, /fee|biaya|mdr|net/); if (p.nominal < 0) p.nominal = cari(/amount|nominal|jumlah|total/);
    p.waktu = cari(/transaction.?(time|date)|waktu|tanggal|date|time|created/, /settle/); if (p.waktu < 0) p.waktu = cari(/date|time|tanggal|waktu/);
    p.ref = cari(/reference|ref|transaction.?id|order.?id|id transaksi|no\.? transaksi|^id$/);
    p.status = cari(/status/);
    return p;
  }
  var SUKSES = /sukses|success|settle|berhasil|paid|complete|capture|lunas/i;

  // Pencocokan: nominal sama persis + waktu terdekat (≤ 48 jam), satu order hanya untuk satu transaksi
  function cocokkan(baris, peta, orders) {
    var trx = [], abaikan = [];
    baris.forEach(function (r, i) {
      var t = { no: i + 1, nominal: angkaRp(r[peta.nominal]), waktu: waktu(r[peta.waktu]), ref: peta.ref >= 0 ? String(r[peta.ref] || '').trim() : '', status: peta.status >= 0 ? String(r[peta.status] || '').trim() : '' };
      if (!(t.nominal > 0) || !t.waktu) { abaikan.push(Object.assign(t, { alasan: 'Nominal/waktu tidak terbaca' })); return; }
      if (peta.status >= 0 && t.status && !SUKSES.test(t.status)) { abaikan.push(Object.assign(t, { alasan: 'Status ' + t.status })); return; }
      trx.push(t);
    });
    trx.sort(function (a, b) { return a.waktu - b.waktu; });
    var qris = orders.filter(function (o) { return o.metode === 'qris'; }), dipakai = {};
    var refDobel = {}, refAda = {};
    trx.forEach(function (t) { if (t.ref) { if (refAda[t.ref]) refDobel[t.ref] = true; refAda[t.ref] = true; } });
    var hasil = trx.map(function (t) {
      var terbaik = null, beda = Infinity;
      qris.forEach(function (o) {
        if (dipakai[o.id] || o.nominal !== t.nominal) return;
        var w = new Date(o.dikirim || o.dibuat).getTime(), d = Math.abs(w - t.waktu.getTime());
        var skor = d - (o.status === 'ok' ? 3600000 : 0);   // utamakan order yang sudah dikonfirmasi
        if (d <= 48 * 3600000 && skor < beda) { beda = skor; terbaik = o; }
      });
      if (terbaik) dipakai[terbaik.id] = true;
      var kat = !terbaik ? 'asing' : terbaik.status === 'ok' ? 'cocok' : 'belum';
      return { kat: kat, t: t, o: terbaik, dobel: !!(t.ref && refDobel[t.ref]) };
    });
    // Order QRIS dikonfirmasi di rentang tanggal laporan yang tidak ada di GoPay
    var dari = trx.length ? hariWib(trx[0].waktu.toISOString()) : null, sampai = trx.length ? hariWib(trx[trx.length - 1].waktu.toISOString()) : null;
    if (dari) qris.forEach(function (o) {
      if (o.status !== 'ok' || dipakai[o.id]) return;
      var k = hariWib(o.dikirim || o.dicek || o.dibuat);
      if (k >= dari && k <= sampai) hasil.push({ kat: 'hilang', t: null, o: o });
    });
    abaikan.forEach(function (t) { hasil.push({ kat: 'abaikan', t: t, o: null }); });
    var n = { cocok: 0, belum: 0, asing: 0, hilang: 0, abaikan: 0 }, total = { gopay: 0, cocok: 0, belum: 0, asing: 0, hilang: 0 };
    hasil.forEach(function (h) {
      n[h.kat]++;
      if (h.t && h.kat !== 'abaikan') total.gopay += h.t.nominal;
      if (h.kat !== 'abaikan') total[h.kat] += h.t ? h.t.nominal : h.o.nominal;
    });
    var totalSistem = qris.filter(function (o) { if (o.status !== 'ok' || !dari) return false; var k = hariWib(o.dikirim || o.dicek || o.dibuat); return k >= dari && k <= sampai; })
      .reduce(function (a, o) { return a + o.nominal; }, 0);
    return { hasil: hasil, n: n, total: total, totalSistem: totalSistem, dari: dari, sampai: sampai, dobel: Object.keys(refDobel).length, jumlahTrx: trx.length };
  }
  function analisis(h) {
    if (!h.jumlahTrx) return ['Belum ada transaksi sukses yang terbaca dari file ini. Cek lagi pilihan kolom nominal dan waktunya.'];
    var a = [], persen = Math.round(h.n.cocok / h.jumlahTrx * 100);
    a.push(h.n.cocok + ' dari ' + h.jumlahTrx + ' transaksi GoPay (' + persen + '%) cocok dengan order yang sudah dikonfirmasi.');
    var selisih = h.total.gopay - h.totalSistem;
    a.push(selisih === 0 ? 'Total GoPay sama persis dengan total order QRIS terkonfirmasi di periode ini (' + rp(h.total.gopay) + ').'
      : 'Total GoPay ' + rp(h.total.gopay) + ' vs order QRIS terkonfirmasi ' + rp(h.totalSistem) + ': selisih ' + (selisih > 0 ? '+' : '−') + rp(Math.abs(selisih)) + '.');
    if (h.n.belum) a.push(h.n.belum + ' pembayaran (' + rp(h.total.belum) + ') sudah masuk di GoPay tapi ordernya belum dikonfirmasi. Cek di menu Authorize order.');
    if (h.n.asing) a.push(h.n.asing + ' transaksi (' + rp(h.total.asing) + ') tidak punya order dengan nominal yang sama: kemungkinan missing order, salah nominal, atau pembayaran di luar Nawasena.');
    if (h.n.hilang) a.push(h.n.hilang + ' order QRIS yang sudah dikonfirmasi (' + rp(h.total.hilang) + ') tidak ada di laporan GoPay. Cek ulang bukti bayarnya.');
    if (h.dobel) a.push(h.dobel + ' ID transaksi muncul lebih dari sekali di file.');
    if (h.n.abaikan) a.push(h.n.abaikan + ' baris diabaikan (status bukan sukses atau data tidak terbaca).');
    if (!h.n.belum && !h.n.asing && !h.n.hilang) a.push('Tidak ada selisih. Laporan GoPay dan sistem cocok semua.');
    return a;
  }

  Object.assign(BO.s, { keuRows: [], keuKomisiBayar: 0, keuPeriode: 'bulan', keuDari: '', keuSampai: '', keuStatus: 'semua', keuCari: '', keuTab: 'transaksi',
    rekon: null, rekonKat: 'semua', rekonRiwayat: [], rekonLihat: null });

  Object.assign(BO, {
    muatKeu: async function () {
      var r = await Promise.all([
        sb.from('pesanan').select('*, profil(nama, email)').order('dibuat', { ascending: false }).limit(10000),
        sb.from('pembayaran_komisi').select('jumlah'),
        sb.from('rekonsiliasi').select('id, dibuat, dibuat_oleh, nama_file, dari, sampai, ringkasan').order('dibuat', { ascending: false }).limit(30),
        sb.from('refund').select('id, kode, pesanan_id, alasan, nominal, status, selesai, tanggal_transfer, nominal_transfer, biaya_admin').order('diajukan', { ascending: false }).limit(10000)
      ]);
      if (r[0].error) { toast(r[0].error.message); return; }
      this.s.keuRows = r[0].data || [];
      this.s.keuKomisiBayar = (r[1].data || []).reduce(function (a, x) { return a + Number(x.jumlah || 0); }, 0);
      this.s.rekonRiwayat = r[2].data || [];
      // refund selesai per order (satu order paling banyak satu refund selesai)
      var rf = {}; (r[3].error ? [] : (r[3].data || [])).forEach(function (x) { if (x.status === 'selesai') rf[x.pesanan_id] = x; });
      this.s.keuRefund = rf;
      this.set({});
    },
    rentangKeu: function () {
      var s = this.s, p = s.keuPeriode, kini = hariIni();
      if (p === 'semua') return [0, 99999999];
      if (p === 'hari') return [kini, kini];
      if (p === '7') return [geserHari(6), kini];
      if (p === '30') return [geserHari(29), kini];
      if (p === 'bulan') return [Math.floor(kini / 100) * 100 + 1, kini];
      var d = s.keuDari ? Number(s.keuDari.replace(/-/g, '')) : 0, k = s.keuSampai ? Number(s.keuSampai.replace(/-/g, '')) : 99999999;
      return [d, k];
    },
    unduhKeuCsv: function (rows) {
      var A = this.s.admins;
      var RF = this.s.keuRefund || {};
      var b = [['order_id', 'status', 'dibuat', 'bukti_dikirim', 'dikonfirmasi', 'nama', 'email', 'metode', 'harga', 'potongan', 'jenis_potongan', 'kode_voucher', 'kode_unik', 'nominal', 'komisi_ambassador', 'dikonfirmasi_oleh',
        'refund_kode', 'refund_alasan', 'refund_nominal', 'refund_tanggal_transfer', 'refund_biaya_admin']]
        .concat(rows.map(function (r) {
          var f = RF[r.id] || {};
          return [r.kode, r.status, r.dibuat, r.dikirim, r.dicek, r.profil && r.profil.nama, r.profil && r.profil.email, r.metode, r.harga, r.potongan,
            r.kode_voucher ? 'voucher' : (r.potongan ? 'referral' : ''), r.kode_voucher, r.kode_unik, r.nominal, r.komisi, A[r.dicek_oleh] || '',
            f.kode || '', f.alasan === 'nominal' ? 'nominal transfer salah' : f.alasan === 'analisis' ? 'analisis gagal' : '', f.nominal_transfer || '', f.tanggal_transfer || '', f.biaya_admin == null ? '' : f.biaya_admin];
        }));
      var rg = this.rentangKeu(), nama = 'transaksi-nawasena-' + (this.s.keuPeriode === 'semua' ? 'semua' : isoHari(rg[0]) + '_' + isoHari(Math.min(rg[1], hariIni()))) + '.csv';
      U.csv(b, nama);
      this.catatEkspor('keuangan', 'Unduh CSV transaksi (' + rows.length + ' baris) · ' + nama);
    },
    // ------------------------------------------------ rekonsiliasi
    pilihFileRekon: function () {
      var self = this, inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.csv,text/csv,text/plain';
      inp.onchange = function () {
        var f = inp.files && inp.files[0]; if (!f) return;
        if (f.size > 10 * 1024 * 1024) { toast('File maksimal 10 MB'); return; }
        var r = new FileReader();
        r.onload = function () {
          var data = parseCsv(r.result);
          // baris judul = baris pertama yang punya ≥ 3 kolom terisi
          var iKepala = data.findIndex(function (b) { return b.filter(function (x) { return String(x).trim(); }).length >= 3; });
          if (iKepala < 0 || data.length - iKepala < 2) { toast('Isi file belum terbaca sebagai tabel CSV. Ekspor laporan GoPay sebagai CSV ya.'); return; }
          var kepala = data[iKepala].map(function (x, i) { return String(x).trim() || 'Kolom ' + (i + 1); });
          self.set({ rekon: { nama: f.name, kepala: kepala, baris: data.slice(iKepala + 1), peta: tebakKolom(kepala), hasil: null }, rekonKat: 'semua', rekonLihat: null });
        };
        r.onerror = function () { toast('File tidak terbaca'); };
        r.readAsText(f);
      };
      inp.click();
    },
    jalankanRekon: function () {
      var R = this.s.rekon;
      if (!R || R.peta.nominal < 0 || R.peta.waktu < 0) { toast('Pilih kolom nominal dan waktu transaksi dulu'); return; }
      R.hasil = cocokkan(R.baris, R.peta, this.s.keuRows);
      R.analisis = analisis(R.hasil);
      this.set({ rekonKat: 'semua' });
    },
    simpanRekon: async function () {
      var R = this.s.rekon; if (!R || !R.hasil) return;
      var h = R.hasil;
      var detail = h.hasil.map(function (x) {
        return { kat: x.kat, ref: x.t ? x.t.ref : null, waktu: x.t ? x.t.waktu.toISOString() : null, nominal: x.t ? x.t.nominal : x.o.nominal, status_gopay: x.t ? x.t.status : null,
          order: x.o ? x.o.kode : null, status_order: x.o ? x.o.status : null, alasan: x.t && x.t.alasan || null };
      });
      sibuk(true);
      try {
        var r = await sb.from('rekonsiliasi').insert({ sumber: 'gopay', nama_file: R.nama, dari: h.dari ? isoHari(h.dari) : null, sampai: h.sampai ? isoHari(h.sampai) : null,
          ringkasan: { n: h.n, total: h.total, total_sistem: h.totalSistem, dobel: h.dobel, jumlah_trx: h.jumlahTrx, analisis: R.analisis }, detail: detail });
        if (r.error) throw r.error;
        toast('Hasil rekonsiliasi disimpan', true);
        await this.muatKeu();
      } catch (e) { toast(e.message); } finally { sibuk(false); }
    },
    unduhRekonCsv: function () {
      var R = this.s.rekon; if (!R || !R.hasil) return;
      var b = [['kategori', 'id_transaksi_gopay', 'waktu_gopay', 'nominal', 'status_gopay', 'order_id', 'status_order', 'nama', 'catatan']].concat(R.hasil.hasil.map(function (x) {
        return [KAT[x.kat][0], x.t ? x.t.ref : '', x.t ? U.tglJam(x.t.waktu.toISOString()) : '', x.t ? x.t.nominal : x.o.nominal, x.t ? x.t.status : '',
          x.o ? x.o.kode : '', x.o ? x.o.status : '', x.o && x.o.profil ? x.o.profil.nama : '', x.t && x.t.alasan || (x.dobel ? 'ID dobel' : '')];
      }));
      U.csv(b, 'rekonsiliasi-gopay-' + (R.hasil.dari ? isoHari(R.hasil.dari) + '_' + isoHari(R.hasil.sampai) : 'kosong') + '.csv');
      this.catatEkspor('keuangan', 'Unduh hasil rekonsiliasi · ' + R.nama);
    },
    lihatRekon: async function (id) {
      var r = await sb.from('rekonsiliasi').select('*').eq('id', id).single();
      if (r.error) { toast(r.error.message); return; }
      this.set({ rekonLihat: r.data, rekon: null });
    },

    valsKeu: function (v) {
      var self = this, s = this.s, rows = s.keuRows;
      v.keuTabTrx = s.keuTab === 'transaksi'; v.keuTabRekon = s.keuTab === 'rekon';
      var tabSt = function (on) { return 'height: 36px; padding: 0 14px; border-radius: 10px; display: flex; align-items: center; font-size: 13.5px; font-weight: 700; cursor: pointer; white-space: nowrap; flex-shrink: 0; ' + (on ? 'background: #0284C7; color: #FFFFFF;' : 'background: #FFFFFF; color: #64748B; border: 1px solid #E2E8F0;'); };
      v.keuTabTrxSt = tabSt(v.keuTabTrx); v.keuTabRekonSt = tabSt(v.keuTabRekon);
      v.keTabTrx = function () { self.set({ keuTab: 'transaksi' }); }; v.keTabRekon = function () { self.set({ keuTab: 'rekon' }); };
      v.keuBolehImpor = this.boleh('keuangan', 'c');

      // sepanjang waktu
      // Pemasukan kotor = order lunas + order yang lunas lalu direfund karena analisis gagal. Refund nominal-salah bukan pemasukan
      // (uangnya tidak pernah diakui), jadi hanya dicatat sebagai dana dikembalikan + biaya admin.
      var RF = s.keuRefund || {}, rfList = Object.keys(RF).map(function (k) { return RF[k]; });
      var lunas = rows.filter(function (r) { return r.status === 'ok' || (r.status === 'direfund' && RF[r.id] && RF[r.id].alasan === 'analisis'); });
      var semuaKomisi = rows.filter(function (r) { return r.status === 'ok'; }).reduce(function (a, r) { return a + Number(r.komisi || 0); }, 0);
      var semuaKotor = lunas.reduce(function (a, r) { return a + r.nominal; }, 0);
      var semuaRefA = rfList.filter(function (x) { return x.alasan === 'analisis'; }).reduce(function (a, x) { return a + (x.nominal_transfer || x.nominal); }, 0);
      var semuaBiaya = rfList.reduce(function (a, x) { return a + Number(x.biaya_admin || 0); }, 0);
      v.keuSemuaUang = rp(semuaKotor - semuaRefA - semuaBiaya);
      v.keuSemuaN = 'bersih · kotor ' + rp(semuaKotor) + (semuaRefA || semuaBiaya ? ' − refund ' + rp(semuaRefA) + ' − biaya admin refund ' + rp(semuaBiaya) : '') + ' · ' + lunas.length + ' transaksi';
      v.keuKomisiSisa = rp(Math.max(0, semuaKomisi - s.keuKomisiBayar)); v.keuKomisiInfo = 'dari ' + rp(semuaKomisi) + ' komisi, ' + rp(s.keuKomisiBayar) + ' sudah dibayar';

      // periode
      var rg = this.rentangKeu();
      v.keuPeriodeList = [['hari', 'Hari ini'], ['7', '7 hari'], ['30', '30 hari'], ['bulan', 'Bulan ini'], ['semua', 'Semua waktu'], ['rentang', 'Pilih tanggal']].map(function (p) {
        var on = s.keuPeriode === p[0];
        return { label: p[1], pick: function () { self.set({ keuPeriode: p[0] }); },
          st: 'height: 34px; padding: 0 12px; border-radius: 10px; display: flex; align-items: center; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; ' + (on ? 'background: #0284C7; color: #FFFFFF;' : 'background: #FFFFFF; color: #64748B; border: 1px solid #E2E8F0;') };
      });
      v.keuRentang = s.keuPeriode === 'rentang';
      v.keuDari = s.keuDari; v.keuSampai = s.keuSampai;
      v.setKeuDari = function (e) { self.s.keuDari = e.target.value; self.set({}); }; v.setKeuSampai = function (e) { self.s.keuSampai = e.target.value; self.set({}); };
      var diPeriode = function (iso) { if (!iso) return false; var k = hariWib(iso); return k >= rg[0] && k <= rg[1]; };
      var lunasP = lunas.filter(function (r) { return diPeriode(r.dicek); });
      var uang = lunasP.reduce(function (a, r) { return a + r.nominal; }, 0);
      var rfP = rfList.filter(function (x) { return diPeriode(x.selesai); });
      var refA = rfP.filter(function (x) { return x.alasan === 'analisis'; }).reduce(function (a, x) { return a + (x.nominal_transfer || x.nominal); }, 0);
      var refN = rfP.filter(function (x) { return x.alasan === 'nominal'; }).reduce(function (a, x) { return a + (x.nominal_transfer || x.nominal); }, 0);
      var biayaRf = rfP.reduce(function (a, x) { return a + Number(x.biaya_admin || 0); }, 0);
      v.keuBersih = rp(uang - refA - biayaRf); v.keuKotor = rp(uang); v.keuRefA = rp(refA); v.keuBiayaRf = rp(biayaRf);
      v.keuRefN = rp(refN); v.keuAdaRefund = rfP.length > 0; v.keuNRefund = String(rfP.length);
      var pot = lunasP.reduce(function (a, r) { return a + Number(r.potongan || 0); }, 0);
      var potV = lunasP.filter(function (r) { return r.kode_voucher; }).reduce(function (a, r) { return a + Number(r.potongan || 0); }, 0);
      var qr = lunasP.filter(function (r) { return r.metode === 'qris'; }).reduce(function (a, r) { return a + r.nominal; }, 0);
      v.keuUang = rp(uang); v.keuN = String(lunasP.length); v.keuRata = rp(lunasP.length ? Math.round(uang / lunasP.length) : 0);
      v.keuPot = rp(pot); v.keuPotInfo = 'voucher ' + rp(potV) + ' · referral ' + rp(pot - potV);
      v.keuQris = rp(qr); v.keuTf = rp(uang - qr);
      v.keuPeriodeTeks = s.keuPeriode === 'semua' ? 'Sepanjang waktu' : (isoHari(rg[0]) === '0000-00-00' ? 'Sampai ' : U.tgl(isoHari(Math.max(rg[0], 19700101)) + 'T00:00:00+07:00') + ' – ') + U.tgl(isoHari(Math.min(rg[1], hariIni())) + 'T00:00:00+07:00');
      // order dibuat di periode, per status (funnel)
      var dibuatP = rows.filter(function (r) { return diPeriode(r.dibuat); });
      var hs = { belum_bayar: 0, menunggu: 0, ok: 0, tolak: 0, kedaluwarsa: 0, direfund: 0 };
      dibuatP.forEach(function (r) { hs[r.status] = (hs[r.status] || 0) + 1; });
      v.keuFunnel = [['belum_bayar', 'Belum bayar'], ['menunggu', 'Menunggu dicek'], ['ok', 'Lunas'], ['tolak', 'Ditolak'], ['kedaluwarsa', 'Kedaluwarsa'], ['direfund', 'Direfund']].map(function (x) {
        return { label: x[1], n: String(hs[x[0]] || 0), st: U.pillBase + U.PST[x[0]] };
      });
      v.keuKonversi = dibuatP.length ? Math.round((hs.ok || 0) / dibuatP.length * 100) + '% order dibuat → lunas' : 'Belum ada order di periode ini';
      // per bulan (sepanjang waktu)
      var perB = {};
      lunas.forEach(function (r) { var d = U.wib(r.dicek || r.dibuat), k = d.getFullYear() * 100 + d.getMonth(); perB[k] = perB[k] || { t: 0, n: 0 }; perB[k].t += r.nominal; perB[k].n++; });
      var kunci = Object.keys(perB).sort().reverse().slice(0, 12), maks = 0;
      kunci.forEach(function (k) { maks = Math.max(maks, perB[k].t); });
      v.keuPerBulan = kunci.map(function (k) {
        var x = perB[k];
        return { label: BLN[k % 100] + ' ' + Math.floor(k / 100), rp: rp(x.t), n: x.n + ' trx', bar: 'height: 100%; border-radius: 4px; background: #009FE3; width: ' + (maks ? Math.max(3, Math.round(x.t / maks * 100)) : 0) + '%;' };
      });
      v.keuPerBulanKosong = !kunci.length;
      // tabel transaksi
      v.keuStatusList = [['semua', 'Semua'], ['ok', 'Lunas'], ['menunggu', 'Menunggu'], ['belum_bayar', 'Belum bayar'], ['tolak', 'Ditolak'], ['kedaluwarsa', 'Kedaluwarsa'], ['direfund', 'Direfund']].map(function (x) {
        var on = s.keuStatus === x[0];
        return { label: x[1], pick: function () { self.set({ keuStatus: x[0] }); },
          st: 'height: 30px; padding: 0 10px; border-radius: 9px; display: flex; align-items: center; font-size: 12.5px; font-weight: 700; cursor: pointer; ' + (on ? 'background: #38BDF8; color: #0F172A;' : 'color: #64748B;') };
      });
      v.keuCari = s.keuCari; v.setKeuCari = function (e) { self.s.keuCari = e.target.value; self.set({}); };
      var q = String(s.keuCari || '').toLowerCase().trim();
      var trx = rows.filter(function (r) {
        if (!diPeriode(r.status === 'ok' ? r.dicek : r.dibuat)) return false;
        if (s.keuStatus !== 'semua' && r.status !== s.keuStatus) return false;
        return !q || [r.kode, r.profil && r.profil.nama, r.profil && r.profil.email, r.nominal, r.kode_voucher].join(' ').toLowerCase().indexOf(q) >= 0;
      });
      v.keuTrx = trx.slice(0, 400).map(function (r) {
        var w = r.status === 'ok' ? r.dicek : r.dibuat;
        return { kode: r.kode, waktu: U.tgl(w) + ', ' + U.jam(w), nama: r.profil ? r.profil.nama : '-', metode: r.metode === 'qris' ? 'QRIS' : 'Transfer',
          harga: rp(r.harga || (r.nominal + Number(r.potongan || 0))), pot: r.potongan ? '−' + rp(r.potongan) + (r.kode_voucher ? ' · ' + r.kode_voucher : ' · ref') : '–',
          nominal: rp(r.nominal), pill: U.LBL[r.status] || r.status, pillSt: U.pillBase + (U.PST[r.status] || ''),
          nomSt: 'font-size: 13px; font-weight: 800; color: ' + (r.status === 'ok' ? '#15803D' : '#94A3B8') + ';',
          st: 'display: grid; grid-template-columns: 128px 110px minmax(0,1fr) 64px 80px 150px 90px 112px; gap: 10px; align-items: center; padding: 11px 18px; border-bottom: 1px solid #F1F5F9; font-size: 12.5px;' };
      });
      v.keuTrxKosong = trx.length === 0;
      v.keuTrxInfo = trx.length + ' transaksi' + (trx.length > 400 ? ' (400 pertama ditampilkan, CSV berisi semua)' : '');
      v.unduhKeuKlik = function () { self.unduhKeuCsv(trx); };

      // ------------------------------------------------ rekonsiliasi
      var R = s.rekon;
      v.rekonKosong = !R && !s.rekonLihat; v.rekonAda = !!R; v.rekonLihat = !!s.rekonLihat;
      v.pilihFileRekonKlik = function () { self.pilihFileRekon(); };
      v.rekonRiwayat = s.rekonRiwayat.map(function (x) {
        var n = (x.ringkasan && x.ringkasan.n) || {};
        return { tgl: U.tglJam(x.dibuat), file: x.nama_file || '-', rentang: (x.dari || '') + (x.sampai && x.sampai !== x.dari ? ' – ' + x.sampai : ''),
          oleh: s.admins[x.dibuat_oleh] || 'admin', ringkas: (n.cocok || 0) + ' cocok · ' + ((n.belum || 0) + (n.asing || 0) + (n.hilang || 0)) + ' perlu dicek',
          pick: function () { self.lihatRekon(x.id); } };
      });
      v.rekonRiwayatKosong = !v.rekonRiwayat.length;
      if (R) {
        v.rkNama = R.nama; v.rkJumlah = R.baris.length + ' baris';
        v.rkPeran = PERAN_KOLOM.map(function (pk) {
          return { label: pk[1] + (pk[2] ? '' : ' (opsional)'), kolom: R.kepala.map(function (k, i) {
            var on = R.peta[pk[0]] === i;
            return { label: k, pick: function () { R.peta[pk[0]] = on && !pk[2] ? -1 : i; R.hasil = null; self.set({}); },
              st: 'padding: 5px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; border: 1.5px solid ' + (on ? '#0284C7; background: #E0F2FE; color: #0F172A;' : '#E2E8F0; background: #FFFFFF; color: #64748B;') };
          }) };
        });
        v.rkContoh = R.baris.slice(0, 3).map(function (b) {
          return { teks: ['nominal', 'waktu', 'ref', 'status'].map(function (k) { return R.peta[k] >= 0 ? b[R.peta[k]] : null; }).filter(function (x) { return x != null; }).join('  ·  '),
            baca: (R.peta.nominal >= 0 ? rp(angkaRp(b[R.peta.nominal])) : '?') + ' · ' + (R.peta.waktu >= 0 && waktu(b[R.peta.waktu]) ? U.tglJam(waktu(b[R.peta.waktu]).toISOString()) : 'waktu tidak terbaca') };
        });
        v.jalankanRekonKlik = function () { self.jalankanRekon(); };
        v.batalRekonKlik = function () { self.set({ rekon: null }); };
        v.rkAdaHasil = !!R.hasil; v.rkBelumHasil = !R.hasil;
        if (R.hasil) {
          var H = R.hasil;
          v.rkAnalisis = R.analisis.map(function (t) { return { t: t }; });
          v.rkTotalGopay = rp(H.total.gopay); v.rkTotalSistem = rp(H.totalSistem);
          var sel = H.total.gopay - H.totalSistem;
          v.rkSelisih = (sel > 0 ? '+' : sel < 0 ? '−' : '') + rp(Math.abs(sel)); v.rkSelisihSt = 'font-family: Nunito, sans-serif; font-size: 24px; font-weight: 800; color: ' + (sel === 0 ? '#15803D' : '#B45309') + ';';
          v.rkRentang = H.dari ? U.tgl(isoHari(H.dari) + 'T00:00:00+07:00') + ' – ' + U.tgl(isoHari(H.sampai) + 'T00:00:00+07:00') : '-';
          v.rkKat = ['semua', 'cocok', 'belum', 'asing', 'hilang', 'abaikan'].map(function (k) {
            var on = s.rekonKat === k, n = k === 'semua' ? H.hasil.length : H.n[k];
            return { label: k === 'semua' ? 'Semua' : KAT[k][0], n: String(n), pick: function () { self.set({ rekonKat: k }); },
              st: 'height: 32px; padding: 0 11px; border-radius: 9px; display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 700; cursor: pointer; white-space: nowrap; ' + (on ? 'background: #38BDF8; color: #0F172A;' : 'color: #64748B; background: #FFFFFF; border: 1px solid #E2E8F0;') };
          });
          v.rkBaris = H.hasil.filter(function (x) { return s.rekonKat === 'semua' || x.kat === s.rekonKat; }).slice(0, 500).map(function (x) {
            return { kat: KAT[x.kat][0], katSt: U.pillBase + KAT[x.kat][1], ket: KAT[x.kat][2] + (x.dobel ? ' · ID dobel' : '') + (x.t && x.t.alasan ? ' · ' + x.t.alasan : ''),
              ref: x.t ? (x.t.ref || '–') : '–', waktu: x.t ? U.tglJam(x.t.waktu.toISOString()) : '–', nominal: rp(x.t ? x.t.nominal : x.o.nominal),
              order: x.o ? x.o.kode + ' · ' + (U.LBL[x.o.status] || x.o.status) : '–', nama: x.o && x.o.profil ? x.o.profil.nama : '' };
          });
          v.simpanRekonKlik = function () { self.simpanRekon(); };
          v.unduhRekonKlik = function () { self.unduhRekonCsv(); };
        }
      }
      if (s.rekonLihat) {
        var L = s.rekonLihat, rg2 = L.ringkasan || {};
        v.rlJudul = (L.nama_file || 'Rekonsiliasi') + ' · ' + U.tglJam(L.dibuat);
        v.rlAnalisis = (rg2.analisis || []).map(function (t) { return { t: t }; });
        v.rlBaris = (L.detail || []).slice(0, 500).map(function (x) {
          var k = KAT[x.kat] || KAT.abaikan;
          return { kat: k[0], katSt: U.pillBase + k[1], ref: x.ref || '–', waktu: x.waktu ? U.tglJam(x.waktu) : '–', nominal: rp(x.nominal), order: x.order ? x.order + ' · ' + (U.LBL[x.status_order] || x.status_order) : '–' };
        });
        v.tutupRekonLihat = function () { self.set({ rekonLihat: null }); };
      }
      return v;
    }
  });
  BO._uji = { parseCsv: parseCsv, angkaRp: angkaRp, waktu: waktu, tebakKolom: tebakKolom, cocokkan: cocokkan };
})();
