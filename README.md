# linetidy

Normalize messy supplier linesheets into clean, validated inventory data.

Suppliers send linesheets as CSVs with no shared format. The column for a style
might be `Style #`, `item no`, or `SKU`. Sizes might be their own columns or
their own rows. Prices come labeled `WSP`, `RRP`, `MSRP`, or just `price`.
linetidy maps any of that onto one canonical schema, expands size charts into
one row per SKU, and validates every cell before you trust the data.

It runs fully deterministic by default, so you can clone it and use it with no
setup. If you set an API key, it uses Claude to map column headers the built-in
dictionary does not recognize.

## Install

```bash
git clone https://github.com/gkmur/linetidy.git
cd linetidy
npm install
```

## Usage

Run it against the included sample:

```bash
npm run dev -- samples/messy-linesheet.csv
```

Write the cleaned output to a file:

```bash
npm run dev -- samples/messy-linesheet.csv --out clean.csv
```

Get JSON instead of CSV:

```bash
npm run dev -- samples/messy-linesheet.csv --json
```

The cleaned rows go to stdout (or `--out`). A summary goes to stderr:

```
  status        invalid
  rows          16
  skus          16
  total units   69
  upc fill      0%
  msrp fill     94%
  columns       12 mapped, 1 unmatched, 5 size
  ai mapping    off
  unmatched     Notes
  issues        1 errors, 0 warnings
    row 15 style: error - missing style
```

### Options

```
--ai              Use Claude to map headers the dictionary misses (needs ANTHROPIC_API_KEY)
-o, --out <path>  Write normalized output to a file (default: stdout)
--format <fmt>    Output format: csv (default) or json
--json            Shorthand for --format json
-q, --quiet       Suppress the summary report
-h, --help        Show this help
```

The CLI exits with code `2` when the data is invalid, so you can gate a script
or CI step on a clean run.

## How it works

linetidy runs four steps:

1. Parse. Reads the CSV into rows.
2. Map. Matches each header to a canonical field, exact match first, then
   substring, then a synonym dictionary. Headers that look like sizes
   (`S`, `M`, `XL`, `9`, `10.5`) are tagged as a size chart.
3. Expand. Turns a size chart (one row per style, a column per size) into one
   row per SKU. Files that are already per-SKU pass straight through.
4. Validate. Repairs scientific-notation UPCs (`1.23E+11` becomes the full
   number), coerces prices and quantities, checks required fields and price
   sanity, then reconciles SKU and unit totals. Each run resolves to one
   status: `complete`, `review`, or `invalid`.

### Optional AI mapping

Without a key, mapping is dictionary-only. Set a key to let Claude handle
headers the dictionary misses:

```bash
cp .env.example .env
# add your ANTHROPIC_API_KEY to .env, then:
node --env-file=.env dist/index.js samples/messy-linesheet.csv --ai
```

If the key is absent or the call fails, linetidy logs a note and falls back to
deterministic mapping. It never blocks on the model.

## Use as a library

```ts
import { runPipeline, rowsToCsv } from 'linetidy';

const result = await runPipeline(csvText, { ai: false });
console.log(result.status, result.summary);
const clean = rowsToCsv(result.rows);
```

## Canonical schema

```
style  description  brand  category  color  size  upc  msrp  wholesale  qty  season
```

Extend the synonym dictionary and size set in `src/schema.ts` for your own files.

## Development

```bash
npm test          # run the test suite
npm run typecheck # type-check without emitting
npm run build     # compile to dist/
```

## License

MIT. See [LICENSE](./LICENSE).
