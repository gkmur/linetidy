import { CANONICAL_SIZES, SYNONYMS, type CanonicalField } from './schema.js';

export type RawRow = Record<string, string>;

export interface MappedRow {
  /** Scalar canonical values, still as raw strings (coerced later). */
  fields: Partial<Record<CanonicalField, string>>;
  /** Size-chart cells: original size header -> quantity string. */
  sizes: Record<string, string>;
}

export interface Mapping {
  /** header -> canonical field, the literal 'size' chart marker, or null. */
  byHeader: Record<string, CanonicalField | 'size-chart' | null>;
  sizeColumns: string[];
  /** Headers that matched no synonym and aren't size columns. */
  unmatched: string[];
}

const norm = (s: string): string => s.toLowerCase().trim().replace(/\s+/g, ' ');

function matchSynonym(header: string): CanonicalField | null {
  const h = norm(header);
  // exact synonym match first
  for (const field of Object.keys(SYNONYMS) as CanonicalField[]) {
    if (SYNONYMS[field].some((syn) => syn === h)) return field;
  }
  // then substring either direction (e.g. "wholesale price usd" -> wholesale)
  for (const field of Object.keys(SYNONYMS) as CanonicalField[]) {
    if (SYNONYMS[field].some((syn) => h.includes(syn) || syn.includes(h))) return field;
  }
  return null;
}

function isSizeColumn(header: string): boolean {
  return CANONICAL_SIZES.has(header.trim().toUpperCase());
}

/**
 * Build a header->field mapping. `overrides` (e.g. from AI) win over synonym
 * matching and let you resolve headers the dictionary missed.
 */
export function buildMapping(
  headers: string[],
  overrides: Record<string, CanonicalField> = {}
): Mapping {
  const byHeader: Mapping['byHeader'] = {};
  const sizeColumns: string[] = [];
  const unmatched: string[] = [];

  for (const header of headers) {
    if (overrides[header]) {
      byHeader[header] = overrides[header];
      continue;
    }
    if (isSizeColumn(header)) {
      byHeader[header] = 'size-chart';
      sizeColumns.push(header);
      continue;
    }
    const field = matchSynonym(header);
    byHeader[header] = field;
    if (!field) unmatched.push(header);
  }

  return { byHeader, sizeColumns, unmatched };
}

/** Apply a mapping to raw rows, splitting scalar fields from size-chart cells. */
export function applyMapping(rawRows: RawRow[], mapping: Mapping): MappedRow[] {
  return rawRows.map((raw) => {
    const fields: MappedRow['fields'] = {};
    const sizes: MappedRow['sizes'] = {};

    for (const [header, value] of Object.entries(raw)) {
      const target = mapping.byHeader[header];
      if (!target || value == null || value === '') continue;
      if (target === 'size-chart') {
        sizes[header] = value;
      } else {
        // first non-empty value wins if two headers map to the same field
        if (fields[target] == null) fields[target] = value.trim();
      }
    }

    return { fields, sizes };
  });
}
