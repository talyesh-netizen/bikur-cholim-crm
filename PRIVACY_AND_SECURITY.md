# Privacy, Security, and Architectural Concerns

_Last updated: 2026-07-27_

This document does two things: (1) explains the protections being built
into the foundation from day one, and (2) is honest about what this
codebase **cannot**, by itself, guarantee. Please read the second part
before anyone enters real resident information.

## What is built in from the start

### 1. Nobody gets in without signing in
Every page that shows real data requires a signed-in session, handled by
Supabase Auth (an established, widely-used authentication service — we
are not writing our own password-handling code, which is exactly the kind
of thing that's easy to get subtly wrong if built from scratch).

### 2. The database itself enforces access rules, not just the app
We are using PostgreSQL's **row-level security** (RLS). In plain terms:
even if there were ever a mistake in the app's own code, the *database*
independently double-checks "is this specific person, right now, actually
allowed to see this specific row?" before handing back any data. This is
a stronger, second layer of protection — not just a single point of
failure in the website's code.

### 3. Two simple roles to start
- **Staff**: can view and edit day-to-day records.
- **Admin**: same as Staff, plus managing who has an account.

This is intentionally simple for Phase One. It is *not* yet a fine-grained
system (e.g., "only this person's assigned facilities"). If that level of
control turns out to matter, it's a natural Phase Two addition on top of
this foundation, not a rebuild.

### 4. A path toward separating "sensitive" notes from general notes
Some fields (like a resident's private internal notes) are treated in the
database as distinct from general/operational fields, so that in a future
phase we could restrict who can read them (e.g., "only Admins can view
private clinical-style notes") without restructuring the whole database.
In Phase One, both roles can see these fields — but the separation exists
so that tightening it later is a small change.

### 5. Data validation
Forms will check that required information is present and reasonably
formatted (e.g., a date field actually contains a date) before saving,
both in the browser and, more importantly, again on the server — because
browser-only checks can be bypassed, so we never rely on them alone.

### 6. Audit-friendly by default
Every record tracks who created it, who last changed it, and when. This
is standard practice for any system handling information about real
people, and it costs nothing to build in from the start versus adding
later.

### 7. Secrets are never stored in the code
Database connection details and any private keys live in environment
variables (a separate configuration mechanism), and are excluded from
Git via `.gitignore`. Nothing sensitive is ever typed directly into a
source code file that gets committed to version control.

### 8. No public access to resident records
There is no "public" or "family login" surface in Phase One at all. The
only way to reach any resident data is to be a signed-in staff/admin
account.

### 9. Only fictional data during development
The demonstration data shipped with Phase One is entirely invented. This
is both a privacy precaution and a practical one — it means the app can
be shown, tested, and even temporarily deployed for review without any
real person's information ever being at risk.

## What this foundation does *not* do — and what to do about it

I want to be direct about this rather than vague: **I am not a lawyer or a
compliance officer, and this codebase is not a certification of legal
compliance with any law** (HIPAA, Ohio state privacy law, or otherwise).
Several things commonly required for handling real health/social-services
information about identifiable people are **not** part of Phase One and
should be addressed before real resident data is entered:

- **A real compliance review.** Depending on exactly what information is
  stored and how the department operates (e.g., whether this counts as
  "protected health information" under HIPAA in your specific
  organizational context), you may need a formal HIPAA risk assessment,
  a Business Associate Agreement with Supabase (or whichever hosting
  provider is ultimately used), and a written data handling policy. This
  requires a professional familiar with healthcare/social-services
  privacy law — not a default we can bake into the code.
- **Encryption and backup policy review.** Supabase encrypts data at rest
  and in transit by default, but *retention*, *backup*, and *breach
  notification* policies need to be deliberately reviewed and documented
  by someone responsible for compliance, not assumed.
- **A real access policy, in writing.** Who, specifically, should have
  Admin vs. Staff access; what happens when someone leaves the
  organization; how often access is reviewed. The software can enforce
  whatever policy you set — but the policy itself needs to be decided by
  the department, not invented by the software.
- **Logging and monitoring for a production system.** Phase One tracks
  who changed what record in the *data itself* (audit timestamps), but a
  production deployment handling real sensitive data would benefit from
  additional infrastructure-level monitoring (e.g., alerting on unusual
  access patterns) that is beyond a Phase One CRM foundation.
- **A real incident response plan.** What the department would actually
  do if a laptop were lost, a password compromised, or an account
  misused — this is an organizational policy question, not something the
  code can supply.
- **Penetration testing / independent security review** before real
  sensitive data goes in, especially once the app is deployed somewhere
  publicly reachable (even behind a login).

**Bottom line:** this foundation is built the *right way* — secure
authentication, database-enforced access rules, no secrets in code, audit
trails, and no public access — but "built the right way" is not the same
as "reviewed and approved by a compliance professional for real resident
data." Please treat the fictional-data-only state of this app as the
default until that review happens, and loop in whoever handles
compliance/IT policy for the organization before that changes.

## A note on architecture-level concerns (non-privacy)

- **Single Supabase project for now.** Phase One assumes one database
  environment. As the app matures, a separate "test" vs. "real" database
  environment is worth setting up so that new features can be tried
  safely without any risk to real data — another natural Phase Two step.
- **No offline support.** Phase One assumes staff have an internet
  connection while using the app (normal for a phone/laptop web app).
  Offline visit-logging (e.g., in a facility with poor signal) is not
  in scope for Phase One but is worth knowing about if it comes up.
