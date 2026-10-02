import { cn } from "@/lib/utils";
import { labelFor as labelForResident, RESIDENT_STATUSES, isActiveResidentStatus } from "@/lib/domain/resident";
import { labelFor as labelForFacility, ENGAGEMENT_STATUSES, VISIT_PRIORITIES } from "@/lib/domain/facility";
import { labelFor as labelForTask, TASK_STATUSES, TASK_PRIORITIES } from "@/lib/domain/task";

/**
 * One badge style for every status in the app. Deliberately soft (tinted
 * background, darker text) rather than solid blocks of color, so a page
 * full of residents or tasks stays calm to read. Color is only ever a
 * hint -- the words always say what the status is.
 *
 * Tones:
 *   neutral  – informational, nothing to do
 *   good     – going well / done
 *   attention – worth a look soon
 *   urgent   – needs action
 *   muted    – no longer active
 */
export type BadgeTone = "neutral" | "good" | "attention" | "urgent" | "muted" | "brand";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-tone-neutral-bg text-tone-neutral-fg",
  good: "bg-tone-good-bg text-tone-good-fg",
  attention: "bg-tone-attention-bg text-tone-attention-fg",
  urgent: "bg-tone-urgent-bg text-tone-urgent-fg",
  muted: "bg-transparent text-muted-foreground ring-1 ring-inset ring-border",
  brand: "bg-tone-brand-bg text-tone-brand-fg",
};

export function StatusBadge({
  tone = "neutral",
  children,
  className,
  dot,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
  /** Optional color dot before the label (used for geographic clusters). */
  dot?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium leading-5",
        TONE_CLASSES[tone],
        className
      )}
    >
      {dot ? <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

// ---- Residents ----------------------------------------------------------

const RESIDENT_STATUS_TONES: Record<string, BadgeTone> = {
  active: "good",
  temporarily_hospitalized: "attention",
  location_unknown: "urgent",
  unable_to_reach: "attention",
  moved_to_another_facility: "muted",
  returned_home: "muted",
  deceased: "muted",
  no_longer_receiving_services: "muted",
};

export function ResidentStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <StatusBadge tone={RESIDENT_STATUS_TONES[status] ?? "neutral"} className={className}>
      {labelForResident(RESIDENT_STATUSES, status)}
    </StatusBadge>
  );
}

/** The big, obvious "Active" / "Not active" marker for a resident, with
 * the detailed status alongside whenever it says more than "Active". */
export function ResidentActiveStatus({ status, size = "large" }: { status: string; size?: "large" | "small" }) {
  const active = isActiveResidentStatus(status);
  const large = size === "large";
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full font-semibold",
          large ? "px-3.5 py-1 text-base" : "px-2.5 py-0.5 text-xs leading-5",
          active ? TONE_CLASSES.good : "bg-muted text-muted-foreground"
        )}
      >
        <span aria-hidden className={cn("shrink-0 rounded-full", large ? "size-2.5" : "size-2", active ? "bg-current" : "bg-muted-foreground/60")} />
        {active ? "Active" : "Not active"}
      </span>
      {status !== "active" ? <ResidentStatusBadge status={status} className={large ? "text-sm" : undefined} /> : null}
    </span>
  );
}

/** Gentle reminder when a resident was saved with only one name. */
export function MissingNameBadge({ resident }: { resident: { first_name: string | null; last_name: string | null } }) {
  const missing = !resident.last_name ? "Last name missing" : !resident.first_name ? "First name missing" : null;
  return missing ? <StatusBadge tone="attention">{missing}</StatusBadge> : null;
}

// ---- Facilities ---------------------------------------------------------

const ENGAGEMENT_TONES: Record<string, BadgeTone> = {
  not_contacted: "muted",
  initial_contact: "neutral",
  staff_relationship_developing: "neutral",
  active_facility: "good",
  recurring_visits: "good",
  recurring_programming: "good",
  no_known_jewish_residents: "muted",
  follow_up_needed: "attention",
};

export function EngagementBadge({ status, className }: { status: string; className?: string }) {
  return (
    <StatusBadge tone={ENGAGEMENT_TONES[status] ?? "neutral"} className={className}>
      {labelForFacility(ENGAGEMENT_STATUSES, status)}
    </StatusBadge>
  );
}

const PRIORITY_TONES: Record<string, BadgeTone> = {
  high: "urgent",
  medium: "attention",
  low: "neutral",
};

/** Visit priority (facilities) and task priority share one scale. */
export function PriorityBadge({
  priority,
  kind = "visit",
  className,
}: {
  priority: string;
  kind?: "visit" | "task";
  className?: string;
}) {
  const label =
    kind === "visit" ? labelForFacility(VISIT_PRIORITIES, priority) : labelForTask(TASK_PRIORITIES, priority);
  return (
    <StatusBadge tone={PRIORITY_TONES[priority] ?? "neutral"} className={className}>
      {label} priority
    </StatusBadge>
  );
}

// ---- Tasks --------------------------------------------------------------

const TASK_STATUS_TONES: Record<string, BadgeTone> = {
  open: "neutral",
  in_progress: "brand",
  waiting: "attention",
  completed: "good",
  cancelled: "muted",
};

export function TaskStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <StatusBadge tone={TASK_STATUS_TONES[status] ?? "neutral"} className={className}>
      {labelForTask(TASK_STATUSES, status)}
    </StatusBadge>
  );
}
