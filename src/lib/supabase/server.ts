import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Klien yang membawa sesi pengguna dari cookie. Hanya dipakai untuk auth.
export async function supabaseSession() {
  const store = await cookies();
  return createServerClient(URL, ANON, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Dipanggil dari Server Component: cookie di-refresh oleh middleware.
        }
      },
    },
  });
}

// Klien service role. Semua akses data lewat sini, SETELAH identitas diverifikasi.
// Tanpa tipe skema yang digenerate; baris di-cast di titik pemakaian.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let admin: SupabaseClient<any, "public", any> | null = null;
export function db() {
  if (!admin) {
    admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}
