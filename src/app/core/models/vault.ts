import { OtpAccount } from './otp-account';

export interface VaultData {
  version: 1;
  createdAt: string;
  updatedAt: string;
  accounts: OtpAccount[];
}

