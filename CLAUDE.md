# CLAUDE.md

Guidance for Claude Code in this repo.

## What This Is

`linetidy` — CLI + library that normalizes messy supplier linesheet CSVs into one canonical inventory schema. Deterministic by default; optional Claude column mapping when both the `--ai` flag is passed and `ANTHROPIC_API_KEY` is set. Published as an npm package (`bin: linetidy`). MIT, open source.

This is the standalone, open-source distillation of the transposing logic in `../ghostflow` (Boo). Keep it dependency-light and clone-and-run with zero setup.

## Commands

```bash
npm run dev -- samples/messy-linesheet.csv          # run against a file (tsx)
npm run dev -- samples/messy-linesheet.csv --out clean.csv
npm run dev -- samples/messy-linesheet.csv --json    # JSON instead of CSV
npm run dev -- samples/messy-linesheet.csv --ai   # use Claude for unmapped headers (needs ANTHROPIC_API_KEY)
npm test          # vitest
npm run typecheck # tsc --noEmit
npm run build     # compile to dist/
```

CLI exits code `2` on invalid data (gate CI on a clean run). Cleaned rows go to stdout/`--out`; summary to stderr.

## Pipeline (4 steps, `src/pipeline.ts`)

`parse → map → expand → validate`

1. **Parse** (`csv-parse`) — CSV to rows.
2. **Map** (`normalize.ts`) — header to canonical field: exact, then substring, then synonym dict. Size-like headers (`S`/`M`/`XL`/`9`/`10.5`) tagged as size chart. Synonym dict + size set live in `src/schema.ts`.
3. **Expand** (`expand.ts`) — size chart (row-per-style) to row-per-SKU. Per-SKU files pass through.
4. **Validate** (`validate.ts`) — repairs scientific-notation UPCs, coerces prices/qty, checks required fields + price sanity, reconciles SKU/unit totals. Status: `complete` | `review` | `invalid`.

## Canonical schema

```
style  description  brand  category  color  size  upc  msrp  wholesale  qty  season
```

## Optional AI mapping (`src/ai.ts`)

`@anthropic-ai/sdk` is an optional dependency. AI mapping requires both: the `--ai` flag AND `ANTHROPIC_API_KEY` set. The flag turns it on; the key (and installed SDK) lets it run. If either is missing or the call fails, logs a note and falls back to deterministic mapping - never blocks on the model.

## Library use

```ts
import { runPipeline, rowsToCsv } from 'linetidy';
const result = await runPipeline(csvText, { ai: false });
```

## Conventions

- ESM (`"type": "module"`), Node >=18, TypeScript strict.
- Keep deps minimal — this is meant to clone and run. Anthropic SDK stays optional.
- Don't add framework/build complexity; `tsc` only.
