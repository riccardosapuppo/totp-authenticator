import { encryptVault } from '../crypto/vault-crypto';
import { IndexedDbVaultRepository } from './indexeddb-vault.repository';

describe('IndexedDbVaultRepository', () => {
  let repository: IndexedDbVaultRepository;

  beforeEach(async () => {
    repository = new IndexedDbVaultRepository();
    await repository.clear();
  });

  afterEach(async () => {
    await repository.clear();
  });

  it('persists and reloads only the encrypted envelope', async () => {
    const encrypted = await encryptVault({ marker: 'SYNTHETIC-STORAGE-MARKER' }, '123456');
    await repository.save(encrypted);
    const loaded = await repository.load();

    expect(loaded).toEqual(encrypted);
    expect(JSON.stringify(loaded)).not.toContain('SYNTHETIC-STORAGE-MARKER');
  });

  it('clears the stored vault', async () => {
    const encrypted = await encryptVault({ value: 1 }, '123456');
    await repository.save(encrypted);
    await repository.clear();
    expect(await repository.load()).toBeNull();
  });
});

