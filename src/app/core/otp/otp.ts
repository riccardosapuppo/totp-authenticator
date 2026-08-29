import { OtpAlgorithm } from '../models/otp-account';
import { decodeBase32 } from './base32';

const HASH_NAMES: Record<OtpAlgorithm, string> = {
  SHA1: 'SHA-1',
  SHA256: 'SHA-256',
  SHA512: 'SHA-512',
};

export interface GeneratedTotp {
  code: string;
  counter: number;
  remainingSeconds: number;
}

function assertOtpParameters(counter: number, digits: number): void {
  if (!Number.isSafeInteger(counter) || counter < 0) {
    throw new Error('The HOTP counter must be a non-negative safe integer.');
  }
  if (!Number.isInteger(digits) || digits < 6 || digits > 8) {
    throw new Error('OTP codes must contain between 6 and 8 digits.');
  }
}

function counterBytes(counter: number): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(counter), false);
  return bytes;
}

export async function generateHotp(
  secret: string,
  counter: number,
  digits = 6,
  algorithm: OtpAlgorithm = 'SHA1',
): Promise<string> {
  assertOtpParameters(counter, digits);
  const key = await crypto.subtle.importKey(
    'raw',
    decodeBase32(secret),
    { name: 'HMAC', hash: HASH_NAMES[algorithm] },
    false,
    ['sign'],
  );
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBytes(counter)));
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return (binary % 10 ** digits).toString().padStart(digits, '0');
}

export async function generateTotp(
  secret: string,
  unixSeconds = Math.floor(Date.now() / 1000),
  period = 30,
  digits = 6,
  algorithm: OtpAlgorithm = 'SHA1',
): Promise<GeneratedTotp> {
  if (!Number.isInteger(period) || period <= 0) {
    throw new Error('The TOTP period must be a positive integer.');
  }
  const counter = Math.floor(unixSeconds / period);
  const elapsed = unixSeconds % period;
  return {
    code: await generateHotp(secret, counter, digits, algorithm),
    counter,
    remainingSeconds: period - elapsed,
  };
}

export function formatOtp(code: string): string {
  const splitAt = Math.ceil(code.length / 2);
  return `${code.slice(0, splitAt)} ${code.slice(splitAt)}`;
}

