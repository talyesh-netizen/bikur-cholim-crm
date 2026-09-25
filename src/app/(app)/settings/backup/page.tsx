import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { DownloadBackupButton } from "./download-backup-button";
import { ShieldAlert } from "lucide-react";

export default async function BackupSettingsPage() {
  const profile = await getCurrentProfile();

  if (profile?.role !== "admin") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Backup</h1>
        <p className="text-sm text-muted-foreground">Only administrators can download a backup of the CRM.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Backup</h1>
        <p className="text-sm text-muted-foreground">
          Download a complete copy of everything in the CRM — one file you can keep safe in case anything is ever
          lost or changed by mistake.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Download a full backup</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <p>
            You&apos;ll get one <strong>.zip</strong> file with a spreadsheet for each part of the CRM — facilities,
            residents, contacts, visits, tasks, staff and more — plus a READ-ME. Nothing in the CRM is changed.
          </p>
          <p className="text-muted-foreground">Suggested: once a week, and before any big change.</p>
          <DownloadBackupButton />
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2.5 text-sm text-warning">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        <span>
          This file contains <strong>real resident information</strong>. Save it only to the organization&apos;s
          private, access-controlled drive — never email it or leave it in Downloads — and delete old copies you no
          longer need.
        </span>
      </div>
    </div>
  );
}
