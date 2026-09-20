import { contactTypeColor } from "@/lib/domain/contact-colors";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase();
}

/** A colored initials circle standing in for a profile picture -- we
 * don't store photos, so a contact's type color doubles as their visual
 * identity everywhere a person is shown, not just in a small badge. */
export function ContactAvatar({
  name,
  contactType,
  size = "md",
}: {
  name: string;
  contactType: string | null | undefined;
  size?: "md" | "lg";
}) {
  return (
    <span
      className={
        size === "lg"
          ? "flex size-12 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white"
          : "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
      }
      style={{ backgroundColor: contactTypeColor(contactType) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
