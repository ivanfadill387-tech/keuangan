import { useMemo, useState } from 'react';
import { BarChart3, PieChart, TrendingUp } from 'lucide-react';
import {
  buildCategoryBreakdown,
  buildMonthlySeries,
  formatIDR,
  formatIDRCompact,
  formatMonthLabel,
  getRecentMonthKeys,
} from '../lib/financeMath';
import { EmergencyConfig, EmergencyLogItem, TransactionItem } from '../types/finance';

interface MonthlyChartsProps {
  transactions: TransactionItem[];
  emergencyLogs: EmergencyLogItem[];
  config: EmergencyConfig;
  rangeMonths: 6 | 12;
  onChangeRange: (range: 6 | 12) => void;
  onOpenAddTransaction: () => void;
  compactMode?: boolean;
}

export function MonthlyCharts({
  transactions,
  emergencyLogs,
  config,
  rangeMonths,
  onChangeRange,
  onOpenAddTransaction,
  compactMode = false,
}: MonthlyChartsProps) {
  const monthKeys = useMemo(() => getRecentMonthKeys(rangeMonths), [rangeMonths]);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedCategoryMonth, setSelectedCategoryMonth] = useState<string>('all');

  const series = useMemo(
    () => buildMonthlySeries(transactions, emergencyLogs, monthKeys, config.currentBalance),
    [transactions, emergencyLogs, monthKeys, config.currentBalance]
  );

  const categoryFilterMonth =
    selectedCategoryMonth === 'all' ? undefined : selectedCategoryMonth;

  const categories = useMemo(
    () => buildCategoryBreakdown(transactions, categoryFilterMonth),
    [transactions, categoryFilterMonth]
  );

  const totalCategoryExpense = useMemo(
    () => categories.reduce((acc, c) => acc + c.amount, 0),
    [categories]
  );

  const hasAnyTransactions = transactions.length > 0 || emergencyLogs.length > 0;

  if (!hasAnyTransactions) {
    return (
      <section className="bg-[#151B18] border border-white/8 rounded-xl p-8 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-xl bg-[#10B981]/10 border border-[#10B981]/25 flex items-center justify-center text-[#10B981]">
          <BarChart3 className="w-6 h-6" />
        </div>
        <div className="space-y-1.5 max-w-md mx-auto">
          <h3 className="font-display text-lg font-semibold text-[#F3F6F4]">
            Belum Ada Data Pelaporan Bulanan
          </h3>
          <p className="text-sm text-[#9CA8A2]">
            Catat transaksi pemasukan atau pengeluaran pertama Anda untuk melihat grafik
            perbandingan arus kas, kategori pengeluaran, dan pertumbuhan dana darurat.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenAddTransaction}
          className="px-4 py-2 text-sm font-semibold bg-[#10B981] text-[#052E1F] rounded-lg hover:bg-[#059669] transition-colors cursor-pointer whitespace-nowrap"
        >
          Catat Transaksi Pertama
        </button>
      </section>
    );
  }

  // Bar Chart Geometry
  const chartW = 760;
  const chartH = 270;
  const padL = 74;
  const padR = 20;
  const padT = 22;
  const padB = 38;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const maxFlowValue = Math.max(
    1_000_000,
    ...series.flatMap((s) => [s.income, s.expense, s.emergencySaved])
  );
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => maxFlowValue * ratio);

  const activePoint = hoveredIdx !== null ? series[hoveredIdx] : series[series.length - 1];

  // Emergency Growth Line Chart Geometry
  const lineW = 760;
  const lineH = 220;
  const lPadL = 74;
  const lPadR = 24;
  const lPadT = 22;
  const lPadB = 34;
  const lPlotW = lineW - lPadL - lPadR;
  const lPlotH = lineH - lPadT - lPadB;

  const maxEmergencyValue = Math.max(
    1_000_000,
    config.targetAmount * 1.05,
    ...series.map((s) => s.cumulativeEmergency)
  );

  const emergencyCoords = series.map((pt, idx) => {
    const x =
      series.length <= 1
        ? lPadL + lPlotW / 2
        : lPadL + (idx / (series.length - 1)) * lPlotW;
    const y = lPadT + lPlotH - (pt.cumulativeEmergency / maxEmergencyValue) * lPlotH;
    return { x, y, pt };
  });

  const linePath = emergencyCoords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    emergencyCoords.length > 0
      ? `${linePath} L ${emergencyCoords[emergencyCoords.length - 1].x.toFixed(1)} ${(lPadT + lPlotH).toFixed(1)} L ${emergencyCoords[0].x.toFixed(1)} ${(lPadT + lPlotH).toFixed(1)} Z`
      : '';

  const targetY =
    config.targetAmount > 0
      ? lPadT + lPlotH - (config.targetAmount / maxEmergencyValue) * lPlotH
      : null;

  // Donut Geometry
  const donutSize = 180;
  const donutR = 66;
  const donutC = 2 * Math.PI * donutR;
  let runningOffset = 0;

  return (
    <div className="space-y-6">
      {/* Monthly Cashflow & Savings Bar Chart */}
      <section className="bg-[#151B18] border border-white/8 rounded-xl p-5 lg:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#10B981]" />
              <h3 className="font-display text-base font-semibold text-[#F3F6F4]">
                Laporan Arus Kas & Tabungan Bulanan
              </h3>
            </div>
            <p className="text-xs text-[#9CA8A2]">
              Perbandingan pemasukan, pengeluaran, dan dana darurat tersisihkan setiap bulan
            </p>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-4 text-xs text-[#9CA8A2]">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#10B981]" />
                Pemasukan
              </span>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#F59E0B]" />
                Pengeluaran
              </span>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#38BDF8]" />
                Dana Darurat
              </span>
            </div>

            <div className="inline-flex items-center gap-1 p-1 bg-[#0F1412] border border-white/8 rounded-lg">
              <button
                type="button"
                onClick={() => onChangeRange(6)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  rangeMonths === 6
                    ? 'bg-[#10B981] text-[#052E1F]'
                    : 'text-[#9CA8A2] hover:text-[#F3F6F4]'
                }`}
              >
                6 Bulan
              </button>
              <button
                type="button"
                onClick={() => onChangeRange(12)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  rangeMonths === 12
                    ? 'bg-[#10B981] text-[#052E1F]'
                    : 'text-[#9CA8A2] hover:text-[#F3F6F4]'
                }`}
              >
                12 Bulan
              </button>
            </div>
          </div>
        </div>

        {/* Active Month Summary Strip */}
        {activePoint && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-3.5 bg-[#0F1412] border border-white/8 rounded-lg text-xs">
            <div>
              <p className="text-[#66736D]">Periode Dipantau</p>
              <p className="font-semibold text-[#F3F6F4] mt-0.5">{activePoint.fullLabel}</p>
            </div>
            <div>
              <p className="text-[#66736D]">Pemasukan</p>
              <p className="font-mono tabular-nums font-semibold text-[#10B981] mt-0.5">
                {formatIDR(activePoint.income)}
              </p>
            </div>
            <div>
              <p className="text-[#66736D]">Pengeluaran</p>
              <p className="font-mono tabular-nums font-semibold text-[#F59E0B] mt-0.5">
                {formatIDR(activePoint.expense)}
              </p>
            </div>
            <div>
              <p className="text-[#66736D]">Masuk Dana Darurat</p>
              <p className="font-mono tabular-nums font-semibold text-[#38BDF8] mt-0.5">
                {formatIDR(activePoint.emergencySaved)}
              </p>
            </div>
          </div>
        )}

        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="w-full min-w-[540px] h-auto select-none"
            role="img"
            aria-label="Grafik batang pemasukan, pengeluaran, dan tabungan dana darurat bulanan"
          >
            {yTicks.map((tick, idx) => {
              const y = padT + plotH - (tick / maxFlowValue) * plotH;
              return (
                <g key={idx}>
                  <line
                    x1={padL}
                    x2={chartW - padR}
                    y1={y}
                    y2={y}
                    stroke="rgba(255,255,255,0.07)"
                    strokeDasharray={idx === 0 ? undefined : '3 4'}
                  />
                  <text
                    x={padL - 10}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-[#66736D] text-[10px] font-mono tabular-nums"
                  >
                    {formatIDRCompact(tick)}
                  </text>
                </g>
              );
            })}

            {series.map((pt, idx) => {
              const slotW = plotW / series.length;
              const groupX = padL + idx * slotW;
              const barW = Math.min(18, Math.max(7, (slotW - 14) / 3));
              const groupInnerW = barW * 3 + 6;
              const startX = groupX + (slotW - groupInnerW) / 2;

              const hIncome = Math.max(pt.income > 0 ? 3 : 0, (pt.income / maxFlowValue) * plotH);
              const hExpense = Math.max(
                pt.expense > 0 ? 3 : 0,
                (pt.expense / maxFlowValue) * plotH
              );
              const hSaved = Math.max(
                pt.emergencySaved > 0 ? 3 : 0,
                (pt.emergencySaved / maxFlowValue) * plotH
              );

              const isHovered = hoveredIdx === idx;

              return (
                <g
                  key={pt.monthKey}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="cursor-pointer"
                >
                  <rect
                    x={groupX + 2}
                    y={padT}
                    width={slotW - 4}
                    height={plotH}
                    rx={6}
                    fill={isHovered ? 'rgba(255,255,255,0.04)' : 'transparent'}
                  />
                  <rect
                    x={startX}
                    y={padT + plotH - hIncome}
                    width={barW}
                    height={hIncome}
                    rx={3}
                    fill="#10B981"
                    opacity={hoveredIdx === null || isHovered ? 1 : 0.55}
                  />
                  <rect
                    x={startX + barW + 3}
                    y={padT + plotH - hExpense}
                    width={barW}
                    height={hExpense}
                    rx={3}
                    fill="#F59E0B"
                    opacity={hoveredIdx === null || isHovered ? 1 : 0.55}
                  />
                  <rect
                    x={startX + (barW + 3) * 2}
                    y={padT + plotH - hSaved}
                    width={barW}
                    height={hSaved}
                    rx={3}
                    fill="#38BDF8"
                    opacity={hoveredIdx === null || isHovered ? 1 : 0.55}
                  />
                  <text
                    x={groupX + slotW / 2}
                    y={chartH - 12}
                    textAnchor="middle"
                    className={`text-[11px] font-mono ${
                      isHovered ? 'fill-[#F3F6F4] font-semibold' : 'fill-[#9CA8A2]'
                    }`}
                  >
                    {pt.shortLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      {/* Secondary Row: Emergency Growth Trend + Expense Category Breakdown */}
      {!compactMode && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Emergency Fund Growth Line Chart */}
          <section className="xl:col-span-7 bg-[#151B18] border border-white/8 rounded-xl p-5 lg:p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#10B981]" />
                  <h3 className="font-display text-base font-semibold text-[#F3F6F4]">
                    Kurva Pertumbuhan Dana Darurat
                  </h3>
                </div>
                <p className="text-xs text-[#9CA8A2]">
                  Akumulasi saldo dana darurat terhadap garis target bulanan
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px] text-[#66736D]">Target Brankas</p>
                <p className="font-mono tabular-nums text-xs font-semibold text-[#10B981]">
                  {formatIDR(config.targetAmount)}
                </p>
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${lineW} ${lineH}`}
                className="w-full min-w-[460px] h-auto select-none"
                role="img"
                aria-label="Grafik garis pertumbuhan dana darurat terhadap target"
              >
                <defs>
                  <linearGradient id="emeraldAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0.01" />
                  </linearGradient>
                </defs>

                {[0, 0.5, 1].map((ratio, idx) => {
                  const val = maxEmergencyValue * ratio;
                  const y = lPadT + lPlotH - ratio * lPlotH;
                  return (
                    <g key={idx}>
                      <line
                        x1={lPadL}
                        x2={lineW - lPadR}
                        y1={y}
                        y2={y}
                        stroke="rgba(255,255,255,0.06)"
                      />
                      <text
                        x={lPadL - 10}
                        y={y + 4}
                        textAnchor="end"
                        className="fill-[#66736D] text-[10px] font-mono tabular-nums"
                      >
                        {formatIDRCompact(val)}
                      </text>
                    </g>
                  );
                })}

                {targetY !== null && (
                  <g>
                    <line
                      x1={lPadL}
                      x2={lineW - lPadR}
                      y1={targetY}
                      y2={targetY}
                      stroke="#10B981"
                      strokeOpacity="0.55"
                      strokeDasharray="5 5"
                    />
                    <text
                      x={lineW - lPadR}
                      y={Math.max(12, targetY - 6)}
                      textAnchor="end"
                      className="fill-[#10B981] text-[10px] font-medium"
                    >
                      Target {formatIDRCompact(config.targetAmount)}
                    </text>
                  </g>
                )}

                {areaPath && <path d={areaPath} fill="url(#emeraldAreaGrad)" />}
                {linePath && (
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {emergencyCoords.map(({ x, y, pt }) => (
                  <g key={pt.monthKey}>
                    <circle
                      cx={x}
                      cy={y}
                      r={4}
                      fill="#090C0B"
                      stroke="#10B981"
                      strokeWidth={2}
                    />
                    <text
                      x={x}
                      y={lineH - 10}
                      textAnchor="middle"
                      className="fill-[#9CA8A2] text-[11px] font-mono"
                    >
                      {pt.shortLabel}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </section>

          {/* Expense Category Donut & Table */}
          <section className="xl:col-span-5 bg-[#151B18] border border-white/8 rounded-xl p-5 lg:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-[#10B981]" />
                <h3 className="font-display text-base font-semibold text-[#F3F6F4]">
                  Kategori Pengeluaran
                </h3>
              </div>

              <select
                value={selectedCategoryMonth}
                onChange={(e) => setSelectedCategoryMonth(e.target.value)}
                aria-label="Filter bulan kategori pengeluaran"
                className="bg-[#0F1412] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-[#F3F6F4] focus:outline-none focus:border-[#10B981]"
              >
                <option value="all">Semua Periode</option>
                {[...monthKeys].reverse().map((key) => (
                  <option key={key} value={key}>
                    {formatMonthLabel(key, 'full')}
                  </option>
                ))}
              </select>
            </div>

            {categories.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#9CA8A2]">
                Belum ada pengeluaran tercatat pada periode ini.
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative shrink-0">
                  <svg
                    width={donutSize}
                    height={donutSize}
                    viewBox={`0 0 ${donutSize} ${donutSize}`}
                    className="-rotate-90"
                  >
                    <circle
                      cx={donutSize / 2}
                      cy={donutSize / 2}
                      r={donutR}
                      fill="none"
                      stroke="rgba(255,255,255,0.06)"
                      strokeWidth={18}
                    />
                    {categories.map((cat) => {
                      const dash = (cat.percentage / 100) * donutC;
                      const offset = -runningOffset;
                      runningOffset += dash;
                      return (
                        <circle
                          key={cat.category}
                          cx={donutSize / 2}
                          cy={donutSize / 2}
                          r={donutR}
                          fill="none"
                          stroke={cat.color}
                          strokeWidth={18}
                          strokeDasharray={`${dash} ${donutC}`}
                          strokeDashoffset={offset}
                        />
                      );
                    })}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
                    <span className="text-[11px] text-[#66736D]">Total Keluar</span>
                    <span className="font-mono tabular-nums text-xs font-semibold text-[#F3F6F4] mt-0.5">
                      {formatIDRCompact(totalCategoryExpense)}
                    </span>
                  </div>
                </div>

                <div className="flex-1 w-full space-y-2.5 max-h-[210px] overflow-y-auto pr-1">
                  {categories.map((cat) => (
                    <div
                      key={cat.category}
                      className="flex items-center justify-between gap-3 text-xs py-1 border-b border-white/5 last:border-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-[#F3F6F4] truncate">{cat.category}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono tabular-nums text-[#F3F6F4] font-medium">
                          {formatIDRCompact(cat.amount)}
                        </span>
                        <span className="text-[#66736D] font-mono tabular-nums ml-2">
                          {cat.percentage.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
