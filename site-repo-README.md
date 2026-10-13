# Wall Street Alpha: public site

The public website, as a Lovable-style TanStack Start project. It has the homepage and every page reachable from it:
- the VSL page and the application (including the DM version and the CV upload)
- the free lecture, its sign-up and ticket pages
- the technicals guide
- the resource library and its 55 guides, which sit behind the Academy paywall
- the job board and the Dean's List
- about, log in, student sign-up, terms and privacy

The community, the free membership and the separate Academy ("Find out more") page are switched off for now.
`/community` redirects to the homepage and `/academy` to the VSL page, there are no "Join free" or "Find out more"
buttons, and create-account only accepts emails Chase has approved. To bring any of them back, set `COMMUNITY`,
`FREE_MEMBERSHIP` or `ACADEMY_PAGE` in `wsa-platform/build.py` and re-export.

The student and coach dashboards are not included. See `WSA-FRONTEND.md` for how the code is organised.

## How the funnel is wired

- Every **Apply** button on the site goes to the VSL page (`/vsl`) first. Only the VSL page links straight to the
  application form (`/apply`), and the form ends with booking the strategy call.
  To change this, edit `APPLY_VIA_VSL` in `wsa-platform/build.py` and re-export.
- The homepage and header buttons all say **Apply now**, and all go to the VSL page.
- The conversion pages (`/vsl`, `/apply`, `/applydm`, `/booked`, `/webinar123`, its sign-up and ticket pages) use the
  stripped-down funnel header with no site navigation.
- Visitors who aren't signed in to the Academy see the paywall on the library, the guides and the job board.

## Not connected yet

- `src/wsa/viewer.ts`: sign-in state and Academy access. Everyone is a signed-out visitor for now.
- `src/wsa/backend.ts`: sign-in, sign-up, the lecture sign-up and the guide opt-in.
  - Sign-in and sign-up say "isn't connected yet".
  - The lecture and guide forms show their confirmation pages but send nothing anywhere.
- `src/wsa/config.ts`: the Youform form IDs. These are Chase's live forms, so anything submitted there is a real lead.

## Run it

```bash
npm install
npm run dev
```

## Push it to GitHub

**Into the GitHub repo connected to your Lovable project** (Lovable then shows it in the editor):

```bash
git clone https://github.com/<you>/<lovable-repo>.git
cd <lovable-repo>
rsync -a --exclude .git /path/to/wsa-site-export/ ./
git add -A
git commit -m "Wall Street Alpha front end"
git push
```

**As a new GitHub repo:**

```bash
cd wsa-site-export
git remote add origin https://github.com/<you>/<new-repo>.git
git push -u origin main
```
