"use client";

/**
 * Same as error.tsx, but for errors thrown by the root layout itself
 * (rare, but without this Next.js falls back to the browser's own bare
 * error page for that case). Must render its own <html>/<body> since it
 * replaces the root layout entirely.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            The app hit an unexpected error. Try again, and if it keeps
            happening let your admin know.
          </p>
        </div>
        <button
          onClick={() => reset()}
          className="inline-flex h-10 items-center justify-center rounded-md bg-black px-4 text-sm font-medium text-white"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
