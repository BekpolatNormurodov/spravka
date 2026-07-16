import { describe, expect, it } from 'vitest';
import { fontFaceCss, SUBSTITUTED_FAMILIES } from './fonts';

describe('bundled document fonts', () => {
  const css = fontFaceCss();

  it('declares the families the document actually names', () => {
    // The component asks for these by name; the @font-face has to answer to the same name or
    // Chromium falls through to whatever the host has.
    expect(SUBSTITUTED_FAMILIES).toEqual(['Times New Roman', 'Arial']);
    for (const family of SUBSTITUTED_FAMILIES) {
      expect(css).toContain(`font-family:'${family}'`);
    }
  });

  it('embeds the bytes rather than linking them', () => {
    expect(css).toContain('src:url(data:font/woff2;base64,');
    // A fetched font would make a signed document depend on the network at that moment.
    expect(css).not.toMatch(/src:url\((?!data:)/);
  });

  it('carries both weights — the body is regular, names and the stamp are bold', () => {
    expect(css).toContain('font-weight:400');
    expect(css).toContain('font-weight:700');
  });

  it('covers cyrillic-ext, where Uzbek қ/ғ/ҳ live', () => {
    // The tripwire for the subtlest failure: drop this range and the document renders correctly
    // apart from three letters, which fall back to another font mid-word.
    expect(css).toContain('U+0460-052F');
  });

  it('is cached — the files are ~200KB and never change between renders', () => {
    expect(fontFaceCss()).toBe(css);
  });
});
