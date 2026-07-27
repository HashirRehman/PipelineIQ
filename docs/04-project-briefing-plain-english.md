# Project & Database — Plain-English Briefing

*AI-Powered Sales & BD Automation Platform*



> For: Team lead / non-technical stakeholder review  

> Purpose: Explain what we’re building and why the database looks the way it does — no SQL required  

> MVP scope: Modules 1–4. Modules 5–9 are designed into the database now, built later.  


---


## 1. What We’re Building, in One Paragraph


A system that replaces the current spreadsheet-and-email workflow for placing engineers with clients. Admin maintains the engineer roster; the system uses AI to scan job platforms and suggest good-fit jobs for each engineer; BD applies manually on the real job site and then records it in our system; from there, every application is tracked permanently, with a full history of what happened and when. AI helps at every step — suggesting, scoring, summarizing — but a human always makes the actual decision to apply or move forward.


## 2. A Few Terms You’ll See in the Technical Docs


Your team may use these words when discussing the design. None of them are complicated — here’s what each one actually means:

| Term | What it actually means |
| --- | --- |
| Table | A structured list — think of it like one tab in a spreadsheet. Each row is one record: one engineer, one job, one lead. |
| Column / Field | One piece of information stored per row — like "email" or "rate expectation." |
| ID (Primary Key) | A unique reference number the system gives every row, so it can be found and linked to reliably — like an order number. Nobody types this in by hand. |
| Link (Foreign Key) | How one table points to a related row in another table — e.g. a Lead record points to which Engineer and which Job it’s about. |
| Lookup table | A small, editable list of options — like the interview stages, or the list of job platforms. An Admin can add/rename/reorder these from a settings screen, with no developer or deployment needed. |
| Fixed list (enum) | Also a list of options, but baked into the system’s structure. Changing it needs a developer. We only use this for things that essentially never change, like "Admin vs. BD Executive." |
| File type (mime_type) | A technical tag saying what kind of file was uploaded — PDF, Word doc, etc. Used so the system can block file types we don’t want and display files correctly. |
| Rule (constraint) | Something the database enforces automatically and can’t be bypassed by a bug — e.g. "you can’t submit the same engineer to the same job twice." |
| Speed-up (index) | An internal structure that makes searching/filtering fast. Invisible to users — purely a performance detail. |
| Automatic action (trigger / function) | Small pieces of logic the database runs by itself — e.g. "when a new CV is uploaded, automatically mark the old one as no longer current." |
| Access control (RLS) | The rule that guarantees a BD Executive only ever sees their own engineers and leads. This is enforced by the database itself, not just hidden in the screen design — so it can’t be accidentally exposed by a bug. |
| Permanent record (append-only) | Once written, an entry can never be edited or deleted — only added to. Used for history logs, so nobody can quietly rewrite what happened. |


## 3. What’s Being Built Now vs. Later


The database is designed for the whole product from day one — that avoids painful restructuring later. But we are only building and shipping four modules right now. The rest are already accounted for in the database so nothing has to be redesigned when we get to them, but there’s no working feature for them yet.

> **MVP (building now)**
>
> 1. Authentication & User Management    2. Engineer Profile Management    3. AI-Powered Job Discovery    4. Lead Management

> **Phase 2 (designed into the database, built later)**
>
> 5. Interview Pipeline Tracking    6. Lead Timeline & Activity Log    7. Notifications & Follow-Up Reminders    8. Reporting & Dashboards    9. AI Capabilities (deeper features)



One practical consequence your team should know: in the MVP, a lead’s status will basically show "Applied," "Withdrawn," or "Closed" — the detailed stage-by-stage tracker (Assessment Received, Tech Interview 1, etc.) is Module 5, and comes in Phase 2. Notes, file attachments at each stage, and reminders are also Phase 2. What MVP does give you: the permanent, duplicate-safe record that BD applied, and a running history entry is quietly recorded in the background from day one — so when Phase 2 ships, nothing historical is missing.


## 4. The Database, Table by Table — In Plain Terms



### MVP — Module 1: Authentication & User Management


| Table | What it’s for |
| --- | --- |
| profiles | One row per person who can log in. Holds their name and whether their account is active. Role is stored separately — see below. |
| roles | The editable list of roles (Admin, BD Executive). Per your team’s decision, this is a table instead of being baked into the system’s structure — so a new role can be added later without a developer. |
| user_roles | Which role each person has. Kept as its own table (rather than a single field on profiles) so a person could hold more than one role in the future, and so adding a role never requires a migration. |
| login_history | A permanent log of every time someone signs in — for security visibility, not used for anything user-facing in MVP. |

> **Who creates a BD account, and how**
>
> Only Admin can create a login — there’s no public sign-up. Admin enters the new person’s name, email, and role; the system emails them a secure link to set their own password. Nobody, including Admin, ever sees or sets another person’s password directly.




### MVP — Module 2: Engineer Profile Management


| Table | What it’s for |
| --- | --- |
| engineers | The core record for each engineer — name, contact info, seniority, rate expectations, location, and an active/inactive flag (inactive = hidden from AI job discovery, but nothing about them is deleted). |
| skills | The master list of skills (React, AWS, Node.js, etc.) — an editable list that grows as new skills come up, rather than free-text that gets misspelled inconsistently. |
| engineer_skills | Which skills belong to which engineer — the many-to-many link between the two. |
| seniority_levels | The editable list of seniority tiers (Junior, Mid, Senior, Lead, …) so Admin can add a new tier without a developer. |
| engineer_cvs | Every CV version ever uploaded for an engineer. Old versions are never deleted or overwritten — you get full history, with the current one clearly flagged. |
| engineer_bd_assignments | Who’s currently responsible for which engineer, with a full history of past assignments. This is what makes "reassign an engineer without losing the old BD’s history" work correctly. |
| app_settings | A small settings table for things like the maximum CV file size — so Admin can change the limit without a developer needing to touch code. |


