import {MDD} from '../src';
import { describe, expect, it } from '@jest/globals';

describe('Mdict', () => {
  describe('Collins', () => {
    const mdict = new MDD('./tests/data/mini/mini.mdd');
    it('#lookup', () => {
      const def = mdict.locate('\\collins.css');

      expect(def.definition).toBeDefined();
      expect(def.keyText).toEqual('\\collins.css');
    });
  });
});
