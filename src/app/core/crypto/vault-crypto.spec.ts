import { decryptVault, encryptVault, isEncryptedVault } from './vault-crypto';

describe('vault encryption', () => {
  const payload = {
    version: 1,
    secret: 'SYNTHETIC-PLAINTEXT-MARKER',
    accounts: [{ issuer: 'Northstar Demo' }],
  };

  it('round-trips JSON with PBKDF2 and AES-GCM', async () => {
    const encrypted = await encryptVault(payload, '123456');
    expect(isEncryptedVault(encrypted)).toBeTrue();
    expect(await decryptVault(encrypted, '123456')).toEqual(payload);
  });

  it('does not expose the PIN or payload in the serialized envelope', async () => {
    const serialized = JSON.stringify(await encryptVault(payload, '123456'));
    expect(serialized).not.toContain('123456');
    expect(serialized).not.toContain(payload.secret);
    expect(serialized).not.toContain('Northstar Demo');
  });

  it('rejects an incorrect PIN', async () => {
    const encrypted = await encryptVault(payload, '123456');
    await expectAsync(decryptVault(encrypted, '654321')).toBeRejectedWithError(/incorrect|damaged/);
  });

  it('rejects short PINs before encryption', async () => {
    await expectAsync(encryptVault(payload, '1234')).toBeRejectedWithError(/6 and 12/);
  });
});

