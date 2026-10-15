"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function BoNav() {
  const p = usePathname();
  return (
    <>
      <Link href="/admin/pembayaran" className={p.startsWith("/admin/pembayaran") ? "on" : ""}>Pembayaran</Link>
      <Link href="/admin/uang-masuk" className={p.startsWith("/admin/uang-masuk") ? "on" : ""}>Uang masuk</Link>
    </>
  );
}
