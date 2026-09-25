import { QuickLog } from "./quick-log";

// Reading a note takes the assistant anywhere from a few seconds to
// about a minute; give the server action room so it isn't cut off.
export const maxDuration = 120;

export default function QuickLogPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Quick Log</h1>
        <p className="text-sm text-muted-foreground">
          Type or dictate what happened, the way you&apos;d tell a colleague. The assistant works out who it&apos;s
          about, logs the visit or call, updates profiles, adds anyone new, and sets follow-ups. You check it
          before anything is saved.
        </p>
      </div>
      <QuickLog />
    </div>
  );
}
