import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { SidebarNavLinks, MobileBottomNavLinks } from "@/components/nav-links";
import { GlobalSearchBar } from "@/components/global-search-bar";
import { QuickAddMenu } from "@/components/quick-add-menu";
import { SaveToast } from "@/components/save-toast";
import { BrandLogo, BrandMark } from "@/components/brand-mark";
import { APP_NAME, ORGANIZATION_NAME } from "@/lib/config";
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
    <div className="flex min-h-dvh flex-col bg-background md:flex-row">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-card px-3 py-5 md:flex">
        <Link href="/dashboard" className="mb-5 flex flex-col gap-2 px-2" aria-label={`${APP_NAME} — ${ORGANIZATION_NAME}`}>
          <BrandLogo className="w-40" />
          <span className="text-sm font-semibold leading-tight text-muted-foreground">{APP_NAME}</span>
        </Link>

        <QuickAddMenu className="mb-4 px-1" fullWidth />

        <SidebarNavLinks isAdmin={role === "admin"} />

        <div className="mt-auto flex flex-col gap-3 border-t border-border px-1 pt-4">
          <div className="px-2 text-sm">
            <p className="font-medium leading-tight">{displayName}</p>
            {role ? <p className="text-xs capitalize text-muted-foreground">{role}</p> : null}
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
      <header className="sticky top-0 z-40 border-b border-border bg-card pt-[env(safe-area-inset-top)] md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
            <BrandMark className="size-8" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold leading-tight">{APP_NAME}</span>
              <span className="block truncate text-xs text-muted-foreground">{ORGANIZATION_NAME}</span>
            </span>
          </Link>
          <QuickAddMenu />
        </div>
      </header>

      <main className="min-w-0 flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
        <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-4 sm:px-6 md:gap-6 md:p-8">
          <Suspense fallback={<div className="h-11 w-full md:max-w-md" />}>
            <GlobalSearchBar />
          </Suspense>
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-card/90 md:hidden"
      >
        <MobileBottomNavLinks />
      </nav>

      <Suspense fallback={null}>
        <SaveToast />
      </Suspense>
    </div>
  );
}
