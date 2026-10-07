/**
 * Field scenarios for Quick Log: the notes staff actually say, run
 * through the real instructions, answer check and review step.
 *
 *   npx tsx scripts/quick-log-scenarios.ts prompts <dir>   writes the exact
 *     request Claude gets for each scenario (instructions, directory,
 *     calendar, note) to <dir>/case-N.txt
 *   npx tsx scripts/quick-log-scenarios.ts check <dir>     reads Claude's
 *     answers from <dir>/answer-N.json, runs them through the same answer
 *     check and record matching as the app, prints what the review screen
 *     would list and checks it against what the note supports
 *   npx tsx scripts/quick-log-scenarios.ts guards         the safety
 *     checks that don't depend on Claude (double facility visits, future
 *     dates)
 *
 * The directory is made up (no real residents), but copies the real
 * ambiguity: several Lisas, two Ilenes, two "Anna Maria"s, and a Jay
 * whose whereabouts are unknown. "Now" is fixed at Wednesday 7 Oct 2026,
 * 2:30pm, so last Thursday = Oct 1, Monday = Oct 5, next week = Oct 14.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadDirectory, type Directory } from "@/lib/assistant/directory";
import { SYSTEM_PROMPT, OUTPUT_INSTRUCTIONS, buildUserMessage } from "@/lib/assistant/prompt";
import { parsePlanText, type ModelPlan, type Plan } from "@/lib/assistant/schema";
import { resolvePlan } from "@/lib/assistant/resolve";

const NOW = "2026-10-07T14:30";

let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

const F = {
  annaMaria: { id: id(), name: "Anna Maria of Aurora", city: "Aurora", active: true, notes: null },
  atrium: { id: id(), name: "The Atrium at Anna Maria (Aurora)", city: "Aurora", active: true, notes: null },
  ashton: { id: id(), name: "The Ashton at Mayfield Heights", city: "Mayfield Heights", active: true, notes: null },
  judson: { id: id(), name: "Judson Manor", city: "Cleveland", active: true, notes: null },
  beachwood: { id: id(), name: "Beachwood Pointe Care Center", city: "Beachwood", active: true, notes: null },
  eliza: { id: id(), name: "Eliza Jennings Health Campus", city: "Lakewood", active: true, notes: null },
  menorah: { id: id(), name: "Menorah Park", city: "Beachwood", active: true, notes: null },
};
const resident = (first: string, last: string, facility: { id: string } | null, room: string | null, status = "active") => ({
  id: id(),
  first_name: first,
  last_name: last,
  preferred_name: null,
  current_facility_id: facility?.id ?? null,
  room_number: room,
  status,
});
const R = {
  ileneAM: resident("Ilene", "Sandler", F.annaMaria, "108"),
  norma: resident("Norma", "Pinsky", F.annaMaria, "121"),
  ileneAshton: resident("Ilene", "Marcus", F.ashton, null),
  jay: resident("Jay", "Dreyfus", null, null, "location_unknown"),
  alan: resident("Alan", "Cohen", F.judson, "3B"),
  judy: resident("Judy", "Cohen", F.judson, null),
  rivka: resident("Rivka", "Gold", F.menorah, "212"),
};
const contact = (name: string, type: string) => ({ id: id(), name, contact_type: type, organization: null, active: true });
const C = {
  lisaAM: contact("Lisa McKay", "facility_staff"),
  lisaB: contact("Lisa Hart", "facility_staff"),
  lisaE: contact("Lisa Fenn", "facility_staff"),
  lisaFam: contact("Lisa Zeller", "family_member"),
};
const SELF = { id: id(), full_name: "Tzvi Alyesh" };
const SARA = { id: id(), full_name: "Sara Klein" };

const TABLES: Record<string, unknown[]> = {
  facilities: Object.values(F),
  residents: Object.values(R),
  contacts: Object.values(C),
  resident_contacts: [{ resident_id: R.judy.id, contact_id: C.lisaFam.id, relationship_to_resident: "daughter" }],
  facility_contacts: [
    { facility_id: F.annaMaria.id, contact_id: C.lisaAM.id, role_at_facility: "Activities Director" },
    { facility_id: F.beachwood.id, contact_id: C.lisaB.id, role_at_facility: "Activity Director" },
    { facility_id: F.eliza.id, contact_id: C.lisaE.id, role_at_facility: "Executive Director" },
  ],
  profiles: [SELF, SARA],
};

/** Just enough of the Supabase client for loadDirectory's reads. */
const fakeSupabase = {
  from(table: string) {
    const result = { data: TABLES[table] ?? [], error: null };
    const builder = {
      select: () => builder,
      order: () => builder,
      eq: () => builder,
      then: (resolve: (value: typeof result) => unknown) => resolve(result),
    };
    return builder;
  },
};

