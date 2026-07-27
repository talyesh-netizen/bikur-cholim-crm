import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { listGeographicClusters } from "@/lib/queries/facilities";
import { ClusterRow } from "./cluster-row";
import { NewClusterForm } from "./new-cluster-form";
import { ArrowLeft } from "lucide-react";

export default async function ClustersSettingsPage() {
  const profile = await getCurrentProfile();

  if (profile?.role !== "admin") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Manage geographic clusters</h1>
        <p className="text-sm text-muted-foreground">
          Only administrators can manage the geographic cluster list. Contact
          an admin if a cluster needs to be added, renamed, or retired.
        </p>
      </div>
    );
  }

  const clusters = await listGeographicClusters(true);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/facilities">
            <ArrowLeft className="size-4" />
            Back to facilities
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Manage geographic clusters</h1>
        <p className="text-sm text-muted-foreground">
          These regions group facilities for planning and reporting. Renaming
          a cluster updates it everywhere it&apos;s used.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a cluster</CardTitle>
        </CardHeader>
        <CardContent>
          <NewClusterForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All clusters</CardTitle>
        </CardHeader>
        <CardContent>
          {clusters.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clusters yet.</p>
          ) : (
            <div className="flex flex-col">
              {clusters.map((cluster) => (
                <ClusterRow key={cluster.id} cluster={cluster} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
