import {
  calculateRoundUp,
  formatMonthLabel,
  getCurrentMonthKey,
  getRecentMonthKeys,
} from '../lib/financeMath';
import {
  DATE_REGEX,
  EmergencyConfig,
  EmergencyLogItem,
  MAX_CATEGORY_LENGTH,
  MAX_LOG_NOTE_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_TITLE_LENGTH,
  MonthlyRuleType,
  RoundUpStep,
  TransactionItem,
  TransactionType,
  VALID_ROUNDUP_STEPS,
} from '../types/finance';

export interface FinanceState {
  config: EmergencyConfig;
  transactions: TransactionItem[];
  emergencyLogs: EmergencyLogItem[];
}

export interface TransactionInput {
  title: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  note: string;
}

export interface EmergencySettingsPatch {
  targetAmount: number;
  monthlyExpenseBaseline: number;
  autoSaveEnabled: boolean;
  monthlyRuleType: MonthlyRuleType;
  monthlyRuleValue: number;
  scheduledDay: number;
  roundUpEnabled: boolean;
  roundUpStep: RoundUpStep;
}

const STORAGE_KEY = 'kasvault_local_finance_v1';

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function sanitizeText(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export function createDefaultConfig(): EmergencyConfig {
  const now = Date.now();
  return {
    targetAmount: 30000000,
    currentBalance: 0,
    monthlyExpenseBaseline: 5000000,
    autoSaveEnabled: true,
    monthlyRuleType: 'fixed',
    monthlyRuleValue: 1000000,
    scheduledDay: 25,
    roundUpEnabled: true,
    roundUpStep: 10000,
    lastExecutedMonth: '',
    createdAt: now,
    updatedAt: now,
  };
}

function sortTransactions(items: TransactionItem[]): TransactionItem[] {
  return [...items].sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date);
    if (dateDiff !== 0) return dateDiff;
    return b.createdAt - a.createdAt;
  });
}

function sortEmergencyLogs(items: EmergencyLogItem[]): EmergencyLogItem[] {
  return [...items].sort((a, b) => {
    const mDiff = b.monthKey.localeCompare(a.monthKey);
    if (mDiff !== 0) return mDiff;
    return b.createdAt - a.createdAt;
  });
}

export function loadFinanceState(): FinanceState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial: FinanceState = {
        config: createDefaultConfig(),
        transactions: [],
        emergencyLogs: [],
      };
      saveFinanceState(initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as Partial<FinanceState>;
    const config: EmergencyConfig = {
      ...createDefaultConfig(),
      ...(parsed.config || {}),
    };
    const transactions = Array.isArray(parsed.transactions)
      ? sortTransactions(parsed.transactions)
      : [];
    const emergencyLogs = Array.isArray(parsed.emergencyLogs)
      ? sortEmergencyLogs(parsed.emergencyLogs)
      : [];

    return { config, transactions, emergencyLogs };
  } catch {
    return {
      config: createDefaultConfig(),
      transactions: [],
      emergencyLogs: [],
    };
  }
}

export function saveFinanceState(state: FinanceState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Gagal menyimpan data ke browser:', err);
  }
}

export function resetFinanceState(): FinanceState {
  const clean: FinanceState = {
    config: createDefaultConfig(),
    transactions: [],
    emergencyLogs: [],
  };
  saveFinanceState(clean);
  return clean;
}

