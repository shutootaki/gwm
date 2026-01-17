import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatRelativeTime } from '../../src/utils/formatting.js';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    // 現在時刻を固定
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should format seconds ago', () => {
    expect(formatRelativeTime('2024-01-15T11:59:30Z')).toBe('30 seconds ago');
    expect(formatRelativeTime('2024-01-15T11:59:59Z')).toBe('1 second ago');
    expect(formatRelativeTime('2024-01-15T11:59:00Z')).toBe('1 minute ago'); // 60秒は1分として表示
  });

  it('should format minutes ago', () => {
    expect(formatRelativeTime('2024-01-15T11:30:00Z')).toBe('30 minutes ago');
    expect(formatRelativeTime('2024-01-15T11:59:00Z')).toBe('1 minute ago');
    expect(formatRelativeTime('2024-01-15T11:00:00Z')).toBe('1 hour ago'); // 60分は1時間として表示
  });

  it('should format hours ago', () => {
    expect(formatRelativeTime('2024-01-15T10:00:00Z')).toBe('2 hours ago');
    expect(formatRelativeTime('2024-01-15T11:00:00Z')).toBe('1 hour ago');
    expect(formatRelativeTime('2024-01-14T13:00:00Z')).toBe('23 hours ago');
  });

  it('should format days ago', () => {
    expect(formatRelativeTime('2024-01-13T12:00:00Z')).toBe('2 days ago');
    expect(formatRelativeTime('2024-01-14T12:00:00Z')).toBe('1 day ago');
    expect(formatRelativeTime('2024-01-09T12:00:00Z')).toBe('6 days ago');
  });

  it('should format weeks ago', () => {
    expect(formatRelativeTime('2024-01-01T12:00:00Z')).toBe('2 weeks ago');
    expect(formatRelativeTime('2024-01-08T12:00:00Z')).toBe('1 week ago');
    expect(formatRelativeTime('2023-12-25T12:00:00Z')).toBe('3 weeks ago');
  });

  it('should format months ago', () => {
    expect(formatRelativeTime('2023-11-15T12:00:00Z')).toBe('2 months ago');
    expect(formatRelativeTime('2023-12-15T12:00:00Z')).toBe('1 month ago');
    expect(formatRelativeTime('2023-02-15T12:00:00Z')).toBe('11 months ago');
  });

  it('should format years ago', () => {
    expect(formatRelativeTime('2022-01-15T12:00:00Z')).toBe('2 years ago');
    expect(formatRelativeTime('2023-01-15T12:00:00Z')).toBe('1 year ago');
    expect(formatRelativeTime('2019-01-15T12:00:00Z')).toBe('5 years ago');
  });

  it('should handle edge cases', () => {
    // 0秒前（現在時刻）
    expect(formatRelativeTime('2024-01-15T12:00:00Z')).toBe('0 seconds ago');
    
    // ちょうど60秒前（1分）
    expect(formatRelativeTime('2024-01-15T11:59:00Z')).toBe('1 minute ago');
    
    // ちょうど60分前（1時間）
    expect(formatRelativeTime('2024-01-15T11:00:00Z')).toBe('1 hour ago');
    
    // ちょうど24時間前（1日）
    expect(formatRelativeTime('2024-01-14T12:00:00Z')).toBe('1 day ago');
  });

  it('should return original string for invalid dates', () => {
    expect(formatRelativeTime('invalid-date')).toBe('invalid-date');
    expect(formatRelativeTime('')).toBe('');
    expect(formatRelativeTime('2024-13-45')).toBe('2024-13-45');
  });

  it('should handle future dates', () => {
    // 未来の日付は負の値になるが、表示は同じ
    expect(formatRelativeTime('2024-01-15T12:00:01Z')).toBe('-1 seconds ago');
  });
});