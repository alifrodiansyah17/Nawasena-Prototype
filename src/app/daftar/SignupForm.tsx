"use client";
import { useActionState, useState } from "react";
import { signup } from "../auth/actions";

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined);
  const [v, setV] = useState({ nickname: "", birth_date: "", whatsapp: "", email: "" });
  const full = Object.values(v).every((x) => x.trim() !== "");
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <form action={action} className="stack">
      <label className="field">
        Panggilan kamu siapa nih?
        <input type="text" name="nickname" autoComplete="nickname" placeholder="Rani" value={v.nickname} onChange={set("nickname")} required />
      </label>
      <label className="field">
        Tanggal lahir
        <input type="date" name="birth_date" value={v.birth_date} onChange={set("birth_date")} required max={new Date().toISOString().slice(0, 10)} />
      </label>
      <label className="field">
        Nomor WhatsApp
        <span className="caption help">Hanya untuk kabar soal akun dan pembayaranmu.</span>
        <input type="tel" name="whatsapp" inputMode="tel" autoComplete="tel" placeholder="0812 3456 7890" value={v.whatsapp} onChange={set("whatsapp")} required />
      </label>
      <label className="field">
        Email
        <input type="email" name="email" autoComplete="email" placeholder="rani@email.com" value={v.email} onChange={set("email")} required />
      </label>
      {state?.error ? <p className="error" role="alert">{state.error}</p> : null}
      <button className="btn btn-primary btn-block" disabled={!full || pending}>
        {pending ? "Sebentar..." : "Lanjut"}
      </button>
    </form>
  );
}
