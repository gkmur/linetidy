import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

import { aiMapHeaders } from './ai.js';
import { expand } from './expand.js';
import { applyMapping, buildMapping, type Mapping, type RawRow } from './normalize.js';
import { CANONICAL_FIELDS, type Row } from './schema.js';
import { validate, type ValidationResult } from './validate.js';

export interface PipelineOptions {
  /** Enable AI mapping for headers the dictionary misses (needs an API key). */
  ai?: boolean;
}

export interface PipelineResult extends ValidationResult {
  headers: string[];
  mapping: Mapping;
  aiUsed: boolean;
}

export async function runPipeline(
  csvText: string,
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true,
  }) as RawRow[];

  const headers = records.length > 0 ? Object.keys(records[0]!) : [];

  let mapping = buildMapping(headers);
  let aiUsed = false;

  if (options.ai && mapping.unmatched.length > 0) {
    const overrides = await aiMapHeaders(mapping.unmatched, records.slice(0, 5));
    if (Object.keys(overrides).length > 0) {
      mapping = buildMapping(headers, overrides);
      aiUsed = true;
    }
  }

  const mapped = applyMapping(records, mapping);
  const flat = expand(mapped, mapping.sizeColumns);
  const result = validate(flat);

  return { ...result, headers, mapping, aiUsed };
}

/** Serialize normalized rows back to CSV in canonical column order. */
export function rowsToCsv(rows: Row[]): string {
  return stringify(rows, { header: true, columns: [...CANONICAL_FIELDS] });
}
