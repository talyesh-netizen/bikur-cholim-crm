/** A label/value row for detail-page "info card" layouts. When `href` is
 * given, the value renders as a real link (tel:, mailto:, https://, maps)
 * instead of plain text — see lib/link-helpers.ts for building the href.
 * On a phone the label sits above the value, so long answers wrap
 * naturally instead of being squeezed into a right-aligned column. */
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
    <div className="flex flex-col gap-0.5 sm:grid sm:grid-cols-[minmax(9rem,2fr)_5fr] sm:gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="break-words">
        {value ? (
          href ? (
            <a
              href={href}
              target={href.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              {value}
            </a>
          ) : (
            <span className="whitespace-pre-wrap">{value}</span>
          )
        ) : (
          <span className="text-muted-foreground">Not recorded</span>
        )}
      </span>
    </div>
  );
}
