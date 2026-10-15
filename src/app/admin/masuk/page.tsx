import { AdminLogin } from "./AdminLogin";

export default async function AdminMasuk({ searchParams }: { searchParams: Promise<{ habis?: string; bukan?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="main" style={{ paddingTop: 80 }}>
      <div className="panel stack">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-nawasena.png" alt="nawasena" style={{ height: 28, width: "auto", alignSelf: "flex-start" }} />
        <h1>Backoffice Nawasena</h1>
        {sp.habis ? <p className="card soft">Sesi berakhir karena 30 menit tidak aktif. Login lagi ya.</p> : null}
        {sp.bukan ? <p className="error">Akun ini tidak punya akses backoffice.</p> : null}
        <AdminLogin />
      </div>
    </main>
  );
}
