import Link from "next/link";
import { db } from "@/lib/supabase/server";
import { requireAdmin, startOfDayWIB, withUsers, type OrderRow } from "@/lib/admin";
import { PAYMENT } from "@/lib/config";
import { rupiah, tanggalJam } from "@/lib/format";
import { AutoRefresh, Detail, SearchBox } from "./client";

const TABS = [
  { kode: "menunggu", label: "Menunggu", status: ["pending_review"] },
  { kode: "terkonfirmasi", label: "Terkonfirmasi", status: ["confirmed"] },
  { kode: "ditolak", label: "Ditolak", status: ["rejected"] },
  { kode: "semua", label: "Semua", status: ["pending_review", "confirmed", "rejected"] },
];

const STATUS_TAG: Record<string, [string, string]> = {
  pending_review: ["Menunggu dicek", "tag-sun"],
  confirmed: ["Terkonfirmasi", "tag-ok"],
  rejected: ["Ditolak", "tag-bad"],
};

export default async function Pembayaran({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; id?: string }> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const tab = TABS.find((t) => t.kode === sp.tab) ?? TABS[0];
  const q = (sp.q ?? "").trim().toLowerCase();

  const { data: all } = await db()
    .from("orders")
    .select("id,order_no,user_id,amount,method,status,proof_amount,reject_reason,submitted_at,decided_at,decided_by,created_at")
    .in("status", ["pending_review", "confirmed", "rejected"])
    .order("submitted_at", { ascending: true })
    .limit(2000);
  let rows = await withUsers((all ?? []) as OrderRow[]);
  if (q) rows = rows.filter((r) => [r.nickname, r.email, r.order_no].some((v) => v?.toLowerCase().includes(q)));
  const counts = Object.fromEntries(TABS.map((t) => [t.kode, rows.filter((r) => t.status.includes(r.status)).length]));
  // Menunggu: urut dari yang paling lama masuk (BO AC-01.1). Lainnya: terbaru dulu.
  const list = rows
    .filter((r) => tab.status.includes(r.status))
    .sort((a, b) => (tab.kode === "menunggu" ? 1 : -1) * ((a.submitted_at ?? "").localeCompare(b.submitted_at ?? "")));

  const today = startOfDayWIB().toISOString();
  const pending = rows.filter((r) => r.status === "pending_review");
  const oldest = pending[0]?.submitted_at;
  const confToday = rows.filter((r) => r.status === "confirmed" && (r.decided_at ?? "") >= today);
  const rejToday = rows.filter((r) => r.status === "rejected" && (r.decided_at ?? "") >= today);
  const cashToday = confToday.reduce((s, r) => s + (r.proof_amount ?? r.amount), 0);
  const lastSeen = admin.last_list_seen_at;
  // "Baru" hilang setelah admin membuka salah satu pesanan, bukan oleh refresh otomatis.
  if (sp.id) await db().from("admins").update({ last_list_seen_at: new Date().toISOString() } as never).eq("user_id", admin.user_id);

  // Panel detail
  let detail = null;
  if (sp.id) {
    const o = rows.find((r) => r.id === sp.id);
    if (o) {
      const [{ data: proofs }, { data: hist }, { data: decider }] = await Promise.all([
        db().from("payment_proofs").select("id,file_name,mime,size,sha256,uploaded_at").eq("order_id", o.id).order("uploaded_at", { ascending: false }),
        db().from("audit_log").select("action,detail,created_at,admin_id").eq("order_id", o.id).in("action", ["confirm", "reject", "undo"]).order("created_at", { ascending: false }),
        o.decided_by ? db().from("admins").select("name").eq("user_id", o.decided_by).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const pr = (proofs ?? []) as { id: string; file_name: string; mime: string; size: number; sha256: string; uploaded_at: string }[];
      // Peringatan kalau file yang sama sudah pernah diunggah untuk pesanan lain.
      let dup = false;
      if (pr[0]?.sha256) {
        const { data: same } = await db().from("payment_proofs").select("order_id").eq("sha256", pr[0].sha256).neq("order_id", o.id).limit(1);
        dup = !!same?.length;
      }
      const adminIds = [...new Set(((hist ?? []) as { admin_id: string }[]).map((h) => h.admin_id))];
      const { data: names } = adminIds.length ? await db().from("admins").select("user_id,name").in("user_id", adminIds) : { data: [] };
      const nameOf = new Map(((names ?? []) as { user_id: string; name: string }[]).map((n) => [n.user_id, n.name]));
      detail = {
        order: o,
        proofs: pr,
        dup,
        deciderName: (decider as { name: string } | null)?.name ?? null,
        canUndo: !!o.decided_by && o.decided_by === admin.user_id && !!o.decided_at && Date.now() - new Date(o.decided_at).getTime() < 15 * 60_000,
        history: ((hist ?? []) as { action: string; detail: { reason?: string } | null; created_at: string; admin_id: string }[]).map((h) => ({
          action: h.action,
          reason: h.detail?.reason ?? null,
          at: h.created_at,
          by: nameOf.get(h.admin_id) ?? "—",
        })),
        dest: o.method === "transfer" ? `${PAYMENT.bankName} ${PAYMENT.bankAccount} a.n. ${PAYMENT.bankHolder}` : `QRIS ${PAYMENT.qrisMerchant} · NMID ${PAYMENT.qrisNmid}`,
      };
    }
  }

  const href = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const m = { tab: tab.kode, q: sp.q, ...p };
    Object.entries(m).forEach(([k, v]) => v && u.set(k, v));
    return `/admin/pembayaran?${u.toString()}`;
  };

  return (
    <div className="stack" style={{ ["--gap" as string]: "18px" }}>
      <AutoRefresh />
      <div className="row between"><h1>Pembayaran</h1><SearchBox initial={sp.q ?? ""} /></div>
      <div className="kpis">
        <div className="kpi"><span className="caption">Menunggu dicek</span><b>{pending.length}</b><span className="caption">{oldest ? `paling lama masuk ${tanggalJam(oldest)}` : "tidak ada antrean"}</span></div>
        <div className="kpi"><span className="caption">Dikonfirmasi hari ini</span><b>{confToday.length}</b></div>
        <div className="kpi"><span className="caption">Ditolak hari ini</span><b>{rejToday.length}</b></div>
        <div className="kpi"><span className="caption">Uang masuk hari ini</span><b>{rupiah(cashToday)}</b><Link href="/admin/uang-masuk?periode=hari" className="caption">Lihat Uang masuk ›</Link></div>
      </div>
      <div className="row">
        {TABS.map((t) => (
          <Link key={t.kode} href={href({ tab: t.kode, id: undefined })} className={`chip${t.kode === tab.kode ? " on" : ""}`}>{t.label} · {counts[t.kode]}</Link>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: detail ? "1fr 440px" : "1fr", gap: 18, alignItems: "start" }}>
        <table>
          <thead><tr><th>Waktu masuk</th><th>Pengguna</th><th>Pesanan</th><th>Metode</th><th>Nominal di bukti</th><th>Status</th></tr></thead>
          <tbody>
            {list.length === 0 ? <tr><td colSpan={6} className="muted">Tidak ada pesanan di tab ini.</td></tr> : null}
            {list.map((r) => {
              const isNew = r.status === "pending_review" && (!lastSeen || (r.submitted_at ?? "") > lastSeen);
              const diff = r.proof_amount !== null && r.proof_amount !== r.amount;
              const [lab, cls] = STATUS_TAG[r.status];
              return (
                <tr key={r.id} className={sp.id === r.id ? "sel" : ""}>
                  <td><Link href={href({ id: r.id })} style={{ color: "inherit", textDecoration: "none" }}>{tanggalJam(r.submitted_at)} {isNew ? <span className="tag tag-sky">Baru</span> : null}</Link></td>
                  <td><b>{r.nickname}</b><br /><span className="caption">{r.email}</span></td>
                  <td>{r.order_no}</td>
                  <td>{r.method === "transfer" ? "Transfer" : "QRIS"}</td>
                  <td className={diff ? "diff" : ""}>{r.proof_amount !== null ? rupiah(r.proof_amount) : <span className="caption">belum diisi</span>}</td>
                  <td><span className={`tag ${cls}`}>{lab}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {detail ? <Detail key={detail.order.id + detail.order.status} d={detail} closeHref={href({ id: undefined })} /> : null}
      </div>
    </div>
  );
}
