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

export const ACTION_LABELS: Record<WfAction, string> = {
  [WfAction.SUBMIT]: 'Yuborildi',
  [WfAction.APPROVE]: 'Tasdiqlandi',
  [WfAction.RETURN]: 'Qaytarildi',
  [WfAction.SIGN]: 'Imzolandi',
  [WfAction.DELETE]: "O'chirildi (arxiv)",
  [WfAction.RESTORE]: 'Tiklandi',
};
