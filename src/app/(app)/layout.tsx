import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { SidebarNavLinks, MobileBottomNavLinks } from "@/components/nav-links";
import { LogOut } from "lucide-react";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayName = "";
  let role = "";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .single();
    displayName = profile?.full_name ?? user.email ?? "";
    role = profile?.role ?? "";
  }

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card p-4 md:flex">
        <div className="mb-6 px-2">
          <p className="font-semibold leading-tight">Resident Support Services</p>
          <p className="text-xs text-muted-foreground">Bikur Cholim of Cleveland</p>
        </div>

        <SidebarNavLinks />

        <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
          <div className="px-2 text-sm">
            <p className="font-medium leading-tight">{displayName}</p>
            {role ? (
              <p className="text-xs capitalize text-muted-foreground">{role}</p>
            ) : null}
          </div>
          <form action={signOut}>
            <Button variant="outline" size="sm" type="submit" className="w-full justify-start gap-2">
              <LogOut className="size-4" />
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
        <div>
          <p className="text-sm font-semibold leading-tight">Resident Support Services</p>
          {displayName ? (
            <p className="text-xs text-muted-foreground">{displayName}</p>
          ) : null}
        </div>
        <form action={signOut}>
          <Button variant="ghost" size="icon" type="submit" aria-label="Sign out">
            <LogOut className="size-4" />
          </Button>
        </form>
      </header>

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="mx-auto max-w-5xl p-4 md:p-8">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 border-t border-border bg-card md:hidden">
        <MobileBottomNavLinks />
      </nav>
    </div>
  );
}
