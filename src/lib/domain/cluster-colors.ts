/**
 * Stable color per geographic cluster, keyed by cluster id so it survives
 * cluster renames. Used as a small dot next to the cluster name - never the
 * only signal, since the name is always shown as text alongside it.
 */
const CLUSTER_COLORS: Record<string, string> = {
  "da48fc9e-5e34-4b13-bc6a-b9f27cbb71bc": "#2a78d6", // Aurora/Chagrin Falls (Zone 7)
  // Darkened from the original #eb6834/#eda100 -- both were under the
  // WCAG AA 4.5:1 contrast minimum for the badge's white label text
  // (roughly 3.2:1 and 2.2:1), making them hard to read.
  "9286066f-d319-4795-b1bb-eb2dcc968287": "#b34a1f", // Avon/Westlake/Lakewood (Zone 5)
  "1c6dec2c-67cf-41a7-9dfc-d6e55edd034c": "#1baf7a", // Beachwood (Zone 2)
  "160ca4cf-0d2c-40e2-ae84-00af35f0d65e": "#9c6600", // Cuyahoga Falls
  "6a244b0a-22b1-4ce2-9a80-1874a0741284": "#e87ba4", // Fairlawn/Akron
  "c9fdb976-62ee-44de-a33a-989cd5890010": "#008300", // HH/RH/Euclid/Wickliffe (Zone 3)
  "b78f0774-3f96-4053-9895-4afa81f2b596": "#4a3aa7", // Highland Hills/Shaker Heights/Solon (Zone 4)
  "ef3c2d31-b1bd-41b8-8e36-163822215774": "#e34948", // Macedonia/Twinsburg/Northfield/Oakwood (Zone 6)
  "564f20ce-c6e7-42cc-bf76-db9b3967bbc3": "#0f8b8d", // North Royalton/Broadview Heights/Parma/Seven Hills (Zone 7)
  "66da2eb2-eb21-4c21-996a-473c763f5f18": "#8a5a2b", // Strongsville
  "7d4f6708-e642-4387-ac9f-14c3ae21690a": "#5b5fc7", // University Circle/Cleveland Heights (Zone 1)
  "bc8cda95-333e-4197-9537-1e919552f589": "#d6336c", // Willoughby
  "1dcda34c-545b-47eb-bb75-3807e96b5bde": "#7a8c1f", // Youngstown
};

const FALLBACK_COLOR = "#898781";

// Same hues as CLUSTER_COLORS above (already checked for readable
// contrast against the badge's white text) -- used so a newly-added
// cluster gets a real, distinguishable color right away instead of
// silently falling back to the same gray forever. Whoever adds a
// cluster can still give it a hand-picked entry above later; this is
// just a reasonable color until then, not a permanent assignment.
const FALLBACK_PALETTE = [
  "#2a78d6",
  "#b34a1f",
  "#1baf7a",
  "#9c6600",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
  "#e34948",
  "#0f8b8d",
  "#8a5a2b",
  "#5b5fc7",
  "#d6336c",
  "#7a8c1f",
];

function hashClusterId(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function clusterColor(clusterId: string | null | undefined): string {
  if (!clusterId) return FALLBACK_COLOR;
  return CLUSTER_COLORS[clusterId] ?? FALLBACK_PALETTE[hashClusterId(clusterId) % FALLBACK_PALETTE.length];
}
