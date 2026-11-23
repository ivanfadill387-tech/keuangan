import { useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Coins,
  Play,
  ShieldCheck,
} from 'lucide-react';
import {
  calculateMonthlyAutoSaveAmount,
  calculateRoundUp,
  estimateMonthsToTarget,
  formatIDR,
  formatMonthLabel,
  getCurrentMonthKey,
} from '../lib/financeMath';
import {
  EmergencyConfig,
  EmergencyLogItem,
  MonthlyRuleType,
  RoundUpStep,
  VALID_ROUNDUP_STEPS,
} from '../types/finance';

interface EmergencyFundPanelProps {
  config: EmergencyConfig;
  logs: EmergencyLogItem[];
  currentMonthIncome: number;
  onSaveSettings: (patch: {
    targetAmount: number;
    monthlyExpenseBaseline: number;
    autoSaveEnabled: boolean;
    monthlyRuleType: MonthlyRuleType;
    monthlyRuleValue: number;
    scheduledDay: number;
    roundUpEnabled: boolean;
    roundUpStep: RoundUpStep;
  }) => Promise<void>;
  onExecuteMonthlyNow: () => Promise<void>;
  onManualMutation: (
    amount: number,
    direction: 'deposit' | 'withdraw',
    note: string
  ) => Promise<void>;
}

const SOURCE_LABELS: Record<EmergencyLogItem['source'], string> = {
  monthly_auto: 'Auto-Save Bulanan',
  round_up: 'Pembulatan Transaksi',
  manual_deposit: 'Setoran Manual',
  emergency_withdraw: 'Penarikan Darurat',
};

