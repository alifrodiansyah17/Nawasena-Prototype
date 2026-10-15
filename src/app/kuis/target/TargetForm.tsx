"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { submitTarget } from "../actions";
import { track } from "@/components/track";

function Buttons({ skipLabel }: { skipLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button className="btn btn-primary btn-block" disabled={pending}>{pending ? "Sebentar..." : "Analisis sekarang"}</button>
      <button className="btn btn-ghost" name="skip" value="1" disabled={pending}>{skipLabel}</button>
    </>
  );
}

export function TargetForm({ initial, examples, skipLabel }: { initial: string; examples: string[]; skipLabel: string }) {
  const [v, setV] = useState(initial);
  return (
    <form action={submitTarget} className="stack">
      <label className="field">
        <span className="sr">Jawabanmu</span>
        <textarea name="target" maxLength={200} rows={3} value={v} onChange={(e) => setV(e.target.value)} placeholder="Tulis di sini" />
        <span className="caption" style={{ textAlign: "right" }}>{v.length}/200</span>
      </label>
      <div className="row wrap">
        {examples.map((x) => (
          <button key={x} type="button" className={`chip${v === x ? " on" : ""}`} onClick={() => { setV(x); track("target_example_pick", { contoh: x }); }}>{x}</button>
        ))}
      </div>
      <Buttons skipLabel={skipLabel} />
    </form>
  );
}
