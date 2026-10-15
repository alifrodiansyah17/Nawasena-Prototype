import Link from "next/link";
import { HelpChip } from "./Help";

// Kerangka semua layar alur: logo + jalur bantuan yang selalu terlihat (AC-03.1).
export function Shell({
  layar,
  children,
  wide = false,
  back,
  right,
}: {
  layar: string;
  children: React.ReactNode;
  wide?: boolean;
  back?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="row">
          {back ? (
            <Link href={back} className="chip" aria-label="Kembali">
              ←
            </Link>
          ) : null}
          <Link href="/" aria-label="Nawasena, ke beranda">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-nawasena.png" alt="nawasena" className="logo" />
          </Link>
        </div>
        <nav>
          {right}
          <HelpChip layar={layar} />
        </nav>
      </header>
      <main className={`main${wide ? " wide" : ""}`}>{children}</main>
    </div>
  );
}
