export type OtpKind = 'totp' | 'hotp';
export type OtpAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';

export interface OtpAccount {
  id: string;
  kind: OtpKind;
  issuer: string;
  accountName: string;
  secret: string;
  algorithm: OtpAlgorithm;
  digits: number;
  period: number;
  counter: number;
}

export type NewOtpAccount = Omit<OtpAccount, 'id'>;

export function createOtpAccount(account: NewOtpAccount): OtpAccount {
  return {
    ...account,
    id: crypto.randomUUID(),
  };
}

