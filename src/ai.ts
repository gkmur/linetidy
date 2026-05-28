import { CANONICAL_FIELDS, type CanonicalField } from './schema.js';
import type { RawRow } from './normalize.js';

const FIELD_SET = new Set<string>(CANONICAL_FIELDS);
const MODEL = process.env.LINETIDY_MODEL ?? 'claude-3-5-haiku-latest';

/**
 * Ask Claude to map headers the synonym dictionary missed onto canonical
 * fields. Returns {} if no API key, the SDK isn't installed, or anything
 * goes wrong, so the pipeline degrades to deterministic-only.
 */
export async function aiMapHeaders(
  unmatched: string[],
  sampleRows: RawRow[]
): Promise<Record<string, CanonicalField>> {
  if (!process.env.ANTHROPIC_API_KEY || unmatched.length === 0) return {};

  let Anthropic: typeof import('@anthropic-ai/sdk').default;
  try {
    Anthropic = (await import('@anthropic-ai/sdk')).default;
  } catch {
    console.warn('[linetidy] AI mapping skipped: install @anthropic-ai/sdk to enable it.');
    return {};
  }

  const samples = unmatched.map((header) => ({
    header,
    examples: sampleRows
      .map((r) => r[header])
      .filter((v): v is string => Boolean(v))
      .slice(0, 3),
  }));

  const prompt = [
    'Map each unknown linesheet column header to one canonical inventory field.',
    `Canonical fields: ${CANONICAL_FIELDS.join(', ')}.`,
    'If a header does not fit any field, use "none".',
    'Return ONLY a JSON object of header -> field. No prose, no code fences.',
    '',
    JSON.stringify(samples, null, 2),
  ].join('\n');

  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = res.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    const parsed = JSON.parse(text) as Record<string, string>;
    const overrides: Record<string, CanonicalField> = {};
    for (const [header, field] of Object.entries(parsed)) {
      if (FIELD_SET.has(field)) overrides[header] = field as CanonicalField;
    }
    return overrides;
  } catch (err) {
    console.warn(`[linetidy] AI mapping failed, continuing deterministic: ${(err as Error).message}`);
    return {};
  }
}
