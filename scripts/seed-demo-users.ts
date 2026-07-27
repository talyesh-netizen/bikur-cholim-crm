/**
 * Creates a handful of FICTIONAL demo staff accounts in a real Supabase
 * project, so the rest of the fictional demo data (see supabase/seed.sql)
 * has real accounts to attach to (e.g., "visit logged by Noah Fischer").
 *
 * This is only ever meant to be run against a fresh, non-production
 * Supabase project used for building/testing this app — never against a
 * project that has real staff accounts or real resident data in it.
 *
 * Usage (after creating a Supabase project and filling in .env.local):
 *   npm run seed:users
 *
 * Then, separately, run the contents of supabase/seed.sql against the
 * same project (e.g., via the Supabase SQL Editor, or `supabase db
 * push` + `psql`) to load the rest of the fictional demo data.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.\n" +
      "This script needs both to create demo accounts. See .env.example for where to find them."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// A throwaway password — these are fictional demo accounts on a
// non-production project, not real credentials to protect. Change or
// remove these accounts before any real data ever goes into this
// project.
const DEMO_PASSWORD = "Demo-Account-ChangeMe-1!";

const DEMO_USERS = [
  { email: "talia.green@example.org", full_name: "Talia Green", role: "admin" as const },
  { email: "noah.fischer@example.org", full_name: "Noah Fischer", role: "staff" as const },
  { email: "dina.katz@example.org", full_name: "Dina Katz", role: "staff" as const },
];

async function main() {
  for (const user of DEMO_USERS) {
    const { data: existing } = await supabase.auth.admin.listUsers();
    const alreadyExists = existing?.users.some((u) => u.email === user.email);

    if (alreadyExists) {
      console.log(`Skipping ${user.email} — already exists.`);
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: user.full_name },
    });

    if (error || !data.user) {
      console.error(`Failed to create ${user.email}:`, error?.message);
      continue;
    }

    console.log(`Created ${user.email} (${data.user.id})`);

    if (user.role === "admin") {
      // Direct table update via the service role key bypasses row-level
      // security, which is exactly what's needed to set the very first
      // admin account — see the note in
      // supabase/migrations/20260727000002_profiles.sql about this
      // bootstrapping step.
      const { error: roleError } = await supabase
        .from("profiles")
        .update({ role: "admin" })
        .eq("id", data.user.id);

      if (roleError) {
        console.error(`Failed to promote ${user.email} to admin:`, roleError.message);
      } else {
        console.log(`Promoted ${user.email} to admin.`);
      }
    }
  }

  console.log(
    "\nDone. Next: run the contents of supabase/seed.sql against this project to load the rest of the fictional demo data."
  );
}

main();
