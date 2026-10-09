/** Extract bounded page references from untrusted model output. */
export function extractCitations(content: string): number[] {
  const pages = new Set<number>();
  const re = /第\s*(\d+)\s*(?:-|—|至)\s*(\d+)\s*页|第\s*(\d+)\s*页/g;
  for (const match of content.matchAll(re)) {
    const start = Number(match[1] ?? match[3]);
    const end = Number(match[2] ?? match[3]);
    if (start < 1 || end > 100_000 || end < start) continue;
    for (let page = start; page <= Math.min(end, start + 999); page++) pages.add(page);
  }
  return [...pages].sort((a, b) => a - b);
}
