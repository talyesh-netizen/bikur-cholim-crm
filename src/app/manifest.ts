import type { MetadataRoute } from "next";
import { APP_NAME, ORGANIZATION_NAME } from "@/lib/config";

/**
 * Web app manifest -- what lets staff "Add to Home Screen" from Safari
 * or "Install app" from Chrome and then open the CRM full-screen like a
 * regular phone app. Served at /manifest.webmanifest.
 *
 * All paths here are relative to whatever domain the app is served
 * from, so it works unchanged on the production domain.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: APP_NAME,
    short_name: "Resident Support",
    description: `${ORGANIZATION_NAME} — ${APP_NAME}`,
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    lang: "en-US",
    dir: "ltr",
    categories: ["productivity", "business"],
    background_color: "#faf6f0",
    theme_color: "#b5592f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the home-screen icon (Android, and desktop Chrome) to
    // jump straight to these.
    shortcuts: [
      {
        name: "Log a visit",
        short_name: "Log visit",
        url: "/interactions/new?type=resident_visit",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Follow-up tasks",
        short_name: "Tasks",
        url: "/tasks",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Residents",
        url: "/residents",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
