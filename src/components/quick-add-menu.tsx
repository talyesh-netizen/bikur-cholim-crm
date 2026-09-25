"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Plus,
  X,
  HeartHandshake,
  MessageSquarePlus,
  UserPlus,
  ListPlus,
  ArrowRightLeft,
  Building2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type QuickAction = { href: string; label: string; hint?: string; icon: LucideIcon };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const RESIDENT_PAGE = new RegExp(`^/residents/(${UUID})$`, "i");
const FACILITY_PAGE = new RegExp(`^/facilities/(${UUID})$`, "i");

/** The common "create something" actions, adjusted to where you are:
 * on a resident's page, "Log a visit" is already for that resident;
 * on a facility's page, it's already at that facility. */
function actionsFor(pathname: string): { context: string | null; actions: QuickAction[] } {
  const resident = pathname.match(RESIDENT_PAGE)?.[1];
  if (resident) {
    return {
      context: "For this resident",
      actions: [
        { href: `/interactions/new?resident=${resident}&type=resident_visit`, label: "Log a visit", icon: HeartHandshake },
        { href: `/interactions/new?resident=${resident}`, label: "Log another interaction", hint: "Call, family update, referral…", icon: MessageSquarePlus },
        { href: `/tasks/new?resident=${resident}`, label: "Add a follow-up task", icon: ListPlus },
        { href: `/residents/${resident}/transfer`, label: "Move to another facility", icon: ArrowRightLeft },
      ],
    };
  }

  const facility = pathname.match(FACILITY_PAGE)?.[1];
  if (facility) {
    return {
      context: "At this facility",
      actions: [
        { href: `/interactions/new?facility=${facility}&type=resident_visit`, label: "Log a visit", icon: HeartHandshake },
        { href: `/interactions/new?facility=${facility}`, label: "Log another interaction", hint: "Program, staff call, delivery…", icon: MessageSquarePlus },
        { href: `/residents/new?facility=${facility}`, label: "Add a resident here", icon: UserPlus },
        { href: `/tasks/new?facility=${facility}`, label: "Add a follow-up task", icon: ListPlus },
      ],
    };
  }

  return {
    context: null,
    actions: [
      { href: "/interactions/new?type=resident_visit", label: "Log a visit", icon: HeartHandshake },
      { href: "/interactions/new", label: "Log another interaction", hint: "Call, family update, program…", icon: MessageSquarePlus },
      { href: "/tasks/new", label: "Add a follow-up task", icon: ListPlus },
      { href: "/residents/new", label: "Add a resident", icon: UserPlus },
      { href: "/facilities/new", label: "Add a facility", icon: Building2 },
    ],
  };
}

export function QuickAddMenu({ className, fullWidth = false }: { className?: string; fullWidth?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  const { context, actions: pageActions } = actionsFor(pathname);
  // Quick Log first everywhere: one note can cover what several of the
  // forms below would.
  const actions: QuickAction[] = [
    { href: "/quick-log", label: "Quick Log", hint: "Type or speak a note and it files everything", icon: Sparkles },
    ...pageActions,
  ];

  // Close whenever the page changes (i.e. after picking an action).
  if (open && openedAt !== pathname) setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className={cn("relative", className)}>
      <Button
        type="button"
        size="sm"
        className={cn("h-10 gap-1.5 px-3.5", fullWidth && "w-full")}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpenedAt(pathname);
          setOpen((v) => !v);
        }}
      >
        <Plus className="size-4" />
        New
      </Button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-foreground/25 animate-in fade-in md:bg-transparent"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Create something new"
            className={cn(
              "z-50 flex flex-col bg-card shadow-xl animate-in",
              // Phone: a bottom sheet above the nav bar.
              "fixed inset-x-0 bottom-0 rounded-t-2xl border-t border-border pb-[calc(0.75rem+env(safe-area-inset-bottom))] slide-in-from-bottom-8",
              // Desktop: a dropdown under the button.
              "md:absolute md:inset-x-auto md:bottom-auto md:left-0 md:top-full md:mt-2 md:w-72 md:rounded-xl md:border md:pb-2 md:fade-in md:slide-in-from-top-2"
            )}
          >
            <div className="flex items-center justify-between px-4 pb-1 pt-4 md:pt-3">
              <div>
                <p className="text-base font-semibold md:text-sm">Create</p>
                {context ? <p className="text-sm text-muted-foreground md:text-xs">{context}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-2 text-muted-foreground hover:bg-accent md:hidden"
              >
                <X className="size-5" />
              </button>
            </div>
            <ul className="flex flex-col px-2">
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <li key={action.href}>
                    <Link
                      href={action.href}
                      onClick={() => setOpen(false)}
                      className="flex min-h-14 items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-accent md:min-h-11 md:py-2"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-tone-brand-bg text-tone-brand-fg md:size-8">
                        <Icon className="size-4" />
                      </span>
                      <span className="flex flex-col">
                        <span className="text-base font-medium leading-tight md:text-sm">{action.label}</span>
                        {action.hint ? <span className="text-sm text-muted-foreground md:text-xs">{action.hint}</span> : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}
