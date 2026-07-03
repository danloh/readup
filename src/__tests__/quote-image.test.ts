import { describe, expect, it } from 'vitest';
import { resolveQuoteImageOptions } from '../../packages/foliate-js/quote-image.js';

describe('resolveQuoteImageOptions', () => {
  it('keeps horizontal defaults while applying custom colors and spacing', () => {
    const options = resolveQuoteImageOptions({
      backgroundColor: '#111827',
      textColor: '#f9fafb',
      fontSize: 24,
      lineHeight: 2,
      writingMode: 'horizontal-tb',
    });

    expect(options.backgroundColor).toBe('#111827');
    expect(options.color).toBe('#f9fafb');
    expect(options.fontSize).toBe(24);
    expect(options.lineHeight).toBe(2);
    expect(options.writingMode).toBe('horizontal-tb');
    expect(options.direction).toBe('ltr');
  });

  it('preserves vertical writing settings', () => {
    const options = resolveQuoteImageOptions({
      writingMode: 'vertical-rl',
      direction: 'rtl',
      textAlign: 'center',
    });

    expect(options.writingMode).toBe('vertical-rl');
    expect(options.direction).toBe('rtl');
    expect(options.textAlign).toBe('center');
  });
});
