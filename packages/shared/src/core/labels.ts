import { Role, CertStatus, WfAction } from './enums';

export const STATUS_LABELS: Record<CertStatus, string> = {
  [CertStatus.DRAFT]: 'Qoralama',
  [CertStatus.ADMIN_REVIEW]: "Admin ko'rigida",
  [CertStatus.DIRECTOR_REVIEW]: 'Rahbar imzosida',
  [CertStatus.SIGNED]: 'Imzolangan',
};

export const ROLE_LABELS: Record<Role, string> = {
  [Role.YURIST]: 'Yurist',
  [Role.ADMIN]: 'Admin',
  [Role.RAHBAR]: 'Rahbar',
};

/** Every value a maʼlumotnoma is written from. */
export type CertField =
  | 'firmId' | 'personPinfl' | 'personFullName' | 'personPassport'
  | 'passportIssuedBy' | 'passportIssuedAt' | 'contracts' | 'contractType'
  | 'loanAmount' | 'asOfDate' | 'asOfText' | 'issueDate' | 'infoRecipient';

/**
 * What each value is called when someone is told about it — on the document as a slot's name, and
 * in an API error when one is missing.
 *
 * One map, because those two used to be separate and the API's half was never written: it reported
 * the property name, so a yurist who left the name blank was told
 * «Maydon toʻldirilmagan: personFullName».
 */
export const CERT_FIELD_LABELS: Record<CertField, string> = {
  firmId: 'Firma',
  personPinfl: 'PINFL',
  personFullName: 'Mijozning F.I.SH.',
  personPassport: 'Passport raqami',
  passportIssuedBy: 'Passportni kim bergan',
  passportIssuedAt: 'Passport berilgan sana',
  contracts: 'Shartnomalar',
  contractType: 'Shartnoma turi',
  loanAmount: 'Kredit summasi',
  asOfDate: 'Holat sanasi',
  asOfText: 'Holat sanasi',
  issueDate: 'Maʼlumotnoma sanasi',
  infoRecipient: 'Maʼlumot uchun (tashkilot)',
};

/**
 * Which of `fields` the body left empty, named in Uzbek — or null when none are.
 *
 * All of them at once rather than the first: one at a time makes the person save, read, fix, save
 * again and meet the next one.
 */
export function missingFieldsError(
  body: Record<string, unknown>,
  fields: readonly CertField[],
): string | null {
  const missing = fields.filter((f) => !body[f]).map((f) => CERT_FIELD_LABELS[f]);
  if (!missing.length) return null;
  return missing.length === 1
    ? `${missing[0]} toʻldirilmagan`
    : `Toʻldirilmagan maydonlar: ${missing.join(', ')}`;
}

export const ACTION_LABELS: Record<WfAction, string> = {
  [WfAction.SUBMIT]: 'Yuborildi',
  [WfAction.APPROVE]: 'Tasdiqlandi',
  [WfAction.RETURN]: 'Qaytarildi',
  [WfAction.SIGN]: 'Imzolandi',
  [WfAction.DELETE]: "O'chirildi (arxiv)",
  [WfAction.RESTORE]: 'Tiklandi',
};
