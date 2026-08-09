import "server-only";
import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client. Uses the Supabase secret key, which bypasses
// Row Level Security, so this file must never be imported from a Client
// Component or anything that ships to the browser. Every database read and
// write in this app goes through here (in Server Components or Route
// Handlers) since the app has no authentication layer.
export function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Missing Supabase server environment variables. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local."
    );
  }

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    // The Supabase client makes its requests with fetch(), and Next.js
    // patches the global fetch() to cache GET requests by default. Without
    // this, reads made right after a write (e.g. router.refresh(), or a
    // hard page reload shortly after) can be served stale/cached data,
    // making a successful update look like it didn't persist. Force every
    // Supabase request to bypass that cache.
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
