-- ============================================================
-- PipelineIQ — seed data (reference + demo)
-- Idempotent: safe to re-run (ON CONFLICT ... DO NOTHING).
-- Applied automatically by `supabase db reset` (config.toml [db.seed]).
-- For a remote fresh project: `supabase db reset --linked`, or run this
-- file against the database directly.
-- The admin auth user is created separately: scripts/createUser.cjs
-- ============================================================

-- API grants (formerly a standalone migration) -------------------
-- Grant the Data API roles table/type privileges so the app can
-- read and write through PostgREST. Idempotent. anon intentionally gets
-- nothing (old schema revoked everything from anon; hardening plan B5).
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage on type public.application_status to authenticated, service_role;


-- Organizations -------------------------------------------------
insert into public.organizations (id, name, is_active)
values ('10000000-0000-4000-8000-000000000001', 'Recurso Labs', true)
on conflict (id) do nothing;

-- Roles ---------------------------------------------------------
insert into public.roles (id, name, description) values
  ('10000000-0000-4000-8000-000000000010', 'Admin', 'Full platform access'),
  ('10000000-0000-4000-8000-000000000011', 'User',  'Standard user access')
on conflict (name) do nothing;

-- Seniority levels (old DB: seniority_levels, which also had a rank
-- column — rank was dropped in the fresh schema) -----------------
insert into public.seniority_level (id, name) values
  ('10000000-0000-4000-8000-000000000020', 'Lead'),
  ('10000000-0000-4000-8000-000000000021', 'Senior'),
  ('10000000-0000-4000-8000-000000000022', 'Mid'),
  ('10000000-0000-4000-8000-000000000023', 'Junior')
on conflict (name) do nothing;

-- Pipeline stages (lead pipeline after an employer reply) --------
-- The frontend reads these dynamically (status select, board columns, list
-- sections, filters) — the order below drives both the UI order and the
-- stage colors, so keep it meaningful. The LAST stage is the terminal one
-- (the "mark done" target).
insert into public.pipeline_stages (id, name, order_index) values
  ('10000000-0000-4000-8000-000000000040', 'Applied',                1),
  ('10000000-0000-4000-8000-000000000041', 'Assessment Received',    2),
  ('10000000-0000-4000-8000-000000000042', 'Assessment Submitted',   3),
  ('10000000-0000-4000-8000-000000000043', 'HR Interview',           4),
  ('10000000-0000-4000-8000-000000000044', 'Tech Interview 1',       5),
  ('10000000-0000-4000-8000-000000000045', 'Tech Interview 2',       6),
  ('10000000-0000-4000-8000-000000000046', 'Client Interview',       7),
  ('10000000-0000-4000-8000-000000000047', 'Offer Received',         8),
  ('10000000-0000-4000-8000-000000000048', 'Offer Accepted/Rejected',9),
  ('10000000-0000-4000-8000-000000000049', 'Closed',                10)
on conflict (id) do nothing;

-- Scrapers (old DB: job_sources) --------------------------------
insert into public.scrapers (id, name, base_url) values
  ('10000000-0000-4000-8000-000000000030', 'Jsearch', 'https://jsearch.p.rapidapi.com')
on conflict (id) do nothing;

