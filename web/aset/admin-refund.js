/* Backoffice: Refund (docs/flow-refund-nawasena.pdf).
 *  Antrian refund dari pengguna (nominal transfer salah / analisis gagal), SLA 1×24 jam sejak diajukan.
 *  Aksi lewat edge function `refund`: proses → selesaikan (wajib bukti transfer, tanggal, nominal penuh, biaya admin) atau tolak (alasan). */
(function () {
  'use strict';
  var BO = window.BO, U = window.BOUtil;
  if (!BO || !U) return;
  var C = window.NAWASENA_CONFIG, sb = U.sb, rp = U.rp, toast = U.toast, sibuk = U.sibuk, tglJam = U.tglJam;
  var LBL = { diajukan: 'Diajukan', diproses: 'Diproses', selesai: 'Selesai', ditolak: 'Ditolak' };
  var PST = { diajukan: 'color: #92400E; background: #FEF3C7;', diproses: 'color: #075985; background: #E0F2FE;', selesai: 'color: #15803D; background: #DCFCE7;', ditolak: 'color: #991B1B; background: #FEE2E2;' };
  var ALASAN = { nominal: 'Nominal transfer tidak sesuai', analisis: 'Analisis gagal disusun' };
  var TOLAK = ['Nomor rekening / e-wallet tidak valid', 'Nama pemilik tidak sesuai dengan nomor tujuan', 'E-wallet tujuan tidak bisa menerima transfer'];

  function hariIni() { var d = U.wib(new Date().toISOString()); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function sisaSla(r) {
    var ms = new Date(r.batas_sla).getTime() - Date.now(), mnt = Math.floor(Math.abs(ms) / 60000), j = Math.floor(mnt / 60), m = mnt % 60;
    var teks = (j ? j + ' jam ' : '') + m + ' mnt';
    return { lewat: ms < 0, teks: ms < 0 ? 'Lewat ' + teks : 'Sisa ' + teks, mepet: ms >= 0 && ms < 4 * 3600000 };
  }

  Object.assign(BO.s, { rfRows: [], rfFilter: 'aktif', rfCari: '', rfPilih: null, rfBukti: {}, rfBuktiUrl: {}, rfForm: {}, rfTolakBuka: false, rfTolak: -1, rfTolakLain: '' });

  Object.assign(BO, {
    muatRefund: async function () {
      var r = await sb.from('refund').select('*, profil(nama, email, hp), pesanan(kode, nominal, status, metode, nominal_bukti)').order('diajukan', { ascending: false }).limit(2000);
      if (r.error) { toast(r.error.message); return; }
      var rows = r.data || [], self = this;
      if (!this.s.rfPilih || !rows.some(function (x) { return x.id === self.s.rfPilih; })) {
        // default: refund aktif dengan batas SLA paling dekat
        var aktif = rows.filter(function (x) { return x.status === 'diajukan' || x.status === 'diproses'; }).sort(function (a, b) { return a.batas_sla < b.batas_sla ? -1 : 1; });
        this.s.rfPilih = (aktif[0] || rows[0] || {}).id || null;
      }
      this.s.rfRows = rows; this.set({});
      this.siapkanBuktiRefund();
      if (!this._rfCh) {
        this._rfCh = sb.channel('bo-refund').on('postgres_changes', { event: '*', schema: 'public', table: 'refund' }, function () { if (self.s.view === 'refund') self.muatRefund(); }).subscribe();
      }
    },
    cariRefund: function (id) { return this.s.rfRows.filter(function (x) { return x.id === id; })[0]; },
    siapkanBuktiRefund: async function () {
      var d = this.cariRefund(this.s.rfPilih);
      if (!d || !d.bukti_path || this.s.rfBuktiUrl[d.id]) return;
      var r = await sb.storage.from('refund').createSignedUrl(d.bukti_path, 900);
      if (!r.error) { this.s.rfBuktiUrl[d.id] = r.data.signedUrl; this.set({}); }
    },
    pilihBuktiRefund: function () {
      var self = this, d = this.cariRefund(this.s.rfPilih); if (!d) return;
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'application/pdf,image/png,image/jpeg';
      inp.onchange = function () {
        var f = inp.files && inp.files[0]; if (!f) return;
        if (!/^(application\/pdf|image\/png|image\/jpeg)$/.test(f.type)) { toast('Bukti transfer harus PDF, JPG, atau PNG'); return; }
        if (f.size > 5 * 1024 * 1024) { toast('Bukti transfer maksimal 5 MB'); return; }
        var fr = new FileReader();
        fr.onload = function () { self.s.rfBukti[d.id] = { nama: f.name, tipe: f.type, data: String(fr.result || '').split(',')[1] || '', ukuran: f.size }; self.set({}); };
        fr.onerror = function () { toast('File tidak terbaca, coba lagi'); };
        fr.readAsDataURL(f);
      };
      inp.click();
    },
    aksiRefund: async function (aksi, extra) {
      var d = this.cariRefund(this.s.rfPilih); if (!d) return;
      sibuk(true);
      try {
        var s = (await sb.auth.getSession()).data.session;
        var res = await fetch(C.SUPABASE_URL + '/functions/v1/refund', {
          method: 'POST', headers: { 'Content-Type': 'application/json', apikey: C.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + s.access_token },
          body: JSON.stringify(Object.assign({ aksi: aksi, id: d.id }, extra || {}))
        });
        var j = await res.json().catch(function () { return {}; });
        if (!res.ok) throw new Error(j.galat || ('Gagal (' + res.status + ')'));
        delete this.s.rfBukti[d.id];
        this.s.rfTolakBuka = false; this.s.rfTolak = -1; this.s.rfTolakLain = '';
        var surel = j.email === false ? ' Tapi email ke pengguna belum terkirim, cek pengaturan SMTP.' : '';
        toast(aksi === 'proses' ? 'Refund ditandai sedang diproses.' : aksi === 'selesaikan' ? 'Refund selesai. Bukti transfer dikirim ke email pengguna.' + surel : 'Penolakan refund terkirim ke pengguna.', !surel);
        await this.muatRefund();
      } catch (e) { toast(e.message); }
      finally { sibuk(false); }
    },

    valsRefund: function (v) {
      var self = this, s = this.s, bisaUbah = this.boleh('refund', 'u');
      var rows = s.rfRows, hit = { aktif: 0, diajukan: 0, diproses: 0, selesai: 0, ditolak: 0, semua: rows.length }, lewat = 0, biaya = 0, keluar = 0;
      rows.forEach(function (r) {
        hit[r.status] = (hit[r.status] || 0) + 1;
        if (r.status === 'diajukan' || r.status === 'diproses') { hit.aktif++; if (sisaSla(r).lewat) lewat++; }
        if (r.status === 'selesai') { keluar += r.nominal_transfer || r.nominal; biaya += r.biaya_admin || 0; }
      });
      v.rfNAktif = String(hit.aktif); v.rfNLewat = String(lewat); v.rfNSelesai = String(hit.selesai || 0);
      v.rfKeluar = rp(keluar); v.rfBiaya = rp(biaya);
      v.rfLewatSt = 'border: 1px solid ' + (lewat ? '#FECACA; background: #FEF2F2;' : '#E2E8F0; background: #FFFFFF;') + ' border-radius: 12px; padding: 15px 17px;';
      v.rfLewatWarna = 'font-family: Nunito, sans-serif; font-size: 28px; font-weight: 800; margin-top: 4px; color: ' + (lewat ? '#DC2626' : '#0F172A') + ';';
      v.rfTabs = [['aktif', 'Perlu diproses'], ['diproses', 'Sedang diproses'], ['selesai', 'Selesai'], ['ditolak', 'Ditolak'], ['semua', 'Semua']].map(function (t) {
        var on = s.rfFilter === t[0];
        return { label: t[1], n: String(hit[t[0]] || 0), pick: function () { self.set({ rfFilter: t[0] }); },
          st: 'height: 34px; padding: 0 11px; border-radius: 10px; display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; ' + (on ? 'background: #38BDF8; color: #0F172A;' : 'background: transparent; color: #64748B;'),
          nst: 'font-size: 11px; font-weight: 800; border-radius: 999px; padding: 1px 7px; ' + (on ? 'background: #FFFFFF; color: #0F172A;' : 'background: #F1F5F9; color: #1E293B;') };
      });
      v.rfCari = s.rfCari; v.setRfCari = function (e) { self.s.rfCari = e.target.value; self.set({}); };
      var q = String(s.rfCari || '').toLowerCase().trim();
      var tampil = rows.filter(function (r) {
        if (s.rfFilter === 'aktif' && !(r.status === 'diajukan' || r.status === 'diproses')) return false;
        if (s.rfFilter !== 'aktif' && s.rfFilter !== 'semua' && r.status !== s.rfFilter) return false;
        if (!q) return true;
        return [r.kode, r.pesanan && r.pesanan.kode, r.profil && r.profil.nama, r.profil && r.profil.email, r.nominal, r.tujuan_nama, r.tujuan_pemilik].join(' ').toLowerCase().indexOf(q) >= 0;
      });
      if (s.rfFilter === 'aktif' || s.rfFilter === 'diproses') tampil = tampil.slice().sort(function (a, b) { return a.batas_sla < b.batas_sla ? -1 : 1; }); // paling mepet di atas
      v.rfRowsV = tampil.slice(0, 500).map(function (r) {
        var sel = s.rfPilih === r.id, aktif = r.status === 'diajukan' || r.status === 'diproses', sla = sisaSla(r);
        return { tgl: U.tgl(r.diajukan), jam: U.jam(r.diajukan), nama: r.profil ? r.profil.nama : '-', email: r.profil ? r.profil.email : '',
          kode: r.kode, alasan: ALASAN[r.alasan] || r.alasan, nominal: rp(r.nominal),
          sla: aktif ? sla.teks : (r.status === 'selesai' ? U.tgl(r.selesai) : '–'),
          slaSt: 'font-size: 12px; font-weight: 700; ' + (!aktif ? 'color: #94A3B8;' : sla.lewat ? 'color: #DC2626;' : sla.mepet ? 'color: #B45309;' : 'color: #15803D;'),
          pill: LBL[r.status] || r.status, pillSt: U.pillBase + (PST[r.status] || ''),
          pick: function () { self.set({ rfPilih: r.id, rfTolakBuka: false, rfTolak: -1 }); self.siapkanBuktiRefund(); },
          st: 'display: grid; grid-template-columns: 64px minmax(0,1fr) 150px 92px 110px 96px; gap: 10px; align-items: center; padding: 12px 18px; border-bottom: 1px solid #F1F5F9; cursor: pointer; '
            + (sel ? 'background: #F0F9FF; box-shadow: inset 3px 0 0 #009FE3;' : (aktif && sla.lewat ? 'background: #FEF2F2;' : '')) };
      });
      v.rfKosong = tampil.length === 0;

      // ------------------------------------------------ detail
      var d = this.cariRefund(s.rfPilih);
      v.rfAda = !!d; v.rfTanpa = !d;
      if (!d) return;
      var st = d.status, aktif = st === 'diajukan' || st === 'diproses', sla = sisaSla(d), P = d.pesanan || {};
      v.rdKode = d.kode; v.rdNama = d.profil ? d.profil.nama : '-'; v.rdEmail = d.profil ? d.profil.email : ''; v.rdHp = d.profil && d.profil.hp ? d.profil.hp : '';
      v.rdPill = LBL[st] || st; v.rdPillSt = U.pillBase + (PST[st] || '');
      v.rdNominal = rp(d.nominal); v.rdAlasan = ALASAN[d.alasan] || d.alasan;
      v.rdOrder = (P.kode || '-') + ' · tagihan ' + rp(P.nominal) + (d.alasan === 'nominal' && P.nominal_bukti ? ' · masuk ' + rp(P.nominal_bukti) : '');
      v.rdOrderStatus = P.status === 'direfund' ? 'Order sudah direfund' : '';
      v.rdJenis = d.tujuan_jenis === 'bank' ? 'Rekening bank' : 'E-wallet';
      v.rdTujuanNama = d.tujuan_nama; v.rdTujuanNomor = d.tujuan_nomor; v.rdPemilik = d.tujuan_pemilik;
      v.rdMilikLain = !!d.milik_lain && aktif;
      v.salinNomor = function () { try { navigator.clipboard.writeText(d.tujuan_nomor); toast('Nomor tujuan disalin', true); } catch (e) { toast(d.tujuan_nomor); } };
      v.rdDiajukan = tglJam(d.diajukan);
      v.rdBatas = tglJam(d.batas_sla) + (aktif ? ' (' + sla.teks.toLowerCase() + ')' : '');
      v.rdBatasSt = 'font-size: 13px; font-weight: 700; text-align: right; color: ' + (aktif && sla.lewat ? '#DC2626' : aktif && sla.mepet ? '#B45309' : '#1E293B') + ';';
      v.rdSlaLewat = aktif && sla.lewat;
      v.rdLihatSaja = aktif && !bisaUbah;
      v.rdDiajukanAksi = st === 'diajukan' && bisaUbah;
      v.rdBisaSelesai = aktif && bisaUbah;
      v.rdDiprosesOleh = d.diproses ? (s.admins[d.diproses_oleh] || 'Admin') + ' · ' + tglJam(d.diproses) : '';
      v.rdAdaDiproses = !!d.diproses;
      v.prosesRefundKlik = function () { self.aksiRefund('proses'); };
      // form selesaikan
      var F = s.rfForm[d.id] || (s.rfForm[d.id] = { tanggal: hariIni(), nominal: String(d.nominal), biaya: '0' });
      var kb = s.rfBukti[d.id];
      v.rfbAda = !!kb; v.rfbKosong = !kb; v.rfbNama = kb ? kb.nama : '';
      v.rfbUkuran = kb ? (kb.ukuran < 1048576 ? Math.max(1, Math.round(kb.ukuran / 1024)) + ' KB' : (kb.ukuran / 1048576).toFixed(1) + ' MB') : '';
      v.rfbSt = 'border: 2px dashed ' + (kb ? '#0284C7' : '#7DD3FC') + '; background: ' + (kb ? '#F0F9FF' : '#F8FAFC') + '; border-radius: 12px; padding: 14px; display: flex; align-items: center; gap: 12px; cursor: pointer;';
      v.pilihBuktiRefund = function () { self.pilihBuktiRefund(); };
      v.rfTanggal = F.tanggal; v.setRfTanggal = function (e) { F.tanggal = e.target.value; };
      v.rfNominalIsi = F.nominal; v.setRfNominalIsi = function (e) { F.nominal = e.target.value; };
      v.rfBiayaIsi = F.biaya; v.setRfBiayaIsi = function (e) { F.biaya = e.target.value; };
      v.rfSelesaiSt = 'height: 46px; border-radius: 9999px; font-size: 14px; font-weight: 700; font-family: Nunito, sans-serif; display: flex; align-items: center; justify-content: center; gap: 7px; '
        + (kb ? 'background: #16A34A; color: #FFFFFF; box-shadow: 0 6px 14px rgba(22,163,74,0.25); cursor: pointer;' : 'background: #E2E8F0; color: #64748B; cursor: not-allowed;');
      v.selesaikanRefundKlik = function () {
        if (!kb) { toast('Unggah bukti transfer refund dulu. Bukti wajib sebelum menandai selesai.'); return; }
        var nom = Number(String(F.nominal).replace(/\D/g, ''));
        if (nom !== d.nominal) { toast('Refund harus penuh: nominal transfer ' + rp(d.nominal)); return; }
        if (String(F.biaya).trim() === '' || !/^\d+$/.test(String(F.biaya).replace(/\D/g, '') || 'x')) { toast('Isi biaya admin transfer (0 kalau gratis)'); return; }
        if (!F.tanggal) { toast('Isi tanggal transfer'); return; }
        if (window.confirm('Tandai refund ' + d.kode + ' selesai: ' + rp(d.nominal) + ' ke ' + d.tujuan_nama + ' ' + d.tujuan_nomor + ' a.n. ' + d.tujuan_pemilik + ', lalu kirim bukti ke ' + v.rdEmail + '?'))
          self.aksiRefund('selesaikan', { bukti: { nama: kb.nama, tipe: kb.tipe, data: kb.data }, tanggal: F.tanggal, nominal: d.nominal, biaya: Number(String(F.biaya).replace(/\D/g, '')) });
      };
      // tolak
      v.rfTolakBuka = s.rfTolakBuka; v.rfTolakTutup = !s.rfTolakBuka;
      v.bukaTolakRefund = function () { self.set({ rfTolakBuka: true, rfTolak: -1, rfTolakLain: '' }); };
      v.tutupTolakRefund = function () { self.set({ rfTolakBuka: false }); };
      v.rfTolakList = TOLAK.concat(['Lainnya']).map(function (a, i) {
        var on = s.rfTolak === i;
        return { label: a, pick: function () { self.set({ rfTolak: i }); },
          st: 'padding: 7px 11px; border-radius: 999px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1.5px solid ' + (on ? '#0284C7; background: #FEF9C3; color: #0F172A;' : '#E2E8F0; background: #FFFFFF; color: #64748B;') };
      });
      v.rfTolakLainAda = s.rfTolak === TOLAK.length;
      v.rfTolakLain = s.rfTolakLain; v.setRfTolakLain = function (e) { self.s.rfTolakLain = e.target.value; };
      var alasanTolak = function () { return s.rfTolak === TOLAK.length ? String(s.rfTolakLain || '').trim() : (TOLAK[s.rfTolak] || ''); };
      v.kirimTolakRefundSt = 'height: 42px; padding: 0 16px; border-radius: 12px; display: flex; align-items: center; font-size: 14px; font-weight: 700; '
        + (s.rfTolak >= 0 ? 'background: #0284C7; color: #FFFFFF; cursor: pointer;' : 'background: #E2E8F0; color: #64748B; cursor: not-allowed;');
      v.kirimTolakRefund = function () {
        var a = alasanTolak();
        if (!a) { toast('Pilih atau tulis alasan penolakan'); return; }
        if (window.confirm('Tolak refund ' + d.kode + ' dengan alasan "' + a + '"? Pengguna bisa memperbaiki data lalu mengajukan ulang.')) self.aksiRefund('tolak', { alasan: a });
      };
      // hasil
      v.rdSelesai = st === 'selesai'; v.rdDitolak = st === 'ditolak';
      v.rdSelesaiInfo = st === 'selesai' ? rp(d.nominal_transfer || d.nominal) + ' · ditransfer ' + (d.tanggal_transfer ? U.tgl(d.tanggal_transfer + 'T05:00:00Z') + ' ' + d.tanggal_transfer.slice(0, 4) : '') + ' · biaya admin ' + rp(d.biaya_admin) : '';
      v.rdSelesaiOleh = d.selesai ? (s.admins[d.selesai_oleh] || 'Admin') + ' · ' + tglJam(d.selesai) : '';
      v.rdBuktiNama = d.bukti_nama || 'bukti-transfer';
      v.bukaBuktiRefund = function () { var u = s.rfBuktiUrl[d.id]; if (u) window.open(u, '_blank'); else { toast('Bukti sedang dimuat, coba lagi'); self.siapkanBuktiRefund(); } };
      v.rdAlasanTolak = d.alasan_tolak || '';
      v.rdDitolakOleh = d.ditolak ? (s.admins[d.ditolak_oleh] || 'Admin') + ' · ' + tglJam(d.ditolak) : '';
    }
  });
})();
