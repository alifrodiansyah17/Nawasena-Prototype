import { Shell } from "@/components/Shell";
import { SignupForm } from "./SignupForm";
import { TrackView } from "@/components/TrackView";

export default function Daftar() {
  return (
    <Shell layar="buat_akun" back="/">
      <TrackView name="signup_start" />
      <div className="stack">
        <div className="stack" style={{ ["--gap" as string]: "6px" }}>
          <h1>Kenalan dulu, yuk</h1>
          <p className="muted">Empat hal ini saja. Hasilmu nanti tersimpan di akun ini.</p>
        </div>
        <SignupForm />
      </div>
    </Shell>
  );
}