-- Profiles (old DB: engineers) -----------------------------------
insert into public.profiles (
  id, organization_id, full_name, email, phone, location,
  seniority_level_id, years_of_experience, rate_expectation,
  rate_currency, rate_unit, summary, is_active
) values
  (
    '10000000-0000-4000-8000-000000000050',
    '10000000-0000-4000-8000-000000000001',
    'Saad Mumtaz',
    'saad.mumtaz@example.com',
    '+92 300 1234567',
    'Pakistan',
    '10000000-0000-4000-8000-000000000021',
    7.5,
    25.00,
    'USD',
    'hourly',
    'Full-stack software engineer with 7+ years of experience building and shipping web applications for FinTech and SaaS products. Comfortable across the stack — TypeScript, React, Node.js, and PostgreSQL — with a focus on clean APIs, reliable data pipelines, and production-grade performance. Strong collaborator who enjoys owning features end-to-end, from design through deployment.',
    true
  ),
  (
    '10000000-0000-4000-8000-000000000051',
    '10000000-0000-4000-8000-000000000001',
    'Hashir Rehman',
    'writehashir@gmail.com',
    '03006786291',
    'Pakistan',
    '10000000-0000-4000-8000-000000000021',
    9.0,
    20.00,
    'USD',
    'hourly',
    'Senior Software Engineer with 9+ years of experience architecting and shipping fullstack production systems across FinTech, SaaS, and Healthcare. Strong background in scalable backend services, APIs, and modern frontend applications built to hold up under production load. In the last few years, moved into AI work as well — RAG pipelines, agentic workflows, and LLM-powered automation are now part of the toolkit. Works end-to-end, from system design through deployment and ongoing production support.',
    true
  )
on conflict (email) do nothing;

-- Profile CVs (old DB: engineer_cvs) -----------------------------
insert into public.profile_cvs (id, profile_id, storage_path, file_name, file_type, file_size_bytes) values
  (
    '10000000-0000-4000-8000-000000000060',
    '10000000-0000-4000-8000-000000000051',
    '10000000-0000-4000-8000-000000000051/10000000-0000-4000-8000-000000000060-Hashir Rehman - Resume.pdf',
    'Hashir Rehman - Resume.pdf',
    'application/pdf',
    128658
  ),
  (
    '10000000-0000-4000-8000-000000000061',
    '10000000-0000-4000-8000-000000000050',
    '10000000-0000-4000-8000-000000000050/10000000-0000-4000-8000-000000000061-Saad Mumtaz - Resume.pdf',
    'Saad Mumtaz - Resume.pdf',
    'application/pdf',
    133987
  )
on conflict (id) do nothing;

