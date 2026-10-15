"use client";
import { useActionState, useState } from "react";
import { requestLoginCode } from "../auth/actions";

// Satu kolom saja; label tombol menyesuaikan isian (AC-02.2, AC-02.2b).
export function LoginForm() {
  const [state, action, pending] = useActionState(requestLoginCode, undefined);
  const [v, setV] = useState("");
  const s = v.trim();
  const label = !s ? "Kirim kodenya" : s.includes("@") ? "Kirim kode ke email" : /^[+\d\s-]+$/.test(s) ? "Kirim kode lewat WhatsApp" : "Kirim kodenya";
  return (
    <form action={action} className="stack">
      <label className="field">
        Email atau nomor HP
        <input type="text" name="contact" autoComplete="username" inputMode="email" placeholder="rani@email.com atau 0812..." value={v} onChange={(e) => setV(e.target.value)} />
      </label>
      {state?.error ? <p className="error" role="alert">{state.error}</p> : null}
      <button className="btn btn-primary btn-block" disabled={!s || pending}>{pending ? "Mengirim..." : label}</button>
    </form>
  );
}
