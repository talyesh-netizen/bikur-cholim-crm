/** A label/value row for detail-page "info card" layouts. When `href` is
 * given, the value renders as a real link (tel:, mailto:, https://, maps)
 * instead of plain text — see lib/link-helpers.ts for building the href. */
export function InfoRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string | null | undefined;
  href?: string;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words text-right">
        {value ? (
          href ? (
            <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="hover:underline">
              {value}
            </a>
          ) : (
            value
          )
        ) : (
          "—"
        )}
      </span>
    </div>
  );
}
