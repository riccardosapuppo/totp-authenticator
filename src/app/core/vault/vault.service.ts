import { Injectable, signal } from '@angular/core';

import { decryptVault, encryptVault, EncryptedVault, isEncryptedVault } from '../crypto/vault-crypto';
import { createOtpAccount, NewOtpAccount, OtpAccount } from '../models/otp-account';
import { VaultData } from '../models/vault';
import { IndexedDbVaultRepository } from '../storage/indexeddb-vault.repository';

function isOtpAccount(value: unknown): value is OtpAccount {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const account = value as Partial<OtpAccount>;
  return (
    typeof account.id === 'string' &&
    (account.kind === 'totp' || account.kind === 'hotp') &&
    typeof account.issuer === 'string' &&
    typeof account.accountName === 'string' &&
    typeof account.secret === 'string' && account.secret.length <= 1024 && /^[A-Z2-7]+$/.test(account.secret) &&
    (account.algorithm === 'SHA1' || account.algorithm === 'SHA256' || account.algorithm === 'SHA512') &&
    typeof account.digits === 'number' &&
    Number.isInteger(account.digits) && account.digits >= 6 && account.digits <= 8 &&
    typeof account.period === 'number' &&
    Number.isInteger(account.period) && account.period > 0 && account.period <= 300 &&
    typeof account.counter === 'number' &&
    Number.isSafeInteger(account.counter) && account.counter >= 0
  );
}

function isVaultData(value: unknown): value is VaultData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const vault = value as Partial<VaultData>;
  return (
    vault.version === 1 &&
    typeof vault.createdAt === 'string' &&
    typeof vault.updatedAt === 'string' &&
    Array.isArray(vault.accounts) &&
    vault.accounts.every(isOtpAccount)
  );
}

function demoAccounts(): OtpAccount[] {
  return [
    createOtpAccount({
      kind: 'totp',
      issuer: 'Northstar Demo',
      accountName: 'demo.user@example.test',
      secret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      counter: 0,
    }),
    createOtpAccount({
      kind: 'hotp',
      issuer: 'Paperkite Lab',
      accountName: 'sample@example.test',
      secret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      counter: 0,
    }),
  ];
}

@Injectable({ providedIn: 'root' })
export class VaultService {
  readonly data = signal<VaultData | null>(null);
  readonly hasStoredVault = signal(false);

  private pin: string | null = null;
  private envelope: EncryptedVault | null = null;

  constructor(private readonly repository: IndexedDbVaultRepository) {}

  async initialize(): Promise<void> {
    this.envelope = await this.repository.load();
    this.hasStoredVault.set(this.envelope !== null);
  }

  async create(pin: string): Promise<void> {
    const now = new Date().toISOString();
    const vault: VaultData = {
      version: 1,
      createdAt: now,
      updatedAt: now,
      accounts: demoAccounts(),
    };
    const envelope = await encryptVault(vault, pin);
    await this.repository.save(envelope);
    this.pin = pin;
    this.envelope = envelope;
    this.data.set(vault);
    this.hasStoredVault.set(true);
  }

  async unlock(pin: string): Promise<void> {
    const envelope = this.envelope ?? (await this.repository.load());
    if (!envelope) {
      throw new Error('No local vault exists yet.');
    }
    const vault = await decryptVault<unknown>(envelope, pin);
    if (!isVaultData(vault)) {
      throw new Error('The decrypted vault data is invalid.');
    }
    this.pin = pin;
    this.envelope = envelope;
    this.data.set(vault);
  }

  lock(): void {
    this.pin = null;
    this.data.set(null);
  }

  async addAccount(account: NewOtpAccount): Promise<void> {
    await this.mutate((vault) => {
      vault.accounts.push(createOtpAccount(account));
    });
  }

  async deleteAccount(id: string): Promise<void> {
    await this.mutate((vault) => {
      vault.accounts = vault.accounts.filter((account) => account.id !== id);
    });
  }

  async advanceHotp(id: string): Promise<void> {
    await this.mutate((vault) => {
      const account = vault.accounts.find((candidate) => candidate.id === id);
      if (!account || account.kind !== 'hotp') {
        throw new Error('The selected account is not an HOTP account.');
      }
      if (account.counter >= Number.MAX_SAFE_INTEGER) {
        throw new Error('The HOTP counter cannot be advanced safely.');
      }
      account.counter += 1;
    });
  }

  exportEncryptedVault(): EncryptedVault {
    if (!this.envelope || !this.data()) {
      throw new Error('Unlock the vault before creating a backup.');
    }
    return structuredClone(this.envelope);
  }

  async restoreEncryptedVault(value: unknown, pin: string): Promise<void> {
    if (!isEncryptedVault(value)) {
      throw new Error('The selected file is not a Cipher OTP backup.');
    }
    const vault = await decryptVault<unknown>(value, pin);
    if (!isVaultData(vault)) {
      throw new Error('The decrypted backup data is invalid.');
    }
    await this.repository.save(value);
    this.pin = pin;
    this.envelope = value;
    this.data.set(vault);
    this.hasStoredVault.set(true);
  }

  private async mutate(change: (vault: VaultData) => void): Promise<void> {
    const current = this.data();
    if (!current || !this.pin) {
      throw new Error('Unlock the vault before changing it.');
    }
    const next = structuredClone(current);
    change(next);
    next.updatedAt = new Date().toISOString();
    const envelope = await encryptVault(next, this.pin);
    await this.repository.save(envelope);
    this.envelope = envelope;
    this.data.set(next);
  }
}
