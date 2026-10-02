import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { listRecentChanges } from "@/lib/queries/change-log";
import { ChangeHistoryList } from "@/components/change-history-list";

export default async function RecentChangesPage() {
  const profile = await getCurrentProfile();

  if (profile?.role !== "admin") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Recent changes</h1>
        <p className="text-sm text-muted-foreground">Only administrators can see the change history.</p>
      </div>
    );
  }

  const entries = await listRecentChanges(100);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Recent changes</h1>
        <p className="text-sm text-muted-foreground">
          The latest 100 edits across the CRM: who made them, when, and what each field said before. If something
          was changed by mistake, the old value is right here to put back.
        </p>
      </div>
      <Card>
        <CardContent className="p-4 sm:p-6">
          <ChangeHistoryList entries={entries} showRecord />
        </CardContent>
      </Card>
    </div>
  );
}
