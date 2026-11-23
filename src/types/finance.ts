export type TransactionType = 'income' | 'expense';
export type MonthlyRuleType = 'fixed' | 'percentage';
export type RoundUpStep = 10000 | 50000 | 100000;
export type EmergencyLogDirection = 'deposit' | 'withdraw';
export type EmergencyLogSource =
  | 'monthly_auto'
  | 'round_up'
  | 'manual_deposit'
  | 'emergency_withdraw';

export type NavSection = 'overview' | 'analytics' | 'emergency' | 'ledger';

export const MAX_TITLE_LENGTH = 120;
export const MAX_NOTE_LENGTH = 240;
export const MAX_LOG_NOTE_LENGTH = 200;
export const MAX_CATEGORY_LENGTH = 50;
export const DATE_REGEX = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
export const MONTH_KEY_REGEX = /^[0-9]{4}-[0-9]{2}$/;
export const VALID_ROUNDUP_STEPS: RoundUpStep[] = [10000, 50000, 100000];

export const INCOME_CATEGORIES = [
  'Gaji',
  'Bonus & Freelance',
  'Investasi & Dividen',
  'Penjualan',
  'Lainnya',
] as const;

export const EXPENSE_CATEGORIES = [
  'Kebutuhan Pokok',
  'Tempat Tinggal',
  'Transportasi',
  'Tagihan & Utilitas',
  'Kesehatan',
  'Gaya Hidup',
  'Pendidikan',
  'Lainnya',
] as const;

export interface EmergencyConfig {
  targetAmount: number;
  currentBalance: number;
  monthlyExpenseBaseline: number;
  autoSaveEnabled: boolean;
  monthlyRuleType: MonthlyRuleType;
  monthlyRuleValue: number;
  scheduledDay: number;
  roundUpEnabled: boolean;
  roundUpStep: RoundUpStep;
  lastExecutedMonth: string;
  createdAt: number;
  updatedAt: number;
}

export interface TransactionItem {
  id: string;
  title: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  monthKey: string;
  note: string;
  roundUpSaved: number;
  createdAt: number;
  updatedAt: number;
}

export interface EmergencyLogItem {
  id: string;
  amount: number;
  direction: EmergencyLogDirection;
  source: EmergencyLogSource;
  note: string;
  monthKey: string;
  transactionId: string;
  createdAt: number;
}

export interface MonthlySummaryPoint {
  monthKey: string;
  shortLabel: string;
  fullLabel: string;
  income: number;
  expense: number;
  netCashflow: number;
  emergencySaved: number;
  cumulativeEmergency: number;
}

export interface CategoryBreakdownItem {
  category: string;
  amount: number;
  percentage: number;
  count: number;
  color: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  detail: string;
  variant: 'success' | 'info' | 'warning';
}
