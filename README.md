# Wall Street Alpha: preview build

A working mockup of the new wallstalpha.com. It has every page on the current Lovable site at the same address, the new platform pages (community and membership, both switched off for now), and a working copy of the Lovable dashboard's student and coach portals running on a mock database.

- **Review link:** https://withfulcrum.tech/wsa-preview-d45eb9/ (noindex)
- **Build:** `python3 build.py --base /wsa-preview-d45eb9/` writes `dist/`.
- **Preview locally:** `python3 serve.py 4176`, then open http://localhost:4176/wsa-preview-d45eb9/.
- **Redeploy:** `./deploy.sh`

## Where things live

| File | What it holds |
| --- | --- |
| `build.py` | Shared header, footer and layout; every public page; resource and job data |
| `pages_app.py` | Login and sign-up flows; the portal page shells (`/dashboard/*`, `/coach/*`) with the same navigation as the Lovable `DashboardApp.tsx`; lecture reporting |
| `src/db.js` | The mock database: profiles and roles, approved emails, programs, enrollments, check-ins, modules, networking, opportunities, coaching notes, payments, calendar and the Deal Desk. Module data from `data/modules.json` is injected at build time. |
| `src/app.js` | Renders every portal screen from the mock database, with working actions |
| `src/site.js`, `src/site.css` | Shared behaviour (sign-in, guards, public pages) and styles |
| `assets/resources/` | The 55 guide PDFs, copied from the Lovable CDN (in the Lovable repo they are only `src/assets/*.pdf.asset.json` pointers), plus `thumbs/` first-page covers made with `sips`. Page counts are read from the PDFs at build time. |
| `data/modules.json` | The 36 real module titles and section headings from `supabase/module-sections.json`, cut to excerpts so Chase's paid content isn't published |

## Roles, as in the Lovable app

| Role | Who | Sees |
| --- | --- | --- |
| admin | Chase (and Amber in the live app) | Everything: Programs, Modules, Coaches, approving emails, deleting students |
| Deal Desk | Chase's account only | The Deal Desk. The live app hard-codes `chase.enloe@gmail.com` in SQL and TypeScript. |
| coach | Emails Chase adds on the Coaches screen | Today, Students, Calls, Contacts, Events, Opportunities, Calendar and Resources, scoped to the students assigned to them |
| student | Emails on `approved_emails` | The student portal, the resource library and the job board |
| member | Anyone else who signs up (new in this build) | The community and free lectures. No portal and no 1:1. |

Preview logins (any password) are listed on `/login`:

- `student@wallstalpha.com`
- `member@wallstalpha.com`
- `coach@wallstalpha.com`
- `chase@wallstalpha.com`

Two emails are already approved, so the sign-up flow can be tested: `new.student@wallstalpha.com` (12-week program) and `new.coach@wallstalpha.com`. Each browser keeps its own copy of the data, and "Reset demo data" in the portal sidebar puts it back.

## What is simulated

Everything below except the application forms happens in the browser only (localStorage).

| Flow | In the preview | At go-live |
| --- | --- | --- |
| Accounts and roles | `db.js` profiles; RLS is mimicked by `visibleStudents()` | Supabase Auth and `profiles.role` on project `iujstwnbepisgixefser`. Add the new domain to the Auth redirect URLs. |
| Create account | Approved email becomes a student (auto-enrolled) or a coach; any other email becomes a member | Keep `is_email_approved()` and `handle_new_user()`. Add a `member` role and a signup path that skips approval. |
| AI call write-ups, notes summaries | Canned summaries built from the text you type or paste | The existing `askJson` and Claude Haiku pipeline |
| Google Calendar | A "connected" flag and sample events | The existing read-only OAuth sync |
| Application (`/apply`, `/applydm`) and CV upload (`/booked`) | **Live**, not simulated: the real Youform forms `5hers03e`, `2icrdiql` and `juj0batp`, embedded the way Lovable does it, with UTMs passed as hidden fields. Submissions are real leads and fire the partial-submission webhook, the Zaps and the Calendly step. | Nothing to change |
| Lecture sign-up (`/webinar123/register`) | Fake ticket at `/webinar-registered` | Same as Lovable: Zapier hook `hooks.zapier.com/hooks/catch/28895668/4mgy91c/`, plus wallet `/claim` with `rid` |
| Deadline reminder emails | Counts what would send; nothing is emailed | Resend gateway plus the daily `pg_cron` job |

**Adding forum members safely.** Every student-scoped RLS policy that checks only "is authenticated" would let a member read student data. That needs to be checked before the member role ships. Policies that match on `student_id = auth.uid()` or `is_admin()` are already safe.

## Paywall: what has to happen server-side

On the live Lovable site, neither of these is protected today:

1. **PDFs** are public files on Lovable's CDN (`wallstalpha.com/__l5e/assets-v1/...`). Anyone with a link can open them. The preview copies sit in `assets/resources/` and are just as public.
   - Move them to a private Supabase Storage bucket.
   - Only hand out short-lived signed URLs (`createSignedUrl`) to signed-in Academy users. A storage RLS policy should check membership.
2. **The job board** reads the `listings` table with the public anon key. Anyone can query it directly, whatever the page shows.
   - Change the RLS on `listings` to require an authenticated Academy member.

## Issues found on the live Lovable site

- **Job board misfiling:** the "Internships" and "Insight" filters classify by substring.
  - "Internal Audit Director" and "International ..." roles count as internships.
  - "Insider Risk" and "Insights" roles count as insight programs.
  - The classifier needs word boundaries.
- **Yahoo calendar link:** the lecture's Yahoo link starts the event at 21 Oct 00:00 UTC, not 24 Oct 18:00 UTC. The preview uses the corrected time.
- **Form typo:** the application form says "descision".
- **Placement count:** the lecture page says 240+; elsewhere it's 250+. The preview uses 250+.
- **Age conflict:** the Terms and Privacy Policy say users must be 18+, but the lecture targets under-21s and freshmen.
- **"Firms I've worked with" list** (on `/vsl`): it includes Blackstone. Chase's firm was an LP relationship, not employment. The preview leaves Blackstone out of his history and lists it only as a student placement.

## Setting up on a new machine

The site generator only needs Python 3 (no packages). The export to Lovable also uses Node.

```bash
git clone https://github.com/<you>/wsa-platform.git
cd wsa-platform
python3 build.py --base /wsa-preview-d45eb9/   # writes dist/
python3 serve.py 4176                            # http://localhost:4176/wsa-preview-d45eb9/
```

- **Redeploy the review site** with `./deploy.sh`. It pushes `dist/` to the VPS over SSH as root@85.31.237.84, so the new
  machine's SSH key has to be on the VPS first (`ssh-copy-id root@85.31.237.84` from a machine that already has access).
- **Rebuild the GitHub-ready front end** with `./export_site_repo.sh`. It writes `../wsa-site-export/` and
  `../wsa-site-export.zip`. It only test-builds when it finds `../wsa-lovable/node_modules`; on a fresh machine, run
  `npm install && npm run build` inside `wsa-site-export` to check it.
- **What's not in the repo:** `dist/` and `handoff/` are generated, so rebuild them. The 55 guide PDFs in
  `assets/resources/` are Chase's paid material, so keep this repository private.
