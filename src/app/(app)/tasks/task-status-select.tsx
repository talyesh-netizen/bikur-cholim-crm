"use client";

import { useRef, useTransition } from "react";
import { TASK_STATUSES } from "@/lib/domain/task";
import { setTaskStatus } from "@/lib/actions/tasks";

/** A compact status dropdown that saves immediately on change -- the
 * "click to move it" alternative to dragging a card between columns. */
export function TaskStatusSelect({ taskId, status }: { taskId: string; status: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const action = setTaskStatus.bind(null, taskId);

  return (
    <form
      ref={formRef}
      action={action}
      onClick={(e) => e.stopPropagation()}
      onChange={() => startTransition(() => formRef.current?.requestSubmit())}
    >
      <select
        name="status"
        defaultValue={status}
        disabled={isPending}
        className="w-full rounded border border-border bg-card px-1.5 py-1 text-xs disabled:opacity-60"
      >
        {TASK_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </form>
  );
}
