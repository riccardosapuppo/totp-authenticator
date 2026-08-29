const DEFAULT_ITERATIONS = 210_000;
const MINIMUM_ITERATIONS = 100_000;
const MAXIMUM_ITERATIONS = 5_000_000;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

export interface EncryptedVault {
  format: 'totp-authenticator-vault';
  version: 1;
  kdf: {
    name: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number;
    salt: string;
  };
  cipher: {
    name: 'AES-GCM';
    iv: string;
  };
  ciphertext: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new Error('The encrypted vault contains invalid Base64 data.');
  }
}

function assertPin(pin: string): void {
  if (!/^\d{6,12}$/.test(pin)) {
    throw new Error('The PIN must contain between 6 and 12 digits.');
  }
}

async function deriveVaultKey(pin: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function isEncryptedVault(value: unknown): value is EncryptedVault {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<EncryptedVault>;
  return (
    candidate.format === 'totp-authenticator-vault' &&
    candidate.version === 1 &&
    candidate.kdf?.name === 'PBKDF2' &&
    candidate.kdf.hash === 'SHA-256' &&
    typeof candidate.kdf.iterations === 'number' &&
    Number.isSafeInteger(candidate.kdf.iterations) &&
    candidate.kdf.iterations >= MINIMUM_ITERATIONS &&
    candidate.kdf.iterations <= MAXIMUM_ITERATIONS &&
    typeof candidate.kdf.salt === 'string' &&
    BASE64_PATTERN.test(candidate.kdf.salt) &&
    candidate.cipher?.name === 'AES-GCM' &&
    typeof candidate.cipher.iv === 'string' &&
    BASE64_PATTERN.test(candidate.cipher.iv) &&
    typeof candidate.ciphertext === 'string' &&
    candidate.ciphertext.length > 0 &&
    BASE64_PATTERN.test(candidate.ciphertext)
  );
}

export async function encryptVault<T>(value: T, pin: string): Promise<EncryptedVault> {
  assertPin(pin);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveVaultKey(pin, salt, DEFAULT_ITERATIONS);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

  return {
    format: 'totp-authenticator-vault',
    version: 1,
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: DEFAULT_ITERATIONS,
      salt: bytesToBase64(salt),
    },
    cipher: {
      name: 'AES-GCM',
      iv: bytesToBase64(iv),
    },
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptVault<T>(envelope: EncryptedVault, pin: string): Promise<T> {
  assertPin(pin);
  if (!isEncryptedVault(envelope)) {
    throw new Error('The encrypted vault format is not supported.');
  }

  try {
    const salt = base64ToBytes(envelope.kdf.salt);
    const iv = base64ToBytes(envelope.cipher.iv);
    if (salt.length !== 16 || iv.length !== 12) {
      throw new Error('Invalid encryption parameters.');
    }
    const key = await deriveVaultKey(pin, salt, envelope.kdf.iterations);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      base64ToBytes(envelope.ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  } catch {
    throw new Error('The PIN is incorrect or the encrypted vault is damaged.');
  }
}
