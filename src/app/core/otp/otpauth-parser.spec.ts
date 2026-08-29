import { parseOtpAuthUri } from './otpauth-parser';

describe('otpauth parser', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  it('parses a complete synthetic TOTP URI', () => {
    const account = parseOtpAuthUri(
      `otpauth://totp/Northstar%20Demo:demo%40example.test?secret=${secret}&issuer=Northstar%20Demo&algorithm=SHA256&digits=8&period=45`,
    );
    expect(account).toEqual({
      kind: 'totp',
      issuer: 'Northstar Demo',
      accountName: 'demo@example.test',
      secret,
      algorithm: 'SHA256',
      digits: 8,
      period: 45,
      counter: 0,
    });
  });

  it('parses HOTP and preserves its initial counter', () => {
    const account = parseOtpAuthUri(
      `otpauth://hotp/Paperkite%20Lab:sample%40example.test?secret=${secret}&issuer=Paperkite%20Lab&counter=7`,
    );
    expect(account.kind).toBe('hotp');
    expect(account.counter).toBe(7);
  });

  it('requires a counter for HOTP', () => {
    expect(() => parseOtpAuthUri(
      `otpauth://hotp/Paperkite%20Lab:sample?secret=${secret}&issuer=Paperkite%20Lab`,
    )).toThrowError(/counter/);
  });

  it('rejects conflicting issuer values', () => {
    expect(() => parseOtpAuthUri(
      `otpauth://totp/Northstar%20Demo:sample?secret=${secret}&issuer=Paperkite%20Lab`,
    )).toThrowError(/issuer/);
  });
});

