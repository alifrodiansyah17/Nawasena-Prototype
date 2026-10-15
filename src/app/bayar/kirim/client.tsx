"use client";
import { useActionState, useState } from "react";
import { submitProof } from "../actions";
import { ukuranFile } from "@/lib/format";

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="chip" onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>
      {done ? "Tersalin" : "Salin"}
    </button>
  );
}

export function ProofForm() {
  const [state, action, pending] = useActionState(submitProof, undefined);
  const [file, setFile] = useState<File | null>(null);
  return (
    <form action={action} className="stack">
      <input id="proof" type="file" name="file" accept="image/jpeg,image/png,application/pdf" className="sr" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      {file ? (
        <div className="file-chip">
          <div><b>{file.name}</b><div className="caption">{ukuranFile(file.size)}</div></div>
          <label htmlFor="proof" className="chip">Ganti</label>
        </div>
      ) : (
        <label htmlFor="proof" className="drop">
          <span style={{ fontSize: 28 }} aria-hidden>🧾</span>
          <b>Pilih screenshot atau file bukti bayar</b>
          <span className="caption">JPG, PNG, PDF · maks. 5 MB</span>
        </label>
      )}
      {state?.error ? <p className="error" role="alert">{state.error}</p> : null}
      <button className="btn btn-primary btn-block" disabled={!file || pending}>{pending ? "Mengirim..." : "Kirim bukti pembayaran"}</button>
      <p className="caption">Bukti bayar disimpan privat dan hanya dipakai untuk mengecek pesanan ini.</p>
    </form>
  );
}