### MVP — Module 3: AI-Powered Job Discovery


| Table | What it’s for |
| --- | --- |
| job_sources | The editable list of job platforms we pull from (Indeed, and later LinkedIn/Wellfound). Adding a new platform later is adding a row, not rebuilding the module. |
| jobs | Every job posting the system has discovered — title, company, description, and the link BD uses to actually apply on the real site. Also records whether it’s remote and, when the description mentions it, which region is eligible (e.g. "US only," "Worldwide") — since you asked for remote-only discovery specifically. |
| job_engineer_matches | The AI’s suggestion: "this job is a good fit for this engineer," with a relevance score so BD can sort best-matches-first. Also records if BD dismissed a suggestion as irrelevant, which feeds the AI’s learning over time. |


### MVP — Module 4: Lead Management


| Table | What it’s for |
| --- | --- |
| leads | The permanent record that "this engineer applied to this job." Once created, it’s never deleted. The database itself blocks submitting the same engineer to the same job twice — unless the earlier attempt was explicitly withdrawn. |

Behind the scenes, two more tables quietly support Lead Management without having a screen of their own yet in MVP:

- lead_event_types / lead_events — every time a lead is created, one entry is automatically logged ("Applied, by so-and-so, at this time"). There’s no timeline screen to browse this yet (that’s Module 6), but the record is being kept from day one so no history is lost when that screen ships.


### Phase 2 — Module 5: Interview Pipeline Tracking (not built yet)


| Table | What it’s for |
| --- | --- |
| pipeline_stages | The editable, ordered list of interview stages (Applied → Assessment → … → Closed). Already created and seeded so the "leads" table has somewhere to point to — but the screen to move a lead between stages, attach notes/files, and set stage-specific reminders is built in Phase 2. |
| lead_files | Where uploaded files (like an assessment document) attached to a lead’s progress will live — table exists, upload screen comes with Module 5. |


### Phase 2 — Module 6: Lead Timeline & Activity Log (not built yet)


Uses the same lead_events table already active in MVP. Phase 2 adds the actual screen to scroll through a lead’s full history — discovered, applied, stage changes, notes, everything, in order, and permanently un-editable.


### Phase 2 — Module 7: Notifications & Follow-Up Reminders (not built yet)


| Table | What it’s for |
| --- | --- |
| lead_reminders | Follow-up reminders tied to a lead, including recurring ones (e.g. "check every Monday"). Table designed now; the reminder-setting screen and the daily check that fires notifications come with Module 7. |
| notifications | The in-app notification inbox (reminder due, lead gone quiet too long, etc.). Same — designed now, built later. |


### Phase 2 — Module 8: Reporting & Dashboards (not built yet)


No new tables needed — dashboards and CSV export are just organized views of data already being collected by Modules 1–4 (and richer once Modules 5–7 add stage/timeline/reminder data).


### Phase 2 — Module 9: AI Capabilities, deeper features (partially built, partially later)


Relevance scoring (Module 3) is MVP and already covered above. The deeper AI features — summarizing long interview notes, suggesting follow-up messages, recommending which CV fits a job best — use small extra fields already included on existing tables (e.g. a "recommended CV" field on job_engineer_matches, an "AI summary" field on lead_events) so no redesign is needed when those features are switched on in Phase 2.


## 5. Questions Your Team Will Likely Ask — Answered in Advance


| Likely question | Short answer |
| --- | --- |
| "Why build tables for features we’re not building yet?" | Because retrofitting the database after real data exists is much more disruptive than designing for it now. We’re not building the Phase 2 screens/logic yet — just making sure the data has somewhere correct to live when we do. |
| "Can two BDs work on the same engineer at once?" | Yes — an engineer can be assigned to more than one BD Executive at a time. Each BD only sees the leads they personally created, though — ownership doesn’t change if the engineer is later reassigned. |
| "What stops duplicate applications?" | The database itself refuses a second active application for the same engineer + same job. It only allows a fresh attempt if the earlier one was explicitly marked "withdrawn." |
| "What happens to CVs when a new one is uploaded?" | Nothing is deleted. Every version is kept; the system just marks the newest as "current" for convenience. |
| "Can Admin see everything?" | Yes, always. BD Executives only see engineers assigned to them and leads they personally created — enforced by the database, not just hidden in the screen. |
| "Why is role a separate table instead of just a field?" | Team decision: it means Admin can add a new role later (e.g. a future "BD Manager") without a developer or deployment, and it leaves room for someone to hold more than one role if that’s ever needed. A field would have worked too for exactly two fixed roles — this was a deliberate choice to build for future flexibility now. |
| "How do we know a remote job is actually open to our engineer’s country?" | Every discovered job gets checked for a region label (e.g. "US only," "Worldwide") read from the description by AI. It’s stored as plain text for now rather than a strict dropdown list, because that source data is often unstructured — we’ll formalize it into a clean list once we’ve seen enough real examples to know the values are consistent. |
| "What if we add a second job platform later (LinkedIn, Wellfound)?" | That’s an additive change — add a row for the new platform and a small connector module. The rest of the system doesn’t need to change. |
