import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import jsQR from 'jsqr';

import { NewOtpAccount, OtpAccount } from '../../core/models/otp-account';
import { decodeBase32, normalizeBase32 } from '../../core/otp/base32';
import { formatOtp, generateHotp, generateTotp } from '../../core/otp/otp';
import { parseOtpAuthUri } from '../../core/otp/otpauth-parser';
import { VaultService } from '../../core/vault/vault.service';

interface OtpCard {
  account: OtpAccount;
  code: string;
  remainingSeconds: number | null;
  progress: number;
}

function emptyAccount(): NewOtpAccount {
  return {
    kind: 'totp', issuer: '', accountName: '', secret: '', algorithm: 'SHA1',
    digits: 6, period: 30, counter: 0,
  };
}

@Component({
  selector: 'app-vault-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vault-dashboard.component.html',
  styleUrl: './vault-dashboard.component.css',
})
export class VaultDashboardComponent implements OnInit, OnDestroy {
  @Output() readonly locked = new EventEmitter<void>();
  @ViewChild('cameraVideo') cameraVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('scanCanvas') scanCanvas?: ElementRef<HTMLCanvasElement>;

  cards: OtpCard[] = [];
  draft = emptyAccount();
  importUri = '';
  restorePin = '';
  notice = '';
  error = '';
  scanning = false;

  private refreshTimer?: number;
  private animationFrame?: number;
  private cameraStream?: MediaStream;

  constructor(readonly vault: VaultService) {}

  ngOnInit(): void {
    void this.refreshCodes();
    this.refreshTimer = window.setInterval(() => void this.refreshCodes(), 1000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer !== undefined) window.clearInterval(this.refreshTimer);
    this.stopCamera();
  }

  async addAccount(): Promise<void> {
    this.clearMessages();
    try {
      await this.vault.addAccount(this.validatedDraft());
      this.draft = emptyAccount();
      this.importUri = '';
      this.notice = 'Account saved in the encrypted vault.';
      await this.refreshCodes();
    } catch (error: unknown) {
      this.error = this.errorMessage(error);
    }
  }

  parseUri(): void {
    this.clearMessages();
    try {
      this.draft = parseOtpAuthUri(this.importUri);
      this.notice = 'URI parsed. Review the account, then save it.';
    } catch (error: unknown) {
      this.error = this.errorMessage(error);
    }
  }

  async onQrImageSelected(event: Event): Promise<void> {
    this.clearMessages();
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      this.error = 'QR image files larger than 10 MB are not accepted.';
      return;
    }

