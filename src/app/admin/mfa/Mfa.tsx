"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function Mfa({ factorId }: { factorId: string | null }) {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [fid, setFid] = useState(factorId);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (factorId) return;
    (async () => {
      const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `nawasena-${Date.now()}` });
      if (error) return setErr(error.message);
      setFid(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verify() {
    if (!fid) return;
    setErr(null);
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: fid, code });
    if (error) return setErr("Kode authenticator salah.");
    router.replace("/admin/pembayaran");
    router.refresh();
  }

  return (
    <div className="stack">
      {!factorId ? (
        <>
          <p className="muted">Pindai QR ini dengan Google Authenticator, 1Password, atau aplikasi sejenis.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr ? <img src={qr} alt="QR authenticator" style={{ width: 200, height: 200 }} /> : <div className="spinner" />}
          {secret ? <p className="caption">Kode manual: {secret}</p> : null}
        </>
      ) : (
        <p className="muted">Masukkan kode 6 angka dari aplikasi authenticator.</p>
      )}
      <input className="otp" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} maxLength={6} inputMode="numeric" />
      {err ? <p className="error">{err}</p> : null}
      <button className="btn btn-primary" onClick={verify} disabled={code.length !== 6}>Verifikasi</button>
    </div>
  );
}
