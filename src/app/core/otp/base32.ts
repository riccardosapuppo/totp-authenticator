const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function normalizeBase32(value: string): string {
  return value.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/g, '');
}

export function decodeBase32(value: string): Uint8Array {
  const normalized = normalizeBase32(value);
  if (!normalized) {
    throw new Error('The Base32 secret is empty.');
  }

  let buffer = 0;
  let bitsInBuffer = 0;
  const output: number[] = [];

  for (const character of normalized) {
    const index = ALPHABET.indexOf(character);
    if (index < 0) {
      throw new Error(`Invalid Base32 character: ${character}`);
    }

    buffer = (buffer << 5) | index;
    bitsInBuffer += 5;

    if (bitsInBuffer >= 8) {
      bitsInBuffer -= 8;
      output.push((buffer >>> bitsInBuffer) & 0xff);
      buffer &= (1 << bitsInBuffer) - 1;
    }
  }

  if (output.length === 0) {
    throw new Error('The Base32 secret is too short.');
  }

  return Uint8Array.from(output);
}

