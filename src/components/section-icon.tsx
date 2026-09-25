import type { LucideIcon } from "lucide-react";
import { sectionVars, type Section } from "@/lib/sections";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { box: "size-6 rounded-md", icon: "size-3.5" },
  md: { box: "size-8 rounded-lg", icon: "size-4" },
  lg: { box: "size-11 rounded-xl", icon: "size-5" },
} as const;

/** An icon on a small tile in its section's color -- the "where am I"
 * cue used in the menu, dashboard tiles and page headings. Purely
 * decorative: it always sits next to a text label. */
export function SectionIcon({
  section,
  icon: Icon,
  size = "md",
  className,
}: {
  section: Section;
  icon: LucideIcon;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const colors = sectionVars(section);
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center", SIZES[size].box, className)}
      style={{ backgroundColor: colors.fill, color: colors.on }}
    >
      <Icon className={SIZES[size].icon} />
    </span>
  );
}
