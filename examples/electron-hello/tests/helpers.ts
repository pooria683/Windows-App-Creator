/** Test helpers — mirrors the CLI's toProductName for template tests. */
export function toProductName(slug: string): string {
  return (
    slug
      .split(/[-_]+/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join('') || 'WinForgeApp'
  );
}
