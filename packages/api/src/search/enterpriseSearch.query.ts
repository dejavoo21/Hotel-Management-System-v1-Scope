import type { Prisma } from '@prisma/client';

const STOP_WORDS = new Set(['a', 'an', 'and', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);

export function enterpriseSearchTerms(query: string): string[] {
  return [...new Set(
    query
      .toLowerCase()
      .replace(/[^a-z0-9#-]+/g, ' ')
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => term.length > 1 && !STOP_WORDS.has(term)),
  )].slice(0, 8);
}

export function enterpriseSearchTextWhere(query: string): Prisma.SearchIndexWhereInput | null {
  const phrase = query.trim();
  if (!phrase) return null;

  const fields: Array<'title' | 'summary' | 'searchableText' | 'roomNumber'> = ['title', 'summary', 'searchableText', 'roomNumber'];
  const phraseConditions = fields.map((field) => ({ [field]: { contains: phrase, mode: 'insensitive' as const } }));
  const tokenConditions = enterpriseSearchTerms(phrase).flatMap((term) => fields.map((field) => ({
    [field]: { contains: term, mode: 'insensitive' as const },
  })));

  return { OR: [...phraseConditions, ...tokenConditions] };
}

export function enterpriseSearchRelevance(record: { title?: string | null; summary?: string | null; searchableText?: string | null; roomNumber?: string | null }, query: string): number {
  const phrase = query.trim().toLowerCase();
  if (!phrase) return 0;
  const title = String(record.title || '').toLowerCase();
  const summary = String(record.summary || '').toLowerCase();
  const searchableText = String(record.searchableText || '').toLowerCase();
  const roomNumber = String(record.roomNumber || '').toLowerCase();
  const terms = enterpriseSearchTerms(phrase);

  let score = 0;
  if (title.includes(phrase)) score += 100;
  if (summary.includes(phrase)) score += 60;
  if (searchableText.includes(phrase)) score += 40;
  if (roomNumber === phrase) score += 120;
  for (const term of terms) {
    if (title.includes(term)) score += 18;
    if (summary.includes(term)) score += 10;
    if (searchableText.includes(term)) score += 5;
    if (roomNumber.includes(term)) score += 12;
  }
  return score;
}

export function enterpriseSearchMatchesQuery(record: { title?: string | null; summary?: string | null; searchableText?: string | null; roomNumber?: string | null }, query: string): boolean {
  const phrase = query.trim().toLowerCase();
  if (!phrase) return true;
  const haystack = [record.title, record.summary, record.searchableText, record.roomNumber]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');
  if (haystack.includes(phrase)) return true;
  const terms = enterpriseSearchTerms(phrase);
  if (!terms.length) return false;
  const matchedTerms = terms.filter((term) => haystack.includes(term)).length;
  return matchedTerms >= Math.min(2, terms.length);
}

export function enterpriseSearchSnippetNeedle(query: string, text: string): string {
  const normalizedText = text.toLowerCase();
  const phrase = query.trim().toLowerCase();
  if (phrase && normalizedText.includes(phrase)) return phrase;
  return enterpriseSearchTerms(query).find((term) => normalizedText.includes(term)) || '';
}
