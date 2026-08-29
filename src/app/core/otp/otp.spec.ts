import { generateHotp, generateTotp } from './otp';

describe('OTP generation', () => {
  const sha1Secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  it('matches every RFC 4226 HOTP test vector', async () => {
    const expected = [
      '755224', '287082', '359152', '969429', '338314',
      '254676', '287922', '162583', '399871', '520489',
    ];
    for (let counter = 0; counter < expected.length; counter += 1) {
      expect(await generateHotp(sha1Secret, counter)).withContext(`counter ${counter}`).toBe(expected[counter]);
    }
  });

  it('matches the RFC 6238 vectors for all supported hashes', async () => {
    const secrets = {
      SHA1: sha1Secret,
      SHA256: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA====',
      SHA512: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNA=',
    } as const;
    const vectors = [
      { time: 59, SHA1: '94287082', SHA256: '46119246', SHA512: '90693936' },
      { time: 1_111_111_109, SHA1: '07081804', SHA256: '68084774', SHA512: '25091201' },
      { time: 1_111_111_111, SHA1: '14050471', SHA256: '67062674', SHA512: '99943326' },
      { time: 1_234_567_890, SHA1: '89005924', SHA256: '91819424', SHA512: '93441116' },
      { time: 2_000_000_000, SHA1: '69279037', SHA256: '90698825', SHA512: '38618901' },
      { time: 20_000_000_000, SHA1: '65353130', SHA256: '77737706', SHA512: '47863826' },
    ];

    for (const vector of vectors) {
      for (const algorithm of ['SHA1', 'SHA256', 'SHA512'] as const) {
        const result = await generateTotp(secrets[algorithm], vector.time, 30, 8, algorithm);
        expect(result.code).withContext(`${algorithm} at ${vector.time}`).toBe(vector[algorithm]);
      }
    }
  });

  it('reports the current TOTP counter and remaining seconds', async () => {
    const result = await generateTotp(sha1Secret, 59, 30, 6, 'SHA1');
    expect(result.code).toBe('287082');
    expect(result.counter).toBe(1);
    expect(result.remainingSeconds).toBe(1);
  });

  it('rejects unsafe counters', async () => {
    await expectAsync(generateHotp(sha1Secret, -1)).toBeRejectedWithError(/counter/);
  });
});

