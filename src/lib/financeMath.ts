import {
  CategoryBreakdownItem,
  EmergencyConfig,
  EmergencyLogItem,
  MonthlySummaryPoint,
  RoundUpStep,
  TransactionItem,
} from '../types/finance';

const MONTH_NAMES_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

const MONTH_NAMES_FULL = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const CATEGORY_COLORS = [
  '#10B981',
  '#38BDF8',
  '#F59E0B',
  '#34D399',
  '#A78BFA',
  '#FB7185',
  '#2DD4BF',
  '#94A3B8',
];

export function formatIDR(value: number): string {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  const prefix = safe < 0 ? '-Rp ' : 'Rp ';
  return prefix + new Intl.NumberFormat('id-ID').format(Math.abs(safe));
}

export function formatIDRCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
  }
  if (abs >= 1_000_000) {
    const formatted = (abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1);
    return `${sign}Rp ${formatted.replace('.', ',')} jt`;
  }
  if (abs >= 1_000) {
    return `${sign}Rp ${Math.round(abs / 1_000)} rb`;
  }
  return `${sign}Rp ${Math.round(abs)}`;
}

export function getTodayDateString(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentMonthKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function formatMonthLabel(monthKey: string, style: 'short' | 'full' = 'short'): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const monthIndex = Number(monthStr) - 1;
  if (Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return monthKey;
  }
  const names = style === 'short' ? MONTH_NAMES_SHORT : MONTH_NAMES_FULL;
  return `${names[monthIndex]} ${yearStr}`;
}

export function formatDateID(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const idx = Number(m) - 1;
  if (idx < 0 || idx > 11) return dateStr;
  return `${Number(d)} ${MONTH_NAMES_SHORT[idx]} ${y}`;
}

export function getRecentMonthKeys(count: number, endMonthKey = getCurrentMonthKey()): string[] {
  const [yStr, mStr] = endMonthKey.split('-');
  const baseYear = Number(yStr);
  const baseMonth = Number(mStr) - 1;
  const keys: string[] = [];

  for (let i = count - 1; i >= 0; i--) {
    const dt = new Date(baseYear, baseMonth - i, 1);
    keys.push(getCurrentMonthKey(dt));
  }
  return keys;
}

export function calculateRoundUp(amount: number, step: RoundUpStep): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const cleanAmount = Math.round(amount);
  const remainder = cleanAmount % step;
  if (remainder === 0) return 0;
  return step - remainder;
}

export function calculateMonthlyAutoSaveAmount(
  config: EmergencyConfig,
  monthIncome: number
): number {
  if (config.monthlyRuleType === 'fixed') {
    return Math.max(0, Math.round(config.monthlyRuleValue));
  }
  const basis = monthIncome > 0 ? monthIncome : 0;
  return Math.max(0, Math.round((basis * config.monthlyRuleValue) / 100));
}

export function buildMonthlySeries(
  transactions: TransactionItem[],
  emergencyLogs: EmergencyLogItem[],
  monthKeys: string[],
  currentEmergencyBalance: number
): MonthlySummaryPoint[] {
  const txMap = new Map<string, { income: number; expense: number }>();
  const saveMap = new Map<string, number>();

  for (const key of monthKeys) {
    txMap.set(key, { income: 0, expense: 0 });
    saveMap.set(key, 0);
  }

  for (const tx of transactions) {
    const bucket = txMap.get(tx.monthKey);
    if (!bucket) continue;
    if (tx.type === 'income') {
      bucket.income += tx.amount;
    } else {
      bucket.expense += tx.amount;
    }
  }

  // Track net emergency movement across ALL logs to reconstruct historical balance accurately
  const allMonthNet = new Map<string, number>();
  for (const log of emergencyLogs) {
    const delta = log.direction === 'deposit' ? log.amount : -log.amount;
    allMonthNet.set(log.monthKey, (allMonthNet.get(log.monthKey) || 0) + delta);
    if (saveMap.has(log.monthKey) && log.direction === 'deposit') {
      saveMap.set(log.monthKey, (saveMap.get(log.monthKey) || 0) + log.amount);
    }
  }

  // Work backward from currentEmergencyBalance to derive end-of-month balances
  const cumulativeByMonth = new Map<string, number>();
  let running = Math.max(0, currentEmergencyBalance);
  const descendingKeys = [...monthKeys].reverse();

  for (const key of descendingKeys) {
    cumulativeByMonth.set(key, Math.max(0, running));
    running -= allMonthNet.get(key) || 0;
  }

  return monthKeys.map((key) => {
    const flow = txMap.get(key) || { income: 0, expense: 0 };
    const emergencySaved = saveMap.get(key) || 0;
    return {
      monthKey: key,
      shortLabel: formatMonthLabel(key, 'short').split(' ')[0],
      fullLabel: formatMonthLabel(key, 'full'),
      income: flow.income,
      expense: flow.expense,
      netCashflow: flow.income - flow.expense,
      emergencySaved,
      cumulativeEmergency: cumulativeByMonth.get(key) ?? currentEmergencyBalance,
    };
  });
}

export function buildCategoryBreakdown(
  transactions: TransactionItem[],
  monthKey?: string
): CategoryBreakdownItem[] {
  const expenses = transactions.filter(
    (tx) => tx.type === 'expense' && (!monthKey || tx.monthKey === monthKey)
  );
  const total = expenses.reduce((sum, tx) => sum + tx.amount, 0);
  if (total === 0) return [];

  const grouped = new Map<string, { amount: number; count: number }>();
  for (const tx of expenses) {
    const prev = grouped.get(tx.category) || { amount: 0, count: 0 };
    grouped.set(tx.category, {
      amount: prev.amount + tx.amount,
      count: prev.count + 1,
    });
  }

  return Array.from(grouped.entries())
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([category, info], index) => ({
      category,
      amount: info.amount,
      percentage: (info.amount / total) * 100,
      count: info.count,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    }));
}

export function estimateMonthsToTarget(
  config: EmergencyConfig,
  estimatedMonthlySaving: number
): { monthsRemaining: number | null; label: string } {
  const remaining = config.targetAmount - config.currentBalance;
  if (config.targetAmount <= 0) {
    return { monthsRemaining: null, label: 'Target belum diatur' };
  }
  if (remaining <= 0) {
    return { monthsRemaining: 0, label: 'Target Tercapai' };
  }
  if (estimatedMonthlySaving <= 0) {
    return { monthsRemaining: null, label: 'Aktifkan setoran rutin' };
  }
  const months = Math.ceil(remaining / estimatedMonthlySaving);
  const now = new Date();
  const targetDate = new Date(now.getFullYear(), now.getMonth() + months, 1);
  return {
    monthsRemaining: months,
    label: `${months} bulan (Est. ${formatMonthLabel(getCurrentMonthKey(targetDate), 'short')})`,
  };
}
