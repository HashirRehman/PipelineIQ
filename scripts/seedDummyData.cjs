#!/usr/bin/env node
// Seeds a large volume of DUMMY data for testing the discovery / pipeline /
// leads flows end-to-end, spread across users of different roles:
//
//   * creates extra test users (BD Managers + Business Developers) if missing
//   * creates N profiles assigned round-robin to those users (admins are NOT
//     assigned — the model forbids it)
//   * gives each profile 1–2 CVs
//   * creates M jobs across several scrapers
//   * scores job × profile matches (job_profile_matches)
//   * applies / dismisses jobs from DIFFERENT profiles owned by DIFFERENT
//     users (job_profile_states), so each role's applied feed has data
//   * converts a share of applied pairs into leads (with notes + stages)
//   * adds a few team comments
//
// Idempotent: deterministic UUIDs + skip-if-exists, so re-running is a no-op
// and never duplicates data. Uses the service-role key (bypasses RLS) — this
// is test data for a development database.
//
// Usage:
//   node scripts/seedDummyData.cjs [--profiles 14] [--jobs 24]
//   npm run seed:dummy

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: '.env.local' });
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient } = require('@supabase/supabase-js');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const crypto = require('crypto');

const ORG_NAME = 'Recurso Labs';
const DUMMY_PASSWORD = 'Test@123';

// ---- CLI flags -----------------------------------------------------------
const args = process.argv.slice(2);
function flag(name, dflt) {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : dflt;
}
const PROFILE_COUNT = flag('--profiles', 14);
const JOB_COUNT = flag('--jobs', 24);

