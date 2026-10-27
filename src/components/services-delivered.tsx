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
  HandHelping,
  Users,
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
  const { food, volunteers, schoolShul, unmetNeed, peopleReached } = services;
  const group = services.groupVolunteers;
  const show = (value: number) => !hideEmpty || value > 0;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {show(services.oneOnOne.residents) ? (
        <Tile
          icon={UserCheck}
          title={`Residents served one-on-one · ${periodLabel}`}
          value={services.oneOnOne.residents}
          unit={services.oneOnOne.residents === 1 ? "resident" : "different residents"}
          details={[
            `${n(services.oneOnOne.contacts)} visits & calls (staff and volunteers)`,
            "Each person counted once",
          ]}
        />
      ) : null}
      {show(peopleReached.total) ? (
        <Tile
          icon={Users}
          title={`Reached through programs & deliveries · ${periodLabel}`}
          value={peopleReached.total}
          unit="(approx.)"
          details={[
            peopleReached.programs > 0 ? `Facility programs: ~${n(peopleReached.programs)}` : null,
            peopleReached.food > 0 ? `Food & holiday deliveries: ~${n(peopleReached.food)}` : null,
            peopleReached.volunteerGroups > 0 ? `Volunteer group visits: ~${n(peopleReached.volunteerGroups)}` : null,
            peopleReached.residentGroups > 0 ? `Group resident visits: ~${n(peopleReached.residentGroups)}` : null,
            peopleReached.schoolShul > 0 ? `School & shul programs: ~${n(peopleReached.schoolShul)}` : null,
            peopleReached.other > 0 ? `Other activities: ~${n(peopleReached.other)}` : null,
            "Attendance: someone at 3 programs counts 3 times",
          ]}
        />
      ) : null}
      {show(food.deliveries) ? (
      <Tile
        icon={Utensils}
        title="Food deliveries"
        value={food.deliveries}
        unit={food.deliveries === 1 ? "delivery" : "deliveries"}
        details={[
          food.peopleReached > 0 ? `~${n(food.peopleReached)} people received food` : null,
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
          schoolShul.students > 0 ? `${n(schoolShul.students)} students` : null,
          schoolShul.volunteers > 0 ? `${n(schoolShul.volunteers)} volunteers` : null,
          schoolShul.notSplit > 0 ? `${n(schoolShul.notSplit)} took part (not split)` : null,
          schoolShul.peopleReached > 0 ? `~${n(schoolShul.peopleReached)} residents reached` : null,
        ]}
      />
      ) : null}
      {show(group.projects) ? (
      <Tile
        icon={School}
        title="Program participation"
        value={group.students + group.volunteers + group.notSplit}
        unit="took part"
        details={[
          group.students > 0 ? `${n(group.students)} students` : null,
          group.volunteers > 0 ? `${n(group.volunteers)} volunteers` : null,
          group.notSplit > 0 ? `${n(group.notSplit)} not split (older entries)` : null,
          `${n(group.projects)} ${group.projects === 1 ? "program" : "programs"}, each counted once however many facilities it reached`,
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
