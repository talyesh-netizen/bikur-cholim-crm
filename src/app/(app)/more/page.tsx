import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { mobileMoreItems } from "@/lib/nav-items";
import { signOut } from "@/lib/actions/auth";
import { LogOut } from "lucide-react";
import { LinkList } from "@/components/link-list";

/** Overflow page for the mobile bottom nav, which only has room for a
 * handful of full-time tabs -- see nav-links.tsx. Not needed on
 * desktop, where the sidebar shows every item directly. Also where
 * "Sign out" lives on a phone, away from anything tapped often. */
export default async function MorePage() {
  const profile = await getCurrentProfile();
  const items = mobileMoreItems();

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">More</h1>
      <LinkList items={items} />

      {profile ? (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4 sm:p-4">
            <div className="min-w-0">
              <p className="truncate font-medium leading-tight">{profile.full_name}</p>
              <p className="truncate text-sm text-muted-foreground">{profile.email}</p>
            </div>
            <form action={signOut}>
              <Button variant="outline" type="submit">
                <LogOut />
                Sign out
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
