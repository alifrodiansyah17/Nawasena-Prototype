/* Gerbang "hanya yang punya link" untuk Cloudflare Pages (mode _worker.js, bisa di-deploy dengan drag & drop).
 *
 * Cara kerja:
 *   - Aplikasi untuk pengguna terbuka untuk publik (https://apps.nawasena.info/).
 *   - Hanya backoffice (/admin) yang dikunci: https://apps.nawasena.info/admin/?k=<KODE_ADMIN>
 *   - Kalau kodenya benar, browser diberi cookie (berlaku 90 hari) lalu diarahkan ke alamat tanpa ?k=.
 *   - Tanpa cookie/kode yang benar, /admin menjawab 404 seolah tidak ada.
 *   - Ganti KODE_ADMIN di pengaturan Cloudflare → semua link dan cookie admin lama otomatis tidak berlaku.
 *
 * Variabel (Cloudflare → Workers & Pages → proyek → Settings → Variables and Secrets):
 *   KODE_ADMIN  (wajib)  kode untuk /admin
 *   KODE_AKSES  tidak dipakai lagi (dulu untuk mengunci seluruh aplikasi)
 */
const HARI_90 = 60 * 60 * 24 * 90;

async function sidik(teks) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('nawasena:' + teks));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function cookieDari(req, nama) {
  const c = req.headers.get('Cookie') || '';
  for (const bagian of c.split(';')) {
    const [k, ...v] = bagian.trim().split('=');
    if (k === nama) return v.join('=');
  }
  return '';
}

function tidakAda() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Tidak ditemukan</title><body style="font-family:system-ui,sans-serif;display:flex;min-height:90vh;align-items:center;justify-content:center;color:#64748B">' +
    '<div style="text-align:center"><h1 style="color:#0F172A;font-size:22px">Halaman tidak ditemukan</h1>' +
    '<p>Pastikan kamu membuka link lengkap yang dibagikan ke kamu.</p></div></body>',
    { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' } });
}

function tambahHeader(res) {
  const r = new Response(res.body, res);
  r.headers.set('X-Robots-Tag', 'noindex, nofollow');
  r.headers.set('Referrer-Policy', 'no-referrer');
  r.headers.set('X-Content-Type-Options', 'nosniff');
  r.headers.set('X-Frame-Options', 'DENY');
  return r;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Aset statis (JS, gambar, font) tidak rahasia: langsung dilayani.
    if (url.pathname.startsWith('/aset/') || url.pathname === '/robots.txt') {
      return tambahHeader(await env.ASSETS.fetch(request));
    }

    const admin = url.pathname === '/admin' || url.pathname.startsWith('/admin/');
    // Aplikasi pengguna: terbuka untuk publik. ?k= dari link lama dibuang supaya alamatnya bersih.
    if (!admin) {
      if (url.searchParams.has('k')) {
        url.searchParams.delete('k');
        return new Response(null, { status: 302, headers: { 'Location': url.pathname + (url.search || ''), 'Cache-Control': 'no-store' } });
      }
      const res = tambahHeader(await env.ASSETS.fetch(request));
      res.headers.set('Cache-Control', 'no-cache');
      return res;
    }

    const kode = env.KODE_ADMIN;
    const namaCookie = 'nws_admin';
    if (!kode) {
      return new Response('Gerbang belum diatur: isi variabel KODE_ADMIN di pengaturan Cloudflare Pages.',
        { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    const benar = await sidik(kode);

    const k = url.searchParams.get('k');
    if (k !== null) {
      if (k !== kode) return tidakAda();
      url.searchParams.delete('k');
      return new Response(null, {
        status: 302,
        headers: {
          'Location': url.pathname + (url.search || ''),
          'Set-Cookie': `${namaCookie}=${benar}; Max-Age=${HARI_90}; Path=/admin; HttpOnly; Secure; SameSite=Lax`,
          'Cache-Control': 'no-store',
        },
      });
    }

    if (cookieDari(request, namaCookie) !== benar) return tidakAda();
    const res = tambahHeader(await env.ASSETS.fetch(request));
    // Halaman HTML dan config.js selalu dicek ulang, supaya versi baru langsung terpakai setelah upload.
    res.headers.set('Cache-Control', 'no-cache');
    return res;
  },
};
