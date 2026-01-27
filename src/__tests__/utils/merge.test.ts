import { describe, it, expect } from 'vitest';
import { mergeArrays } from '@/utils/book';

describe('mergeArrays', () => {
  interface TestItem {
    id: string;
    title: string;
    author?: string;
    pages?: number;
  }

  it('should merge two arrays with no conflicts', () => {
    const arr1: TestItem[] = [
      { id: '1', title: 'Book A', author: 'Author A' },
    ];
    const arr2: TestItem[] = [
      { id: '2', title: 'Book B', author: 'Author B' },
    ];

    const result = mergeArrays(arr1, arr2, 'id');

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ id: '1', title: 'Book A', author: 'Author A' });
    expect(result).toContainEqual({ id: '2', title: 'Book B', author: 'Author B' });
  });

  it('should override existing item when key matches', () => {
    const arr1: TestItem[] = [
      { id: '1', title: 'Book A', author: 'Author A', pages: 100 },
    ];
    const arr2: TestItem[] = [
      { id: '1', title: 'Book A Updated', author: 'Author A New', pages: 120 },
    ];

    const result = mergeArrays(arr1, arr2, 'id');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: '1',
      title: 'Book A Updated',
      author: 'Author A New',
      pages: 120,
    });
  });

  it('should not override when key in arr2 is null', () => {
    const arr1: TestItem[] = [
      { id: '1', title: 'Book A', author: 'Author A' },
    ];
    const arr2: TestItem[] = [
      { id: null as any, title: 'Book B', author: 'Author B' },
    ];

    const result = mergeArrays(arr1, arr2, 'id');

    expect(result).toHaveLength(1);
    expect(result).toEqual([{ id: '1', title: 'Book A', author: 'Author A' }]);
  });

  it('should not override when key in arr2 is undefined', () => {
    const arr1: TestItem[] = [
      { id: '1', title: 'Book A', author: 'Author A' },
    ];
    const arr2: TestItem[] = [
      { id: undefined as any, title: 'Book B', author: 'Author B' },
    ];

    const result = mergeArrays(arr1, arr2, 'id');

    expect(result).toHaveLength(1);
    expect(result).toEqual([{ id: '1', title: 'Book A', author: 'Author A' }]);
  });

  it('should not override when key in arr2 is empty string', () => {
    const arr1: TestItem[] = [
      { id: '1', title: 'Book A', author: 'Author A' },
    ];
    const arr2: TestItem[] = [
      { id: '', title: 'Book B', author: 'Author B' },
    ];

    const result = mergeArrays(arr1, arr2, 'id');

    expect(result).toHaveLength(1);
    expect(result).toEqual([{ id: '1', title: 'Book A', author: 'Author A' }]);
  });

  it('should keep existing property values when item property is invalid', () => {
    const arr1: TestItem[] = [
      { id: '1', title: 'Book A', author: 'Author A', pages: 100 },
    ];
    const arr2: TestItem[] = [
      { id: '1', title: 'Book A Updated', author: '' as any, pages: undefined as any },
    ];

    const result = mergeArrays(arr1, arr2, 'id');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: '1',
      title: 'Book A Updated',
      author: 'Author A', // kept from arr1
      pages: 100, // kept from arr1
    });
  });

  it('should selectively merge valid properties', () => {
    const arr1: TestItem[] = [
      { id: '1', title: 'Original Title', author: 'Original Author', pages: 100 },
    ];
    const arr2: TestItem[] = [
      { id: '1', title: 'Updated Title', author: null as any, pages: 150 },
    ];

    const result = mergeArrays(arr1, arr2, 'id');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: '1',
      title: 'Updated Title', // updated with valid value
      author: 'Original Author', // kept from arr1 (null is invalid)
      pages: 150, // updated with valid value
    });
  });

  it('should handle empty arrays', () => {
    const arr1: TestItem[] = [];
    const arr2: TestItem[] = [{ id: '1', title: 'Book A' }];

    const result = mergeArrays(arr1, arr2, 'id');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: '1', title: 'Book A' });
  });

  it('should handle both arrays empty', () => {
    const arr1: TestItem[] = [];
    const arr2: TestItem[] = [];

    const result = mergeArrays(arr1, arr2, 'id');

    expect(result).toHaveLength(0);
  });

  it('should work with multiple items and mixed scenarios', () => {
    const arr1: TestItem[] = [
      { id: '1', title: 'Book 1', author: 'Author 1', pages: 100 },
      { id: '2', title: 'Book 2', author: 'Author 2', pages: 200 },
      { id: '3', title: 'Book 3', author: 'Author 3', pages: 300 },
    ];
    const arr2: TestItem[] = [
      { id: '1', title: 'Updated Book 1', author: '' as any, pages: 110 }, // partial update
      { id: '', title: 'Invalid Book', author: 'Invalid Author' }, // skip due to invalid key
      { id: '4', title: 'Book 4', author: 'Author 4', pages: 400 }, // new item
    ];

    const result = mergeArrays(arr1, arr2, 'id');

    expect(result).toHaveLength(4);
    expect(result).toContainEqual({
      id: '1',
      title: 'Updated Book 1',
      author: 'Author 1', // kept from arr1
      pages: 110,
    });
    expect(result).toContainEqual({
      id: '2',
      title: 'Book 2',
      author: 'Author 2',
      pages: 200,
    });
    expect(result).toContainEqual({
      id: '3',
      title: 'Book 3',
      author: 'Author 3',
      pages: 300,
    });
    expect(result).toContainEqual({
      id: '4',
      title: 'Book 4',
      author: 'Author 4',
      pages: 400,
    });
  });

  it('should work with numeric keys', () => {
    interface NumericItem {
      id: number;
      value: string;
    }

    const arr1: NumericItem[] = [
      { id: 1, value: 'A' },
      { id: 2, value: 'B' },
    ];
    const arr2: NumericItem[] = [
      { id: 1, value: 'A Updated' },
      { id: 3, value: 'C' },
    ];

    const result = mergeArrays(arr1, arr2, 'id');

    expect(result).toHaveLength(3);
    expect(result).toContainEqual({ id: 1, value: 'A Updated' });
    expect(result).toContainEqual({ id: 2, value: 'B' });
    expect(result).toContainEqual({ id: 3, value: 'C' });
  });
});
