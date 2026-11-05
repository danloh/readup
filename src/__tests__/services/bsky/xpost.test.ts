import { describe, expect, it, vi } from 'vitest';
import type { Agent } from '@atproto/api';
import { buildFacets, linkFacet, postWithImageAndLink } from '@/services/bsky/xpost';

const bytes = (s: string) => new TextEncoder().encode(s).length;

describe('post facets', () => {
  it('computes UTF-8 byte offsets for a titled link after CJK and emoji', () => {
    const text = '《红楼梦》📚 #读书\n📖 Read on Readup';
    const facet = linkFacet(text, 'Read on Readup', 'https://readup.cc/x')!;
    const start = text.lastIndexOf('Read on Readup');
    expect(facet.index.byteStart).toBe(bytes(text.slice(0, start)));
    expect(facet.index.byteEnd).toBe(bytes(text));
  });

  it('detects unicode hashtags without Buffer', async () => {
    const { facets } = await buildFacets({} as Agent, '好书 #读书 #booksky');
    const tags = facets!.flatMap((f) => f.features.map((feat) => (feat as { tag?: string }).tag));
    expect(tags).toEqual(['读书', 'booksky']);
  });

  it('rejects posts over the 300 character limit', async () => {
    await expect(buildFacets({} as Agent, 'x'.repeat(301))).rejects.toThrow(/too long/);
  });

  it('creates the post in the agent DID repo (works for OAuth agents)', async () => {
    const createRecord = vi.fn().mockResolvedValue({ success: true, data: { uri: 'at://p' } });
    const agent = {
      assertDid: 'did:plc:me',
      uploadBlob: vi.fn().mockResolvedValue({ data: { blob: { ref: 'b' } } }),
      com: { atproto: { repo: { createRecord } } },
    } as unknown as Agent;

    await postWithImageAndLink(agent, {
      text: 'Quote #booksky',
      imageData: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
      url: 'https://readup.cc/read/h',
      linkTitle: 'Read the Book on Readup',
    });

    const arg = createRecord.mock.calls[0]![0];
    expect(arg.repo).toBe('did:plc:me');
    expect(arg.record.embed.$type).toBe('app.bsky.embed.images');
    const link = arg.record.facets.find((f: { features: { $type: string }[] }) =>
      f.features[0]!.$type === 'app.bsky.richtext.facet#link',
    );
    expect(link.features[0].uri).toBe('https://readup.cc/read/h');
  });
});
