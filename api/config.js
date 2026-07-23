// Serves the PUBLIC Supabase config to the browser. The anon key is designed to
// be exposed client-side (row-level security does the protecting), so this is safe.
// When these env vars are unset, the app simply runs in local "guest" mode.
export default function handler(req, res) {
  res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  });
}
