#!/usr/bin/env node
// Seeds the PipelineIQ demo admin user and the surrounding rows that
// require an auth identity (which SQL seed files cannot create):
//   auth.users -> public.users (single role via users.role_id)
// Optionally links the demo "Saad Mumtaz" profile to this user (BD
// ownership via profiles.user_id — a user may own several profiles).
//
// Usage:
//   node scripts/createUser.cjs [email] [password] [fullName]
//   npm run seed:user
//
// Env fallbacks: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME
//
// Prereqs:
//   1. Migrations applied (npm run migrate:up).
//   2. supabase/seed.sql applied (applies the API grants the service_role
//      needs for this script, plus organizations, roles, profiles).

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: '.env.local' });
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient } = require('@supabase/supabase-js');

const DEFAULTS = {
  email: 'fareed.zafar@recursolabs.com',
  orgName: 'Recurso Labs',
  role: 'Admin',
  demoProfileEmail: 'saad.mumtaz@example.com',
};

function deriveName(email) {
  const local = email.split('@')[0].replace(/[._]/g, ' ');
  return local
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function main() {
  const [, , emailArg, passwordArg, nameArg] = process.argv;
  const email = (emailArg || process.env.SEED_ADMIN_EMAIL || DEFAULTS.email).trim();
  const password = passwordArg || process.env.SEED_ADMIN_PASSWORD;
  const fullName = nameArg || process.env.SEED_ADMIN_NAME || deriveName(email);

  if (!password) {
    console.error('Usage: node scripts/createUser.cjs [email] [password] [fullName]');
    console.error('  or set SEED_ADMIN_PASSWORD in .env.local');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in .env.local');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 0) Resolve the organization (UUIDs differ per database — never hardcode)
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('name', DEFAULTS.orgName)
    .is('deleted_at', null)
    .limit(1)
    .single();
  if (orgErr || !org) {
    console.error(`No organization named '${DEFAULTS.orgName}' found.`, orgErr?.message || '');
    console.error('Apply supabase/seed.sql first (e.g. `supabase db reset`) so organizations, roles, and profiles exist.');
    process.exit(1);
  }

  // 1) Auth user (idempotent: reuse if the email already exists)
  let userId;
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createErr) {
    if (/already.*registered|already been registered/i.test(createErr.message)) {
      console.warn('Auth user already exists, looking it up...');
      const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
      if (listErr) {
        console.error('Could not list users:', listErr.message);
        process.exit(1);
      }
      const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (!existing) {
        console.error('Auth user reported as existing but not found in listUsers.');
        process.exit(1);
      }
      userId = existing.id;
    } else {
      console.error('Auth createUser error:', createErr.message);
      process.exit(1);
    }
  } else {
    userId = created.user?.id;
  }

  if (!userId) {
    console.error('No user ID resolved');
    process.exit(1);
  }

  // 2) public.users row (id = auth user id, FK enforced)
  const { error: usersErr } = await supabase
    .from('users')
    .upsert(
      { id: userId, organization_id: org.id, full_name: fullName, email, is_active: true },
      { onConflict: 'id' }
    );
  if (usersErr) {
    console.error('users upsert error:', usersErr.message);
    process.exit(1);
  }

  // 3) Role assignment — a user has exactly one role (users.role_id)
  const { data: roleRow, error: roleErr } = await supabase
    .from('roles')
    .select('id, name')
    .eq('name', DEFAULTS.role)
    .maybeSingle();
  if (roleErr) {
    console.error('roles lookup error:', roleErr.message);
    process.exit(1);
  }
  if (!roleRow) {
    console.warn(
      `Role '${DEFAULTS.role}' not found in DB (run supabase/seed.sql first) — user created without a role.`
    );
  } else {
    const { error: assignErr } = await supabase
      .from('users')
      .update({ role_id: roleRow.id })
      .eq('id', userId);
    if (assignErr) {
      console.error('users role assignment error:', assignErr.message);
      process.exit(1);
    }
  }

  // 4) Link the demo profile to this user (ownership — only if unassigned)
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('email', DEFAULTS.demoProfileEmail)
    .is('deleted_at', null)
    .maybeSingle();
  if (profErr) {
    console.error('profile lookup error:', profErr.message);
    process.exit(1);
  }
  if (profile) {
    const { data: updated, error: linkErr } = await supabase
      .from('profiles')
      .update({ user_id: userId })
      .eq('id', profile.id)
      .is('user_id', null)
      .select('id');
    if (linkErr) {
      console.error('profile link error:', linkErr.message);
      process.exit(1);
    }
    if (updated && updated.length > 0) {
      console.log(`Linked profile "${profile.full_name}" to this user (ownership).`);
    } else {
      console.warn(`Profile "${profile.full_name}" is already assigned to a user — skipped.`);
    }
  } else {
    console.warn(`Demo profile "${DEFAULTS.demoProfileEmail}" not found — skipped linking.`);
  }

  console.log('\n✅ Seed user ready:');
  console.log('   Email:   ', email);
  console.log('   Password:', password);
  console.log('   Name:    ', fullName);
  console.log('   Role:    ', DEFAULTS.role);
  console.log('   Org:     ', org.name);
  console.log('\nYou can now log in through the app.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
