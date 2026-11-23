import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  BookOpenText,
  CheckCircle2,
  LayoutDashboard,
  Plus,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { EmergencyFundPanel } from './components/EmergencyFundPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MonthlyCharts } from './components/MonthlyCharts';
import { OverviewDashboard } from './components/OverviewDashboard';
import { TransactionModal } from './components/TransactionModal';
import { TransactionsLedger } from './components/TransactionsLedger';
import {
  calculateMonthlyAutoSaveAmount,
  formatIDR,
  formatMonthLabel,
  getCurrentMonthKey,
} from './lib/financeMath';
import {
  createTransactionWithAutoSave,
  deleteTransaction,
  EmergencySettingsPatch,
  executeMonthlyAutoSave,
  FinanceState,
  loadFinanceState,
  recordManualEmergencyMutation,
  resetFinanceState,
  seedSamplePortfolio,
  TransactionInput,
  updateEmergencyConfig,
  updateTransaction,
} from './services/financeService';
import {
  NavSection,
  ToastMessage,
  TransactionItem,
} from './types/finance';

const NAV_ITEMS: Array<{ id: NavSection; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Ringkasan', icon: LayoutDashboard },
  { id: 'analytics', label: 'Grafik Bulanan', icon: BarChart3 },
  { id: 'emergency', label: 'Dana Darurat', icon: ShieldCheck },
  { id: 'ledger', label: 'Buku Kas', icon: BookOpenText },
];

const SECTION_TITLES: Record<NavSection, string> = {
  overview: 'Ringkasan Keuangan',
  analytics: 'Pelaporan Grafik Bulanan',
  emergency: 'Brankas & Auto-Save Dana Darurat',
  ledger: 'Buku Kas Transaksi',
};

