import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/misc', () => ({ isCJKEnv: vi.fn(() => false) }));
vi.mock('@/utils/path', () => ({
  getFilename: vi.fn((path: string) => path.split('/').pop() || path),
}));
vi.mock('@/utils/md5', () => ({
  md5Fingerprint: vi.fn((name: string) => `md5_${name}`),
}));

import { isCJKEnv } from '@/utils/misc';
import { mountAdditionalFonts } from '@/styles/font';


describe('mountAdditionalFonts', () => {
  beforeEach(() => {
    // Reset document head between tests
    document.head.innerHTML = '';
    vi.mocked(isCJKEnv).mockReturnValue(false);
  });

  it('skips a document without a <head> such as an SVG spine item (#480)', async () => {
    const svgDoc = new DOMParser().parseFromString(
      '<svg xmlns="http://www.w3.org/2000/svg"><text>page</text></svg>',
      'image/svg+xml',
    );
    await expect(mountAdditionalFonts(svgDoc, true)).resolves.toBeUndefined();
    expect(svgDoc.querySelector('style, link')).toBeNull();
  });

  it('should mount basic Google Fonts link tags', async () => {
    await mountAdditionalFonts(document);

    const links = document.head.querySelectorAll('link[rel="stylesheet"]');
    expect(links.length).toBeGreaterThanOrEqual(1);

    // Verify at least one link points to Google Fonts
    const hrefs = Array.from(links).map((l) => l.getAttribute('href') || '');
    expect(hrefs.some((h) => h.includes('fonts.googleapis.com'))).toBe(true);
  });

  it('should set crossOrigin on link tags', async () => {
    await mountAdditionalFonts(document);

    const links = document.head.querySelectorAll('link');
    for (const link of Array.from(links)) {
      expect(link.crossOrigin).toBe('anonymous');
    }
  });

  it('should not mount CJK fonts when isCJK is false', async () => {
    await mountAdditionalFonts(document, false);

    const styles = document.head.querySelectorAll('style');
    expect(styles.length).toBe(0);

    const links = document.head.querySelectorAll('link');
    const hrefs = Array.from(links).map((l) => l.getAttribute('href') || '');
    expect(hrefs.some((h) => h.includes('jsdelivr.net'))).toBe(false);
  });

  it('should mount CJK fonts when isCJK is true', async () => {
    await mountAdditionalFonts(document, true);

    // Should have a style element with @font-face rules
    const styles = document.head.querySelectorAll('style');
    expect(styles.length).toBeGreaterThanOrEqual(1);

    const styleContent = styles[0]!.textContent || '';
    expect(styleContent).toContain('@font-face');
    expect(styleContent).toContain('FangSong');
    expect(styleContent).toContain('Kaiti');
    expect(styleContent).toContain('Heiti');
    expect(styleContent).toContain('XiHeiti');

    // Should have CJK-specific link tags
    const links = document.head.querySelectorAll('link');
    const hrefs = Array.from(links).map((l) => l.getAttribute('href') || '');
    expect(hrefs.some((h) => h.includes('jsdelivr.net'))).toBe(true);
  });

  it('should mount CJK fonts when isCJKEnv returns true', async () => {
    vi.mocked(isCJKEnv).mockReturnValue(true);

    await mountAdditionalFonts(document);

    const styles = document.head.querySelectorAll('style');
    expect(styles.length).toBeGreaterThanOrEqual(1);

    const styleContent = styles[0]!.textContent || '';
    expect(styleContent).toContain('@font-face');
  });

  it('should mount CJK fonts when either isCJK param or isCJKEnv is true', async () => {
    vi.mocked(isCJKEnv).mockReturnValue(false);
    await mountAdditionalFonts(document, true);

    const styles = document.head.querySelectorAll('style');
    expect(styles.length).toBeGreaterThanOrEqual(1);
  });
});

