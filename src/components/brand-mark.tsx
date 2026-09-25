import Image from "next/image";
import { cn } from "@/lib/utils";

/** The Bikur Cholim of Cleveland hearts mark (public/brand/mark.png) --
 * the same artwork as the home-screen icon. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/mark.png"
      alt=""
      aria-hidden
      width={64}
      height={64}
      className={cn("size-8 shrink-0 object-contain", className)}
      priority
    />
  );
}

/** The full Bikur Cholim of Cleveland logo, for the sign-in screen and
 * the desktop sidebar. Transparent background, 1200x487. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/logo-full.png"
      alt="Bikur Cholim of Cleveland"
      width={1200}
      height={487}
      className={cn("h-auto w-48", className)}
      priority
    />
  );
}
