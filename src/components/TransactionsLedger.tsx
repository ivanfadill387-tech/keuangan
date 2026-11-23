import { useMemo, useState } from 'react';
import { Pencil, Search, Trash2 } from 'lucide-react';
import { formatDateID, formatIDR, formatMonthLabel } from '../lib/financeMath';
import { TransactionItem, TransactionType } from '../types/finance';

interface TransactionsLedgerProps {
  transactions: TransactionItem[];
  onEdit: (tx: TransactionItem) => void;
  onDelete: (txId: string) => Promise<void>;
  onOpenAdd: () => void;
}

export function TransactionsLedger({
  transactions,
  onEdit,
  onDelete,
  onOpenAdd,
}: TransactionsLedgerProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const availableMonths = useMemo(() => {
    const unique = Array.from(new Set(transactions.map((t) => t.monthKey)));
    return unique.sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (monthFilter !== 'all' && tx.monthKey !== monthFilter) return false;
      if (
        q &&
        !tx.title.toLowerCase().includes(q) &&
        !tx.category.toLowerCase().includes(q) &&
        !(tx.note || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [transactions, search, typeFilter, monthFilter]);

  const handleConfirmDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="bg-[#151B18] border border-white/8 rounded-xl p-5 lg:p-6 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-semibold text-[#F3F6F4]">
            Buku Kas Transaksi
          </h2>
          <p className="text-xs text-[#9CA8A2] mt-0.5">
            {filtered.length} transaksi ditampilkan · Angka rata kanan tabular
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#66736D] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari judul atau kategori..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-[#090C0B] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#F3F6F4] placeholder:text-[#66736D] focus:outline-none focus:border-[#10B981] w-52"
            />
          </div>

          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            aria-label="Filter bulan transaksi"
            className="bg-[#090C0B] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-[#F3F6F4] focus:outline-none focus:border-[#10B981]"
          >
            <option value="all">Semua Bulan</option>
            {availableMonths.map((key) => (
              <option key={key} value={key}>
                {formatMonthLabel(key, 'full')}
              </option>
            ))}
          </select>

          <div className="inline-flex items-center gap-1 p-1 bg-[#090C0B] border border-white/8 rounded-lg">
            {(
              [
                ['all', 'Semua'],
                ['income', 'Pemasukan'],
                ['expense', 'Pengeluaran'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setTypeFilter(val)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  typeFilter === val
                    ? 'bg-[#10B981] text-[#052E1F]'
                    : 'text-[#9CA8A2] hover:text-[#F3F6F4]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center space-y-3 border-t border-white/8">
          <p className="text-sm text-[#9CA8A2]">
            {transactions.length === 0
              ? 'Belum ada transaksi tercatat.'
              : 'Tidak ada transaksi yang cocok dengan filter Anda.'}
          </p>
          {transactions.length === 0 && (
            <button
              type="button"
              onClick={onOpenAdd}
              className="px-4 py-2 text-xs font-semibold bg-[#10B981] text-[#052E1F] rounded-lg hover:bg-[#059669] transition-colors cursor-pointer"
            >
              Catat Transaksi Pertama
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-white/8">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-white/8 text-[11px] font-medium text-[#66736D]">
                <th className="py-3 pr-4">Tanggal</th>
                <th className="py-3 pr-4">Transaksi & Kategori</th>
                <th className="py-3 pr-4">Tipe</th>
                <th className="py-3 pr-4 text-right">Nominal</th>
                <th className="py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx) => (
                <tr
                  key={tx.id}
                  className="border-b border-white/6 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-2.5 pr-4 text-xs font-mono tabular-nums text-[#9CA8A2] whitespace-nowrap">
                    {formatDateID(tx.date)}
                  </td>
                  <td className="py-2.5 pr-4">
                    <p className="text-sm font-medium text-[#F3F6F4]">{tx.title}</p>
                    <p className="text-xs text-[#66736D]">
                      {tx.category}
                      {tx.roundUpSaved > 0 && (
                        <>
                          {' · '}
                          <span className="text-[#10B981]">
                            Auto-save +{formatIDR(tx.roundUpSaved)}
                          </span>
                        </>
                      )}
                      {tx.note && ` · ${tx.note}`}
                    </p>
                  </td>
                  <td className="py-2.5 pr-4 text-xs whitespace-nowrap">
                    <span
                      className={
                        tx.type === 'income' ? 'text-[#10B981]' : 'text-[#F59E0B]'
                      }
                    >
                      {tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                    </span>
                  </td>
                  <td
                    className={`py-2.5 pr-4 text-right text-sm font-mono tabular-nums font-semibold whitespace-nowrap ${
                      tx.type === 'income' ? 'text-[#10B981]' : 'text-[#F3F6F4]'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : '-'}
                    {formatIDR(tx.amount)}
                  </td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    {confirmDeleteId === tx.id ? (
                      <div className="inline-flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => handleConfirmDelete(tx.id)}
                          disabled={deletingId === tx.id}
                          className="text-[#EF4444] hover:underline font-medium cursor-pointer"
                        >
                          {deletingId === tx.id ? 'Hapus...' : 'Konfirmasi'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-[#9CA8A2] hover:text-[#F3F6F4] cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEdit(tx)}
                          aria-label={`Ubah ${tx.title}`}
                          className="p-1.5 rounded-md text-[#9CA8A2] hover:text-[#F3F6F4] hover:bg-white/5 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(tx.id)}
                          aria-label={`Hapus ${tx.title}`}
                          className="p-1.5 rounded-md text-[#9CA8A2] hover:text-[#EF4444] hover:bg-white/5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
