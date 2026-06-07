import { describe, it, expect } from 'vitest';
import { buildShareUrl } from '../../utils/deeplink';

describe('buildShareUrl', () => {
  const link = { bookHash: 'abc', noteId: 'n1', did: 'he', cfi: '/6/4!/4/2' };

  it('builds the custom-scheme app URL when linkType is "app"', () => {
    const url = buildShareUrl(link, 'app');
    expect(url.startsWith('readup://share?id=abc&nid=n1&did=he&loc')).toBe(true);
  });

  it('builds the HTTPS web URL when linkType is "web"', () => {
    const url = buildShareUrl(link, 'web');
    expect(url.startsWith('https://')).toBe(true);
    expect(url).toContain('/share?id=abc');
  });

  it('preserves the noteid query for both link types', () => {
    expect(buildShareUrl(link, 'app')).toContain(`nid=n1`);
    expect(buildShareUrl(link, 'web')).toContain(`nid=n1`);
  });

  it('preserves the did query for both link types', () => {
    expect(buildShareUrl(link, 'app')).toContain(`did=he`);
    expect(buildShareUrl(link, 'web')).toContain(`did=he`);
  });

  it('preserves the cfi query for both link types', () => {
    const encoded = encodeURIComponent(link.cfi);
    expect(buildShareUrl(link, 'app')).toContain(`loc=${encoded}`);
    expect(buildShareUrl(link, 'web')).toContain(`loc=${encoded}`);
  });

  it('omits the cfi query when no cfi is provided', () => {
    const url = buildShareUrl({ bookHash: 'abc', noteId: 'n1' }, 'app');
    expect(url).toBe('readup://share?id=abc&nid=n1');
  });
});