// ---- Deterministic helpers ------------------------------------------------
// uuid v5 (SHA-1 namespace) — same input always yields the same id, which is
// what makes the script idempotent across runs.
const NS = Buffer.from('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'hex');
function uuid5(name) {
  const hash = crypto.createHash('sha1').update(NS).update(String(name)).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // variant 10xx
  const b = hash.subarray(0, 16);
  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// Small seeded PRNG so the "random" choices are stable across runs.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260811);

// ---- Static test data -----------------------------------------------------
const PROFILE_NAMES = [
  'Ayesha Khan', 'Bilal Ahmed', 'Daniyal Raza', 'Emaan Fatima', 'Hamza Tariq',
  'Iqra Malik', 'Junaid Aslam', 'Khadija Noor', 'Muneeb Shah', 'Nimra Qureshi',
  'Omar Farooq', 'Rabia Sultana', 'Salman Haider', 'Zainab Ali', 'Usman Ghani',
  'Fatima Zahra', 'Ali Raza', 'Maryam Javed',
];

const LOCATIONS = [
  'Pakistan', 'United Arab Emirates', 'United Kingdom', 'United States',
  'Canada', 'Germany', 'Netherlands',
];

const SKILLS_BY_SENIORITY = {
  'Lead': 'Tech lead with hands-on architecture, mentoring, and cross-team delivery. TypeScript, Node.js, React, PostgreSQL, AWS, and Kubernetes.',
  'Senior': 'Senior engineer shipping production systems end-to-end. Strong in TypeScript, React, Node.js, PostgreSQL, Docker, and CI/CD.',
  'Mid': 'Full-stack engineer with solid experience in React, Node.js, and SQL. Comfortable owning features from design to deployment.',
  'Junior': 'Enthusiastic engineer skilled in JavaScript, React, and Node.js. Fast learner with a strong CS foundation.',
};

const JOB_TITLES = [
  'Senior Frontend Engineer (React)', 'Backend Engineer (Node.js)', 'DevOps Engineer',
  'Machine Learning Engineer', 'Full-Stack Engineer', 'QA Automation Engineer',
  'Data Engineer', 'Site Reliability Engineer', 'AI/ML Engineer', 'iOS Engineer (Swift)',
  'Solutions Architect', 'Cloud Engineer (AWS)', 'Platform Engineer', 'Security Engineer',
  'React Native Engineer', 'Data Scientist', 'Golang Engineer', 'Python Engineer',
  'Infrastructure Engineer (Kubernetes)', 'Product Engineer (TypeScript)',
  'Staff Engineer', 'ETL Developer', 'BI Engineer', 'Test Automation Lead',
];

const JOB_COMPANIES = [
  'Nimbus Labs', 'Helios Data', 'Quantum Works', 'Orbit AI', 'Vertex Cloud',
  'Lumen Health', 'Cresta Finance', 'Atlas Robotics', 'Pulse Analytics', 'Foundry AI',
  'Skyline SaaS', 'Cobalt Systems', 'Northwind Digital', 'Summit Data', 'Brightpath',
  'Corewave', 'Drift Labs', 'Harbor Analytics', 'EchoStack', 'Meridian Tech',
];

const JOB_LOCATIONS = [
  'Remote', 'Anywhere', 'US only', 'London, UK', 'Dubai, UAE', 'Berlin, Germany',
  'Toronto, Canada', 'Karachi, Pakistan', 'New York, US', 'Amsterdam, Netherlands',
];

const DISMISS_REASONS = [
  'Not a good fit for the profile',
  'Budget mismatch',
  'Location requirement',
  'Client rejected the profile',
  'Duplicate posting',
];

const LEAD_NOTES = [
  '',
  '',
  '',
  'Received a reply — asked for availability.',
  'Interview scheduled for next week.',
  'Assessment sent, due Friday.',
  'HR call went well.',
  'Client wants a follow-up call.',
  'Offer stage — negotiating the rate.',
];

const COMMENTS = [
  'Strong match — the CV aligns with the required stack.',
  'Client replied fast on this one.',
  'Applied yesterday, awaiting a response.',
  'Good rate fit for a senior profile.',
  'Rejected — required US work authorization.',
  'Salary band seems low for the seniority.',
  'Relevant experience, worth keeping an eye on.',
];

// ---- Main -----------------------------------------------------------------
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in .env.local');
    process.exit(1);
  }
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const created = { users: 0, profiles: 0, cvs: 0, scrapers: 0, jobs: 0, matches: 0, states: 0, leads: 0, comments: 0 };

  // 0) Reference rows -------------------------------------------------------
  const { data: org } = await supabase
    .from('organizations').select('id').eq('name', ORG_NAME).is('deleted_at', null).limit(1).single();
  if (!org) {
    console.error(`No organization named '${ORG_NAME}' — apply supabase/seed.sql first.`);
    process.exit(1);
  }
  const orgId = org.id;

  const { data: roleRows } = await supabase.from('roles').select('id, name');
  const roleIdByName = new Map((roleRows ?? []).map((r) => [r.name, r.id]));
  const managerRoleId = roleIdByName.get('BD Manager');
  const devRoleId = roleIdByName.get('Business Developer');
  if (!managerRoleId || !devRoleId) {
    console.error("Roles 'BD Manager' and 'Business Developer' must exist (see supabase/seed.sql / migration 14).");
    process.exit(1);
  }

  const { data: seniorityRows } = await supabase.from('seniority_level').select('id, name');
  const seniorityIdByName = new Map((seniorityRows ?? []).map((s) => [s.name, s.id]));

  const { data: stageRows } = await supabase
    .from('pipeline_stages').select('id, order_index').order('order_index');
  const stageIds = (stageRows ?? []).map((s) => s.id);

  const { data: scraperRows } = await supabase
    .from('scrapers').select('id, name').is('deleted_at', null);
  const scraperByName = new Map((scraperRows ?? []).map((s) => [s.name, s.id]));

  // 1) Test users (auth + public.users row + role) ---------------------------
  const managerUsers = [];
  const devUsers = [];
  const allUsers = [];
  const wantedUsers = [
    { email: 'test.manager@recursolabs.com', name: 'Test Manager', roleId: managerRoleId, list: managerUsers },
    { email: 'test.bd2@recursolabs.com', name: 'Test Manager 2', roleId: managerRoleId, list: managerUsers },
    { email: 'test.bd3@recursolabs.com', name: 'Test Manager 3', roleId: managerRoleId, list: managerUsers },
    { email: 'test.user@recursolabs.com', name: 'Test User', roleId: devRoleId, list: devUsers },
    { email: 'test.dev2@recursolabs.com', name: 'Test Developer 2', roleId: devRoleId, list: devUsers },
    { email: 'test.dev3@recursolabs.com', name: 'Test Developer 3', roleId: devRoleId, list: devUsers },
    { email: 'test.dev4@recursolabs.com', name: 'Test Developer 4', roleId: devRoleId, list: devUsers },
  ];

  for (const w of wantedUsers) {
    let userId = null;
    const { data: createdAuth, error: createErr } = await supabase.auth.admin.createUser({
      email: w.email,
      password: DUMMY_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: w.name },
    });
    if (createErr) {
      if (/already.*registered|already been registered/i.test(createErr.message)) {
        const { data: list } = await supabase.auth.admin.listUsers();
        userId = list?.users.find((u) => u.email?.toLowerCase() === w.email.toLowerCase())?.id ?? null;
      } else {
        console.error(`auth createUser failed for ${w.email}:`, createErr.message);
        process.exit(1);
      }
    } else {
      userId = createdAuth.user?.id ?? null;
      created.users += 1;
    }
    if (!userId) {
      console.error(`Could not resolve user id for ${w.email}`);
      process.exit(1);
    }

    await supabase.from('users').upsert(
      { id: userId, organization_id: orgId, full_name: w.name, email: w.email, role_id: w.roleId, is_active: true },
      { onConflict: 'id' },
    );
    const row = { id: userId, name: w.name, email: w.email, roleId: w.roleId };
    w.list.push(row);
    allUsers.push(row);
  }

  const owners = allUsers.filter((u) => u.roleId !== roleIdByName.get('Admin'));
  console.log(`✅ Users ready: ${managerUsers.length} BD Manager(s), ${devUsers.length} Business Developer(s)`);

  // 2) Profiles assigned to managers / devs (never admins) -------------------
  const seniorityNames = ['Senior', 'Mid', 'Junior', 'Lead'];
  const profileRows = [];
  for (let i = 0; i < PROFILE_COUNT; i++) {
    const name = PROFILE_NAMES[i % PROFILE_NAMES.length];
    const owner = owners[i % owners.length];
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '.');
    const seniority = seniorityNames[i % seniorityNames.length];
    const years = (2 + (i * 3) % 10 + (rnd() * 2)).toFixed(1);
    const profile = {
      id: uuid5(`profile:${name}`),
      organization_id: orgId,
      user_id: owner.id,
      full_name: name,
      email: `${slug}@dummy.profiles`,
      phone: `+92 3${String(10000000 + i * 137913).slice(0, 7)}`,
      location: LOCATIONS[i % LOCATIONS.length],
      seniority_level_id: seniorityIdByName.get(seniority) ?? null,
      years_of_experience: Number(years),
      rate_expectation: Number((15 + (i * 7) % 45).toFixed(2)),
      rate_currency: 'USD',
      rate_unit: 'hourly',
      summary: `${name} — ${SKILLS_BY_SENIORITY[seniority]}`,
      is_active: i % 7 !== 3, // a couple inactive for variety
    };
    profileRows.push(profile);
  }

  const { data: existingProfiles } = await supabase
    .from('profiles').select('email').eq('organization_id', orgId).is('deleted_at', null);
  const existingEmails = new Set((existingProfiles ?? []).map((p) => p.email));

  const freshProfiles = profileRows.filter((p) => !existingEmails.has(p.email));
  if (freshProfiles.length > 0) {
    const { error } = await supabase.from('profiles').upsert(freshProfiles, { onConflict: 'email' });
    if (error) {
      console.error('profiles upsert failed:', error.message);
      process.exit(1);
    }
  }
  created.profiles = freshProfiles.length;
  console.log(`✅ Profiles: ${freshProfiles.length} created (${profileRows.length} total intended)`);

  // 3) CVs for the new profiles ---------------------------------------------
  const cvRows = [];
  for (const p of profileRows) {
    // parseInt(str, 16) — NOT Number(str, 16): Number() ignores the radix
    // argument, so hex prefixes containing letters became NaN (0 CVs).
    const cvCount = 1 + (parseInt(p.id.slice(0, 2), 16) % 2); // 1–2 CVs each
    for (let c = 0; c < cvCount; c++) {
      const cvId = uuid5(`cv:${p.id}:${c}`);
      cvRows.push({
        id: cvId,
        profile_id: p.id,
        storage_path: `${p.id}/${cvId}-${p.full_name.replace(/\s+/g, '-')}-Resume.pdf`,
        file_name: `${p.full_name} - Resume${c > 0 ? ` v${c + 1}` : ''}.pdf`,
        file_type: 'application/pdf',
        file_size_bytes: 90000 + Math.floor(rnd() * 300000),
        parse_status: 'pending',
      });
    }
  }

  const { data: existingCvs } = await supabase
    .from('profile_cvs').select('id').in('profile_id', profileRows.map((p) => p.id));
  const existingCvIds = new Set((existingCvs ?? []).map((cv) => cv.id));
  const freshCvs = cvRows.filter((cv) => !existingCvIds.has(cv.id));
  if (freshCvs.length > 0) {
    const { error } = await supabase.from('profile_cvs').insert(freshCvs);
    if (error) {
      console.error('profile_cvs insert failed:', error.message);
      process.exit(1);
    }
  }
  created.cvs = freshCvs.length;

  // 4) Scrapers (add a couple of extra sources for variety) ------------------
  const scrapers = [
    { id: uuid5('scraper:RemoteOK'), name: 'RemoteOK', base_url: 'https://remoteok.com' },
    { id: uuid5('scraper:WeWorkRemotely'), name: 'WeWorkRemotely', base_url: 'https://weworkremotely.com' },
  ];
  for (const s of scrapers) {
    if (!scraperByName.has(s.name)) {
      const { error } = await supabase.from('scrapers').upsert(s, { onConflict: 'id' });
      if (error) {
        console.error(`scraper upsert failed (${s.name}):`, error.message);
        process.exit(1);
      }
      created.scrapers += 1;
      scraperByName.set(s.name, s.id);
    }
  }
  // 5) Jobs -----------------------------------------------------------------
  const jobRows = [];
  const now = Date.now();
  for (let i = 0; i < JOB_COUNT; i++) {
    const scraperKey = [...scraperByName.keys()][i % scraperByName.size];
    const externalId = `dummy-${scraperKey.toLowerCase()}-${String(i + 1).padStart(3, '0')}`;
    const isRemote = i % 3 !== 2;
    // A few postings are US-only (is_globally_open = false) so the
    // Discovery region filter has data to narrow to.
    const usOnly = i % 7 === 5;
    jobRows.push({
      id: uuid5(`job:${externalId}`),
      organization_id: orgId,
      scraper_id: scraperByName.get(scraperKey),
      external_job_id: externalId,
      title: JOB_TITLES[i % JOB_TITLES.length],
      company_name: JOB_COMPANIES[i % JOB_COMPANIES.length],
      company_location: JOB_LOCATIONS[i % JOB_LOCATIONS.length],
      description: `${JOB_TITLES[i % JOB_TITLES.length]} at ${JOB_COMPANIES[i % JOB_COMPANIES.length]}. Responsibilities include owning features end-to-end, collaborating with product and design, and maintaining production quality. Remote-friendly, ${isRemote ? 'fully remote' : 'on-site'}.\n\nRequirements: ${(i % 2 ? '5+' : '3+')} years of relevant experience, strong communication, and a track record of shipping.`,
      apply_url: `https://example.com/jobs/${String(i + 1).padStart(4, '0')}`,
      is_remote: isRemote,
      remote_allowed_region: usOnly ? 'US only' : i % 2 === 0 ? 'Worldwide' : null,
      job_posted_at: new Date(now - ((i % 21) * 24 + (i % 12)) * 3600 * 1000).toISOString(),
      is_globally_open: !usOnly,
      possibly_closed: false,
      possibly_closed_reason: null,
    });
  }

  const { data: existingJobs } = await supabase
    .from('jobs').select('external_job_id').eq('organization_id', orgId);
  const existingJobIds = new Set((existingJobs ?? []).map((j) => j.external_job_id));
  const freshJobs = jobRows.filter((j) => !existingJobIds.has(j.external_job_id));
  if (freshJobs.length > 0) {
    const { error } = await supabase.from('jobs').upsert(freshJobs, { onConflict: 'scraper_id,external_job_id' });
    if (error) {
      console.error('jobs upsert failed:', error.message);
      process.exit(1);
    }
  }
  created.jobs = freshJobs.length;
  console.log(`✅ Jobs: ${freshJobs.length} created (${jobRows.length} total intended)`);

  // All profile rows now exist (created above or pre-existing from a prior
  // run) — resolve the actual CV ids we inserted for match/state rows.
  const { data: cvLookup } = await supabase
    .from('profile_cvs').select('id, profile_id').in('profile_id', profileRows.map((p) => p.id));
  const cvByProfile = new Map();
  for (const cv of cvLookup ?? []) {
    if (!cvByProfile.has(cv.profile_id)) cvByProfile.set(cv.profile_id, []);
    cvByProfile.get(cv.profile_id).push(cv.id);
  }

  // 6) Job × profile matches -------------------------------------------------
  // One score row PER CV of the profile — a profile with several CVs shows
  // each CV's relevance against the same job (multi-CV scores in the drawer).
  const matchRows = [];
  for (let i = 0; i < jobRows.length; i++) {
    const job = jobRows[i];
    const matchCount = 3 + (i % 4); // 3–6 profiles scored per job
    for (let k = 0; k < matchCount; k++) {
      const profile = profileRows[(i * 3 + k * 2) % profileRows.length];
      const cvIds = cvByProfile.get(profile.id) ?? [];
      for (const cvId of cvIds) {
        matchRows.push({
          id: uuid5(`match:${job.id}:${profile.id}:${cvId}`),
          organization_id: orgId,
          job_id: job.id,
          profile_id: profile.id,
          cv_id: cvId,
          relevance_score: Number((42 + Math.floor(rnd() * 57)).toFixed(2)),
          ai_model_version: 'dummy-v1',
        });
      }
    }
  }

  const { data: existingMatches } = await supabase
    .from('job_profile_matches').select('job_id, profile_id, cv_id').eq('organization_id', orgId);
  const existingMatchKeys = new Set(
    (existingMatches ?? []).map((m) => `${m.job_id}:${m.profile_id}:${m.cv_id}`),
  );
  const freshMatches = matchRows.filter((m) => !existingMatchKeys.has(`${m.job_id}:${m.profile_id}:${m.cv_id}`));
  if (freshMatches.length > 0) {
    const { error } = await supabase.from('job_profile_matches').insert(freshMatches);
    if (error) {
      console.error('job_profile_matches insert failed:', error.message);
      process.exit(1);
    }
  }
  created.matches = freshMatches.length;

  // 7) Application states (applied / dismissed per job × profile) ------------
  const { data: existingStates } = await supabase
    .from('job_profile_states').select('job_id, profile_id').eq('organization_id', orgId);
  const existingStateKeys = new Set(
    (existingStates ?? []).map((s) => `${s.job_id}:${s.profile_id}`),
  );

  const stateRows = [];
  for (let i = 0; i < jobRows.length; i++) {
    const job = jobRows[i];
    const jobPosted = new Date(job.job_posted_at).getTime();

    // Applied by 1–3 different profiles (different users, different roles).
    const appliedCount = 1 + (i % 3);
    const appliedProfiles = [];
    for (let k = 0; k < appliedCount; k++) {
      appliedProfiles.push(profileRows[(i + k * 3) % profileRows.length]);
    }
    for (const p of appliedProfiles) {
      const key = `${job.id}:${p.id}`;
      if (existingStateKeys.has(key)) continue;
      const stateId = uuid5(`state:${job.id}:${p.id}`);
      // Applied 2–11 days after posting, but never in the future.
      const appliedAt = new Date(
        Math.min(jobPosted + ((i % 10) + 2) * 24 * 3600 * 1000, Date.now() - 3600 * 1000),
      ).toISOString();
      stateRows.push({
        id: stateId,
        organization_id: orgId,
        job_id: job.id,
        profile_id: p.id,
        status: 'applied',
        user_id: p.user_id,
        cv_id: (cvByProfile.get(p.id) ?? [])[0] ?? null,
        dismissed_reason: null,
        created_at: appliedAt,
      });
    }

    // Dismissed by one profile (a different one than applied above).
    const dismissed = profileRows[(i * 5 + 1) % profileRows.length];
    const dKey = `${job.id}:${dismissed.id}`;
    if (!existingStateKeys.has(dKey) && !appliedProfiles.some((p) => p.id === dismissed.id)) {
      stateRows.push({
        id: uuid5(`state:${job.id}:${dismissed.id}`),
        organization_id: orgId,
        job_id: job.id,
        profile_id: dismissed.id,
        status: 'dismissed',
        user_id: dismissed.user_id,
        cv_id: (cvByProfile.get(dismissed.id) ?? [])[0] ?? null,
        dismissed_reason: DISMISS_REASONS[i % DISMISS_REASONS.length],
        created_at: new Date(jobPosted + ((i % 5) + 1) * 24 * 3600 * 1000).toISOString(),
      });
    }
  }

  if (stateRows.length > 0) {
    const { error } = await supabase.from('job_profile_states').insert(stateRows);
    if (error) {
      console.error('job_profile_states insert failed:', error.message);
      process.exit(1);
    }
  }
  created.states = stateRows.length;

  // 8) Leads — convert a share of applied pairs -----------------------------
  const { data: existingLeads } = await supabase
    .from('leads').select('job_id, profile_id').eq('organization_id', orgId);
  const existingLeadKeys = new Set(
    (existingLeads ?? []).map((l) => `${l.job_id}:${l.profile_id}`),
  );

  const appliedStates = stateRows.filter((s) => s.status === 'applied');
  const leadRows = [];
  for (let i = 0; i < appliedStates.length; i++) {
    // ~2 of every 3 applied pairs become leads; the rest stay visible in the
    // applied feed (a job whose pairs are ALL leads moves to Leads only).
    if (i % 3 === 2) continue;
    const s = appliedStates[i];
    const key = `${s.job_id}:${s.profile_id}`;
    if (existingLeadKeys.has(key)) continue;
    const stageIndex = [0, 0, 0, 0, 1, 3, 4][i % 7];
    leadRows.push({
      id: uuid5(`lead:${s.job_id}:${s.profile_id}`),
      organization_id: orgId,
      job_id: s.job_id,
      profile_id: s.profile_id,
      job_profile_state_id: s.id,
      user_id: s.user_id,
      pipeline_stage_id: stageIds[stageIndex] ?? stageIds[0],
      applied_at: s.created_at,
      last_activity_at: new Date(new Date(s.created_at).getTime() + (i % 6) * 24 * 3600 * 1000).toISOString(),
      notes: LEAD_NOTES[i % LEAD_NOTES.length],
    });
  }

  if (leadRows.length > 0) {
    const { error } = await supabase.from('leads').insert(leadRows);
    if (error) {
      console.error('leads insert failed:', error.message);
      process.exit(1);
    }
  }
  created.leads = leadRows.length;

  // 9) A few team comments on jobs -------------------------------------------
  const commentJobs = jobRows.filter((_, i) => i % 4 === 0);
  const commentRows = [];
  for (let i = 0; i < commentJobs.length; i++) {
    const commenter = owners[i % owners.length];
    commentRows.push({
      id: uuid5(`comment:${commentJobs[i].id}:${i}`),
      organization_id: orgId,
      job_id: commentJobs[i].id,
      user_id: commenter.id,
      body: COMMENTS[i % COMMENTS.length],
    });
  }
  const { data: existingComments } = await supabase
    .from('job_comments').select('id').eq('organization_id', orgId);
  const existingCommentIds = new Set((existingComments ?? []).map((c) => c.id));
  const freshComments = commentRows.filter((c) => !existingCommentIds.has(c.id));
  if (freshComments.length > 0) {
    const { error } = await supabase.from('job_comments').insert(freshComments);
    if (error) {
      console.error('job_comments insert failed:', error.message);
      process.exit(1);
    }
  }
  created.comments = freshComments.length;

  // 10) Summary ---------------------------------------------------------------
  const { count: totalProfiles } = await supabase
    .from('profiles').select('id', { count: 'exact', head: true }).eq('organization_id', orgId);
  const { count: totalJobs } = await supabase
    .from('jobs').select('id', { count: 'exact', head: true }).eq('organization_id', orgId);
  const { count: totalStates } = await supabase
    .from('job_profile_states').select('id', { count: 'exact', head: true }).eq('organization_id', orgId);
  const { count: totalLeads } = await supabase
    .from('leads').select('id', { count: 'exact', head: true }).eq('organization_id', orgId);
  const { data: appliedByUser } = await supabase
    .from('job_profile_states')
    .select('user_id, profiles!inner(full_name, users!inner(full_name, roles(name)))')
    .eq('organization_id', orgId)
    .eq('status', 'applied')
    .is('deleted_at', null);

  console.log('\n════════════════════════════════════════════');
  console.log('✅ DUMMY DATA SEED COMPLETE');
  console.log('════════════════════════════════════════════');
  console.log('Created this run:', JSON.stringify(created));
  console.log('Totals now:',
    `profiles=${totalProfiles} jobs=${totalJobs} states=${totalStates} leads=${totalLeads}`);

  const perUser = new Map();
  for (const s of appliedByUser ?? []) {
    const key = s.profiles?.users?.full_name ?? 'unknown';
    perUser.set(key, (perUser.get(key) ?? 0) + 1);
  }
  console.log('\nApplied jobs per user (role):');
  for (const [name, count] of [...perUser.entries()].sort()) {
    console.log(`  ${count}  ${name}`);
  }
  console.log('\nTest logins (all password Test@123):');
  for (const u of allUsers) {
    const role = u.roleId === managerRoleId ? 'BD Manager' : 'Business Developer';
    console.log(`  ${u.email}  (${role})`);
  }
  console.log('\nHint: open Discovery (new feed), Pipeline (applied feed), Leads, and the');
  console.log('Users/Profiles tabs to see the data. BD Managers filter Pipeline/Leads by');
  console.log('profile or user; Business Developers only ever see their own.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
