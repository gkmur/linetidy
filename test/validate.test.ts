import { describe, expect, it } from 'vitest';

import { fixScientificNotation, validate } from '../src/validate.js';

describe('fixScientificNotation', () => {
  it('expands scientific-notation UPCs to full integers', () => {
    expect(fixScientificNotation('1.23E+11')).toEqual({ value: '123000000000', changed: true });
  });

  it('leaves normal UPC strings untouched', () => {
    expect(fixScientificNotation('012345678905')).toEqual({ value: '012345678905', changed: false });
  });
});

describe('validate', () => {
  it('flags a missing style as an error and marks the run invalid', () => {
    const result = validate([{ size: 'M', qty: '3' }]);
    expect(result.status).toBe('invalid');
    expect(result.issues.some((i) => i.field === 'style' && i.level === 'error')).toBe(true);
  });

  it('warns when wholesale is above MSRP but stays reviewable', () => {
    const result = validate([{ style: 'A1', msrp: '100', wholesale: '120' }]);
    expect(result.status).toBe('review');
    expect(result.issues.some((i) => i.field === 'wholesale' && i.level === 'warning')).toBe(true);
  });

  it('coerces numbers and totals units across rows', () => {
    const result = validate([
      { style: 'A1', size: 'S', qty: '4', msrp: '$295' },
      { style: 'A1', size: 'M', qty: '6', msrp: '$295' },
    ]);
    expect(result.summary.totalUnits).toBe(10);
    expect(result.summary.skus).toBe(2);
    expect(result.rows[0]?.msrp).toBe(295);
    expect(result.status).toBe('complete');
  });

  it('repairs a scientific-notation UPC and warns about it', () => {
    const result = validate([{ style: 'A1', upc: '1.93E+11' }]);
    expect(result.rows[0]?.upc).toBe('193000000000');
    expect(result.issues.some((i) => i.field === 'upc' && i.message.includes('scientific'))).toBe(true);
  });
});
