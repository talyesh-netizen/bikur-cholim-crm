import * as React from "react";

import { cn } from "@/lib/utils";

// Kinds of box where a capital first letter would be wrong (an email
// address, a password, a web address) or meaningless (numbers, dates).
const NO_AUTO_CAPS = new Set(["email", "password", "url", "number", "tel", "date", "datetime-local", "time", "month", "search"]);

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      // Phones capitalize the first letter of what's typed, everywhere it
      // makes sense; a box can still ask for "words" (names) or "none".
      autoCapitalize={type && NO_AUTO_CAPS.has(type) ? undefined : "sentences"}
      data-slot="input"
      className={cn(
        "flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm md:h-10 md:text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Input };
