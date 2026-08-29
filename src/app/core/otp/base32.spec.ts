import { decodeBase32, normalizeBase32 } from './base32';

describe('Base32', () => {
  it('decodes the RFC test secret', () => {
    const decoded = decodeBase32('GEZD GNBV-GY3TQOJQ GEZDGNBVGY3TQOJQ');
    expect(new TextDecoder().decode(decoded)).toBe('12345678901234567890');
  });

  it('normalizes padding, separators and case', () => {
    expect(normalizeBase32('gezd gnbv-gy3t====')).toBe('GEZDGNBVGY3T');
  });

  it('rejects invalid alphabet characters', () => {
    expect(() => decodeBase32('INVALID1!')).toThrowError(/Invalid Base32 character/);
  });
});

