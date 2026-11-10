/* Backoffice: audit trail.
 *  - Aktivitas akun: login/logout, semua create/update/delete, keputusan order, ekspor/impor (dari audit_log)
 *  - Riwayat order: setiap perubahan status order beserta siapa yang mengubah (dari riwayat_pesanan) */
(function () {
  'use strict';
  var BO = window.BO, U = window.BOUtil;
  if (!BO || !U) return;
  var sb = U.sb, toast = U.toast;
  var NAMA_MENU = { order: 'Authorize order', refund: 'Refund', voucher: 'Voucher', keuangan: 'Laporan keuangan', ambassador: 'Ambassador', akun: 'Akun & role', audit: 'Audit trail', sistem: 'Sistem' };
  var NAMA_AKSI = { login: 'Login', logout: 'Logout', sesi_habis: 'Logout otomatis (24 jam)', create: 'Buat', update: 'Ubah', delete: 'Hapus',
    konfirmasi: 'Konfirmasi', tolak: 'Tolak', proses: 'Proses', selesai: 'Selesaikan', batal: 'Batalkan keputusan', ekspor: 'Ekspor', impor: 'Impor' };
  var WARNA = { create: 'color: #15803D; background: #DCFCE7;', update: 'color: #075985; background: #E0F2FE;', delete: 'color: #991B1B; background: #FEE2E2;',
    konfirmasi: 'color: #15803D; background: #DCFCE7;', tolak: 'color: #991B1B; background: #FEE2E2;', login: 'color: #475569; background: #F1F5F9;',
    logout: 'color: #475569; background: #F1F5F9;', sesi_habis: 'color: #475569; background: #F1F5F9;', ekspor: 'color: #6B21A8; background: #F3E8FF;', batal: 'color: #92400E; background: #FEF3C7;', proses: 'color: #075985; background: #E0F2FE;', selesai: 'color: #15803D; background: #DCFCE7;' };
  var ABAIKAN = { dibuat: 1, dibuat_oleh: 1, id: 1 };

  function nilai(x) { if (x == null || x === '') return '–'; if (typeof x === 'object') return JSON.stringify(x); return String(x); }
  function beda(a, b) {
    a = a || {}; b = b || {};
    var kunci = {}; Object.keys(a).concat(Object.keys(b)).forEach(function (k) { if (!ABAIKAN[k]) kunci[k] = 1; });
    return Object.keys(kunci).filter(function (k) { return JSON.stringify(a[k]) !== JSON.stringify(b[k]); })
      .map(function (k) { return { k: k, lama: nilai(a[k]), baru: nilai(b[k]) }; });
  }

  Object.assign(BO.s, { auTab: 'aktivitas', auRows: [], auPeriode: '7', auAkun: '', auMenu: '', auCari: '', auPilih: null, orRows: [], orCari: '', orPilih: null });

  Object.assign(BO, {
    muatAudit: async function () {
      var s = this.s, sejak = s.auPeriode === 'semua' ? null : new Date(Date.now() - Number(s.auPeriode) * 86400000).toISOString();
      var q1 = sb.from('audit_log').select('*').order('waktu', { ascending: false }).limit(2000);
      var q2 = sb.from('riwayat_pesanan').select('*').order('waktu', { ascending: false }).limit(2000);
      if (sejak) { q1 = q1.gte('waktu', sejak); q2 = q2.gte('waktu', sejak); }
      var r = await Promise.all([q1, q2]);
      if (r[0].error) { toast(r[0].error.message); return; }
      s.auRows = r[0].data || []; s.orRows = r[1].error ? [] : (r[1].data || []);
      this.set({});
    },
    valsAudit: function (v) {
      var self = this, s = this.s;
      var tabSt = function (on) { return 'height: 36px; padding: 0 14px; border-radius: 10px; display: flex; align-items: center; font-size: 13.5px; font-weight: 700; cursor: pointer; white-space: nowrap; flex-shrink: 0; ' + (on ? 'background: #0284C7; color: #FFFFFF;' : 'background: #FFFFFF; color: #64748B; border: 1px solid #E2E8F0;'); };
      var chip = function (on) { return 'height: 30px; padding: 0 10px; border-radius: 9px; display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 700; cursor: pointer; white-space: nowrap; ' + (on ? 'background: #38BDF8; color: #0F172A;' : 'color: #64748B; background: #FFFFFF; border: 1px solid #E2E8F0;'); };
      v.auTabAkt = s.auTab === 'aktivitas'; v.auTabOrd = s.auTab === 'order';
      v.auTabAktSt = tabSt(v.auTabAkt); v.auTabOrdSt = tabSt(v.auTabOrd);
      v.keTabAkt = function () { self.set({ auTab: 'aktivitas' }); }; v.keTabOrd = function () { self.set({ auTab: 'order' }); };
      v.auPeriodeList = [['1', '24 jam'], ['7', '7 hari'], ['30', '30 hari'], ['semua', 'Semua']].map(function (p) {
        return { label: p[1], st: chip(s.auPeriode === p[0]), pick: function () { self.s.auPeriode = p[0]; self.muatAudit(); } };
      });

      // per akun
      var perAkun = {};
      s.auRows.forEach(function (x) { var k = x.admin_id || 'sistem'; perAkun[k] = perAkun[k] || { nama: x.admin_nama || 'Sistem', n: 0 }; perAkun[k].n++; });
      v.auAkunList = [{ label: 'Semua akun', n: String(s.auRows.length), st: chip(!s.auAkun), pick: function () { self.set({ auAkun: '' }); } }]
        .concat(Object.keys(perAkun).map(function (k) { return { label: perAkun[k].nama, n: String(perAkun[k].n), st: chip(s.auAkun === k), pick: function () { self.set({ auAkun: k }); } }; }));
      var menuAda = {}; s.auRows.forEach(function (x) { menuAda[x.menu] = 1; });
      v.auMenuList = [{ label: 'Semua menu', st: chip(!s.auMenu), pick: function () { self.set({ auMenu: '' }); } }]
        .concat(Object.keys(menuAda).map(function (m) { return { label: NAMA_MENU[m] || m, st: chip(s.auMenu === m), pick: function () { self.set({ auMenu: m }); } }; }));
      v.auCari = s.auCari; v.setAuCari = function (e) { self.s.auCari = e.target.value; self.set({}); };
      var q = String(s.auCari || '').toLowerCase().trim();
      var tampil = s.auRows.filter(function (x) {
        if (s.auAkun && (x.admin_id || 'sistem') !== s.auAkun) return false;
        if (s.auMenu && x.menu !== s.auMenu) return false;
        return !q || [x.admin_nama, x.ringkas, x.objek, x.aksi, x.menu].join(' ').toLowerCase().indexOf(q) >= 0;
      });
      v.auRowsV = tampil.slice(0, 500).map(function (x) {
        var sel = s.auPilih === x.id;
        return { waktu: U.tglJam(x.waktu), akun: x.admin_nama || 'Sistem', menu: NAMA_MENU[x.menu] || x.menu, aksi: NAMA_AKSI[x.aksi] || x.aksi,
          aksiSt: U.pillBase + (WARNA[x.aksi] || 'color: #475569; background: #F1F5F9;'), ringkas: x.ringkas || x.objek || '',
          pick: function () { self.set({ auPilih: sel ? null : x.id }); }, buka: sel,
          beda: sel ? beda(x.sebelum, x.sesudah) : [],
          st: 'display: grid; grid-template-columns: 150px 150px 130px 120px minmax(0,1fr); gap: 10px; align-items: center; padding: 11px 18px; border-bottom: 1px solid #F1F5F9; cursor: pointer; ' + (sel ? 'background: #F0F9FF;' : '') };
      });
      v.auRowsV.forEach(function (r) { r.adaBeda = r.buka && r.beda.length > 0; });
      v.auKosong = tampil.length === 0;
      v.auInfo = tampil.length + ' aktivitas' + (tampil.length > 500 ? ' (500 terbaru ditampilkan)' : '');
      v.unduhAuditKlik = function () {
        U.csv([['waktu', 'akun', 'menu', 'aksi', 'objek', 'id_objek', 'ringkasan', 'sebelum', 'sesudah']].concat(tampil.map(function (x) {
          return [x.waktu, x.admin_nama, x.menu, x.aksi, x.objek, x.objek_id, x.ringkas, x.sebelum ? JSON.stringify(x.sebelum) : '', x.sesudah ? JSON.stringify(x.sesudah) : ''];
        })), 'audit-trail-nawasena.csv');
        self.catatEkspor('audit', 'Unduh CSV audit trail (' + tampil.length + ' baris)');
      };

      // riwayat order
      var JENIS = { user: 'Pengguna', admin: 'Admin', sistem: 'Sistem' };
      v.orCari = s.orCari; v.setOrCari = function (e) { self.s.orCari = e.target.value; self.set({}); };
      var q2 = String(s.orCari || '').toLowerCase().trim();
      var ord = s.orRows.filter(function (x) { return !q2 || [x.kode, x.catatan, x.status_baru].join(' ').toLowerCase().indexOf(q2) >= 0; });
      v.orRowsV = ord.slice(0, 500).map(function (x) {
        return { waktu: U.tglJam(x.waktu), kode: x.kode || '-', dari: x.status_lama ? (U.LBL[x.status_lama] || x.status_lama) : 'Baru',
          ke: U.LBL[x.status_baru] || x.status_baru, keSt: U.pillBase + (U.PST[x.status_baru] || ''),
          nominal: x.nominal != null ? U.rp(x.nominal) : '', oleh: x.oleh_jenis === 'admin' ? (s.admins[x.oleh] || 'Admin') : (JENIS[x.oleh_jenis] || ''), catatan: x.catatan || '',
          pick: function () { self.set({ orCari: x.kode || '' }); },
          st: 'display: grid; grid-template-columns: 150px 130px 110px 24px 120px 90px 120px minmax(0,1fr); gap: 8px; align-items: center; padding: 10px 18px; border-bottom: 1px solid #F1F5F9; font-size: 12.5px; cursor: pointer;' };
      });
      v.orKosong = ord.length === 0;
      v.orInfo = ord.length + ' perubahan status' + (q2 ? ' untuk "' + s.orCari + '"' : '') + (ord.length > 500 ? ' (500 terbaru ditampilkan)' : '');
      v.orAdaCari = !!q2; v.hapusOrCari = function () { self.set({ orCari: '' }); };
      return v;
    }
  });
})();
