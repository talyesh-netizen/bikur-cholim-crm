# Notes for Claude

The product owner is the department director, who is not technical.
Explain things in plain English, one topic at a time, and send
screenshots for anything visual.

## Merging pull requests (standing permission from the director, Sept 2026)

Claude may merge its own pull requests into `main` **without asking
first** when the change is a *small fix*, and must tell the director
afterwards what went live.

Small fix (merge yourself):
- bug fixes and corrections to wording or spelling
- small adjustments to something the director already approved
  (spacing, a wrong link, a mislabeled button)
- fixes the director or a reviewer asked for

Still ask first:
- new features, or anything that changes how the app looks
- anything that changes what is saved or who can see what (database
  migrations, access/RLS rules, privacy, what is sent to outside
  services)
- anything that deletes data

Before any merge: `npx tsc --noEmit`, `npm run lint` and `npm run build`
must pass, and the Vercel check on the pull request must be green.

## Other context

- Live site deploys from lowercase `main` (see `LAUNCH_READINESS.md`).
- Real resident data is in production; see `PRIVACY_AND_SECURITY.md`
  before sending any data anywhere new.