type Check = [string, boolean];
type Scenario = { note: string; expect: string; checks: (plan: Plan, questions: string[]) => Check[] };

const dates = (plan: Plan) => plan.interactions.map((x) => x.occurred_at.slice(0, 10));
const none = (plan: Plan, ...sections: (keyof Plan)[]) =>
  sections.every((s) => (plan[s] as unknown[]).length === 0);
const noFacilityVisit = (plan: Plan): Check => [
  "no extra facility visit",
  !plan.interactions.some((x) => x.interaction_type === "facility_visit"),
];

const SCENARIOS: Scenario[] = [
  {
    note: "Remind me to call Lisa next week about Chanukah.",
    expect: "Task only.",
    checks: (plan, q) => [
      ["exactly one task", plan.tasks.length === 1],
      ["no interaction", plan.interactions.length === 0],
      ["nothing else", none(plan, "new_residents", "new_contacts", "resident_updates", "profile_notes", "transfers")],
      ["due next week (Oct 14)", plan.tasks[0]?.due_date === "2026-10-14"],
      ["four Lisas: doesn't guess which one (or asks)", !plan.tasks[0]?.contact || q.some((x) => /lisa/i.test(x))],
    ],
  },
  {
    note: "Ilene moved to room 214.",
    expect: "Resident update only.",
    checks: (plan, q) => [
      ["no interaction", plan.interactions.length === 0],
      ["no task", plan.tasks.length === 0],
      ["no new resident", plan.new_residents.length === 0],
      [
        "room 214 proposed, or which-Ilene asked",
        plan.resident_updates.some((u) => u.room_number === "214") || q.some((x) => /ilene/i.test(x)),
      ],
      [
        "two Ilenes: doesn't pick one silently",
        plan.resident_updates.length === 0 || q.some((x) => /ilene/i.test(x)),
      ],
    ],
  },
  {
    note: "I need to find out where Jay moved.",
    expect: "Follow-up task only.",
    checks: (plan) => [
      ["exactly one task", plan.tasks.length === 1],
      ["task is about Jay", plan.tasks[0]?.resident === R.jay.id || /jay/i.test(plan.tasks[0]?.title ?? "")],
      ["no interaction", plan.interactions.length === 0],
      ["no transfer or status change", none(plan, "transfers", "resident_updates")],
    ],
  },
  {
    note: "New resident David Cohen at Anna Maria room 214. He would love visitors.",
    expect: "New resident with room and visiting preference; no interaction.",
    checks: (plan) => [
      ["one new resident", plan.new_residents.length === 1],
      ["at Anna Maria of Aurora, room 214", plan.new_residents[0]?.facility === F.annaMaria.id && plan.new_residents[0]?.room_number === "214"],
      ["visiting preference kept", /visit/i.test(plan.new_residents[0]?.visitation_needs ?? "") || plan.profile_notes.some((p) => /visit/i.test(p.note))],
      ["no interaction", plan.interactions.length === 0],
      ["no task", plan.tasks.length === 0],
    ],
  },
  {
    note: "Last Thursday I visited Ilene at Anna Maria for about 20 minutes. She was doing well.",
    expect: "One past visit with Ilene, dated last Thursday (Oct 1).",
    checks: (plan) => [
      ["one interaction", plan.interactions.length === 1],
      ["resident visit with the Anna Maria Ilene", plan.interactions[0]?.interaction_type === "resident_visit" && plan.interactions[0]?.resident === R.ileneAM.id],
      ["dated Thu Oct 1", dates(plan)[0] === "2026-10-01"],
      ["20 minutes", plan.interactions[0]?.minutes_spent === 20],
      ["no task", plan.tasks.length === 0],
      noFacilityVisit(plan),
    ],
  },
  {
    note: "Catching up from Monday. I visited Ilene at Anna Maria for 20 minutes, then saw Norma for about 15 minutes. I also spoke with Lisa about the upcoming program.",
    expect: "Three separate entries, all Monday (Oct 5).",
    checks: (plan) => [
      ["three interactions", plan.interactions.length === 3],
      ["all dated Mon Oct 5", plan.interactions.length > 0 && dates(plan).every((d) => d === "2026-10-05")],
      ["Ilene visit 20 min", plan.interactions.some((x) => x.resident === R.ileneAM.id && x.minutes_spent === 20)],
      ["Norma visit 15 min", plan.interactions.some((x) => x.resident === R.norma.id && x.minutes_spent === 15)],
      ["Lisa = Anna Maria's activities director", plan.interactions.some((x) => x.contact === C.lisaAM.id)],
      ["no task", plan.tasks.length === 0],
      noFacilityVisit(plan),
    ],
  },
  {
    note: "Just left Anna Maria. Saw Ilene and she is doing well. Met a new resident David Cohen in room 214 who would love visitors. Lisa asked about doing something for Chanukah and I need to follow up with her next week.",
    expect: "Ilene visit, new resident David + his visit, Lisa conversation, follow-up task with Lisa.",
    checks: (plan) => [
      ["Ilene visit today", plan.interactions.some((x) => x.resident === R.ileneAM.id && x.occurred_at.startsWith("2026-10-07"))],
      ["new resident David Cohen, room 214", plan.new_residents.some((r) => r.last_name === "Cohen" && r.room_number === "214")],
      ["David's visit logged (he was met)", plan.interactions.some((x) => x.resident === "new:" + plan.new_residents[0]?.key)],
      ["visiting preference kept", plan.new_residents.some((r) => /visit/i.test(r.visitation_needs ?? "")) || plan.profile_notes.some((p) => /visit/i.test(p.note))],
      ["task with Lisa due Oct 14", plan.tasks.some((t) => t.contact === C.lisaAM.id && t.due_date === "2026-10-14")],
      ["only one task", plan.tasks.length === 1],
      ["all entries today", dates(plan).every((d) => d === "2026-10-07")],
      noFacilityVisit(plan),
    ],
  },
  {
    // Director, Oct 7: meetings with volunteers (recruiting, check-ins)
    // are their own kind of entry, not a volunteer visit.
    note: "Met with Lisa Fenn today about volunteering on Sundays.",
    expect: "One volunteer meeting -- not a volunteer visit, no task.",
    checks: (plan) => [
      ["one volunteer meeting", plan.interactions.length === 1 && plan.interactions[0].interaction_type === "volunteer_meeting"],
      ["no task", plan.tasks.length === 0],
    ],
  },
  {
    // Director, Oct 7: when family is there, the family member is the one
    // supported -- a separate family entry, not just a name on the visit.
    note: "Visited Norma at Anna Maria today with her husband Sam, we talked for a while. Ilene is married to Phil.",
    expect: "Norma's visit plus a family entry for Sam; nothing for Phil (only mentioned).",
    checks: (plan) => [
      ["Norma visit", plan.interactions.some((x) => x.interaction_type === "resident_visit" && x.resident === R.norma.id)],
      ["family entry for Sam, about Norma", plan.interactions.some((x) => x.interaction_type === "family_communication" && x.resident === R.norma.id && !!x.contact)],
      ["no entry about Ilene", !plan.interactions.some((x) => x.resident === R.ileneAM.id)],
      noFacilityVisit(plan),
    ],
  },
];

