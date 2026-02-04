/**
 * Format utilities unit tests
 */

import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatTime,
  formatPhoneNumber,
  truncate,
  getInitials,
  capitalize,
  formatEnumLabel,
} from './format';

describe('Format Utilities', () => {
  describe('formatCurrency', () => {
    it('should format USD currency', () => {
      expect(formatCurrency(100)).toBe('$100.00');
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should format with different currencies', () => {
      expect(formatCurrency(100, 'EUR')).toContain('100');
      expect(formatCurrency(100, 'GBP')).toContain('100');
    });

    it('should handle negative amounts', () => {
      expect(formatCurrency(-50)).toBe('-$50.00');
    });

    it('should handle decimal amounts', () => {
      expect(formatCurrency(99.99)).toBe('$99.99');
      expect(formatCurrency(0.01)).toBe('$0.01');
    });
  });

  describe('formatDate', () => {
    it('should format date object', () => {
      const date = new Date('2024-06-15');
      const result = formatDate(date);
      expect(result).toContain('Jun');
      expect(result).toContain('15');
      expect(result).toContain('2024');
    });

    it('should format date string', () => {
      const result = formatDate('2024-06-15');
      expect(result).toContain('Jun');
      expect(result).toContain('15');
    });
  });

  describe('formatTime', () => {
    it('should format time from date object', () => {
      const date = new Date('2024-06-15T14:30:00');
      const result = formatTime(date);
      expect(result).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)?/i);
    });

    it('should format time from string', () => {
      const result = formatTime('2024-06-15T09:15:00');
      expect(result).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)?/i);
    });
  });

  describe('formatPhoneNumber', () => {
    it('should format 10-digit US number', () => {
      expect(formatPhoneNumber('1234567890')).toBe('(123) 456-7890');
    });

    it('should format 11-digit number starting with 1', () => {
      expect(formatPhoneNumber('11234567890')).toBe('+1 (123) 456-7890');
    });

    it('should return original if not standard format', () => {
      expect(formatPhoneNumber('+44123456')).toBe('+44123456');
    });

    it('should strip non-numeric characters before formatting', () => {
      expect(formatPhoneNumber('(123) 456-7890')).toBe('(123) 456-7890');
    });
  });

  describe('truncate', () => {
    it('should truncate long text', () => {
      const result = truncate('This is a very long text that needs truncation', 20);
      expect(result).toBe('This is a very lo...');
      expect(result.length).toBe(20);
    });

    it('should not truncate short text', () => {
      expect(truncate('Short', 20)).toBe('Short');
    });

    it('should handle exact length', () => {
      expect(truncate('Exact', 5)).toBe('Exact');
    });
  });

  describe('getInitials', () => {
    it('should get initials from first and last name', () => {
      expect(getInitials('John', 'Doe')).toBe('JD');
    });

    it('should get single initial from first name only', () => {
      expect(getInitials('John')).toBe('J');
    });

    it('should handle lowercase names', () => {
      expect(getInitials('john', 'doe')).toBe('JD');
    });
  });

  describe('capitalize', () => {
    it('should capitalize first letter of each word', () => {
      expect(capitalize('hello world')).toBe('Hello World');
    });

    it('should handle single word', () => {
      expect(capitalize('hello')).toBe('Hello');
    });

    it('should handle already capitalized text', () => {
      expect(capitalize('HELLO WORLD')).toBe('Hello World');
    });

    it('should handle mixed case', () => {
      expect(capitalize('hElLo WoRLd')).toBe('Hello World');
    });
  });

  describe('formatEnumLabel', () => {
    it('converts underscored enums into readable labels', () => {
      expect(formatEnumLabel('OUT_OF_SERVICE')).toBe('Out of Service');
      expect(formatEnumLabel('BOOKING_CONFIRMED')).toBe('Booking Confirmed');
    });

    it('keeps configured small words lowercase after the first word', () => {
      expect(formatEnumLabel('ADD_TO_CART')).toBe('Add to Cart');
    });

    it('returns empty string for falsy input', () => {
      expect(formatEnumLabel('')).toBe('');
      expect(formatEnumLabel(undefined)).toBe('');
    });
  });
});
