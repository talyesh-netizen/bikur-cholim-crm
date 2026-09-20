import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { mobileMoreItems } from "@/components/nav-links";
import { ChevronRight } from "lucide-react";

/** Overflow page for the mobile bottom nav, which only has room for a
 * handful of full-time tabs -- see nav-links.tsx. Not needed on
 * desktop, where the sidebar shows every item directly. */
export default async function MorePage() {
  const profile = await getCurrentProfile();
  const items = mobileMoreItems(profile?.role === "admin");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">More</h1>
      <Card>
        <CardContent className="flex flex-col p-0">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 border-b border-border p-4 text-sm font-medium last:border-0 hover:bg-accent"
              >
                <Icon className="size-5 text-muted-foreground" />
                <span className="flex-1">{item.label}</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
