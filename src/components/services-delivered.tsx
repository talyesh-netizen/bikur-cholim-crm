import type { ServicesDelivered } from "@/lib/queries/impact";
import { labelFor, UNMET_NEED_REASONS } from "@/lib/domain/interaction";
import { cn } from "@/lib/utils";
import {
  UserCheck,
  Utensils,
  HeartHandshake,
  School,
  Stethoscope,
  Car,
  Compass,
  HandHelping,
  CalendarHeart,
  type LucideIcon,
} from "lucide-react";

const n = (value: number) => value.toLocaleString("en-US");

function Tile({
  icon: Icon,
  title,
  value,
  unit,
  details,
  tone = "default",
}: {
  icon: LucideIcon;
  title: string;
  value: number;
  unit: string;
  details: (string | null)[];
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-3",
        tone === "warning" ? "border-warning/40 bg-warning/5" : "border-border"
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-4" />
        {title}
      </div>
      <p className="text-2xl font-semibold leading-none">
        {n(value)} <span className="text-sm font-normal text-muted-foreground">{unit}</span>
      </p>
      {details
        .filter((d): d is string => d !== null)
        .map((d) => (
          <p key={d} className="text-xs text-muted-foreground">
            {d}
          </p>
        ))}
    </div>
  );
}

function HeadlineTile({
  icon: Icon,
  title,
  explainer,
  value,
  unit,
  details,
}: {
  icon: LucideIcon;
  title: string;
  explainer: string;
  value: number;
  unit: string;
  details: (string | null)[];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
        <Icon className="size-5 text-primary" />
        {title}
      </div>
      <p className="text-sm text-muted-foreground">{explainer}</p>
      <p className="text-4xl font-semibold leading-none">
        {n(value)} <span className="text-base font-normal text-muted-foreground">{unit}</span>
      </p>
      <ul className="flex flex-col gap-0.5 text-sm">
        {details
          .filter((d): d is string => d !== null)
          .map((d) => (
            <li key={d}>{d}</li>
          ))}
      </ul>
    </div>
  );
}

/** The two headline numbers at the top of the Impact card: one-on-one
 * visits and calls, and programs the department ran or hosted. Each
 * says in a line exactly what it counts, so a funder (or the director)
 * never has to guess what a number is made of. */
export function HeadlineImpactTiles({ services }: { services: ServicesDelivered }) {
  const { oneOnOne, programs } = services;
  const otherStaff = oneOnOne.byYou === null ? null : oneOnOne.byStaff - oneOnOne.byYou;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <HeadlineTile
        icon={UserCheck}
        title="One-on-one visits"
        explainer="Visits and phone calls with one named resident. Each resident is counted once, however often we saw them."
        value={oneOnOne.residents}
        unit={oneOnOne.residents === 1 ? "resident" : "different residents"}
        details={[
          `${n(oneOnOne.contacts)} visits & calls in all${
            oneOnOne.facilities > 0 ? `, at ${n(oneOnOne.facilities)} ${oneOnOne.facilities === 1 ? "facility" : "facilities"}` : ""
          }`,
          oneOnOne.byYou !== null
            ? `By you personally: ${n(oneOnOne.byYou)}`
            : `By staff: ${n(oneOnOne.byStaff)}`,
          otherStaff !== null && otherStaff > 0 ? `By other staff: ${n(otherStaff)}` : null,
          `By volunteers: ${n(oneOnOne.byVolunteers)}`,
          oneOnOne.groupVisits > 0
            ? `Also ${n(oneOnOne.groupVisits)} group ${oneOnOne.groupVisits === 1 ? "visit" : "visits"} (~${n(oneOnOne.groupAttendance)} people, not in the count above)`
            : null,
        ]}
      />
      <HeadlineTile
        icon={CalendarHeart}
        title="Programs we ran or hosted"
        explainer="Holiday programs, events and school & shul programs. Attendance is what was typed in: someone at 3 programs counts 3 times."
        value={programs.programs}
        unit={programs.programs === 1 ? "program" : "programs"}
        details={[
          programs.facilities > 0
            ? `At ${n(programs.facilities)} ${programs.facilities === 1 ? "facility" : "facilities"}`
            : null,
          programs.attendance > 0 ? `~${n(programs.attendance)} total attendance` : null,
          programs.withoutAttendance > 0
            ? `${n(programs.withoutAttendance)} ${programs.withoutAttendance === 1 ? "program has" : "programs have"} no attendance entered`
            : null,
        ]}
      />
    </div>
  );
}

