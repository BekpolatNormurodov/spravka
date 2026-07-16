// Node-only. Reached through the `@spravka/shared/pdf` subpath so it never enters a browser
// or edge bundle — same rule that keeps `qr` and `password` off `core`.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

interface Substitute {
  /**
   * The family name the *document* asks for. The @font-face is declared under this name, so
   * `font-family: "Times New Roman"` in CertificateDocument resolves to the bundled bytes with
   * no change to the component.
   */
  as: string;
  pkg: string;
  /** Filename prefix inside <pkg>/files. */
  slug: string;
  subsets: string[];
  weights: number[];
}

/**
 * Croscore substitutes, embedded rather than installed.
 *
 * The document is Times New Roman and the stamp renders in Arial. The Linux host has neither,
 * and Chromium does not fail on a missing font — it silently picks another and re-flows every
 * line. That would be correct in dev, wrong in prod, and already frozen into every stored file
 * by the time anyone looked. Tinos and Arimo are metrically identical to Times New Roman and
 * Arial (same advance widths, by design), so line breaks land in the same place, and inlining
 * them makes the render depend on nothing installed on the machine.
 *
 * Subsets are not guesswork: they are the ones the document's own text needs. Uzbek Cyrillic
 * қ/ғ/ҳ live in cyrillic-ext, not cyrillic — dropping it would fall back on those letters alone.
 */
const SUBSTITUTES: Substitute[] = [
  {
    as: 'Times New Roman',
    pkg: '@fontsource/tinos',
    slug: 'tinos',
    subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
    weights: [400, 700],
  },
  {
    // The stamp only ever renders Cyrillic, so it needs no latin.
    as: 'Arial',
    pkg: '@fontsource/arimo',
    slug: 'arimo',
    subsets: ['cyrillic', 'cyrillic-ext'],
    weights: [400, 700],
  },
];

let cached: string | null = null;

/**
 * `@font-face` rules with the fonts inlined as base64. Cached: the files are ~200KB and never
 * change between renders.
 */
export function fontFaceCss(): string {
  if (cached !== null) return cached;

  const rules: string[] = [];
  for (const sub of SUBSTITUTES) {
    const dir = path.dirname(require.resolve(`${sub.pkg}/package.json`));
    // Ranges come from the package itself, so they cannot drift from the shipped files.
    const ranges = JSON.parse(readFileSync(path.join(dir, 'unicode.json'), 'utf8')) as Record<string, string>;

    for (const subset of sub.subsets) {
      const range = ranges[subset];
      if (!range) throw new Error(`${sub.pkg}: unicode.json has no subset "${subset}"`);

      for (const weight of sub.weights) {
        const file = path.join(dir, 'files', `${sub.slug}-${subset}-${weight}-normal.woff2`);
        const b64 = readFileSync(file).toString('base64');
        rules.push(
          `@font-face{font-family:'${sub.as}';font-style:normal;font-weight:${weight};` +
            `src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:${range};}`,
        );
      }
    }
  }

  cached = rules.join('\n');
  return cached;
}

/** Families declared by {@link fontFaceCss} — the tripwire the tests assert against. */
export const SUBSTITUTED_FAMILIES = SUBSTITUTES.map((s) => s.as);
