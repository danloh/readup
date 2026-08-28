import Mdict from '../src/mdict';
import { describe, expect, it } from '@jest/globals';

describe('mdx-reduce-word-key-block', () => {
  const mdict = new Mdict(
    './tests/data/mini/mini.mdx',
    { resort: true }
  );
  it('decode-key-block-01', () => {
    const keyListItems = mdict.lookupPartialKeyBlockListByKeyInfoId(1);
    expect(keyListItems.length > 0).toBeTruthy();
  });
});
