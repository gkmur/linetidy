import type { MappedRow } from './normalize.js';
import type { CanonicalField } from './schema.js';

/** A flat, pre-validation row. Still strings; coercion happens in validate. */
export type FlatRow = Partial<Record<CanonicalField, string>>;

function parseQty(value: string | undefined): number | null {
  if (value == null) return null;
  const n = Number(String(value).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Expand size-chart rows (one row per style with a column per size) into one
 * row per SKU (style + size + qty). Rows without size columns pass through.
 */
export function expand(rows: MappedRow[], sizeColumns: string[]): FlatRow[] {
  if (sizeColumns.length === 0) {
    return rows.map((r) => ({ ...r.fields }));
  }

  const out: FlatRow[] = [];
  for (const row of rows) {
    const sizeCells = Object.entries(row.sizes).filter(([, v]) => (parseQty(v) ?? 0) > 0);

    if (sizeCells.length === 0) {
      // No stock across the size run; keep the style as a single row.
      out.push({ ...row.fields });
      continue;
    }

    for (const [sizeLabel, qtyRaw] of sizeCells) {
      out.push({
        ...row.fields,
        size: sizeLabel.trim().toUpperCase(),
        qty: String(parseQty(qtyRaw)),
      });
    }
  }
  return out;
}
