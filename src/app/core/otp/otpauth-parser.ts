import { NewOtpAccount, OtpAlgorithm, OtpKind } from '../models/otp-account';
import { decodeBase32, normalizeBase32 } from './base32';

function parseInteger(value: string | null, fallback: number, label: string): number {
  if (value === null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return parsed;
}

function parseAlgorithm(value: string | null): OtpAlgorithm {
  const normalized = (value ?? 'SHA1').replace('-', '').toUpperCase();
  if (normalized !== 'SHA1' && normalized !== 'SHA256' && normalized !== 'SHA512') {
    throw new Error('Only SHA1, SHA256 and SHA512 are supported.');
  }
  return normalized;
}

export function parseOtpAuthUri(value: string): NewOtpAccount {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('The value is not a valid otpauth URI.');
  }

  if (url.protocol.toLowerCase() !== 'otpauth:') {
    throw new Error('The URI must use the otpauth scheme.');
  }

  const kind = url.hostname.toLowerCase() as OtpKind;
  if (kind !== 'totp' && kind !== 'hotp') {
    throw new Error('The otpauth type must be TOTP or HOTP.');
  }

  const label = decodeURIComponent(url.pathname.replace(/^\//, '')).trim();
  if (!label) {
    throw new Error('The otpauth label is empty.');
  }

  const separator = label.indexOf(':');
  const labelIssuer = separator >= 0 ? label.slice(0, separator).trim() : '';
  const accountName = (separator >= 0 ? label.slice(separator + 1) : label).trim();
  const queryIssuer = (url.searchParams.get('issuer') ?? '').trim();
  if (labelIssuer && queryIssuer && labelIssuer !== queryIssuer) {
    throw new Error('The issuer in the label and query string must match.');
  }

  const issuer = queryIssuer || labelIssuer;
  if (!issuer || !accountName) {
    throw new Error('Both issuer and account name are required.');
  }

  const secret = normalizeBase32(url.searchParams.get('secret') ?? '');
  if (secret.length > 1024) {
    throw new Error('The Base32 secret is too long.');
  }
  decodeBase32(secret);

  const digits = parseInteger(url.searchParams.get('digits'), 6, 'Digits');
  if (digits < 6 || digits > 8) {
    throw new Error('Digits must be between 6 and 8.');
  }

  const period = parseInteger(url.searchParams.get('period'), 30, 'Period');
  if (kind === 'totp' && (period === 0 || period > 300)) {
    throw new Error('The TOTP period must be between 1 and 300 seconds.');
  }

  const counterValue = url.searchParams.get('counter');
  if (kind === 'hotp' && counterValue === null) {
    throw new Error('HOTP URIs must contain a counter.');
  }

  return {
    kind,
    issuer,
    accountName,
    secret,
    algorithm: parseAlgorithm(url.searchParams.get('algorithm')),
    digits,
    period: kind === 'totp' ? period : 30,
    counter: parseInteger(counterValue, 0, 'Counter'),
  };
}