export function EmergencyFundPanel({
  config,
  logs,
  currentMonthIncome,
  onSaveSettings,
  onExecuteMonthlyNow,
  onManualMutation,
}: EmergencyFundPanelProps) {
  const [targetAmount, setTargetAmount] = useState(String(config.targetAmount));
  const [expenseBaseline, setExpenseBaseline] = useState(String(config.monthlyExpenseBaseline));
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(config.autoSaveEnabled);
  const [monthlyRuleType, setMonthlyRuleType] = useState<MonthlyRuleType>(config.monthlyRuleType);
  const [monthlyRuleValue, setMonthlyRuleValue] = useState(String(config.monthlyRuleValue));
  const [scheduledDay, setScheduledDay] = useState(String(config.scheduledDay));
  const [roundUpEnabled, setRoundUpEnabled] = useState(config.roundUpEnabled);
  const [roundUpStep, setRoundUpStep] = useState<RoundUpStep>(config.roundUpStep);

  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isExecutingAuto, setIsExecutingAuto] = useState(false);

  // Manual deposit / withdraw state
  const [mutationDirection, setMutationDirection] = useState<'deposit' | 'withdraw'>('deposit');
  const [mutationAmount, setMutationAmount] = useState('');
  const [mutationNote, setMutationNote] = useState('');
  const [isSubmittingMutation, setIsSubmittingMutation] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  useEffect(() => {
    setTargetAmount(String(config.targetAmount));
    setExpenseBaseline(String(config.monthlyExpenseBaseline));
    setAutoSaveEnabled(config.autoSaveEnabled);
    setMonthlyRuleType(config.monthlyRuleType);
    setMonthlyRuleValue(String(config.monthlyRuleValue));
    setScheduledDay(String(config.scheduledDay));
    setRoundUpEnabled(config.roundUpEnabled);
    setRoundUpStep(config.roundUpStep);
  }, [config]);

  const currentMonthKey = getCurrentMonthKey();
  const isCurrentMonthExecuted = config.lastExecutedMonth === currentMonthKey;

  const progressPct =
    config.targetAmount > 0
      ? Math.min(100, (config.currentBalance / config.targetAmount) * 100)
      : 0;

  const monthsCoverage =
    config.monthlyExpenseBaseline > 0
      ? config.currentBalance / config.monthlyExpenseBaseline
      : 0;

  const previewAutoSaveAmount = calculateMonthlyAutoSaveAmount(
    {
      ...config,
      monthlyRuleType,
      monthlyRuleValue: Number(monthlyRuleValue) || 0,
    },
    currentMonthIncome
  );

  const projection = estimateMonthsToTarget(
    config,
    config.autoSaveEnabled ? calculateMonthlyAutoSaveAmount(config, currentMonthIncome) : 0
  );

  const exampleExpense = 43500;
  const exampleRoundUp = calculateRoundUp(exampleExpense, roundUpStep);

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      await onSaveSettings({
        targetAmount: Math.max(0, Number(targetAmount) || 0),
        monthlyExpenseBaseline: Math.max(0, Number(expenseBaseline) || 0),
        autoSaveEnabled,
        monthlyRuleType,
        monthlyRuleValue: Math.max(0, Number(monthlyRuleValue) || 0),
        scheduledDay: Math.min(28, Math.max(1, Number(scheduledDay) || 25)),
        roundUpEnabled,
        roundUpStep,
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleExecuteNow = async () => {
    setIsExecutingAuto(true);
    try {
      await onExecuteMonthlyNow();
    } finally {
      setIsExecutingAuto(false);
    }
  };

  const handleMutationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMutationError(null);
    const num = Number(mutationAmount);
    if (!Number.isFinite(num) || num <= 0) {
      setMutationError('Masukkan nominal lebih dari Rp 0.');
      return;
    }
    if (mutationDirection === 'withdraw' && num > config.currentBalance) {
      setMutationError('Saldo dana darurat tidak mencukupi.');
      return;
    }
    setIsSubmittingMutation(true);
    try {
      await onManualMutation(
        num,
        mutationDirection,
        mutationNote.trim() ||
          (mutationDirection === 'deposit'
            ? 'Setoran tambahan ke brankas dana darurat'
            : 'Penarikan kebutuhan darurat')
      );
      setMutationAmount('');
      setMutationNote('');
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Gagal memproses mutasi.');
    } finally {
      setIsSubmittingMutation(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Emergency Vault Status */}
      <section className="bg-[#151B18] border border-white/8 rounded-xl p-5 lg:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-[#10B981]">
              <ShieldCheck className="w-4 h-4" />
              <span>Brankas Dana Darurat</span>
            </div>
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-[#F3F6F4]">
                {formatIDR(config.currentBalance)}
              </h2>
              <span className="text-xs text-[#9CA8A2] font-mono tabular-nums">
                dari target {formatIDR(config.targetAmount)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExecuteNow}
              disabled={isExecutingAuto || isCurrentMonthExecuted || previewAutoSaveAmount <= 0}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                isCurrentMonthExecuted
                  ? 'bg-[#0F1412] text-[#10B981] border border-[#10B981]/30 cursor-default'
                  : 'bg-[#10B981] text-[#052E1F] hover:bg-[#059669] cursor-pointer disabled:opacity-50'
              }`}
            >
              {isCurrentMonthExecuted ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Auto-Save {formatMonthLabel(currentMonthKey, 'short')} Selesai</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>
                    {isExecutingAuto
                      ? 'Menyisihkan...'
                      : `Jalankan Auto-Save (${formatIDR(previewAutoSaveAmount)})`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="w-full h-3 bg-[#090C0B] border border-white/8 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#10B981] rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#9CA8A2]">
            <span className="font-mono tabular-nums">
              Tercapai <strong className="text-[#F3F6F4]">{progressPct.toFixed(1)}%</strong>
              {' · '}Ketahanan biaya hidup:{' '}
              <strong className="text-[#10B981]">{monthsCoverage.toFixed(1)} bulan</strong>
            </span>
            <span>Estimasi selesai: {projection.label}</span>
          </div>
        </div>
      </section>

      {/* Configuration & Manual Action Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Automation Rules Form */}
        <form
          onSubmit={handleSaveRules}
          className="xl:col-span-7 bg-[#151B18] border border-white/8 rounded-xl p-5 lg:p-6 space-y-6"
        >
          <div className="flex items-center justify-between gap-4 border-b border-white/8 pb-4">
            <div>
              <h3 className="font-display text-base font-semibold text-[#F3F6F4]">
                Aturan Menabung Otomatis
              </h3>
              <p className="text-xs text-[#9CA8A2] mt-0.5">
                Atur penyisihan bulanan terjadwal dan pembulatan transaksi harian
              </p>
            </div>
          </div>

          {/* Rule 1: Monthly Scheduled Auto-Save */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <CalendarClock className="w-4 h-4 text-[#10B981] shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[#F3F6F4]">
                    Alokasi Otomatis Bulanan
                  </p>
                  <p className="text-xs text-[#66736D]">
                    Otomatis menyisihkan dana setiap bulan sesuai tanggal gajian
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoSaveEnabled}
                onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${
                  autoSaveEnabled ? 'bg-[#10B981]' : 'bg-white/15'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-[#090C0B] transition-transform ${
                    autoSaveEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMonthlyRuleType('fixed');
                    if (Number(monthlyRuleValue) <= 100) {
                      setMonthlyRuleValue('1000000');
                    }
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                    monthlyRuleType === 'fixed'
                      ? 'bg-[#10B981]/15 border-[#10B981]/50 text-[#10B981]'
                      : 'bg-[#0F1412] border-white/8 text-[#9CA8A2]'
                  }`}
                >
                  Nominal Tetap (Rp)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMonthlyRuleType('percentage');
                    if (Number(monthlyRuleValue) > 80 || Number(monthlyRuleValue) === 0) {
                      setMonthlyRuleValue('15');
                    }
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                    monthlyRuleType === 'percentage'
                      ? 'bg-[#10B981]/15 border-[#10B981]/50 text-[#10B981]'
                      : 'bg-[#0F1412] border-white/8 text-[#9CA8A2]'
                  }`}
                >
                  Persentase Pemasukan (%)
                </button>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs text-[#9CA8A2]">
                  {monthlyRuleType === 'fixed'
                    ? 'Nominal Setoran / Bulan (Rp)'
                    : 'Persentase dari Pemasukan Bulan Ini (1–80%)'}
                </label>
                <input
                  type="number"
                  min={monthlyRuleType === 'percentage' ? 1 : 0}
                  max={monthlyRuleType === 'percentage' ? 80 : 1000000000}
                  value={monthlyRuleValue}
                  onChange={(e) => setMonthlyRuleValue(e.target.value)}
                  className="w-full bg-[#090C0B] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-[#F3F6F4] focus:outline-none focus:border-[#10B981]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs text-[#9CA8A2]">Tanggal Eksekusi</label>
                <select
                  value={scheduledDay}
                  onChange={(e) => setScheduledDay(e.target.value)}
                  className="w-full bg-[#090C0B] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-[#F3F6F4] focus:outline-none focus:border-[#10B981]"
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day}>
                      Tanggal {day}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {monthlyRuleType === 'percentage' && (
              <p className="text-xs text-[#9CA8A2] bg-[#0F1412] border border-white/8 rounded-lg px-3 py-2">
                Pemasukan bulan ini{' '}
                <span className="font-mono text-[#F3F6F4]">
                  {formatIDR(currentMonthIncome)}
                </span>{' '}
                → Estimasi auto-save bulan ini{' '}
                <span className="font-mono text-[#10B981] font-semibold">
                  {formatIDR(previewAutoSaveAmount)}
                </span>
              </p>
            )}
          </div>

          {/* Rule 2: Round-Up Transactions */}
          <div className="pt-4 border-t border-white/8 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Coins className="w-4 h-4 text-[#10B981] shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[#F3F6F4]">
                    Pembulatan Transaksi (Round-Up)
                  </p>
                  <p className="text-xs text-[#66736D]">
                    Setiap pengeluaran dibulatkan ke atas dan selisihnya masuk dana darurat
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={roundUpEnabled}
                onClick={() => setRoundUpEnabled(!roundUpEnabled)}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${
                  roundUpEnabled ? 'bg-[#10B981]' : 'bg-white/15'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-[#090C0B] transition-transform ${
                    roundUpEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {VALID_ROUNDUP_STEPS.map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setRoundUpStep(step)}
                  className={`px-3 py-1.5 text-xs font-mono tabular-nums rounded-lg border transition-colors cursor-pointer ${
                    roundUpStep === step
                      ? 'bg-[#10B981]/15 border-[#10B981]/50 text-[#10B981]'
                      : 'bg-[#0F1412] border-white/8 text-[#9CA8A2] hover:text-[#F3F6F4]'
                  }`}
                >
                  Kelipatan {formatIDR(step)}
                </button>
              ))}
            </div>

            <p className="text-xs text-[#9CA8A2] bg-[#0F1412] border border-white/8 rounded-lg px-3 py-2">
              Simulasi: Pengeluaran{' '}
              <span className="font-mono text-[#F3F6F4]">{formatIDR(exampleExpense)}</span> →
              Otomatis nabung{' '}
              <span className="font-mono text-[#10B981] font-semibold">
                {formatIDR(exampleRoundUp)}
              </span>
            </p>
          </div>

          {/* Target & Baseline */}
          <div className="pt-4 border-t border-white/8 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs text-[#9CA8A2]">
                  Basis Pengeluaran Bulanan (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  value={expenseBaseline}
                  onChange={(e) => setExpenseBaseline(e.target.value)}
                  className="w-full bg-[#090C0B] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-[#F3F6F4] focus:outline-none focus:border-[#10B981]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs text-[#9CA8A2]">
                  Target Dana Darurat (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  className="w-full bg-[#090C0B] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-[#F3F6F4] focus:outline-none focus:border-[#10B981]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#66736D]">Rekomendasi cepat:</span>
                {[3, 6, 12].map((mult) => (
                  <button
                    key={mult}
                    type="button"
                    onClick={() =>
                      setTargetAmount(
                        String(Math.max(0, (Number(expenseBaseline) || 0) * mult))
                      )
                    }
                    className="px-2.5 py-1 bg-[#0F1412] border border-white/8 rounded text-[#9CA8A2] hover:text-[#F3F6F4] cursor-pointer"
                  >
                    {mult}× Pengeluaran
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={isSavingConfig}
                className="px-4 py-2 text-xs font-semibold bg-[#10B981] text-[#052E1F] rounded-lg hover:bg-[#059669] transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
              >
                {isSavingConfig ? 'Menyimpan...' : 'Simpan Aturan'}
              </button>
            </div>
          </div>
        </form>

        {/* Manual Deposit / Withdraw + Recent Logs */}
        <div className="xl:col-span-5 space-y-6">
          <form
            onSubmit={handleMutationSubmit}
            className="bg-[#151B18] border border-white/8 rounded-xl p-5 lg:p-6 space-y-4"
          >
            <h3 className="font-display text-base font-semibold text-[#F3F6F4]">
              Setoran & Penarikan Manual
            </h3>

            <div className="grid grid-cols-2 gap-2 p-1 bg-[#0F1412] border border-white/8 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setMutationDirection('deposit');
                  setMutationError(null);
                }}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  mutationDirection === 'deposit'
                    ? 'bg-[#10B981] text-[#052E1F]'
                    : 'text-[#9CA8A2] hover:text-[#F3F6F4]'
                }`}
              >
                Setor Tambahan
              </button>
              <button
                type="button"
                onClick={() => {
                  setMutationDirection('withdraw');
                  setMutationError(null);
                }}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  mutationDirection === 'withdraw'
                    ? 'bg-[#F59E0B] text-[#291800]'
                    : 'text-[#9CA8A2] hover:text-[#F3F6F4]'
                }`}
              >
                Tarik Darurat
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs text-[#9CA8A2]">Nominal (Rp)</label>
                <input
                  type="number"
                  min={1}
                  placeholder="Contoh: 500000"
                  value={mutationAmount}
                  onChange={(e) => setMutationAmount(e.target.value)}
                  className="w-full bg-[#090C0B] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-[#F3F6F4] focus:outline-none focus:border-[#10B981]"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-[#9CA8A2]">Keterangan</label>
                <input
                  type="text"
                  maxLength={200}
                  placeholder={
                    mutationDirection === 'deposit'
                      ? 'Misal: Bonus proyek akhir bulan'
                      : 'Misal: Perbaikan kendaraan mendadak'
                  }
                  value={mutationNote}
                  onChange={(e) => setMutationNote(e.target.value)}
                  className="w-full bg-[#090C0B] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#F3F6F4] focus:outline-none focus:border-[#10B981]"
                />
              </div>
            </div>

            {mutationError && (
              <p className="text-xs text-[#EF4444]">{mutationError}</p>
            )}

            <button
              type="submit"
              disabled={isSubmittingMutation}
              className="w-full py-2.5 text-xs font-semibold bg-[#0F1412] border border-white/15 text-[#F3F6F4] rounded-lg hover:border-[#10B981] hover:text-[#10B981] transition-colors disabled:opacity-60 cursor-pointer"
            >
              {isSubmittingMutation
                ? 'Memproses...'
                : mutationDirection === 'deposit'
                ? 'Tambah ke Dana Darurat'
                : 'Catat Penarikan Darurat'}
            </button>
          </form>

          {/* Emergency Fund Audit Logs */}
          <section className="bg-[#151B18] border border-white/8 rounded-xl p-5 lg:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-[#F3F6F4]">
                Riwayat Mutasi Brankas
              </h3>
              <span className="text-xs text-[#66736D] font-mono tabular-nums">
                {logs.length} entri
              </span>
            </div>

            {logs.length === 0 ? (
              <p className="text-xs text-[#9CA8A2] py-6 text-center">
                Belum ada setoran otomatis maupun manual ke dana darurat.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                {logs.slice(0, 20).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between gap-3 py-2 border-b border-white/6 last:border-0 text-xs"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      {log.direction === 'deposit' ? (
                        <ArrowDownLeft className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <p className="text-[#F3F6F4] font-medium truncate">{log.note}</p>
                        <p className="text-[#66736D] mt-0.5">
                          {SOURCE_LABELS[log.source]} · {formatMonthLabel(log.monthKey, 'short')}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`font-mono tabular-nums font-semibold shrink-0 ${
                        log.direction === 'deposit' ? 'text-[#10B981]' : 'text-[#F59E0B]'
                      }`}
                    >
                      {log.direction === 'deposit' ? '+' : '-'}
                      {formatIDR(log.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
