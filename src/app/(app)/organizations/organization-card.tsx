import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { labelFor, ORGANIZATION_TYPES } from "@/lib/domain/organization";
import type { Organization } from "@/lib/domain/organization";
import { MapPin } from "lucide-react";

export function OrganizationCard({ organization }: { organization: Organization }) {
  return (
    <Link href={`/organizations/${organization.id}`}>
      <Card className="transition-colors hover:border-primary/50">
        <CardContent className="flex flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold leading-tight">{organization.name}</p>
            <div className="flex items-center gap-1.5">
              {!organization.active ? <Badge variant="outline">Inactive</Badge> : null}
              <Badge variant="secondary">{labelFor(ORGANIZATION_TYPES, organization.organization_type)}</Badge>
            </div>
          </div>
          {organization.city ? (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-3.5" />
              {organization.city}
            </span>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
