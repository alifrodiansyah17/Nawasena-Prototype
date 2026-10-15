import "server-only";
import { db } from "./supabase/server";
import { ARCHETYPES, type Archetype } from "./archetypes";
import type { FreePart, PaidPart } from "./report-schema";
import { roleById, type RoleRef } from "./roles";
import { groupFor, type Group } from "./groups";
import type { Level } from "./level";
import type { Journey } from "./session";

export interface Arah {
  no: number;
  role: RoleRef;
  group: Group;
  data: PaidPart["bagian5"]["arah"][number];
}

export interface Peta {
  archetype: Archetype;
  free: FreePart;
  paid: PaidPart | null; // null kalau belum dibayar atau belum siap
  paidStatus: string;
  level: Level;
  target: string | null;
  arah: Arah[];
  identitas: string;
}

// Bagian 2–6 hanya dimuat dari database kalau pesanan sudah terkonfirmasi.
// Jadi isi berbayar tidak pernah terkirim ke browser sebelum bayar (BO: 0 kebocoran).
export async function loadPeta(j: Journey): Promise<Peta | null> {
  const cols = j.paid ? "archetype,free,paid,paid_status,level,free_status" : "archetype,free,paid_status,level,free_status";
  const { data } = await db().from("reports").select(cols).eq("user_id", j.profile.id).maybeSingle();
  const row = data as { archetype: string; free: FreePart; paid?: PaidPart | null; paid_status: string; level: Level; free_status: string } | null;
  if (!row || row.free_status !== "ready" || !row.free) return null;
  const target = j.target?.filled ? j.target.text : null;
  const paid = j.paid && row.paid_status === "ready" ? (row.paid ?? null) : null;
  const arah: Arah[] = paid
    ? paid.bagian5.arah.map((a, i) => ({ no: i + 1, role: roleById(a.role_id)!, group: groupFor(i, row.level, !!target), data: a })).filter((a) => a.role)
    : [];
  const facts = j.cv?.facts;
  return {
    archetype: ARCHETYPES[row.archetype] ?? ARCHETYPES.analyst,
    free: row.free,
    paid,
    paidStatus: row.paid_status,
    level: row.level,
    target,
    arah,
    identitas: facts?.ringkas ?? "",
  };
}
