import { cn } from "@/lib/utils";

/** The app's small home-and-heart mark -- same artwork as the
 * home-screen icon (public/icon-*.png), drawn inline so it's crisp. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden className={cn("size-8 shrink-0", className)}>
      <rect width="512" height="512" rx="112" fill="#b5592f" />
      <path
        d="M136 214 L256 118 L376 214"
        fill="none"
        stroke="#fff8f2"
        strokeWidth="30"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M256 404 C 178 352 150 314 150 276 C 150 246 173 224 202 224 C 226 224 244 238 256 258 C 268 238 286 224 310 224 C 339 224 362 246 362 276 C 362 314 334 352 256 404 Z"
        fill="#fff8f2"
      />
    </svg>
  );
}
