/** Shared domain vocabulary. Kept in one place so labels never drift. */

export const LOCALES = ["ja", "en", "zh"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ja";

export const ROLES = ["ADMIN", "SELLER", "BIDDER"] as const;
export type Role = (typeof ROLES)[number];

export const COMPANY_STATUSES = [
  "PENDING",
  "UNDER_REVIEW",
  "PROVISIONAL",
  "APPROVED",
  "SUSPENDED",
  "EXPELLED",
] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export const LOT_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "OPEN",
  "CLOSED",
  "AWARDED",
  "CANCELLED",
  "FAILED",
] as const;
export type LotStatus = (typeof LOT_STATUSES)[number];

export const CONDITIONS = [
  "NEW_SEALED",
  "NEW_OPENED",
  "USED_WORKING",
  "USED_JUNK",
  "PARTS_TESTED",
  "PARTS_UNTESTED",
] as const;
export type Condition = (typeof CONDITIONS)[number];

export const CATEGORY_CODES = [
  "PC",
  "SERVER",
  "MOBILE",
  "TABLET",
  "PARTS",
] as const;
export type CategoryCode = (typeof CATEGORY_CODES)[number];

export const CONTRACT_STATUSES = [
  "AWARDED",
  "IN_CONTRACT",
  "AWAITING_PAYMENT",
  "DELIVERED",
  "COMPLETED",
] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const PAYMENT_METHODS = [
  "BANK_TRANSFER",
  "CREDIT_CARD",
  "PAYPAL",
  "INVOICE_TERMS",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const NOTIFICATION_CHANNELS = [
  "EMAIL",
  "SMS",
  "TEAMS",
  "LINE",
  "WHATSAPP",
  "WECHAT",
] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const DOCUMENT_KINDS = [
  "REGISTRY",
  "ANTIQUE_LICENSE",
  "ID_DOCUMENT",
  "IMPORT_LICENSE",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const AUDIT_ACTIONS = [
  "LOGIN",
  "LOGIN_FAILED",
  "LOGOUT",
  "SESSION_REVOKE",
  "MFA_ENROLLED",
  "MFA_DISABLED",
  "PASSWORD_RESET",
  "MEMBER_APPLY",
  "MEMBER_REVIEW",
  "MEMBER_APPROVE",
  "MEMBER_SUSPEND",
  "LOT_CREATE",
  "LOT_UPDATE",
  "LOT_PUBLISH",
  "LOT_CANCEL",
  "LOT_OPEN",
  "BID_SUBMIT",
  "BID_AMEND",
  "BID_CANCEL",
  "AWARD_SELECT",
  "AWARD_CONFIRM",
  "INVOICE_ISSUE",
  "PAYMENT_METHOD",
  "PAYMENT_CONFIRM",
  "SHIPMENT_UPDATE",
  "DOCUMENT_VIEW",
  "ADMIN_ACTION",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Audit retention: the brief asks for 5-7 years. We keep 7. */
export const AUDIT_RETENTION_YEARS = 7;

/**
 * Above this figure card and PayPal settlement is disabled, because a 3-4%
 * processing fee on a six-figure lot is real money. Configurable at runtime
 * through SystemSetting.
 */
export const DEFAULT_CARD_LIMIT_CENTS = 1_000_000; // USD 10,000

export const REGIONS = [
  "ASIA",
  "OCEANIA",
  "NORTH_AMERICA",
  "SOUTH_AMERICA",
  "EUROPE",
  "MIDDLE_EAST",
  "AFRICA",
] as const;
export type Region = (typeof REGIONS)[number];

export const JP_CONSUMPTION_TAX_RATE = 0.1;
