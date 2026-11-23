import { useEffect, useState } from 'react';
import { Coins, X } from 'lucide-react';
import { calculateRoundUp, formatIDR, getTodayDateString } from '../lib/financeMath';
import {
  EXPENSE_CATEGORIES,
  EmergencyConfig,
  INCOME_CATEGORIES,
  MAX_NOTE_LENGTH,
  MAX_TITLE_LENGTH,
  TransactionItem,
  TransactionType,
} from '../types/finance';

interface TransactionModalProps {
  isOpen: boolean;
  editingTx: TransactionItem | null;
  config: EmergencyConfig;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    amount: number;
    type: TransactionType;
    category: string;
    date: string;
    note: string;
  }) => Promise<void>;
}

export function TransactionModal({
  isOpen,
  editingTx,
  config,
  onClose,
  onSubmit,
}: TransactionModalProps) {
  const [type, setType] = useState<TransactionType>('expense');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [date, setDate] = useState(getTodayDateString());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editingTx) {
      setType(editingTx.type);
      setTitle(editingTx.title);
      setAmount(String(editingTx.amount));
      setCategory(editingTx.category);
      setDate(editingTx.date);
      setNote(editingTx.note || '');
    } else {
      setType('expense');
      setTitle('');
      setAmount('');
      setCategory(EXPENSE_CATEGORIES[0]);
      setDate(getTodayDateString());
      setNote('');
    }
    setError(null);
  }, [isOpen, editingTx]);

  if (!isOpen) return null;

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const numericAmount = Number(amount) || 0;
  const roundUpPreview =
    !editingTx && type === 'expense' && config.roundUpEnabled && numericAmount > 0
      ? calculateRoundUp(numericAmount, config.roundUpStep)
      : 0;

  const handleTypeSwitch = (nextType: TransactionType) => {
    setType(nextType);
    const list = nextType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    if (!list.includes(category as never)) {
      setCategory(list[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Judul transaksi wajib diisi.');
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Nominal transaksi harus lebih dari Rp 0.');
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        amount: Math.round(numericAmount),
        type,
        category,
        date,
        note: note.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan transaksi.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-modal-title"
    >
      <div className="w-full max-w-lg bg-[#151B18] border border-white/10 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <h2 id="tx-modal-title" className="font-display text-base font-semibold text-[#F3F6F4]">
            {editingTx ? 'Ubah Transaksi' : 'Catat Transaksi Baru'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog transaksi"
            className="p-1.5 rounded-lg text-[#9CA8A2] hover:text-[#F3F6F4] hover:bg-white/5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Type Switch */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#090C0B] border border-white/8 rounded-lg">
            <button
              type="button"
              onClick={() => handleTypeSwitch('expense')}
              className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                type === 'expense'
                  ? 'bg-[#F59E0B] text-[#291800]'
                  : 'text-[#9CA8A2] hover:text-[#F3F6F4]'
              }`}
            >
              Pengeluaran
            </button>
            <button
              type="button"
              onClick={() => handleTypeSwitch('income')}
              className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                type === 'income'
                  ? 'bg-[#10B981] text-[#052E1F]'
                  : 'text-[#9CA8A2] hover:text-[#F3F6F4]'
              }`}
            >
              Pemasukan
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs text-[#9CA8A2]">Judul Transaksi</label>
            <input
              type="text"
              maxLength={MAX_TITLE_LENGTH}
              required
              placeholder={
                type === 'expense' ? 'Misal: Belanja bahan makanan' : 'Misal: Gaji bulanan'
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#090C0B] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#F3F6F4] focus:outline-none focus:border-[#10B981]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs text-[#9CA8A2]">Nominal (Rp)</label>
              <input
                type="number"
                min={1}
                required
                placeholder="150000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-[#090C0B] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-[#F3F6F4] focus:outline-none focus:border-[#10B981]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs text-[#9CA8A2]">Tanggal</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#090C0B] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-[#F3F6F4] focus:outline-none focus:border-[#10B981]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs text-[#9CA8A2]">Kategori</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-[#090C0B] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#F3F6F4] focus:outline-none focus:border-[#10B981]"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs text-[#9CA8A2]">Catatan (Opsional)</label>
            <input
              type="text"
              maxLength={MAX_NOTE_LENGTH}
              placeholder="Tambahkan catatan singkat..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-[#090C0B] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#F3F6F4] focus:outline-none focus:border-[#10B981]"
            />
          </div>

          {roundUpPreview > 0 && (
            <div className="flex items-start gap-2.5 p-3 bg-[#10B981]/10 border border-[#10B981]/30 rounded-lg text-xs">
              <Coins className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
              <div className="text-[#F3F6F4]">
                Pembulatan aktif (kelipatan {formatIDR(config.roundUpStep)}):{' '}
                <strong className="font-mono text-[#10B981]">
                  +{formatIDR(roundUpPreview)}
                </strong>{' '}
                akan otomatis disisihkan ke Dana Darurat.
              </div>
            </div>
          )}

          {error && <p className="text-xs text-[#EF4444]">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/8">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#9CA8A2] hover:text-[#F3F6F4] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-xs font-semibold bg-[#10B981] text-[#052E1F] rounded-lg hover:bg-[#059669] transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              {isSaving
                ? 'Menyimpan...'
                : editingTx
                ? 'Simpan Perubahan'
                : 'Simpan Transaksi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