export function createTransactionWithAutoSave(
  state: FinanceState,
  input: TransactionInput
): { nextState: FinanceState; roundUpSaved: number } {
  const title = sanitizeText(input.title, MAX_TITLE_LENGTH);
  const category = sanitizeText(input.category, MAX_CATEGORY_LENGTH);
  const note = sanitizeText(input.note, MAX_NOTE_LENGTH);
  const amount = Math.round(input.amount);
  const date = DATE_REGEX.test(input.date) ? input.date : new Date().toISOString().slice(0, 10);
  const monthKey = date.slice(0, 7);

  if (!title || amount <= 0 || !category) {
    throw new Error('Data transaksi tidak lengkap atau nominal harus lebih dari 0.');
  }

  const now = Date.now();
  const txId = createId('tx');
  const roundUpSaved =
    input.type === 'expense' && state.config.roundUpEnabled
      ? Math.min(1000000, calculateRoundUp(amount, state.config.roundUpStep))
      : 0;

  const newTx: TransactionItem = {
    id: txId,
    title,
    amount,
    type: input.type,
    category,
    date,
    monthKey,
    note,
    roundUpSaved,
    createdAt: now,
    updatedAt: now,
  };

  let nextConfig = state.config;
  let nextLogs = state.emergencyLogs;

  if (roundUpSaved > 0) {
    nextConfig = {
      ...state.config,
      currentBalance: Math.max(0, Math.round(state.config.currentBalance + roundUpSaved)),
      updatedAt: now,
    };
    const roundUpLog: EmergencyLogItem = {
      id: createId('log'),
      amount: roundUpSaved,
      direction: 'deposit',
      source: 'round_up',
      note: sanitizeText(`Pembulatan: ${title}`, MAX_LOG_NOTE_LENGTH),
      monthKey,
      transactionId: txId,
      createdAt: now,
    };
    nextLogs = sortEmergencyLogs([roundUpLog, ...state.emergencyLogs]);
  }

  const nextState: FinanceState = {
    config: nextConfig,
    transactions: sortTransactions([newTx, ...state.transactions]),
    emergencyLogs: nextLogs,
  };
  saveFinanceState(nextState);
  return { nextState, roundUpSaved };
}

export function updateTransaction(
  state: FinanceState,
  existingTx: TransactionItem,
  input: TransactionInput
): FinanceState {
  const title = sanitizeText(input.title, MAX_TITLE_LENGTH);
  const category = sanitizeText(input.category, MAX_CATEGORY_LENGTH);
  const note = sanitizeText(input.note, MAX_NOTE_LENGTH);
  const amount = Math.round(input.amount);
  const date = DATE_REGEX.test(input.date) ? input.date : existingTx.date;
  const monthKey = date.slice(0, 7);

  if (!title || amount <= 0 || !category) {
    throw new Error('Data transaksi tidak valid.');
  }

  const now = Date.now();
  const nextTransactions = sortTransactions(
    state.transactions.map((tx) =>
      tx.id === existingTx.id
        ? {
            ...tx,
            title,
            amount,
            type: input.type,
            category,
            date,
            monthKey,
            note,
            updatedAt: now,
          }
        : tx
    )
  );

  const nextState: FinanceState = {
    ...state,
    transactions: nextTransactions,
  };
  saveFinanceState(nextState);
  return nextState;
}

export function deleteTransaction(state: FinanceState, txId: string): FinanceState {
  const nextState: FinanceState = {
    ...state,
    transactions: state.transactions.filter((tx) => tx.id !== txId),
  };
  saveFinanceState(nextState);
  return nextState;
}

export function updateEmergencyConfig(
  state: FinanceState,
  patch: EmergencySettingsPatch
): FinanceState {
  const roundUpStep: RoundUpStep = VALID_ROUNDUP_STEPS.includes(patch.roundUpStep)
    ? patch.roundUpStep
    : 10000;
  const scheduledDay = Math.min(28, Math.max(1, Math.round(patch.scheduledDay)));
  const monthlyRuleValue =
    patch.monthlyRuleType === 'percentage'
      ? Math.min(80, Math.max(1, Math.round(patch.monthlyRuleValue)))
      : Math.max(0, Math.round(patch.monthlyRuleValue));

  const nextState: FinanceState = {
    ...state,
    config: {
      ...state.config,
      targetAmount: Math.max(0, Math.round(patch.targetAmount)),
      monthlyExpenseBaseline: Math.max(0, Math.round(patch.monthlyExpenseBaseline)),
      autoSaveEnabled: Boolean(patch.autoSaveEnabled),
      monthlyRuleType: patch.monthlyRuleType,
      monthlyRuleValue,
      scheduledDay,
      roundUpEnabled: Boolean(patch.roundUpEnabled),
      roundUpStep,
      updatedAt: Date.now(),
    },
  };
  saveFinanceState(nextState);
  return nextState;
}

