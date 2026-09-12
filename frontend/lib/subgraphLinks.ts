/**
 * Derives a public Subgraph Studio playground link from the server-side query
 * URL (e.g. https://api.studio.thegraph.com/query/1758823/pit/v0.0.5 ->
 * https://thegraph.com/studio/subgraph/pit/playground/). Never pass the API
 * key through this — it's a display-only deep link, not an authenticated call.
 */
export function studioPlaygroundUrl(queryUrl: string): string | null {
  try {
    const segments = new URL(queryUrl).pathname.split("/").filter(Boolean);
    // pathname: /query/<id>/<slug>/<version>
    const slug = segments[2];
    if (!slug) return null;
    return `https://thegraph.com/studio/subgraph/${slug}/playground/`;
  } catch {
    return null;
  }
}
