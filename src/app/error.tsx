"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/config";

/**
 * Catches unhandled errors anywhere under the root layout (e.g. a page
 * whose server-side data fetch throws) and shows a friendly in-app
 * screen instead of letting the browser's own bare "server error" page
 * take over -- see PLAN.md mobile-refinement item for error messages.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Intentionally no third-party error reporting here -- see
    // ROADMAP.md privacy rules on what may reach external logs.
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-muted-foreground">{APP_NAME}</p>
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This page hit an unexpected error. Nothing was lost -- try again, and
          if it keeps happening let your admin know.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" asChild>
          <a href="/dashboard">Go to dashboard</a>
        </Button>
      </div>
    </div>
  );
}
