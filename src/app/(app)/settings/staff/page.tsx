import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { listStaffAccounts } from "@/lib/queries/profiles";
import { listFacilityOptions } from "@/lib/queries/facilities";
import { NewStaffForm } from "./new-staff-form";
import { StaffRow } from "./staff-row";
import { ArrowLeft } from "lucide-react";

export default async function StaffSettingsPage() {
  const profile = await getCurrentProfile();

  if (profile?.role !== "admin") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Staff accounts</h1>
        <p className="text-sm text-muted-foreground">
          Only administrators can manage staff accounts. Contact an admin if
          you need a new account or a change to your access.
        </p>
      </div>
    );
  }

  const [accounts, facilities] = await Promise.all([listStaffAccounts(), listFacilityOptions()]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/dashboard">
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Staff accounts</h1>
        <p className="text-sm text-muted-foreground">
          Add staff or volunteers who need a login, and choose whether they see every
          facility or only a chosen few -- useful while someone is still getting ramped up.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a staff account</CardTitle>
        </CardHeader>
        <CardContent>
          <NewStaffForm facilities={facilities} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All accounts ({accounts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col">
            {accounts.map((account) => (
              <StaffRow
                key={account.id}
                account={account}
                facilities={facilities}
                isSelf={account.id === profile.id}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
