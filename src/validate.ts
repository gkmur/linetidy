import type { FlatRow } from './expand.js';
import { RowSchema, type Row } from './schema.js';

export type IssueLevel = 'error' | 'warning';

export interface CellIssue {
  row: number;
  field: string;
  level: IssueLevel;
  message: string;
}

export interface LotSummary {
  rows: number;
  skus: number;
  totalUnits: number;
  upcFillRate: number;
  msrpFillRate: number;
}

export type RunStatus = 'complete' | 'review' | 'invalid';

export interface ValidationResult {
  rows: Row[];
  issues: CellIssue[];
  summary: LotSummary;
  status: RunStatus;
}

const SCI = /^-?\d(\.\d+)?[eE]\+?\d+$/;

/** Expand "1.23E+11" style UPCs back to a full integer string. */
export function fixScientificNotation(raw: string): { value: string; changed: boolean } {
  const trimmed = raw.trim();
  if (!SCI.test(trimmed)) return { value: trimmed, changed: false };
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { value: trimmed, changed: false };
  return { value: BigInt(Math.round(n)).toString(), changed: true };
}

function toNumber(raw: string | undefined): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(String(raw).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

const round1 = (n: number): number => Math.round(n * 1000) / 1000;

export function validate(flatRows: FlatRow[]): ValidationResult {
  const rows: Row[] = [];
  const issues: CellIssue[] = [];

  flatRows.forEach((flat, i) => {
    const candidate: Record<string, unknown> = {
      style: flat.style,
      description: flat.description,
      brand: flat.brand,
      category: flat.category,
      color: flat.color,
      size: flat.size,
      season: flat.season,
    };

    // UPC: repair scientific notation, then sanity-check length.
    if (flat.upc != null && flat.upc !== '') {
      const { value, changed } = fixScientificNotation(flat.upc);
      candidate.upc = value;
      if (changed) {
        issues.push({ row: i, field: 'upc', level: 'warning', message: 'expanded scientific-notation UPC' });
      }
      const digits = value.replace(/\D/g, '');
      if (digits.length > 0 && ![8, 11, 12, 13, 14].includes(digits.length)) {
        issues.push({ row: i, field: 'upc', level: 'warning', message: `unusual UPC length (${digits.length})` });
      }
    }

    // Numbers: flag non-empty values that fail to parse.
    for (const field of ['msrp', 'wholesale', 'qty'] as const) {
      const rawVal = flat[field];
      if (rawVal == null || rawVal === '') continue;
      const n = toNumber(rawVal);
      if (n == null) {
        issues.push({ row: i, field, level: 'error', message: `"${rawVal}" is not a number` });
      } else {
        candidate[field] = field === 'qty' ? Math.round(n) : n;
      }
    }

    // Required + cross-field business rules.
    if (!candidate.style) {
      issues.push({ row: i, field: 'style', level: 'error', message: 'missing style' });
    }
    if (candidate.size != null && candidate.qty == null) {
      issues.push({ row: i, field: 'qty', level: 'warning', message: 'sized row has no quantity' });
    }
    if (typeof candidate.msrp === 'number' && typeof candidate.wholesale === 'number' && candidate.wholesale > candidate.msrp) {
      issues.push({ row: i, field: 'wholesale', level: 'warning', message: 'wholesale is above MSRP' });
    }

    // Final type-check through Zod; surface any remaining shape errors.
    const parsed = RowSchema.safeParse(candidate);
    if (parsed.success) {
      rows.push(parsed.data);
    } else {
      const first = parsed.error.issues[0];
      issues.push({ row: i, field: String(first?.path[0] ?? '-'), level: 'error', message: first?.message ?? 'invalid row' });
      // keep a best-effort row so output still lines up
      rows.push({ style: typeof candidate.style === 'string' ? candidate.style : undefined });
    }
  });

  const totalUnits = rows.reduce((sum, r) => sum + (r.qty ?? 0), 0);
  const withUpc = rows.filter((r) => r.upc).length;
  const withMsrp = rows.filter((r) => r.msrp != null).length;
  const summary: LotSummary = {
    rows: rows.length,
    skus: new Set(rows.map((r) => `${r.style ?? ''}|${r.size ?? ''}`)).size,
    totalUnits,
    upcFillRate: rows.length ? round1(withUpc / rows.length) : 0,
    msrpFillRate: rows.length ? round1(withMsrp / rows.length) : 0,
  };

  const hasError = issues.some((x) => x.level === 'error');
  const hasWarning = issues.some((x) => x.level === 'warning');
  const status: RunStatus = hasError ? 'invalid' : hasWarning ? 'review' : 'complete';

  return { rows, issues, summary, status };
}
