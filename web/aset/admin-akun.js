/* Backoffice: akun & role (RBAC).
 *  - Akun: nama, email, nomor telepon, kata sandi, role (dibuat lewat edge function akun-admin)
 *  - Role: izin per menu (lihat/buat/ubah/hapus). Super admin = role sistem, izinnya tetap. */
(function () {
  'use strict';
  var BO = window.BO, U = window.BOUtil, C = window.NAWASENA_CONFIG;
  if (!BO || !U) return;
  var sb = U.sb, toast = U.toast, sibuk = U.sibuk;
  var AKSI = [['r', 'Lihat'], ['c', 'Buat'], ['u', 'Ubah'], ['d', 'Hapus']];
  var KET_AKSI = {
    order: 'Ubah = konfirmasi/tolak order', voucher: 'Buat, ubah, nonaktifkan, hapus voucher', keuangan: 'Buat = simpan rekonsiliasi; ekspor CSV ikut Lihat',
    ambassador: 'Termasuk komisi dan target microsite', akun: 'Kelola akun backoffice dan role', audit: 'Hanya Lihat yang berlaku'
  };

  function sandiAcak() {
    var a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz', n = '23456789', s = '';
    for (var i = 0; i < 8; i++) s += a.charAt(Math.floor(Math.random() * a.length));
    return s + n.charAt(Math.floor(Math.random() * n.length)) + n.charAt(Math.floor(Math.random() * n.length));
  }
  async function panggil(body) {
    var s = (await sb.auth.getSession()).data.session;
    var res = await fetch(C.SUPABASE_URL + '/functions/v1/akun-admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: C.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + (s && s.access_token) },
      body: JSON.stringify(body)
    });
    var j = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(j.galat || ('Gagal (' + res.status + ')'));
    return j;
  }

  Object.assign(BO.s, { akunTab: 'akun', akunList: [], peranList: [], akunPilih: null, akunForm: null, akunSandi: '', peranPilih: null, peranForm: null });

  Object.assign(BO, {
    muatAkun: async function () {
      var r = await Promise.all([
        sb.from('admin').select('user_id, nama, email, hp, peran_id, aktif, dibuat, masuk_terakhir').order('dibuat', { ascending: true }),
        sb.from('peran').select('*').order('dibuat', { ascending: true })
      ]);
      if (r[0].error) { toast(r[0].error.message); return; }
      var s = this.s; s.akunList = r[0].data || []; s.peranList = r[1].data || [];
      if (!s.akunPilih || !s.akunList.some(function (a) { return a.user_id === s.akunPilih; })) s.akunPilih = s.akunList[0] ? s.akunList[0].user_id : null;
      if (!s.peranPilih || !s.peranList.some(function (p) { return p.id === s.peranPilih; })) s.peranPilih = s.peranList[0] ? s.peranList[0].id : null;
      this.set({});
    },
    simpanAkunBaru: async function () {
      var f = this.s.akunForm;
      if (!String(f.nama || '').trim()) { toast('Nama wajib diisi'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(f.email || '').trim())) { toast('Email belum benar'); return; }
      if (!f.peran_id) { toast('Pilih role akunnya'); return; }
      if (String(f.sandi || '').length < 8 || !/[A-Za-z]/.test(f.sandi) || !/\d/.test(f.sandi)) { toast('Kata sandi minimal 8 karakter, ada huruf dan angka'); return; }
      sibuk(true);
      try {
        var j = await panggil({ aksi: 'buat', nama: f.nama, email: f.email, hp: f.hp, sandi: f.sandi, peran_id: f.peran_id });
        toast('Akun ' + f.nama + ' dibuat. Kirim email dan kata sandinya ke orangnya lewat jalur aman.', true);
        this.s.akunForm = null; this.s.akunPilih = j.user_id; await this.muatAkun();
      } catch (e) { toast(e.message); } finally { sibuk(false); }
    },
    ubahAkun: async function (uid, ubah, pesan) {
      sibuk(true);
      try { await panggil(Object.assign({ aksi: 'ubah', user_id: uid }, ubah)); toast(pesan || 'Akun disimpan', true); this.s.akunEdit = null; await this.muatAkun(); }
      catch (e) { toast(e.message); } finally { sibuk(false); }
    },
    resetSandi: async function (uid) {
      var sandi = String(this.s.akunSandi || '');
      if (sandi.length < 8 || !/[A-Za-z]/.test(sandi) || !/\d/.test(sandi)) { toast('Kata sandi baru minimal 8 karakter, ada huruf dan angka'); return; }
      sibuk(true);
      try { await panggil({ aksi: 'sandi', user_id: uid, sandi: sandi }); toast('Kata sandi diganti. Akun itu otomatis keluar dari semua perangkat.', true); this.s.akunSandi = ''; this.set({}); }
      catch (e) { toast(e.message); } finally { sibuk(false); }
    },
    hapusAkun: async function (uid) {
      sibuk(true);
      try { await panggil({ aksi: 'hapus', user_id: uid }); toast('Akun dihapus dari backoffice', true); this.s.akunPilih = null; await this.muatAkun(); }
      catch (e) { toast(e.message); } finally { sibuk(false); }
    },
    simpanPeran: async function () {
      var f = this.s.peranForm, nama = String(f.nama || '').trim();
      if (!nama) { toast('Nama role wajib diisi'); return; }
      var izin = {};
      BO.MENU.forEach(function (m) { var a = f.izin[m.id] || []; if (a.length) izin[m.id] = AKSI.map(function (x) { return x[0]; }).filter(function (k) { return a.indexOf(k) >= 0; }); });
      sibuk(true);
      try {
        var data = { nama: nama, deskripsi: String(f.deskripsi || '').trim() || null, izin: izin };
        var r = f.id ? await sb.from('peran').update(data).eq('id', f.id).select().single() : await sb.from('peran').insert(data).select().single();
        if (r.error) throw new Error(/duplicate|unique/i.test(r.error.message) ? 'Nama role ' + nama + ' sudah ada' : r.error.message);
        toast('Role ' + nama + ' disimpan. Akun dengan role ini mengikuti izin baru saat memuat ulang halaman.', true);
        this.s.peranForm = null; this.s.peranPilih = r.data.id; await this.muatAkun();
      } catch (e) { toast(e.message); } finally { sibuk(false); }
    },
    hapusPeran: async function (p) {
      sibuk(true);
      try {
        var r = await sb.from('peran').delete().eq('id', p.id);
        if (r.error) throw r.error;
        toast('Role ' + p.nama + ' dihapus', true); this.s.peranPilih = null; await this.muatAkun();
      } catch (e) { toast(e.message); } finally { sibuk(false); }
    },

    valsAkun: function (v) {
      var self = this, s = this.s;
      var bc = this.boleh('akun', 'c'), bu = this.boleh('akun', 'u'), bd = this.boleh('akun', 'd');
      var tabSt = function (on) { return 'height: 36px; padding: 0 14px; border-radius: 10px; display: flex; align-items: center; font-size: 13.5px; font-weight: 700; cursor: pointer; white-space: nowrap; flex-shrink: 0; ' + (on ? 'background: #0284C7; color: #FFFFFF;' : 'background: #FFFFFF; color: #64748B; border: 1px solid #E2E8F0;'); };
      v.akTabAkun = s.akunTab === 'akun'; v.akTabRole = s.akunTab === 'role';
      v.akTabAkunSt = tabSt(v.akTabAkun); v.akTabRoleSt = tabSt(v.akTabRole);
      v.keTabAkun = function () { self.set({ akunTab: 'akun' }); }; v.keTabRole = function () { self.set({ akunTab: 'role' }); };
      v.akBolehBuat = bc;
      var namaPeran = {}; s.peranList.forEach(function (p) { namaPeran[p.id] = p.nama; });
      var kotak = 'height: 40px; border: 1.5px solid #E2E8F0; border-radius: 10px; padding: 0 12px; font-size: 13.5px; color: #1E293B; background: #FFFFFF; width: 100%;';
      v.akKotakSt = kotak;
      var chip = function (on) { return 'padding: 7px 12px; border-radius: 999px; font-size: 12.5px; font-weight: 700; cursor: pointer; border: 1.5px solid ' + (on ? '#0284C7; background: #E0F2FE; color: #0F172A;' : '#E2E8F0; background: #FFFFFF; color: #64748B;'); };

      // ---------------- akun
      v.akRows = s.akunList.map(function (a) {
        var sel = s.akunPilih === a.user_id;
        return { nama: a.nama || '-', email: a.email || '', hp: a.hp ? '+' + a.hp : '–', peran: namaPeran[a.peran_id] || '–',
          masuk: a.masuk_terakhir ? U.tglJam(a.masuk_terakhir) : 'Belum pernah', saya: a.user_id === s.uid,
          pill: a.aktif ? 'Aktif' : 'Nonaktif', pillSt: U.pillBase + (a.aktif ? 'color: #15803D; background: #DCFCE7;' : 'color: #475569; background: #F1F5F9;'),
          pick: function () { self.set({ akunPilih: a.user_id, akunForm: null, akunEdit: null, akunSandi: '' }); },
          st: 'display: grid; grid-template-columns: minmax(0,1.3fr) minmax(0,1.4fr) 120px 120px 150px 90px; gap: 10px; align-items: center; padding: 12px 18px; border-bottom: 1px solid #F1F5F9; cursor: pointer; ' + (sel ? 'background: #F0F9FF; box-shadow: inset 3px 0 0 #009FE3;' : '') };
      });
      v.tambahAkunKlik = function () { self.set({ akunForm: { nama: '', email: '', hp: '', sandi: sandiAcak(), peran_id: '' }, akunEdit: null }); };
      var F = s.akunForm;
      v.akFormBuka = !!F; v.akDetail = !F && !!s.akunPilih;
      if (F) {
        var isiF = function (k) { return function (e) { self.s.akunForm[k] = e.target.value; }; };
        v.afNama = F.nama; v.setAfNama = isiF('nama'); v.afEmail = F.email; v.setAfEmail = isiF('email');
        v.afHp = F.hp; v.setAfHp = isiF('hp'); v.afSandi = F.sandi; v.setAfSandi = isiF('sandi');
        v.acakSandiKlik = function () { self.s.akunForm.sandi = sandiAcak(); self.set({}); };
        v.afPeran = s.peranList.map(function (p) { return { label: p.nama, st: chip(F.peran_id === p.id), pick: function () { self.s.akunForm.peran_id = p.id; self.set({}); } }; });
        v.simpanAkunKlik = function () { self.simpanAkunBaru(); };
        v.batalAkunKlik = function () { self.set({ akunForm: null }); };
      }
      var a = s.akunList.filter(function (x) { return x.user_id === s.akunPilih; })[0];
      if (!F && a) {
        var saya = a.user_id === s.uid, E = s.akunEdit;
        v.adNama = a.nama || '-'; v.adEmail = a.email || ''; v.adHp = a.hp ? '+' + a.hp : 'Belum diisi';
        v.adPeran = namaPeran[a.peran_id] || '–'; v.adSaya = saya;
        v.adMasuk = a.masuk_terakhir ? U.tglJam(a.masuk_terakhir) : 'Belum pernah login';
        v.adDibuat = a.dibuat ? U.tglJam(a.dibuat) : '';
        v.adPill = a.aktif ? 'Aktif' : 'Nonaktif'; v.adPillSt = U.pillBase + (a.aktif ? 'color: #15803D; background: #DCFCE7;' : 'color: #475569; background: #F1F5F9;');
        v.adBolehUbah = bu; v.adBolehHapus = bd && !saya;
        v.adEditBuka = !!E && bu; v.adEditTutup = !E && bu;
        v.ubahAkunKlik = function () { self.set({ akunEdit: { nama: a.nama || '', hp: a.hp || '', peran_id: a.peran_id } }); };
        if (E) {
          v.aeNama = E.nama; v.setAeNama = function (e) { self.s.akunEdit.nama = e.target.value; };
          v.aeHp = E.hp; v.setAeHp = function (e) { self.s.akunEdit.hp = e.target.value; };
          v.aePeran = s.peranList.map(function (p) { return { label: p.nama, st: chip(E.peran_id === p.id), pick: function () { self.s.akunEdit.peran_id = p.id; self.set({}); } }; });
          v.simpanEditAkunKlik = function () {
            var ubah = { nama: E.nama, hp: E.hp };
            if (E.peran_id !== a.peran_id) {
              if (!window.confirm('Ganti role ' + (a.nama || a.email) + ' jadi ' + namaPeran[E.peran_id] + '? Akunnya otomatis keluar dan perlu login lagi.')) return;
              ubah.peran_id = E.peran_id;
            }
            self.ubahAkun(a.user_id, ubah, 'Akun ' + E.nama + ' disimpan');
          };
          v.batalEditAkunKlik = function () { self.set({ akunEdit: null }); };
        }
        v.adAktif = a.aktif && bu && !saya; v.adNonaktif = !a.aktif && bu;
        v.nonaktifAkunKlik = function () { if (window.confirm('Nonaktifkan akun ' + (a.nama || a.email) + '? Akunnya langsung keluar dan tidak bisa login sampai diaktifkan lagi.')) self.ubahAkun(a.user_id, { aktif: false }, 'Akun dinonaktifkan'); };
        v.aktifAkunKlik = function () { self.ubahAkun(a.user_id, { aktif: true }, 'Akun diaktifkan lagi'); };
        v.akunSandi = s.akunSandi; v.setAkunSandi = function (e) { self.s.akunSandi = e.target.value; };
        v.acakSandiResetKlik = function () { self.s.akunSandi = sandiAcak(); self.set({}); };
        v.resetSandiKlik = function () { if (window.confirm('Ganti kata sandi ' + (a.nama || a.email) + '?')) self.resetSandi(a.user_id); };
        v.hapusAkunKlik = function () { if (window.confirm('Hapus akun ' + (a.nama || a.email) + ' dari backoffice? Akses login-nya dicabut permanen. Riwayat aktivitasnya tetap tersimpan di audit trail.')) self.hapusAkun(a.user_id); };
      }

      // ---------------- role
      var anggota = {}; s.akunList.forEach(function (x) { anggota[x.peran_id] = (anggota[x.peran_id] || 0) + 1; });
      v.rlRows = s.peranList.map(function (p) {
        var sel = s.peranPilih === p.id, menu = BO.MENU.filter(function (m) { return (p.izin[m.id] || []).indexOf('r') >= 0; }).map(function (m) { return m.label; });
        return { nama: p.nama, desk: p.deskripsi || '', menu: menu.join(', ') || 'Belum ada menu', n: (anggota[p.id] || 0) + ' akun', sistem: p.sistem,
          pick: function () { self.set({ peranPilih: p.id, peranForm: null }); },
          st: 'display: grid; grid-template-columns: 180px minmax(0,1fr) 80px; gap: 12px; align-items: center; padding: 13px 18px; border-bottom: 1px solid #F1F5F9; cursor: pointer; ' + (sel ? 'background: #F0F9FF; box-shadow: inset 3px 0 0 #009FE3;' : '') };
      });
      v.tambahPeranKlik = function () { self.set({ peranForm: { id: null, nama: '', deskripsi: '', izin: {} } }); };
      var P = s.peranForm, p = s.peranList.filter(function (x) { return x.id === s.peranPilih; })[0];
      v.rfBuka = !!P; v.rdBuka = !P && !!p;
      var sel = function (izin, menu, k) { return (izin[menu] || []).indexOf(k) >= 0; };
      var sel2 = function (bisa, on, ro) {
        return 'width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 800; ' + (ro ? 'cursor: default; ' : 'cursor: pointer; ')
          + (on ? 'background: #0284C7; color: #FFFFFF;' : bisa ? 'background: #F1F5F9; color: #CBD5E1; border: 1.5px solid #E2E8F0;' : 'background: #F8FAFC; color: #E2E8F0;');
      };
      var matriks = function (izin, ro, ubahFn) {
        return BO.MENU.map(function (m) {
          return { label: m.label, ket: KET_AKSI[m.id] || '', sel: AKSI.map(function (x) {
            var on = sel(izin, m.id, x[0]);
            return { t: on ? '✓' : '', st: sel2(true, on, ro), pick: ro ? function () {} : function () { ubahFn(m.id, x[0], !on); } };
          }) };
        });
      };
      v.rlAksi = AKSI.map(function (x) { return { label: x[1] }; });
      if (P) {
        v.rfJudul = P.id ? 'Ubah role' : 'Role baru';
        v.rfNama = P.nama; v.setRfNama = function (e) { self.s.peranForm.nama = e.target.value; };
        v.rfDesk = P.deskripsi; v.setRfDesk = function (e) { self.s.peranForm.deskripsi = e.target.value; };
        v.rfMatriks = matriks(P.izin, false, function (menu, k, on) {
          var a2 = (P.izin[menu] || []).slice();
          if (on) { if (a2.indexOf(k) < 0) a2.push(k); if (k !== 'r' && a2.indexOf('r') < 0) a2.push('r'); }   // aksi lain butuh izin lihat
          else { a2 = a2.filter(function (z) { return z !== k; }); if (k === 'r') a2 = []; }
          P.izin[menu] = a2; self.set({});
        });
        v.simpanPeranKlik = function () { self.simpanPeran(); };
        v.batalPeranKlik = function () { self.set({ peranForm: null }); };
      }
      if (!P && p) {
        v.rdNama = p.nama; v.rdDesk = p.deskripsi || 'Tanpa deskripsi'; v.rdSistem = p.sistem; v.rdN = (anggota[p.id] || 0) + ' akun memakai role ini';
        v.rdMatriks = matriks(p.izin, true);
        v.rdBolehUbah = bu && !p.sistem; v.rdBolehHapus = bd && !p.sistem;
        v.ubahPeranKlik = function () { self.set({ peranForm: { id: p.id, nama: p.nama, deskripsi: p.deskripsi || '', izin: JSON.parse(JSON.stringify(p.izin || {})) } }); };
        v.hapusPeranKlik = function () { if (window.confirm('Hapus role ' + p.nama + '? Role yang masih dipakai akun tidak bisa dihapus.')) self.hapusPeran(p); };
      }
      return v;
    }
  });
})();
