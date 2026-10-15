import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { adminSignOut } from "../actions";
import { BoNav } from "./BoNav";

// Desktop saja (≥ 1280px) di rilis ini.
export default async function BoLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="bo" style={{ minWidth: 1280 }}>
      <aside>
        <Link href="/admin/pembayaran" style={{ padding: "6px 12px 18px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-nawasena-putih.png" alt="nawasena" style={{ height: 24 }} />
        </Link>
        <BoNav />
        <div style={{ marginTop: "auto", fontSize: 12, padding: 12, color: "#94a3b8" }}>
          {admin.name}<br />{admin.role === "owner" ? "Pemilik" : "Admin pembayaran"}
          <form action={adminSignOut}><button className="btn btn-ghost" style={{ color: "#e2e8f0", padding: 0 }}>Keluar</button></form>
        </div>
      </aside>
      <main>{children}</main>
    </div>
  );
}
