import { beforeEach, describe, expect, it, vi } from 'vitest';

const agent = {
  assertDid: 'did:plc:me',
  com: {
    atproto: {
      repo: {
        getRecord: vi.fn(),
        putRecord: vi.fn(),
        listRecords: vi.fn(),
        uploadBlob: vi.fn(),
        deleteRecord: vi.fn(),
      },
    },
  },
};

vi.mock('@/services/bsky/auth', () => ({
  getAgent: vi.fn(async () => agent),
  resolveDid: vi.fn(async () => 'https://pds.example.com'),
}));

import { getBlobCid, listBookRecords, uploadBookFile } from '@/services/bsky/atfile';
import type { Book } from '@/types/book';

const CID_STR = 'bafkreibme22gw2h7y2h7tg2fhqotaqjucnbc24deqo72b6mkl2egezxhvy';

describe('getBlobCid', () => {
  it('reads the CID from every blob shape', () => {
    // BlobRef instances carry a CID object whose toString() is the CID
    const cidObject = { toString: () => CID_STR };
    expect(getBlobCid({ ref: cidObject, mimeType: 'image/png', size: 10 })).toBe(CID_STR);
    expect(getBlobCid({ ref: { $link: CID_STR } })).toBe(CID_STR);
    expect(getBlobCid({ cid: CID_STR })).toBe(CID_STR);
    expect(getBlobCid(undefined)).toBeUndefined();
    expect(getBlobCid({})).toBeUndefined();
  });
});

describe('PDS book records', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('follows the cursor past the first page', async () => {
    const rec = (n: number) => ({ uri: `at://x/${n}`, cid: 'c', value: { name: `${n}` } });
    agent.com.atproto.repo.listRecords
      .mockResolvedValueOnce({ data: { records: [rec(1), rec(2)], cursor: 'next' } })
      .mockResolvedValueOnce({ data: { records: [rec(3)], cursor: undefined } });

    const records = await listBookRecords();
    expect(records.map((r) => r.value.name)).toEqual(['1', '2', '3']);
    expect(agent.com.atproto.repo.listRecords).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'next', repo: 'did:plc:me' }),
    );
  });

  it('keeps existing blobs when re-uploading only metadata', async () => {
    const existing = {
      coverblob: { ref: { $link: 'cover' } },
      docblob: { ref: { $link: 'doc' } },
      config: { ref: { $link: 'config' } },
      createdAt: '2025-01-01T00:00:00.000Z',
      bookmeta: { fileSize: 1234 },
    };
    agent.com.atproto.repo.getRecord.mockResolvedValue({ data: { value: existing, cid: 'rc' } });
    agent.com.atproto.repo.putRecord.mockResolvedValue({ success: true, data: { uri: 'u', cid: 'c' } });

    const book = { hash: 'h1', title: 'T', author: 'A', format: 'EPUB', createdAt: 1, updatedAt: 2 } as Book;
    const res = await uploadBookFile(book);

    expect(res.success).toBe(true);
    expect(agent.com.atproto.repo.uploadBlob).not.toHaveBeenCalled();
    const { record } = agent.com.atproto.repo.putRecord.mock.calls[0]![0];
    expect(record.coverblob).toBe(existing.coverblob);
    expect(record.docblob).toBe(existing.docblob);
    expect(record.config).toBe(existing.config);
    expect(record.createdAt).toBe(existing.createdAt);
    expect(record.bookmeta.fileSize).toBe(1234);
  });

  it('creates a new record when none exists yet', async () => {
    agent.com.atproto.repo.getRecord.mockRejectedValue(new Error('Could not locate record: at://x'));
    agent.com.atproto.repo.putRecord.mockResolvedValue({ success: true, data: { uri: 'u', cid: 'c' } });

    const book = { hash: 'h2', title: 'T', author: 'A', format: 'EPUB', createdAt: 1, updatedAt: 2 } as Book;
    await expect(uploadBookFile(book)).resolves.toMatchObject({ success: true });
    const { record, rkey } = agent.com.atproto.repo.putRecord.mock.calls[0]![0];
    expect(rkey).toBe('h2');
    expect(record.config).toBeUndefined();
  });
});
