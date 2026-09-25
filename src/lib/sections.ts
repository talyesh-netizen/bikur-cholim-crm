/**
 * The app's sections and the color each one wears -- see "section
 * colors" in globals.css. Kept as CSS variables (not hard-coded hex) so
 * light and dark mode each get their own checked values.
 */
export type Section = "dashboard" | "log" | "facilities" | "residents" | "contacts" | "tasks" | "neutral";

export function sectionVars(section: Section) {
  return {
    accent: `var(--section-${section}-accent)`,
    fill: `var(--section-${section}-fill)`,
    on: `var(--section-${section}-on)`,
  };
}
