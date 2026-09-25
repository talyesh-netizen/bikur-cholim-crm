import type { ServicesDelivered } from "@/lib/queries/impact";
import { labelFor, UNMET_NEED_REASONS } from "@/lib/domain/interaction";
import { cn } from "@/lib/utils";
import {
  Utensils,
  HeartHandshake,
  School,
  Stethoscope,
  Car,
  Compass,
  HandHelping,
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
}: {
  services: ServicesDelivered;
  periodLabel: string;
}) {
  const { food, volunteers, schoolShul, careNavigation, unmetNeed } = services;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
      <Tile
        icon={Stethoscope}
        title="Medical referrals"
        value={services.medicalReferrals}
        unit={services.medicalReferrals === 1 ? "referral" : "referrals"}
        details={["To the Bikur Cholim medical referral team"]}
      />
      <Tile
        icon={Car}
        title="Rides arranged"
        value={services.rides}
        unit={services.rides === 1 ? "ride" : "rides"}
        details={["Through Bikur Cholim rides"]}
      />
      <Tile
        icon={Compass}
        title="Care navigation"
        value={careNavigation.families}
        unit={careNavigation.families === 1 ? "family helped" : "families helped"}
        details={[careNavigation.hours > 0 ? `${n(careNavigation.hours)} hours spent` : null]}
      />
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
    </div>
  );
}
