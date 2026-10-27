import Link from "next/link";
import { Pencil } from "lucide-react";
import { formatDateOnly } from "@/lib/format-date";
import type { Story } from "@/lib/queries/stories";

/** Stories as written, newest first: the day, who wrote it, what it's
 * linked to (if anything) and a way to edit or link it. */
export function StoryList({ stories, back, hideLinks }: { stories: Story[]; back: string; hideLinks?: "resident" | "facility" }) {
  if (stories.length === 0) return <p className="text-sm text-muted-foreground">No stories yet.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {stories.map((s) => (
        <li key={s.id} className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3">
          <p className="whitespace-pre-wrap text-sm">{s.story}</p>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {formatDateOnly(s.created_at)}
              {s.written_by ? ` · ${s.written_by}` : ""}
              {s.resident_id && hideLinks !== "resident" ? (
                <>
                  {" · "}
                  <Link href={`/residents/${s.resident_id}`} className="underline-offset-2 hover:underline">
                    {s.resident_name}
                  </Link>
                </>
              ) : null}
              {s.facility_id && hideLinks !== "facility" ? (
                <>
                  {" · "}
                  <Link href={`/facilities/${s.facility_id}`} className="underline-offset-2 hover:underline">
                    {s.facility_name}
                  </Link>
                </>
              ) : null}
              {!s.resident_id && !s.facility_id ? " · Not linked" : ""}
            </span>
            <Link
              href={`/stories/${s.id}/edit?back=${encodeURIComponent(back)}`}
              className="flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
            >
              <Pencil className="size-3.5" />
              {!s.resident_id && !s.facility_id ? "Edit or link" : "Edit"}
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
