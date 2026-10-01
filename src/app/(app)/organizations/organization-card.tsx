import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { labelFor, ORGANIZATION_TYPES } from "@/lib/domain/organization";
import type { Organization } from "@/lib/domain/organization";
import { ChevronRight, MapPin } from "lucide-react";

const typeStyles: Record<string, string> = {
  synagogue: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200",
  school: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  outreach_center: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  community_partner: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200",
  other: "border-border bg-muted text-muted-foreground",
};

export function OrganizationCard({ organization }: { organization: Organization }) {
  const fullAddress = [organization.address, organization.city, organization.state, organization.zip].filter(Boolean).join(", ");
  const mapsHref = fullAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}` : null;

  return (
    <Card className="group transition-colors hover:border-primary/50">
      <CardContent className="flex items-center gap-3 p-4 sm:p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={`/organizations/${organization.id}`}
              className="text-base font-semibold leading-tight hover:underline"
            >
              {organization.name}
            </Link>
            {!organization.active ? <Badge variant="outline">Inactive</Badge> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className={typeStyles[organization.organization_type]}>
              {labelFor(ORGANIZATION_TYPES, organization.organization_type)}
            </Badge>
            {mapsHref ? (
              <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 hover:text-foreground hover:underline"
              >
                <MapPin className="size-3.5" />
                {fullAddress}
              </a>
            ) : organization.city ? (
              <span className="flex items-center gap-1"><MapPin className="size-3.5" />{organization.city}</span>
            ) : null}
          </div>
        </div>
        <Link
          href={`/organizations/${organization.id}`}
          aria-label={`Open ${organization.name}`}
          className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="size-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