/** The funder-facing "what we did beyond our own visits" tiles on the
 * dashboard -- the same numbers the impact export's "Services
 * delivered" section carries. Detail lines only appear once there's
 * something to say, so an empty month doesn't read as a wall of zeros. */
export function ServicesDeliveredTiles({
  services,
  periodLabel,
  hideEmpty = false,
}: {
  services: ServicesDelivered;
  periodLabel: string;
  /** Leave out tiles whose number is zero (used on facility pages,
   * where most services won't apply to any one facility). */
  hideEmpty?: boolean;
}) {
  const { food, volunteers, schoolShul, careNavigation, unmetNeed } = services;
  const show = (value: number) => !hideEmpty || value > 0;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {show(food.deliveries) ? (
      <Tile
        icon={Utensils}
        title="Food deliveries"
        value={food.deliveries}
        unit={food.deliveries === 1 ? "delivery" : "deliveries"}
        details={[
          food.items > 0 ? `${n(food.items)} items delivered` : null,
          food.peopleReached > 0 ? `~${n(food.peopleReached)} residents reached` : null,
          food.byOccasion.shabbos + food.byOccasion.yomTov > 0
            ? `Shabbos: ${n(food.byOccasion.shabbos)} · Yom Tov: ${n(food.byOccasion.yomTov)}`
            : null,
        ]}
      />
      ) : null}
      {show(volunteers.visits) ? (
      <Tile
        icon={HeartHandshake}
        title={`Volunteer impact · ${periodLabel}`}
        value={volunteers.visits}
        unit={volunteers.visits === 1 ? "visit" : "visits"}
        details={[
          volunteers.volunteers > 0 ? `${n(volunteers.volunteers)} volunteers` : null,
          volunteers.hours > 0 ? `${n(volunteers.hours)} volunteer hours` : null,
          volunteers.residentsVisited > 0 ? `${n(volunteers.residentsVisited)} residents visited` : null,
        ]}
      />
      ) : null}
      {show(schoolShul.programs) ? (
      <Tile
        icon={School}
        title="School & shul programs"
        value={schoolShul.programs}
        unit={schoolShul.programs === 1 ? "program" : "programs"}
        details={[
          schoolShul.programs > 0 ? `School: ${n(schoolShul.school)} · Shul: ${n(schoolShul.shul)}` : null,
          schoolShul.participants > 0 ? `${n(schoolShul.participants)} students / members took part` : null,
          schoolShul.peopleReached > 0 ? `~${n(schoolShul.peopleReached)} residents reached` : null,
        ]}
      />
      ) : null}
      {show(services.medicalReferrals) ? (
      <Tile
        icon={Stethoscope}
        title="Medical referrals"
        value={services.medicalReferrals}
        unit={services.medicalReferrals === 1 ? "referral" : "referrals"}
        details={["To the Bikur Cholim medical referral team"]}
      />
      ) : null}
      {show(services.rides) ? (
      <Tile
        icon={Car}
        title="Rides arranged"
        value={services.rides}
        unit={services.rides === 1 ? "ride" : "rides"}
        details={["Through Bikur Cholim rides"]}
      />
      ) : null}
      {show(careNavigation.families) ? (
      <Tile
        icon={Compass}
        title="Care navigation"
        value={careNavigation.families}
        unit={careNavigation.families === 1 ? "family helped" : "families helped"}
        details={[careNavigation.hours > 0 ? `${n(careNavigation.hours)} hours spent` : null]}
      />
      ) : null}
      {show(unmetNeed.total) ? (
      <Tile
        icon={HandHelping}
        title="Need we couldn't meet"
        value={unmetNeed.total}
        unit={unmetNeed.total === 1 ? "request" : "requests"}
        tone={unmetNeed.total > 0 ? "warning" : "default"}
        details={unmetNeed.byReason.map(
          (r) =>
            `${r.reason === "unspecified" ? "Reason not given" : labelFor(UNMET_NEED_REASONS, r.reason)}: ${n(r.count)}`
        )}
      />
      ) : null}
    </div>
  );
}
