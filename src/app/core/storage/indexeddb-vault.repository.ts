import { Injectable } from '@angular/core';

import { EncryptedVault } from '../crypto/vault-crypto';

const DATABASE_NAME = 'totp-authenticator';
const DATABASE_VERSION = 1;
const STORE_NAME = 'vaults';
const PRIMARY_VAULT_KEY = 'primary';

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'));
  });
}

@Injectable({ providedIn: 'root' })
export class IndexedDbVaultRepository {
  private databasePromise?: Promise<IDBDatabase>;

  private openDatabase(): Promise<IDBDatabase> {
    if (!this.databasePromise) {
      this.databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(STORE_NAME)) {
            database.createObjectStore(STORE_NAME);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB.'));
        request.onblocked = () => reject(new Error('The vault database is blocked by another tab.'));
      });
    }
    return this.databasePromise;
  }

  async load(): Promise<EncryptedVault | null> {
    const database = await this.openDatabase();
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const result = await requestResult(
      transaction.objectStore(STORE_NAME).get(PRIMARY_VAULT_KEY) as IDBRequest<EncryptedVault | undefined>,
    );
    await transactionComplete(transaction);
    return result ?? null;
  }

  async save(vault: EncryptedVault): Promise<void> {
    const database = await this.openDatabase();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(vault, PRIMARY_VAULT_KEY);
    await transactionComplete(transaction);
  }

  async clear(): Promise<void> {
    const database = await this.openDatabase();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(PRIMARY_VAULT_KEY);
    await transactionComplete(transaction);
  }
}