-- Jobs (old DB: jobs) --------------------------------------------
insert into public.jobs (
  id, organization_id, scraper_id, external_job_id, title, company_name,
  company_location, description, apply_url, is_remote, remote_allowed_region,
  job_posted_at, is_globally_open, possibly_closed, possibly_closed_reason
) values
  (
    '10000000-0000-4000-8000-000000000070',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000030',
    'MVdwc2ZEVVB0WDJnVzJzQUFBQUFBQT09OkVzd0JDb3dCUVVwcFZEUjBTMHAzWjJ0WVJsOWlibGhxWVd0VGN6QXRZa3R2TlZKU2JXMWZaVmhyUmpGemIyNW1TR0paWkRaNFMySmxSMDFKZUU5NVVqaEthRmxaWkZkalZWcGxTbkUxY21Oa2R6TmlkMDVNYm5nMFFUQXhaazVUVUdKaE5FazNRVGs1T1VkRlFXSlhUVlV0YUU1MVUwOTJhMGRYWDI5M1pFVldSRGN5WmxWRE9UWkdlWFpxTm0xd1lsb1NGelpsYkhGaGRVUk9URnA1VTNkaWExQm5aRmN6YzFGakdpSkJSSE55T1daU1lqRkVjVzlNWjJGZlVEUjBaMk5NVFc0dFVYbzNTalp3WTI5bg',
    'Java Software Developer - Remote',
    'YO AI Labs',
    'Anywhere',
    'Job Title: Senior Software Engineer

Job Type: Contract

Location: Remote

Job Summary: In this role, you''ll apply your expertise to help train next-generation AI systems. Your work will shape how models learn, reason, and perform through high-quality, real-world input. No prior experience in AI is required — your domain knowledge is what matters.

We are seeking strong Software Engineers to join our customer''s team with expertise in Python3, Java, Rust, Go, C++, or TypeScript. This is a unique opportunity to directly impact the next generation of AI by leveraging your advanced engineering skills in a dynamic, remote setting.

Required Skills and Qualifications:

• Proficiency in Python3, Java, Rust, or TypeScript, with additional experience in C++ or Go considered a strong asset.
• Deep understanding of algorithms, data structures, and performance tuning.
• Demonstrated experience in debugging complex software issues and delivering maintainable solutions.
• Strong background in feature development and codebase refactoring.
• Proven ability to optimize software for performance and scalability.
• Exceptional written and verbal communication skills, with a keen attention to detail.
• Track record of success in collaborative, cross-functional teams, ideally in remote settings.

Preferred Qualifications:

• Previous experience working on large-scale, distributed codebases.
• Familiarity with modern AI or machine learning systems is a plus, though not required.
• Background in participating in rigorous code reviews and contributing to the development of software best practices.',
    'https://www.linkedin.com/jobs/view/java-software-developer-remote-at-yo-ai-labs-4445426538',
    true,
    'Worldwide',
    '2026-07-28 00:00:00+00',
    true,
    false,
    null
  ),
  (
    '10000000-0000-4000-8000-000000000071',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000030',
    'ekRsNTBlNW9LMEpyUkoyR0FBQUFBQT09OkVzd0JDb3dCUVVwcFZEUjBTbFJoUkRJMWNHSjZlV2xJTlhSSlprVlVNR2xxTlhGNWVuUndVbTlYVlhaak1IRk5MV1JVYWpOYVJ6a3RWMlZoY0hSWGFrbGlkbk0wUmpGNk5sWk1jVjltWDBzNVN6RkxTMEp2Wm1wSldFa3pZbWRzUVRsMmFWUjBhM2RCWm5OclNGbEtibXMzVWtkUmFsazJORFUwUWt0eFkyUnRjM0pMWlVSVVJqTkVNMHBXZFUxWVRUQVNGelpsYkhGaGRVUk9URnA1VTNkaWExQm5aRmN6YzFGakdpSkJSSE55T1daVFdsaFdURlZXY1hVM1FXYzNOR2xUUkRNdExUVk9ORlY1TkRCQg',
    'QA / Software Engineering Reviewer – Browser Test Validation',
    'Mercor',
    'Anywhere',
    'We''re seeking experienced Software Engineers, QA Engineers, SDETs, and Test Automation Engineers to review browser-based evaluation workflows for AI-generated web applications. You''ll validate whether browser tests are technically sound, deterministic, and capable of producing clear pass/fail outcomes before they become part of benchmark datasets.

What You''ll Do

• Review browser-based testing workflows for AI-generated web applications.
• Assess whether browser interactions are technically feasible and reliable.
• Validate test isolation, fixtures, setup, and execution flow.
• Ensure assertions produce deterministic, unambiguous pass/fail results.
• Identify flaky tests, hidden dependencies, or ambiguous validation logic.
• Provide structured technical feedback following project review rubrics.

We''re Looking For

• 3+ years of experience in Software Engineering, QA Engineering, SDET, or Test Automation.
• Strong experience testing modern web applications.
• Familiarity with browser automation frameworks such as Playwright, Cypress, Selenium, or similar tools.
• Experience writing automated UI and end-to-end tests.
• Strong understanding of test isolation, fixtures, reproducibility, and reliable browser automation.
• Excellent debugging skills and attention to detail.

Why Join?

• Contribute to the development of AI systems by ensuring browser-based evaluation workflows are technically robust and reliable.
• Review realistic web application testing scenarios involving automation, test design, and software quality engineering.
• Collaborate with a high-calibre team helping establish quality standards for AI-generated software evaluation.',
    'https://work.mercor.com/jobs/list_AAABn635cuK1BNv8N59BUoUx/qa-software-engineering-reviewer-browser-test-validation',
    true,
    null,
    '2026-07-29 13:00:00+00',
    true,
    false,
    null
  )
on conflict (scraper_id, external_job_id) do nothing;