    try {
      const bitmap = await createImageBitmap(file);
      const canvas = this.scanCanvas?.nativeElement;
      if (!canvas) throw new Error('The QR scanner is not ready.');
      const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Canvas access is not available.');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const decoded = this.decodeCanvas(context, canvas.width, canvas.height);
      if (!decoded) throw new Error('No QR code was found in the selected image.');
      this.applyScannedUri(decoded);
    } catch (error: unknown) {
      this.error = this.errorMessage(error);
    }
  }

  async startCamera(): Promise<void> {
    this.clearMessages();
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is not supported by this browser.');
      }
      const video = this.cameraVideo?.nativeElement;
      if (!video) throw new Error('The camera preview is not ready.');
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }, audio: false,
      });
      video.srcObject = this.cameraStream;
      await video.play();
      this.scanning = true;
      this.scanCameraFrame();
    } catch (error: unknown) {
      this.stopCamera();
      this.error = this.errorMessage(error);
    }
  }

  stopCamera(): void {
    this.scanning = false;
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = undefined;
    }
    this.cameraStream?.getTracks().forEach((track) => track.stop());
    this.cameraStream = undefined;
    if (this.cameraVideo?.nativeElement) this.cameraVideo.nativeElement.srcObject = null;
  }

  async advanceHotp(account: OtpAccount): Promise<void> {
    this.clearMessages();
    try {
      await this.vault.advanceHotp(account.id);
      this.notice = `Advanced ${account.issuer} to the next HOTP counter.`;
      await this.refreshCodes();
    } catch (error: unknown) {
      this.error = this.errorMessage(error);
    }
  }

  async copyCode(card: OtpCard): Promise<void> {
    this.clearMessages();
    try {
      await navigator.clipboard.writeText(card.code.replace(/\s/g, ''));
      this.notice = `Copied the code for ${card.account.issuer}.`;
    } catch {
      this.error = 'Clipboard access was denied by the browser.';
    }
  }

  async deleteAccount(account: OtpAccount): Promise<void> {
    if (!window.confirm(`Delete the account “${account.issuer}”?`)) return;
    this.clearMessages();
    try {
      await this.vault.deleteAccount(account.id);
      this.notice = 'Account deleted.';
      await this.refreshCodes();
    } catch (error: unknown) {
      this.error = this.errorMessage(error);
    }
  }

  exportBackup(): void {
    this.clearMessages();
    try {
      const backup = this.vault.exportEncryptedVault();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cipher-otp-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      this.notice = 'Encrypted backup created.';
    } catch (error: unknown) {
      this.error = this.errorMessage(error);
    }
  }

  async restoreBackup(event: Event): Promise<void> {
    this.clearMessages();
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      this.error = 'Backup files larger than 10 MB are not accepted.';
      return;
    }
    if (!/^\d{6,12}$/.test(this.restorePin)) {
      this.error = 'Enter the 6–12 digit PIN used by the backup first.';
      return;
    }
    if (!window.confirm('Replace the vault currently stored in this browser?')) return;
    try {
      const value = JSON.parse(await file.text()) as unknown;
      await this.vault.restoreEncryptedVault(value, this.restorePin);
      this.restorePin = '';
      this.notice = 'Encrypted backup restored.';
      await this.refreshCodes();
    } catch (error: unknown) {
      this.error = this.errorMessage(error);
    }
  }

  lock(): void {
    this.vault.lock();
    this.locked.emit();
  }

  trackAccount(_index: number, card: OtpCard): string {
    return card.account.id;
  }

  private validatedDraft(): NewOtpAccount {
    const issuer = this.draft.issuer.trim();
    const accountName = this.draft.accountName.trim();
    const secret = normalizeBase32(this.draft.secret);
    if (!issuer || !accountName) throw new Error('Issuer and account name are required.');
    if (secret.length > 1024) throw new Error('The Base32 secret is too long.');
    decodeBase32(secret);
    if (!Number.isInteger(this.draft.digits) || this.draft.digits < 6 || this.draft.digits > 8) {
      throw new Error('Digits must be between 6 and 8.');
    }
    if (this.draft.kind === 'totp' &&
      (!Number.isInteger(this.draft.period) || this.draft.period <= 0 || this.draft.period > 300)) {
      throw new Error('The TOTP period must be between 1 and 300 seconds.');
    }
    if (!Number.isSafeInteger(this.draft.counter) || this.draft.counter < 0) {
      throw new Error('The HOTP counter must be a non-negative integer.');
    }
    return {
      ...this.draft, issuer, accountName, secret,
      period: this.draft.kind === 'totp' ? this.draft.period : 30,
      counter: this.draft.kind === 'hotp' ? this.draft.counter : 0,
    };
  }

  private async refreshCodes(): Promise<void> {
    const accounts = this.vault.data()?.accounts ?? [];
    const unixSeconds = Math.floor(Date.now() / 1000);
    this.cards = await Promise.all(accounts.map(async (account): Promise<OtpCard> => {
      if (account.kind === 'hotp') {
        return {
          account,
          code: formatOtp(await generateHotp(account.secret, account.counter, account.digits, account.algorithm)),
          remainingSeconds: null,
          progress: 100,
        };
      }
      const generated = await generateTotp(
        account.secret, unixSeconds, account.period, account.digits, account.algorithm,
      );
      return {
        account,
        code: formatOtp(generated.code),
        remainingSeconds: generated.remainingSeconds,
        progress: (generated.remainingSeconds / account.period) * 100,
      };
    }));
  }

  private scanCameraFrame(): void {
    if (!this.scanning) return;
    const video = this.cameraVideo?.nativeElement;
    const canvas = this.scanCanvas?.nativeElement;
    if (video?.videoWidth && video.videoHeight && canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const decoded = this.decodeCanvas(context, canvas.width, canvas.height);
        if (decoded) {
          try {
            this.applyScannedUri(decoded);
          } catch (error: unknown) {
            this.error = this.errorMessage(error);
          }
          this.stopCamera();
          return;
        }
      }
    }
    this.animationFrame = requestAnimationFrame(() => this.scanCameraFrame());
  }

  private decodeCanvas(context: CanvasRenderingContext2D, width: number, height: number): string | null {
    const pixels = context.getImageData(0, 0, width, height);
    return jsQR(pixels.data, width, height)?.data ?? null;
  }

  private applyScannedUri(uri: string): void {
    this.importUri = uri;
    this.draft = parseOtpAuthUri(uri);
    this.notice = 'QR code parsed. Review the account, then save it.';
  }

  private clearMessages(): void {
    this.notice = '';
    this.error = '';
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'The operation could not be completed.';
  }
}
