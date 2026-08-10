// ============================================================
// Unit Test — PageRange parser
// ============================================================

import { describe, it, expect } from 'vitest';
import { parsePageRanges, expandPageRanges, formatPageRanges, validatePages, PageRangeParseError } from '@domain/pageRange';

describe('parsePageRanges', () => {
  it('解析单个页码', () => {
    expect(parsePageRanges('8')).toEqual([{ start: 8, end: 8 }]);
  });

  it('解析范围', () => {
    expect(parsePageRanges('1-5')).toEqual([{ start: 1, end: 5 }]);
  });

  it('解析逗号分隔的混合输入', () => {
    expect(parsePageRanges('1-5, 8, 10-12')).toEqual([
      { start: 1, end: 5 },
      { start: 8, end: 8 },
      { start: 10, end: 12 },
    ]);
  });

  it('归一化倒序范围', () => {
    expect(parsePageRanges('5-3')).toEqual([{ start: 3, end: 5 }]);
  });

  it('容忍多余空格', () => {
    expect(parsePageRanges(' 1 - 3 , 7 ')).toEqual([
      { start: 1, end: 3 },
      { start: 7, end: 7 },
    ]);
  });

  it('空输入抛出友好错误', () => {
    expect(() => parsePageRanges('')).toThrow(PageRangeParseError);
    expect(() => parsePageRanges('  ')).toThrow(PageRangeParseError);
  });

  it('非法格式抛出友好错误', () => {
    expect(() => parsePageRanges('abc')).toThrow(PageRangeParseError);
    expect(() => parsePageRanges('1-5,x')).toThrow(PageRangeParseError);
    expect(() => parsePageRanges('1-2-3')).toThrow(PageRangeParseError);
  });

  it('页码为 0 或负数时抛出错误', () => {
    expect(() => parsePageRanges('0')).toThrow(PageRangeParseError);
    expect(() => parsePageRanges('-3')).toThrow(PageRangeParseError);
  });
});

describe('expandPageRanges', () => {
  it('展开为升序去重数组', () => {
    expect(expandPageRanges([{ start: 1, end: 3 }, { start: 3, end: 3 }, { start: 5, end: 6 }])).toEqual([1, 2, 3, 5, 6]);
  });

  it('pageCount 截断越界', () => {
    expect(expandPageRanges([{ start: 1, end: 10 }], 4)).toEqual([1, 2, 3, 4]);
  });
});

describe('formatPageRanges', () => {
  it('格式化连续范围', () => {
    expect(formatPageRanges([1, 2, 3, 5])).toBe('1-3, 5');
  });

  it('空数组返回空串', () => {
    expect(formatPageRanges([])).toBe('');
  });
});

describe('validatePages', () => {
  it('分离有效与越界页码', () => {
    expect(validatePages([1, 2, 5, 99], 5)).toEqual({ valid: [1, 2, 5], outOfRange: [99] });
  });
});
