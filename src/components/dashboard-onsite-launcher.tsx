"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionIcon } from "@/components/section-icon";

export function DashboardOnsiteLauncher({
  facilities,
}: {
  facilities: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [facilityId, setFacilityId] = useState("");

  function startOnsite() {
    if (!facilityId) return;
    router.push(`/facilities/${facilityId}/onsite`);
  }

  return (
    <Card className="border-t-4" style={{ borderTopColor: "var(--section-facilities)" }}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base uppercase tracking-wide">
          <SectionIcon section="facilities" icon={ClipboardCheck} />
          Start onsite visit
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <select
            value={facilityId}
            onChange={(e) => setFacilityId(e.target.value)}
            className="h-10 w-full appearance-none rounded-md border border-input bg-background pl-9 pr-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Choose facility for onsite visit"
          >
            <option value="">Choose a facility</option>
            {facilities.map((facility) => (
              <option key={facility.id} value={facility.id}>
                {facility.name}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={startOnsite} disabled={!facilityId} className="uppercase tracking-wide sm:min-w-48">
          <ClipboardCheck className="size-4" />
          Start onsite visit
        </Button>
      </CardContent>
    </Card>
  );
}