async function directory(): Promise<Directory> {
  return loadDirectory(fakeSupabase as never, SELF.id);
}

function describe(plan: Plan, names: Record<string, string>) {
  const nm = (ref: string | null) => (ref ? names[ref] ?? ref : null);
  const out: string[] = [];
  for (const f of plan.new_facilities) out.push(`+ New facility: ${f.name}`);
  for (const r of plan.new_residents) {
    out.push(`+ New resident: ${[r.first_name, r.last_name].filter(Boolean).join(" ")} at ${nm(r.facility)}${r.room_number ? `, room ${r.room_number}` : ""}${r.visitation_needs ? ` | visiting: ${r.visitation_needs}` : ""}`);
  }
  for (const c of plan.new_contacts) out.push(`+ New contact: ${c.name} (${c.contact_type})`);
  for (const u of plan.resident_updates) {
    const changes = Object.entries(u).filter(([k, v]) => k !== "resident" && v).map(([k, v]) => `${k}=${v}`);
    out.push(`~ Update ${nm(u.resident)}: ${changes.join(", ")}`);
  }
  for (const t of plan.transfers) out.push(`~ Move ${nm(t.resident)} to ${nm(t.new_facility)}`);
  for (const u of plan.facility_updates) out.push(`~ Update facility ${nm(u.facility)}`);
  for (const p of plan.profile_notes) out.push(`# Profile note for ${nm(p.resident) ?? nm(p.facility)}: ${p.note}`);
  for (const x of plan.interactions) {
    out.push(
      `* Log ${x.interaction_type} ${x.occurred_at.replace("T", " ")}${x.date_unclear ? ` [CHECK DATE: ${x.date_unclear}]` : ""}: ${[nm(x.resident), x.contact && `with ${nm(x.contact)}`, x.facility && `at ${nm(x.facility)}`].filter(Boolean).join(" ")}${x.minutes_spent ? `, ${x.minutes_spent} min` : ""}${x.notes ? ` -- ${x.notes}` : ""}`
    );
  }
  for (const t of plan.tasks) {
    out.push(`! Task: ${t.title} (due ${t.due_date ?? "-"}${t.contact ? `, with ${nm(t.contact)}` : ""}${t.resident ? `, ${nm(t.resident)}` : ""}${t.facility ? `, ${nm(t.facility)}` : ""})`);
  }
  return out;
}

