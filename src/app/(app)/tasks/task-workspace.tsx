"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, CheckCircle2, ListChecks, Plus, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { OPEN_TASK_STATUSES } from "@/lib/domain/task";
import type { TaskWithNames } from "@/lib/domain/task";
import { completeTaskQuick, undoTaskCompletion } from "@/lib/actions/tasks";
import { cn } from "@/lib/utils";
import { TaskCard } from "./task-card";

/** The four views (decided Oct 9, 2026). Open is every outstanding
 * task, dated or not; Today is due today or overdue. */
const TABS = [
  { key: "open", label: "Open" },
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const isOpen = (t: TaskWithNames) => (OPEN_TASK_STATUSES as readonly string[]).includes(t.status);

/** Overdue and due-today first, then later dates, then undated (newest first). */
function byDue(a: TaskWithNames, b: TaskWithNames) {
  if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
  if (a.due_date) return -1;
  if (b.due_date) return 1;
  return b.created_at.localeCompare(a.created_at);
}
const byRecentlyFinished = (a: TaskWithNames, b: TaskWithNames) => b.updated_at.localeCompare(a.updated_at);

function haystack(t: TaskWithNames) {
  return [t.title, t.description, t.completion_notes, t.resident_name, t.facility_name, t.contact_name, t.contact_detail, t.assigned_to_name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

type Toast = { taskId: string; title: string; previousStatus: string; cancelled: boolean; key: number };

export function TaskWorkspace({
  tasks,
  staff,
  today,
  myId,
}: {
  tasks: TaskWithNames[];
  staff: { id: string; full_name: string }[];
  today: string;
  myId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: TabKey = TABS.some((t) => t.key === tabParam) ? (tabParam as TabKey) : "open";
  const assigned = searchParams.get("assigned") ?? "";
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [toast, setToast] = useState<Toast | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Ticked off on this screen, shown as done before the list reloads.
  const [justDone, setJustDone] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  /** Settings live in the address, so going into a task and back (or
   * a refresh) keeps the same tab, search and person. */
  function setParams(change: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(change)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  // Search as you type; the address catches up a moment later.
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (query.trim() === current) return;
    const timer = window.setTimeout(() => setParams({ q: query.trim() || null }), 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Back from a task's page after completing it: show the message with
  // Undo (picked up during render, like SaveToast), then tidy the address.
  const doneParam = searchParams.get("done");
  const [seenDone, setSeenDone] = useState<string | null>(null);
  if (doneParam !== seenDone) {
    setSeenDone(doneParam);
    if (doneParam) {
      const task = tasks.find((t) => t.id === doneParam);
      setToast({
        taskId: doneParam,
        title: task?.title ?? "Task",
        previousStatus: searchParams.get("was") ?? "open",
        cancelled: searchParams.get("cancelled") === "1",
        key: (toast?.key ?? 0) + 1,
      });
    }
  }
  useEffect(() => {
    if (doneParam) setParams({ done: null, was: null, cancelled: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneParam]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 8000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const searching = query.trim().length > 0;

  const visible = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const mine = assigned === "me" ? myId : assigned;
    return tasks
      .map((t) => (justDone.has(t.id) && isOpen(t) ? { ...t, status: "completed" } : t))
      .filter((t) => !mine || t.assigned_to === mine)
      .filter((t) => {
        if (words.length === 0) return true;
        const text = haystack(t);
        return words.every((w) => text.includes(w));
      });
  }, [tasks, justDone, assigned, myId, query]);

  const open = visible.filter(isOpen).sort(byDue);
  const lists: Record<TabKey, TaskWithNames[]> = {
    open,
    today: open.filter((t) => t.due_date && t.due_date <= today),
    upcoming: open.filter((t) => t.due_date && t.due_date > today),
    completed: visible.filter((t) => !isOpen(t)).sort(byRecentlyFinished),
  };

  function complete(task: TaskWithNames) {
    setError(null);
    setJustDone((s) => new Set(s).add(task.id));
    startTransition(async () => {
      const result = await completeTaskQuick(task.id);
      if (!result.ok) {
        setJustDone((s) => {
          const n = new Set(s);
          n.delete(task.id);
          return n;
        });
        setError(result.error);
        return;
      }
      setToast({ taskId: task.id, title: task.title, previousStatus: result.previousStatus, cancelled: false, key: (toast?.key ?? 0) + 1 });
    });
  }

  function undo(t: Toast) {
    setToast(null);
    startTransition(async () => {
      const result = await undoTaskCompletion(t.taskId, t.previousStatus);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setJustDone((s) => {
        const n = new Set(s);
        n.delete(t.taskId);
        return n;
      });
      router.refresh();
    });
  }

  const backQuery = new URLSearchParams();
  if (tab !== "open") backQuery.set("tab", tab);
  if (query.trim()) backQuery.set("q", query.trim());
  if (assigned) backQuery.set("assigned", assigned);
  const back = backQuery.toString();
  const taskHref = (id: string) => `/tasks/${id}${back ? `?back=${encodeURIComponent(back)}` : ""}`;

  const renderList = (list: TaskWithNames[]) => (
    <div className="flex flex-col gap-3">
      {list.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          href={taskHref(task.id)}
          leading={
            isOpen(task) ? (
              <button
                type="button"
                onClick={() => complete(task)}
                aria-label={`Mark "${task.title}" done`}
                className="-m-1.5 flex size-11 shrink-0 items-center justify-center rounded-full"
              >
                <span className="flex size-7 items-center justify-center rounded-full border-2 border-muted-foreground/50 text-transparent hover:border-success hover:text-success">
                  <Check className="size-4" />
                </span>
              </button>
            ) : (
              <span className="-m-1.5 flex size-11 shrink-0 items-center justify-center" aria-hidden>
                <CheckCircle2 className="size-7 text-success" />
              </span>
            )
          }
        />
      ))}
    </div>
  );

  const current = lists[tab];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks: words, a name, a facility…"
            aria-label="Search tasks, open and completed"
            enterKeyHint="search"
            autoComplete="off"
            className="h-11 pl-9"
          />
        </div>
        <select
          value={assigned}
          onChange={(e) => setParams({ assigned: e.target.value || null })}
          aria-label="Whose tasks"
          className="h-11 rounded-md border border-input bg-card px-3 text-sm sm:w-48"
        >
          <option value="">Everyone&apos;s tasks</option>
          {myId ? <option value="me">My tasks</option> : null}
          {staff
            .filter((s) => s.id !== myId)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
        </select>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      {searching ? (
        // A search looks through every task, finished ones too -- the
        // quickest way to tell whether something was already recorded.
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {lists.open.length + lists.completed.length === 0
              ? "No task, open or completed, matches that."
              : `${lists.open.length} open and ${lists.completed.length} completed match.`}
          </p>
          {lists.open.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">Open</h2>
              {renderList(lists.open)}
            </section>
          ) : null}
          {lists.completed.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">Completed</h2>
              {renderList(lists.completed)}
            </section>
          ) : null}
          <Button variant="outline" className="border-dashed" asChild>
            <Link href={`/tasks/new?title=${encodeURIComponent(query.trim())}`}>
              <Plus /> Add &ldquo;{query.trim()}&rdquo; as a new task
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Which tasks" className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setParams({ tab: t.key === "open" ? null : t.key })}
                className={cn(
                  "flex min-h-10 flex-col items-center justify-center rounded-md px-1 text-xs font-medium sm:flex-row sm:gap-1.5 sm:text-sm",
                  tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                {t.label}
                <span className={cn("text-xs", t.key === "today" && lists.today.length > 0 ? "font-semibold text-destructive" : "")}>
                  {lists[t.key].length}
                </span>
              </button>
            ))}
          </div>

          {current.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title={
                tab === "today"
                  ? "Nothing due today or overdue"
                  : tab === "upcoming"
                    ? "Nothing scheduled ahead"
                    : tab === "completed"
                      ? "No completed tasks yet"
                      : "No open tasks"
              }
              description={tab === "completed" ? "Tasks you mark done show up here." : "Add a task when something needs doing later."}
              action={tab === "completed" ? undefined : { href: "/tasks/new", label: "Add a task" }}
            />
          ) : (
            renderList(current)
          )}
        </>
      )}

      {toast ? (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-6"
          role="status"
          aria-live="polite"
        >
          <div
            key={toast.key}
            className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-success/30 bg-card px-4 py-3 shadow-lg animate-in fade-in slide-in-from-bottom-4"
          >
            <CheckCircle2 className="size-5 shrink-0 text-success" />
            <p className="min-w-0 flex-1 text-sm font-medium">
              {toast.cancelled ? "Task cancelled" : "Task done"}
              <span className="block truncate text-xs font-normal text-muted-foreground">{toast.title}</span>
            </p>
            <button
              type="button"
              onClick={() => undo(toast)}
              className="shrink-0 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:bg-accent"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="-mr-1 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