export function executeMonthlyAutoSave(
  state: FinanceState,
  amount: number,
  monthKey: string,
  notePrefix = 'Alokasi otomatis bulanan'
): FinanceState {
  const safeAmount = Math.round(amount);
  if (safeAmount <= 0) {
    throw new Error('Nominal alokasi bulanan harus lebih dari Rp 0.');
  }

  const now = Date.now();
  const newLog: EmergencyLogItem = {
    id: createId('log'),
    amount: safeAmount,
    direction: 'deposit',
    source: 'monthly_auto',
    note: sanitizeText(
      `${notePrefix} (${formatMonthLabel(monthKey, 'full')})`,
      MAX_LOG_NOTE_LENGTH
    ),
    monthKey,
    transactionId: '',
    createdAt: now,
  };

  const nextState: FinanceState = {
    ...state,
    config: {
      ...state.config,
      currentBalance: Math.max(0, Math.round(state.config.currentBalance + safeAmount)),
      lastExecutedMonth: monthKey,
      updatedAt: now,
    },
    emergencyLogs: sortEmergencyLogs([newLog, ...state.emergencyLogs]),
  };
  saveFinanceState(nextState);
  return nextState;
}

export function recordManualEmergencyMutation(
  state: FinanceState,
  amount: number,
  direction: 'deposit' | 'withdraw',
  note: string
): FinanceState {
  const safeAmount = Math.round(amount);
  if (safeAmount <= 0) {
    throw new Error('Nominal mutasi harus lebih dari Rp 0.');
  }
  if (direction === 'withdraw' && safeAmount > state.config.currentBalance) {
    throw new Error('Saldo dana darurat tidak mencukupi untuk penarikan ini.');
  }

  const now = Date.now();
  const nextBalance =
    direction === 'deposit'
      ? state.config.currentBalance + safeAmount
      : Math.max(0, state.config.currentBalance - safeAmount);

  const newLog: EmergencyLogItem = {
    id: createId('log'),
    amount: safeAmount,
    direction,
    source: direction === 'deposit' ? 'manual_deposit' : 'emergency_withdraw',
    note:
      sanitizeText(note, MAX_LOG_NOTE_LENGTH) ||
      (direction === 'deposit' ? 'Setoran manual dana darurat' : 'Penarikan dana darurat'),
    monthKey: getCurrentMonthKey(),
    transactionId: '',
    createdAt: now,
  };

  const nextState: FinanceState = {
    ...state,
    config: {
      ...state.config,
      currentBalance: Math.round(nextBalance),
      updatedAt: now,
    },
    emergencyLogs: sortEmergencyLogs([newLog, ...state.emergencyLogs]),
  };
  saveFinanceState(nextState);
  return nextState;
}

