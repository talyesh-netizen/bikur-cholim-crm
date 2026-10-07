import { QuickLog } from "./quick-log";
import { SectionIcon } from "@/components/section-icon";
import { Sparkles } from "lucide-react";
import { listFacilities } from "@/lib/queries/facilities";

// Reading a note takes the assistant anywhere from a few seconds to
// a couple of minutes for a long one; give the server action room so
// it isn't cut off.
export const maxDuration = 300;

export default async function QuickLogPage() {
  const facilities = await listFacilities();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
            <SectionIcon section="log" icon={Sparkles} />
            Quick Log
          </h1>
        <p className="text-sm text-muted-foreground">
          The easiest way to put anything in the CRM. Say where it happened, then talk or type what happened or what you
          need to remember &mdash; a visit (today or earlier), a reminder, a room change, someone new. It works out
          where each thing goes, and you check it before anything is saved.
        </p>
      </div>
      <QuickLog facilities={facilities.map((f) => ({ id: f.id, name: f.name, city: f.city }))} />
    </div>
  );
}
