/** Shown instantly while a page's data loads (Next.js swaps it in
 * automatically), so tapping a link on a slow facility Wi-Fi connection
 * gives immediate feedback instead of a frozen-looking screen. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-col gap-2">
        <div className="skeleton h-8 w-2/3 max-w-xs" />
        <div className="skeleton h-4 w-1/2 max-w-[14rem]" />
      </div>
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="skeleton h-14" />
          <div className="skeleton h-14" />
          <div className="skeleton hidden h-14 sm:block" />
        </div>
        <div className="skeleton mt-4 h-11" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <div className="skeleton h-5 w-40" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-5/6" />
        </div>
      ))}
    </div>
  );
}
