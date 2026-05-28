import { z } from 'zod';

/**
 * The canonical shape every linesheet gets normalized into.
 * Source files use wildly different column names; these are the fields
 * we map them onto.
 */
export const CANONICAL_FIELDS = [
  'style',
  'description',
  'brand',
  'category',
  'color',
  'size',
  'upc',
  'msrp',
  'wholesale',
  'qty',
  'season',
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

/**
 * Known header synonyms per canonical field. Lowercased, matched
 * exact-first then by substring. Extend these freely for your own files.
 */
export const SYNONYMS: Record<CanonicalField, string[]> = {
  style: ['style', 'style number', 'style no', 'style #', 'style#', 'item', 'item number', 'item #', 'item no', 'sku', 'product id', 'model', 'ref'],
  description: ['description', 'desc', 'name', 'product name', 'style name', 'item description', 'product'],
  brand: ['brand', 'label', 'designer', 'vendor', 'manufacturer', 'make'],
  category: ['category', 'type', 'class', 'department', 'dept', 'product type'],
  color: ['color', 'colour', 'colorway', 'colourway', 'color name', 'shade'],
  size: ['size', 'sizes', 'size run', 'size scale'],
  upc: ['upc', 'barcode', 'ean', 'gtin', 'upc code', 'upc-a'],
  msrp: ['msrp', 'retail', 'retail price', 'rrp', 'srp', 'list price', 'price'],
  wholesale: ['wholesale', 'wholesale price', 'cost', 'unit cost', 'ws', 'wsp', 'buy price'],
  qty: ['qty', 'quantity', 'units', 'count', 'on hand', 'on-hand', 'available', 'stock', 'inventory', 'units remaining'],
  season: ['season', 'collection', 'drop', 'delivery'],
};

/** Canonical apparel + footwear sizes used to detect size-chart columns. */
export const CANONICAL_SIZES = new Set<string>([
  'OS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2XL', '3XL', '4XL',
  // numeric apparel + footwear
  ...Array.from({ length: 45 }, (_, i) => String(i + 4)),
  // half shoe sizes
  ...Array.from({ length: 30 }, (_, i) => `${i + 4}.5`),
]);

/** A single normalized output row. All fields optional; validation flags gaps. */
export const RowSchema = z.object({
  style: z.string().optional(),
  description: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  upc: z.string().optional(),
  msrp: z.number().nonnegative().optional(),
  wholesale: z.number().nonnegative().optional(),
  qty: z.number().int().nonnegative().optional(),
  season: z.string().optional(),
});

export type Row = z.infer<typeof RowSchema>;
