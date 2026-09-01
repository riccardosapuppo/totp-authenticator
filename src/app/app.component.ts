import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { VERSION } from './version';
import { VaultService } from './core/vault/vault.service';
import { VaultDashboardComponent } from './features/vault/vault-dashboard.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, VaultDashboardComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  /**
   * What this is and who made it.
   *
   * Shown where a version belongs — under the card somebody looks at before
   * they have unlocked anything. A test keeps it in step with package.json,
   * because a version printed on screen that disagrees with the one published
   * is worse than none.
   */
  readonly version = VERSION;
  readonly author = 'Riccardo Sapuppo';

  pin = '';
  confirmPin = '';
  initializing = true;
  busy = false;
  error = '';

  constructor(readonly vault: VaultService) {}

  async ngOnInit(): Promise<void> {
    try {
      await this.vault.initialize();
    } catch (error: unknown) {
      this.error = this.errorMessage(error);
    } finally {
      this.initializing = false;
    }
  }

  async submitPin(): Promise<void> {
    this.error = '';
    this.busy = true;
    try {
      if (this.vault.hasStoredVault()) {
        await this.vault.unlock(this.pin);
      } else {
        if (this.pin !== this.confirmPin) throw new Error('The PIN confirmation does not match.');
        await this.vault.create(this.pin);
      }
      this.pin = '';
      this.confirmPin = '';
    } catch (error: unknown) {
      this.error = this.errorMessage(error);
    } finally {
      this.busy = false;
    }
  }

  async restoreBackup(event: Event): Promise<void> {
    this.error = '';
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!/^\d{6,12}$/.test(this.pin)) {
      this.error = 'Enter the 6–12 digit PIN used by the backup first.';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.error = 'Backup files larger than 10 MB are not accepted.';
      return;
    }
    if (this.vault.hasStoredVault() && !window.confirm('Replace the vault stored in this browser?')) return;

    this.busy = true;
    try {
      const value = JSON.parse(await file.text()) as unknown;
      await this.vault.restoreEncryptedVault(value, this.pin);
      this.pin = '';
      this.confirmPin = '';
    } catch (error: unknown) {
      this.error = this.errorMessage(error);
    } finally {
      this.busy = false;
    }
  }

  onLocked(): void {
    this.pin = '';
    this.confirmPin = '';
    this.error = '';
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'The operation could not be completed.';
  }
}
