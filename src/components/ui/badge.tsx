import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5 transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-tone-brand-bg text-tone-brand-fg",
        secondary: "border-transparent bg-tone-neutral-bg text-tone-neutral-fg",
        success: "border-transparent bg-tone-good-bg text-tone-good-fg",
        warning: "border-transparent bg-tone-attention-bg text-tone-attention-fg",
        destructive: "border-transparent bg-tone-urgent-bg text-tone-urgent-fg",
        outline: "border-border text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
