import { describe, expect, it } from 'vitest';

import { expand } from '../src/expand.js';
import { applyMapping, buildMapping } from '../src/normalize.js';

const HEADERS = ['Style #', 'Item Description', 'Brand', 'Colourway', 'WSP', 'RRP', 'XS', 'S', 'M', 'L', 'XL', 'Season', 'Notes'];

describe('buildMapping', () => {
  it('maps exact and substring synonyms to canonical fields', () => {
    const m = buildMapping(HEADERS);
    expect(m.byHeader['Style #']).toBe('style');
    expect(m.byHeader['Item Description']).toBe('description');
    expect(m.byHeader['Colourway']).toBe('color');
    expect(m.byHeader['WSP']).toBe('wholesale');
    expect(m.byHeader['RRP']).toBe('msrp');
    expect(m.byHeader['Season']).toBe('season');
  });

  it('detects size-chart columns', () => {
    const m = buildMapping(HEADERS);
    expect(m.sizeColumns).toEqual(['XS', 'S', 'M', 'L', 'XL']);
  });

  it('reports headers that match nothing', () => {
    const m = buildMapping(HEADERS);
    expect(m.unmatched).toContain('Notes');
  });

  it('lets overrides win over synonym matching', () => {
    const m = buildMapping(['Notes'], { Notes: 'description' });
    expect(m.byHeader['Notes']).toBe('description');
    expect(m.unmatched).not.toContain('Notes');
  });
});

describe('expand', () => {
  it('turns a size chart into one row per stocked size', () => {
    const headers = ['Style #', 'S', 'M', 'L'];
    const rows = [{ 'Style #': 'SW-100', S: '4', M: '6', L: '0' }];
    const mapping = buildMapping(headers);
    const mapped = applyMapping(rows, mapping);
    const flat = expand(mapped, mapping.sizeColumns);

    // L has 0 stock, so only S and M expand.
    expect(flat).toHaveLength(2);
    expect(flat.map((r) => r.size)).toEqual(['S', 'M']);
    expect(flat.map((r) => r.qty)).toEqual(['4', '6']);
    expect(flat.every((r) => r.style === 'SW-100')).toBe(true);
  });

  it('passes rows through when there is no size chart', () => {
    const headers = ['SKU', 'Size', 'Qty'];
    const rows = [{ SKU: 'A1', Size: 'M', Qty: '3' }];
    const mapping = buildMapping(headers);
    const mapped = applyMapping(rows, mapping);
    const flat = expand(mapped, mapping.sizeColumns);
    expect(flat).toHaveLength(1);
    expect(flat[0]?.style).toBe('A1');
  });
});