export function seedSamplePortfolio(state: FinanceState): FinanceState {
  const months = getRecentMonthKeys(6);
  const now = Date.now();
  const newTransactions: TransactionItem[] = [];
  const newLogs: EmergencyLogItem[] = [];
  let addedEmergencyTotal = 0;

  const monthlyTemplates = [
    { salary: 12500000, bonus: 1500000, groceries: 2154000, rent: 2400000, transport: 643000, utility: 586000, lifestyle: 742000 },
    { salary: 12500000, bonus: 800000, groceries: 2285000, rent: 2400000, transport: 712000, utility: 615000, lifestyle: 891000 },
    { salary: 13000000, bonus: 2200000, groceries: 2046000, rent: 2400000, transport: 594000, utility: 548000, lifestyle: 924000 },
    { salary: 13000000, bonus: 0, groceries: 2392000, rent: 2400000, transport: 685000, utility: 602000, lifestyle: 635000 },
    { salary: 13500000, bonus: 1750000, groceries: 2183000, rent: 2400000, transport: 621000, utility: 574000, lifestyle: 816000 },
    { salary: 13500000, bonus: 1200000, groceries: 1964000, rent: 2400000, transport: 538000, utility: 592000, lifestyle: 564000 },
  ];

  months.forEach((monthKey, idx) => {
    const tpl = monthlyTemplates[idx];
    const items: Array<{
      day: string;
      title: string;
      amount: number;
      type: TransactionType;
      category: string;
      note: string;
    }> = [
      { day: '01', title: 'Gaji Bulanan', amount: tpl.salary, type: 'income', category: 'Gaji', note: 'Pemasukan utama bulanan' },
      { day: '03', title: 'Sewa Tempat Tinggal', amount: tpl.rent, type: 'expense', category: 'Tempat Tinggal', note: 'Pembayaran sewa bulanan' },
      { day: '08', title: 'Belanja Kebutuhan Pokok', amount: tpl.groceries, type: 'expense', category: 'Kebutuhan Pokok', note: 'Supermarket & bahan dapur' },
      { day: '12', title: 'Listrik, Air & Internet', amount: tpl.utility, type: 'expense', category: 'Tagihan & Utilitas', note: 'Tagihan rutin rumah' },
      { day: '15', title: 'Transportasi & BBM', amount: tpl.transport, type: 'expense', category: 'Transportasi', note: 'Komuter harian' },
      { day: '21', title: 'Kopi, Makan Luar & Hiburan', amount: tpl.lifestyle, type: 'expense', category: 'Gaya Hidup', note: 'Pengeluaran akhir pekan' },
    ];

    if (tpl.bonus > 0) {
      items.push({
        day: '18',
        title: 'Proyek Lepas & Bonus',
        amount: tpl.bonus,
        type: 'income',
        category: 'Bonus & Freelance',
        note: 'Pendapatan tambahan',
      });
    }

    let monthRoundUp = 0;
    items.forEach((item, itemIdx) => {
      const roundUpSaved =
        item.type === 'expense' ? calculateRoundUp(item.amount, state.config.roundUpStep) : 0;
      monthRoundUp += roundUpSaved;

      newTransactions.push({
        id: createId(`seed_${idx}_${itemIdx}`),
        title: item.title,
        amount: item.amount,
        type: item.type,
        category: item.category,
        date: `${monthKey}-${item.day}`,
        monthKey,
        note: item.note,
        roundUpSaved,
        createdAt: now + idx * 100 + itemIdx,
        updatedAt: now + idx * 100 + itemIdx,
      });
    });

    if (idx < 5) {
      const autoAmt = 1500000;
      newLogs.push({
        id: createId(`log_auto_${idx}`),
        amount: autoAmt,
        direction: 'deposit',
        source: 'monthly_auto',
        note: `Alokasi otomatis bulanan (${formatMonthLabel(monthKey, 'full')})`,
        monthKey,
        transactionId: '',
        createdAt: now + idx * 100 + 50,
      });
      addedEmergencyTotal += autoAmt;
    }

    if (monthRoundUp > 0) {
      newLogs.push({
        id: createId(`log_ru_${idx}`),
        amount: monthRoundUp,
        direction: 'deposit',
        source: 'round_up',
        note: `Akumulasi pembulatan transaksi ${formatMonthLabel(monthKey, 'short')}`,
        monthKey,
        transactionId: '',
        createdAt: now + idx * 100 + 60,
      });
      addedEmergencyTotal += monthRoundUp;
    }
  });

  const nextState: FinanceState = {
    config: {
      ...state.config,
      currentBalance: Math.round(state.config.currentBalance + addedEmergencyTotal),
      updatedAt: now,
    },
    transactions: sortTransactions([...newTransactions, ...state.transactions]),
    emergencyLogs: sortEmergencyLogs([...newLogs, ...state.emergencyLogs]),
  };
  saveFinanceState(nextState);
  return nextState;
}
