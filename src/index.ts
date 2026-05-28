#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

import { rowsToCsv, runPipeline } from './pipeline.js';

interface Args {
  file?: string;
  ai: boolean;
  out?: string;
  format: 'csv' | 'json';
  quiet: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { ai: false, format: 'csv', quiet: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--ai') args.ai = true;
    else if (a === '--quiet' || a === '-q') args.quiet = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--json') args.format = 'json';
    else if (a === '--out' || a === '-o') args.out = argv[++i];
    else if (a === '--format') args.format = argv[++i] === 'json' ? 'json' : 'csv';
    else if (a && !a.startsWith('-')) args.file ??= a;
  }
  return args;
}

const HELP = `linetidy - normalize messy supplier linesheets into clean inventory data

Usage:
  linetidy <file.csv> [options]

Options:
  --ai              Use Claude to map headers the dictionary misses (needs ANTHROPIC_API_KEY)
  -o, --out <path>  Write normalized output to a file (default: stdout)
  --format <fmt>    Output format: csv (default) or json
  --json            Shorthand for --format json
  -q, --quiet       Suppress the summary report
  -h, --help        Show this help

Examples:
  linetidy samples/messy-linesheet.csv
  linetidy linesheet.csv --out clean.csv
  node --env-file=.env dist/index.js linesheet.csv --ai --json
`;

function report(result: Awaited<ReturnType<typeof runPipeline>>): void {
  const { summary, status, mapping, issues, aiUsed } = result;
  const matched = mapping.sizeColumns.length + Object.values(mapping.byHeader).filter((v) => v && v !== 'size-chart').length;

  const lines = [
    '',
    `  status        ${status}`,
    `  rows          ${summary.rows}`,
    `  skus          ${summary.skus}`,
    `  total units   ${summary.totalUnits}`,
    `  upc fill      ${Math.round(summary.upcFillRate * 100)}%`,
    `  msrp fill     ${Math.round(summary.msrpFillRate * 100)}%`,
    `  columns       ${matched} mapped, ${mapping.unmatched.length} unmatched, ${mapping.sizeColumns.length} size`,
    `  ai mapping    ${aiUsed ? 'used' : 'off'}`,
  ];

  if (mapping.unmatched.length > 0) {
    lines.push(`  unmatched     ${mapping.unmatched.join(', ')}`);
  }

  const errors = issues.filter((x) => x.level === 'error');
  const warnings = issues.filter((x) => x.level === 'warning');
  lines.push(`  issues        ${errors.length} errors, ${warnings.length} warnings`);
  for (const issue of issues.slice(0, 10)) {
    lines.push(`    row ${issue.row} ${issue.field}: ${issue.level} - ${issue.message}`);
  }
  if (issues.length > 10) lines.push(`    ... and ${issues.length - 10} more`);
  lines.push('');

  process.stderr.write(lines.join('\n') + '\n');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.file) {
    process.stdout.write(HELP);
    process.exit(args.file ? 0 : 1);
  }

  let csvText: string;
  try {
    csvText = readFileSync(args.file, 'utf8');
  } catch {
    process.stderr.write(`linetidy: cannot read file "${args.file}"\n`);
    process.exit(1);
  }

  const result = await runPipeline(csvText, { ai: args.ai });
  const output = args.format === 'json' ? JSON.stringify(result.rows, null, 2) : rowsToCsv(result.rows);

  if (args.out) {
    writeFileSync(args.out, output);
    if (!args.quiet) report(result);
    process.stderr.write(`linetidy: wrote ${result.rows.length} rows to ${args.out}\n`);
  } else {
    if (!args.quiet) report(result);
    process.stdout.write(output);
  }

  // Non-zero exit when data is invalid, so CI/scripts can gate on it.
  process.exit(result.status === 'invalid' ? 2 : 0);
}

main().catch((err) => {
  process.stderr.write(`linetidy: ${(err as Error).message}\n`);
  process.exit(1);
});