async function writePrompts(dir: string) {
  mkdirSync(dir, { recursive: true });
  const d = await directory();
  SCENARIOS.forEach((s, i) => {
    const text = [
      "=== SYSTEM ===",
      SYSTEM_PROMPT,
      OUTPUT_INSTRUCTIONS,
      `DIRECTORY\n\n${d.text}`,
      "=== USER ===",
      buildUserMessage({ now: NOW, selfAlias: d.selfAlias, note: s.note }),
    ].join("\n\n");
    writeFileSync(join(dir, `case-${i + 1}.txt`), text);
  });
  console.log(`Wrote ${SCENARIOS.length} prompts to ${dir}`);
}

async function checkAnswers(dir: string) {
  const d = await directory();
  let failed = 0;
  for (const [i, s] of SCENARIOS.entries()) {
    console.log(`\n=== ${i + 1}. "${s.note}"\nExpected: ${s.expect}`);
    let text: string;
    try {
      text = readFileSync(join(dir, `answer-${i + 1}.json`), "utf8");
    } catch {
      console.log("  (no answer file)");
      failed++;
      continue;
    }
    const parsed = parsePlanText(text);
    if ("problem" in parsed) {
      console.log(`  ANSWER REJECTED: ${parsed.problem}`);
      failed++;
      continue;
    }
    const { plan, names, matches } = resolvePlan(parsed.plan as ModelPlan, d);
    console.log(`Summary: ${plan.summary}`);
    for (const line of describe(plan, names)) console.log(`  ${line}`);
    for (const q of plan.questions) console.log(`  ? ${q}`);
    for (const [key, list] of Object.entries(matches)) console.log(`  ?? ${key} may be: ${list.map((m) => m.name).join(", ")}`);
    for (const [label, ok] of s.checks(plan, plan.questions)) {
      if (!ok) failed++;
      console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
    }
  }
  console.log(`\n${failed === 0 ? "All checks passed." : `${failed} check(s) failed.`}`);
  process.exitCode = failed ? 1 : 0;
}

/** Checks that run after Claude answers, whatever it answered. */
async function guards() {
  const d = await directory();
  const alias = (realId: string) => [...d.idFor.entries()].find(([, v]) => v === realId)![0];
  const blank = {
    date_unclear: null, contact: null, volunteers: [], also_by: [], notes: null, minutes_spent: null,
    people_reached: null, holiday: null, family_need: null,
  };
  const model: ModelPlan = {
    summary: "test",
    new_facilities: [], new_residents: [], new_contacts: [], resident_updates: [], transfers: [],
    facility_updates: [], profile_notes: [], tasks: [], questions: [],
    interactions: [
      { ...blank, interaction_type: "resident_visit", occurred_at: "2026-10-05T12:00", facility: alias(F.annaMaria.id), resident: alias(R.ileneAM.id) },
      // Same facility, same day: already counted by the visit above.
      { ...blank, interaction_type: "facility_visit", occurred_at: "2026-10-05T12:00", facility: alias(F.annaMaria.id), resident: null },
      // A different facility: a real facility visit, kept.
      { ...blank, interaction_type: "facility_visit", occurred_at: "2026-10-05T15:00", facility: alias(F.menorah.id), resident: null },
      // Next year: can't have happened yet.
      { ...blank, interaction_type: "resident_visit", occurred_at: "2027-10-05T12:00", facility: alias(F.annaMaria.id), resident: alias(R.norma.id) },
    ],
  };
  const { plan } = resolvePlan(model, d);
  const results: Check[] = [
    ["double facility visit dropped", plan.interactions.filter((x) => x.interaction_type === "facility_visit").length === 1],
    ["the other facility's visit kept", plan.interactions.some((x) => x.interaction_type === "facility_visit" && x.facility === F.menorah.id)],
    ["dropping it is explained", plan.questions.some((q) => /already count/.test(q))],
    ["future date flagged for checking", !!plan.interactions.find((x) => x.resident === R.norma.id)?.date_unclear],
    ["past date not flagged", !plan.interactions.find((x) => x.resident === R.ileneAM.id)?.date_unclear],
  ];
  for (const [label, ok] of results) console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  process.exitCode = results.every(([, ok]) => ok) ? 0 : 1;
}

const [mode, dir] = process.argv.slice(2);
if (mode === "prompts" && dir) void writePrompts(dir);
else if (mode === "check" && dir) void checkAnswers(dir);
else if (mode === "guards") void guards();
else console.log("Usage: quick-log-scenarios.ts prompts <dir> | check <dir> | guards");
