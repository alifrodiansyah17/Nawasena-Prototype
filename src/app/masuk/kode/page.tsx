import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { CodeForm } from "./CodeForm";

export default async function Kode() {
  const raw = (await cookies()).get("nws_login")?.value;
  if (!raw) redirect("/masuk");
  const c = JSON.parse(raw) as { kind: "email" | "phone"; value: string };
  return (
    <Shell layar="kode_masuk" back="/masuk">
      <div className="stack">
        <div className="stack" style={{ ["--gap" as string]: "6px" }}>
          <h1>Masukkan kodenya</h1>
          <p className="muted">
            Kode 6 angka sudah dikirim {c.kind === "email" ? "ke email" : "lewat WhatsApp ke"} <b style={{ color: "var(--ink)" }}>{c.value}</b>.
          </p>
        </div>
        <CodeForm />
      </div>
    </Shell>
  );
}
