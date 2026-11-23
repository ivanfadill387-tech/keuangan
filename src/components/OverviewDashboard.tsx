import { ArrowRight, Database, ShieldCheck, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import {
  calculateMonthlyAutoSaveAmount,
  estimateMonthsToTarget,
  formatDateID,
  formatIDR,
  formatMonthLabel,
  getCurrentMonthKey,
} from '../lib/financeMath';
import {
  EmergencyConfig,
  EmergencyLogItem,
  NavSection,
  TransactionItem,
} from '../types/finance';
import { MonthlyCharts } from './MonthlyCharts';

interface OverviewDashboardProps {
  transactions: TransactionItem[];
  emergencyLogs: EmergencyLogItem[];
  config: EmergencyConfig;
  rangeMonths: 6 | 12;
  onChangeRange: (range: 6 | 12) => void;
  onNavigate: (section: NavSection) => void;
  onOpenAddTransaction: () => void;
  onSeedSample: () => Promise<void>;
  isSeeding: boolean;
}

export function OverviewDashboard({
  transactions,
  emergencyLogs,
  config,
  rangeMonths,
  onChangeRange,
  onNavigate,
  onOpenAddTransaction,
  onSeedSample,
  isSeeding,
}: OverviewDashboardProps) {
  const currentMonth = getCurrentMonthKey();

  const currentMonthTx = transactions.filter((tx) => tx.monthKey === currentMonth);
  const monthIncome = currentMonthTx
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const monthExpense = currentMonthTx
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalIncomeAll = transactions
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpenseAll = transactions
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const netBalance = totalIncomeAll - totalExpenseAll;

  const progressPct =
    config.targetAmount > 0
      ? Math.min(100, (config.currentBalance / config.targetAmount) * 100)
      : 0;
  const scheduledMonthlyAmt = calculateMonthlyAutoSaveAmount(config, monthIncome);
  const projection = estimateMonthsToTarget(
    config,
    config.autoSaveEnabled ? scheduledMonthlyAmt : 0
  );

  const isEmpty = transactions.length === 0 && emergencyLogs.length === 0;

  return (
    <div className="space-y-6">
      {isEmpty && (
        <section className="bg-[#151B18] border border-[#10B981]/30 rounded-xl p-5 lg:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-base font-semibold text-[#F3F6F4]">
              Selamat Datang di KasVault
            </h2>
            <p className="text-xs text-[#9CA8A2] max-w-2xl leading-relaxed">
              Mulai catat pemasukan atau pengeluaran pertama Anda, atau muat contoh data 6 bulan
              untuk langsung melihat simulasi grafik bulanan dan progres dana darurat otomatis.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onSeedSample}
              disabled={isSeeding}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[#0F1412] border border-white/15 text-[#F3F6F4] rounded-lg hover:border-[#10B981] hover:text-[#10B981] transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{isSeeding ? 'Memuat Contoh...' : 'Muat Contoh Data 6 Bulan'}</span>
            </button>
            <button
              type="button"
              onClick={onOpenAddTransaction}
              className="px-4 py-2 text-xs font-semibold bg-[#10B981] text-[#052E1F] rounded-lg hover:bg-[#059669] transition-colors cursor-pointer whitespace-nowrap"
            >
              Catat Transaksi Pertama
            </button>
          </div>
        </section>
      )}

      {/* 4 KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#151B18] border border-white/8 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#9CA8A2]">
            <span>Saldo Arus Kas Bersih</span>
            <Wallet className="w-4 h-4 text-[#10B981]" />
          </div>
          <p className="font-mono tabular-nums text-xl font-bold text-[#F3F6F4]">
            {formatIDR(netBalance)}
          </p>
          <p className="text-xs text-[#66736D]">
            Akumulasi seluruh pemasukan dikurangi pengeluaran
          </p>
        </div>

        <div className="bg-[#151B18] border border-white/8 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#9CA8A2]">
            <span>Pemasukan ({formatMonthLabel(currentMonth, 'short')})</span>
            <TrendingUp className="w-4 h-4 text-[#10B981]" />
          </div>
          <p className="font-mono tabular-nums text-xl font-bold text-[#10B981]">
            {formatIDR(monthIncome)}
          </p>
          <p className="text-xs text-[#66736D]">
            {currentMonthTx.filter((t) => t.type === 'income').length} transaksi masuk bulan ini
          </p>
        </div>

        <div className="bg-[#151B18] border border-white/8 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#9CA8A2]">
            <span>Pengeluaran ({formatMonthLabel(currentMonth, 'short')})</span>
            <TrendingDown className="w-4 h-4 text-[#F59E0B]" />
          </div>
          <p className="font-mono tabular-nums text-xl font-bold text-[#F59E0B]">
            {formatIDR(monthExpense)}
          </p>
          <p className="text-xs text-[#66736D]">
            {currentMonthTx.filter((t) => t.type === 'expense').length} transaksi keluar bulan ini
          </p>
        </div>

        <div className="bg-[#151B18] border border-white/8 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#9CA8A2]">
            <span>Dana Darurat Terkumpul</span>
            <ShieldCheck className="w-4 h-4 text-[#10B981]" />
          </div>
          <p className="font-mono tabular-nums text-xl font-bold text-[#F3F6F4]">
            {formatIDR(config.currentBalance)}
          </p>
          <div className="space-y-1.5 pt-0.5">
            <div className="w-full h-1.5 bg-[#090C0B] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#10B981] rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-[#66736D] font-mono tabular-nums">
              {progressPct.toFixed(0)}% dari target · {projection.label}
            </p>
          </div>
        </div>
      </section>

      {/* Main Overview Chart */}
      <MonthlyCharts
        transactions={transactions}
        emergencyLogs={emergencyLogs}
        config={config}
        rangeMonths={rangeMonths}
        onChangeRange={onChangeRange}
        onOpenAddTransaction={onOpenAddTransaction}
        compactMode
      />

      {/* Bottom Split: Auto-Save Snapshot + Recent 5 Transactions */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-5 bg-[#151B18] border border-white/8 rounded-xl p-5 lg:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-semibold text-[#F3F6F4]">
              Status Otomatisasi Dana Darurat
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('emergency')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#10B981] hover:underline cursor-pointer whitespace-nowrap"
            >
              <span>Kelola</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 text-xs border-t border-white/8 pt-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[#9CA8A2]">Alokasi Bulanan Terjadwal</span>
              <span className="font-mono tabular-nums text-[#F3F6F4] font-medium">
                {config.autoSaveEnabled
                  ? `Aktif · Tgl ${config.scheduledDay} (${
                      config.monthlyRuleType === 'fixed'
                        ? formatIDR(config.monthlyRuleValue)
                        : `${config.monthlyRuleValue}% pemasukan`
                    })`
                  : 'Nonaktif'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[#9CA8A2]">Pembulatan Transaksi</span>
              <span className="font-mono tabular-nums text-[#F3F6F4] font-medium">
                {config.roundUpEnabled
                  ? `Aktif · Kelipatan ${formatIDR(config.roundUpStep)}`
                  : 'Nonaktif'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[#9CA8A2]">Eksekusi Bulan Ini</span>
              <span
                className={`font-medium ${
                  config.lastExecutedMonth === currentMonth
                    ? 'text-[#10B981]'
                    : 'text-[#F59E0B]'
                }`}
              >
                {config.lastExecutedMonth === currentMonth
                  ? `Sudah Dijalankan (${formatMonthLabel(currentMonth, 'short')})`
                  : `Menunggu Jadwal (Tgl ${config.scheduledDay})`}
              </span>
            </div>
          </div>
        </section>

        <section className="xl:col-span-7 bg-[#151B18] border border-white/8 rounded-xl p-5 lg:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-semibold text-[#F3F6F4]">
              Transaksi Terbaru
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('ledger')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#10B981] hover:underline cursor-pointer whitespace-nowrap"
            >
              <span>Lihat Semua</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {transactions.length === 0 ? (
            <p className="text-xs text-[#9CA8A2] py-6 text-center border-t border-white/8">
              Belum ada transaksi yang dicatat.
            </p>
          ) : (
            <div className="divide-y divide-white/6 border-t border-white/8">
              {transactions.slice(0, 5).map((tx) => (
                <div
                  key={tx.id}
                  className="py-2.5 flex items-center justify-between gap-4 text-xs"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#F3F6F4] truncate">{tx.title}</p>
                    <p className="text-[#66736D] mt-0.5">
                      {formatDateID(tx.date)} · {tx.category}
                      {tx.roundUpSaved > 0 && (
                        <>
                          {' · '}
                          <span className="text-[#10B981]">
                            Auto-save +{formatIDR(tx.roundUpSaved)}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <span
                    className={`font-mono tabular-nums text-sm font-semibold shrink-0 ${
                      tx.type === 'income' ? 'text-[#10B981]' : 'text-[#F3F6F4]'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : '-'}
                    {formatIDR(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
