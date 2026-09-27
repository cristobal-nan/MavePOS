/**
 * Normalizes text for search indexing and queries:
 * - Upper case
 * - Strips accents/diacritics (NFD)
 * - Trims outer whitespace
 */
export function normalizeSearchName(text: string): string {
  if (!text) return ''
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
}
