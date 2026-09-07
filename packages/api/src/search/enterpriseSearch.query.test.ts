import { describe, expect, it } from 'vitest';
import { enterpriseSearchMatchesQuery, enterpriseSearchRelevance, enterpriseSearchSnippetNeedle, enterpriseSearchTerms, enterpriseSearchTextWhere } from './enterpriseSearch.query.js';

describe('Enterprise Search query helpers', () => {
  it('tokenises a natural-language investigation without stop words', () => {
    expect(enterpriseSearchTerms('the water leak in basement sensor')).toEqual(['water', 'leak', 'basement', 'sensor']);
  });

  it('builds token-aware matching instead of requiring one contiguous phrase', () => {
    const where = enterpriseSearchTextWhere('water leak basement sensor');
    expect(where?.OR).toHaveLength(20);
    expect(where?.OR).toContainEqual({ searchableText: { contains: 'water', mode: 'insensitive' } });
    expect(where?.OR).toContainEqual({ title: { contains: 'sensor', mode: 'insensitive' } });
  });

  it('ranks records matching more investigation terms above partial matches', () => {
    const complete = enterpriseSearchRelevance({ title: 'Basement sensor incident', summary: 'Water leak auto-shutdown triggered' }, 'water leak basement sensor');
    const partial = enterpriseSearchRelevance({ title: 'Room sensor', summary: 'Battery status' }, 'water leak basement sensor');
    expect(complete).toBeGreaterThan(partial);
  });

  it('uses a matching token for snippets when the exact phrase is absent', () => {
    expect(enterpriseSearchSnippetNeedle('water leak basement sensor', 'Sensor WL-01 detected water in the basement')).toBe('water');
  });

  it('requires a meaningful multi-token match while preserving short searches', () => {
    const record = { title: 'Basement water sensor', summary: 'Leak detected near plant room' };
    expect(enterpriseSearchMatchesQuery(record, 'water leak investigation')).toBe(true);
    expect(enterpriseSearchMatchesQuery(record, 'zz live verify 32354534 no result')).toBe(false);
    expect(enterpriseSearchMatchesQuery({ title: 'Live operational result' }, 'zz live verify 97f984c6 no result')).toBe(false);
    expect(enterpriseSearchMatchesQuery(record, 'sensor')).toBe(true);
  });
});