function KasVaultApp() {
  const [financeState, setFinanceState] = useState<FinanceState>(() => loadFinanceState());
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [rangeMonths, setRangeMonths] = useState<6 | 12>(6);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<TransactionItem | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const autoTriggeredRef = useRef<string | null>(null);

  const { config, transactions, emergencyLogs } = financeState;

  const pushToast = useCallback(
    (title: string, detail: string, variant: ToastMessage['variant'] = 'success') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, title, detail, variant }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    []
  );

  const currentMonthKey = getCurrentMonthKey();

  const currentMonthIncome = useMemo(
    () =>
      transactions
        .filter((tx) => tx.monthKey === currentMonthKey && tx.type === 'income')
        .reduce((sum, tx) => sum + tx.amount, 0),
    [transactions, currentMonthKey]
  );

  // Idempotent scheduled monthly auto-save check
  useEffect(() => {
    if (!config.autoSaveEnabled) return;

    const todayDay = new Date().getDate();
    if (todayDay < config.scheduledDay) return;
    if (config.lastExecutedMonth === currentMonthKey) return;

    if (autoTriggeredRef.current === currentMonthKey) return;

    const amount = calculateMonthlyAutoSaveAmount(config, currentMonthIncome);
    if (amount <= 0) return;

    autoTriggeredRef.current = currentMonthKey;
    setFinanceState((prev) => {
      if (prev.config.lastExecutedMonth === currentMonthKey) return prev;
      return executeMonthlyAutoSave(
        prev,
        amount,
        currentMonthKey,
        'Auto-Save terjadwal otomatis'
      );
    });
    pushToast(
      'Auto-Save Bulanan Berhasil',
      `${formatIDR(amount)} otomatis disisihkan ke Dana Darurat untuk ${formatMonthLabel(
        currentMonthKey,
        'full'
      )}.`,
      'success'
    );
  }, [config, currentMonthKey, currentMonthIncome, pushToast]);

  const handleTransactionSubmit = async (data: TransactionInput) => {
    if (editingTx) {
      setFinanceState((prev) => updateTransaction(prev, editingTx, data));
      pushToast('Transaksi Diperbarui', `${data.title} berhasil diperbarui.`, 'info');
    } else {
      let savedRoundUp = 0;
      setFinanceState((prev) => {
        const result = createTransactionWithAutoSave(prev, data);
        savedRoundUp = result.roundUpSaved;
        return result.nextState;
      });
      if (savedRoundUp > 0) {
        pushToast(
          'Transaksi & Auto-Save Tersimpan',
          `${data.title} dicatat + ${formatIDR(savedRoundUp)} masuk ke Dana Darurat.`,
          'success'
        );
      } else {
        pushToast('Transaksi Tercatat', `${data.title} (${formatIDR(data.amount)})`, 'info');
      }
    }
  };

  const handleDeleteTx = async (txId: string) => {
    setFinanceState((prev) => deleteTransaction(prev, txId));
    pushToast('Transaksi Dihapus', 'Catatan transaksi telah dihapus dari buku kas.', 'info');
  };

  const handleSaveEmergencySettings = async (patch: EmergencySettingsPatch) => {
    setFinanceState((prev) => updateEmergencyConfig(prev, patch));
    pushToast(
      'Aturan Auto-Save Disimpan',
      'Konfigurasi target dan jadwal menabung otomatis telah diperbarui.',
      'success'
    );
  };

  const handleExecuteMonthlyNow = async () => {
    if (config.lastExecutedMonth === currentMonthKey) return;
    const amount = calculateMonthlyAutoSaveAmount(config, currentMonthIncome);
    if (amount <= 0) {
      pushToast(
        'Nominal Auto-Save Rp 0',
        'Atur nominal tetap atau catat pemasukan bulan ini untuk persentase.',
        'warning'
      );
      return;
    }
    setFinanceState((prev) => executeMonthlyAutoSave(prev, amount, currentMonthKey));
    pushToast(
      'Dana Darurat Bertambah',
      `${formatIDR(amount)} disisihkan untuk ${formatMonthLabel(currentMonthKey, 'full')}.`,
      'success'
    );
  };

  const handleManualEmergencyMutation = async (
    amount: number,
    direction: 'deposit' | 'withdraw',
    note: string
  ) => {
    setFinanceState((prev) => recordManualEmergencyMutation(prev, amount, direction, note));
    pushToast(
      direction === 'deposit' ? 'Setoran Berhasil' : 'Penarikan Tercatat',
      `${formatIDR(amount)} ${
        direction === 'deposit' ? 'ditambahkan ke' : 'ditarik dari'
      } Dana Darurat.`,
      direction === 'deposit' ? 'success' : 'warning'
    );
  };

  const handleSeedSample = async () => {
    setIsSeeding(true);
    try {
      setFinanceState((prev) => seedSamplePortfolio(prev));
      pushToast(
        'Contoh Data 6 Bulan Dimuat',
        'Grafik bulanan, kategori pengeluaran, dan histori dana darurat siap ditinjau.',
        'success'
      );
    } finally {
      setIsSeeding(false);
    }
  };

  const handleResetAll = () => {
    autoTriggeredRef.current = null;
    setFinanceState(resetFinanceState());
    setConfirmReset(false);
    pushToast('Data Direset', 'Seluruh catatan dan pengaturan dikembalikan ke awal.', 'info');
  };

  return (
    <div className="min-h-screen bg-[#090C0B] text-[#F3F6F4] flex flex-col lg:flex-row">
      {/* Desktop Sidebar (240px) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 bg-[#0F1412] border-r border-white/8 min-h-screen sticky top-0">
        <div className="px-6 py-5 border-b border-white/8">
          <span className="font-display text-xl font-bold tracking-tight text-[#F3F6F4] whitespace-nowrap">
            KasVault
          </span>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveSection(id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#10B981]/15 text-[#10B981]'
                    : 'text-[#9CA8A2] hover:text-[#F3F6F4] hover:bg-white/[0.03]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/8 space-y-3">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-[#F3F6F4]">Penyimpanan Lokal</p>
            <p className="text-[11px] text-[#66736D]">Tersimpan otomatis di browser · IDR</p>
          </div>

          {confirmReset ? (
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={handleResetAll}
                className="flex-1 py-1.5 bg-[#EF4444] text-white font-semibold rounded-lg hover:bg-[#DC2626] transition-colors cursor-pointer"
              >
                Ya, Reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-2.5 py-1.5 bg-[#090C0B] border border-white/10 text-[#9CA8A2] rounded-lg hover:text-[#F3F6F4] cursor-pointer"
              >
                Batal
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-[#9CA8A2] hover:text-[#F3F6F4] bg-[#090C0B] border border-white/8 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Data</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        {/* Top Bar Contract */}
        <header className="sticky top-0 z-30 bg-[#090C0B]/95 backdrop-blur-xs border-b border-white/8 px-5 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0 flex items-center gap-2 text-sm">
            <span className="lg:hidden font-display font-bold text-[#F3F6F4] whitespace-nowrap">
              KasVault
            </span>
            <span className="lg:hidden text-[#66736D]">/</span>
            <h1 className="font-display text-base lg:text-lg font-semibold text-[#F3F6F4] truncate">
              {SECTION_TITLES[activeSection]}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditingTx(null);
                setIsTxModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#10B981] text-[#052E1F] rounded-lg hover:bg-[#059669] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Catat Transaksi</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset((prev) => !prev)}
              aria-label="Reset Data"
              title="Reset Data"
              className="lg:hidden p-2 rounded-lg text-[#9CA8A2] hover:text-[#F3F6F4] border border-white/10 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </header>

        {confirmReset && (
          <div className="lg:hidden bg-[#151B18] border-b border-[#EF4444]/40 px-5 py-3 flex items-center justify-between gap-3 text-xs">
            <span className="text-[#F3F6F4]">Hapus semua data lokal?</span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleResetAll}
                className="px-3 py-1 bg-[#EF4444] text-white font-semibold rounded-md cursor-pointer"
              >
                Ya, Reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3 py-1 bg-[#090C0B] border border-white/10 text-[#9CA8A2] rounded-md cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        )}

        {/* Active Viewport */}
        <main className="flex-1 w-full max-w-[1280px] mx-auto px-5 lg:px-8 py-6">
          {activeSection === 'overview' && (
            <OverviewDashboard
              transactions={transactions}
              emergencyLogs={emergencyLogs}
              config={config}
              rangeMonths={rangeMonths}
              onChangeRange={setRangeMonths}
              onNavigate={setActiveSection}
              onOpenAddTransaction={() => {
                setEditingTx(null);
                setIsTxModalOpen(true);
              }}
              onSeedSample={handleSeedSample}
              isSeeding={isSeeding}
            />
          )}

          {activeSection === 'analytics' && (
            <MonthlyCharts
              transactions={transactions}
              emergencyLogs={emergencyLogs}
              config={config}
              rangeMonths={rangeMonths}
              onChangeRange={setRangeMonths}
              onOpenAddTransaction={() => {
                setEditingTx(null);
                setIsTxModalOpen(true);
              }}
            />
          )}

          {activeSection === 'emergency' && (
            <EmergencyFundPanel
              config={config}
              logs={emergencyLogs}
              currentMonthIncome={currentMonthIncome}
              onSaveSettings={handleSaveEmergencySettings}
              onExecuteMonthlyNow={handleExecuteMonthlyNow}
              onManualMutation={handleManualEmergencyMutation}
            />
          )}

          {activeSection === 'ledger' && (
            <TransactionsLedger
              transactions={transactions}
              onEdit={(tx) => {
                setEditingTx(tx);
                setIsTxModalOpen(true);
              }}
              onDelete={handleDeleteTx}
              onOpenAdd={() => {
                setEditingTx(null);
                setIsTxModalOpen(true);
              }}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation (Compact <= 56px height) */}
      <nav
        aria-label="Navigasi Utama Mobile"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-14 bg-[#0F1412] border-t border-white/10 grid grid-cols-4"
      >
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = activeSection === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSection(id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium cursor-pointer ${
                active ? 'text-[#10B981]' : 'text-[#9CA8A2]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="truncate max-w-[72px]">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Transaction Add / Edit Modal */}
      <TransactionModal
        isOpen={isTxModalOpen}
        editingTx={editingTx}
        config={config}
        onClose={() => {
          setIsTxModalOpen(false);
          setEditingTx(null);
        }}
        onSubmit={handleTransactionSubmit}
      />

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-16 lg:bottom-6 right-4 lg:right-6 z-50 space-y-2 max-w-sm w-full pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto bg-[#151B18] border border-[#10B981]/40 rounded-xl p-3.5 shadow-xl flex items-start gap-3"
            >
              <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#F3F6F4]">{toast.title}</p>
                <p className="text-xs text-[#9CA8A2] mt-0.5">{toast.detail}</p>
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="text-[#66736D] hover:text-[#F3F6F4] cursor-pointer"
                aria-label="Tutup notifikasi"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <KasVaultApp />
    </ErrorBoundary>
  );
}
