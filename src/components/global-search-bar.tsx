"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

/** A single search box, present on every page (see layout.tsx), for
 * jumping straight to a resident/facility/contact/organization by name
 * instead of navigating to that section first. */
export function GlobalSearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const [value, setValue] = useState(urlQuery);

  // This bar lives in the shared layout and isn't remounted between
  // pages, so without this, navigating (e.g. browser back/forward)
  // between two different searches would leave the box showing stale
  // text that no longer matches the results below it. Adjusting state
  // during render (React's recommended pattern for this, rather than an
  // effect -- see https://react.dev/learn/you-might-not-need-an-effect)
  // instead of useEffect avoids an extra render pass on every navigation.
  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery);
  if (urlQuery !== prevUrlQuery) {
    setPrevUrlQuery(urlQuery);
    setValue(urlQuery);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) router.push(`/search?q=${encodeURIComponent(value.trim())}`);
      }}
      className="relative w-full md:max-w-md"
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        type="search"
        enterKeyHint="search"
        aria-label="Search residents, facilities, and contacts"
        placeholder="Search residents, facilities, contacts…"
        className="pl-9"
      />
    </form>
  );
}
