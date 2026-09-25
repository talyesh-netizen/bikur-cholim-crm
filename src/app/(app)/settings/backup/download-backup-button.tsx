"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, DatabaseBackup } from "lucide-react";

/** Fetches the backup and hands it to the browser as a download --
 * rather than a plain link -- so a failure shows a clear message here
 * instead of a raw error page, and a success is confirmed. */
export function DownloadBackupButton() {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function download() {
    setState("working");
    try {
      const res = await fetch("/api/backup", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "The backup could not be downloaded. Please try again.");
      }
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "crm-backup.zip";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage(name);
      setState("done");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "The backup could not be downloaded. Please try again.");
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={download} disabled={state === "working"} className="w-full sm:w-auto">
        <DatabaseBackup className="size-4" />
        {state === "working" ? "Preparing backup…" : "Download full backup"}
      </Button>
      {state === "done" ? (
        <p className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          Downloaded {message}. Move it to the secure shared drive.
        </p>
      ) : null}
      {state === "error" ? (
        <p role="alert" className="rounded-md border border-destructive bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive">
          {message}
        </p>
      ) : null}
    </div>
  );
}
