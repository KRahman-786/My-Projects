'use client';

import { useState, type ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import { Table2, BarChart3 } from 'lucide-react';
import { formatPrice } from '@/utils/format';

/** One validated series colour (plum #8A2F52: passes band, chroma and 3:1 contrast on white). */
const SERIES = '#8A2F52';
const GRID = '#EFE8E3';
const AXIS = { fontSize: 11, fill: '#7A6A70' };

const compactINR = (paise: number) => {
  const r = paise / 100;
  if (r >= 100000) return `₹${(r / 100000).toFixed(1)}L`;
  if (r >= 1000) return `₹${(r / 1000).toFixed(r >= 10000 ? 0 : 1)}k`;
  return `₹${Math.round(r)}`;
};

type Row = Record<string, string | number>;

function Tip({ active, payload, label, valueKey, extra }: TooltipProps<number, string> & { valueKey: string; extra?: (row: Row) => string }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]!.payload as Row;
  const v = row[valueKey] as number;
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-lift">
      <p className="text-sm font-bold text-ink">{valueKey === 'revenue' ? formatPrice(v) : v.toLocaleString('en-IN')}</p>
      <p className="text-ink-muted">{String(label ?? row.label ?? '')}</p>
      {extra && <p className="mt-0.5 text-ink-soft">{extra(row)}</p>}
    </div>
  );
}

export function ChartCard({ title, subtitle, table, children }: { title: string; subtitle?: string; table: { head: string[]; rows: (string | number)[][] }; children: ReactNode }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {subtitle && <p className="text-xs text-ink-muted">{subtitle}</p>}
        </div>
        <button onClick={() => setShowTable((v) => !v)} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-ink-muted hover:bg-sand" aria-pressed={showTable}>
          {showTable ? <BarChart3 className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />} {showTable ? 'Chart' : 'Table'}
        </button>
      </div>
      {showTable ? (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-white text-ink-muted">
              <tr>
                {table.head.map((h) => (
                  <th key={h} className="py-1.5 pr-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} className="py-1.5 pr-3 text-ink-soft">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

/** Revenue over time: area with crosshair tooltip. */
export function RevenueArea({ data, xKey, tickFormatter }: { data: Row[]; xKey: string; tickFormatter?: (v: string) => string }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={SERIES} stopOpacity={0.22} />
              <stop offset="1" stopColor={SERIES} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={tickFormatter} minTickGap={24} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={compactINR} width={52} />
          <Tooltip cursor={{ stroke: '#B35F83', strokeWidth: 1 }} content={<Tip valueKey="revenue" extra={(r) => `${r.orders} order(s)`} />} />
          <Area type="monotone" dataKey="revenue" stroke={SERIES} strokeWidth={2} fill="url(#rev)" activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2, fill: SERIES }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VBars({ data, xKey, valueKey, tickFormatter }: { data: Row[]; xKey: string; valueKey: string; tickFormatter?: (v: string) => string }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={6}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={tickFormatter} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={valueKey === 'revenue' ? compactINR : undefined} width={52} allowDecimals={false} />
          <Tooltip cursor={{ fill: '#F5E3EA', opacity: 0.6 }} content={<Tip valueKey={valueKey} extra={valueKey === 'revenue' ? (r) => `${r.orders} order(s)` : undefined} />} />
          <Bar dataKey={valueKey} fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bars for ranked categories (labels on the axis, so identity never relies on colour). */
export function HBars({ data, labelKey, valueKey, extra }: { data: Row[]; labelKey: string; valueKey: string; extra?: (row: Row) => string }) {
  const height = Math.max(120, data.length * 36 + 20);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={valueKey === 'revenue' ? compactINR : undefined} allowDecimals={false} />
          <YAxis type="category" dataKey={labelKey} tick={{ ...AXIS, fill: '#2B2126' }} tickLine={false} axisLine={false} width={150} tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)} />
          <Tooltip cursor={{ fill: '#F5E3EA', opacity: 0.6 }} content={<Tip valueKey={valueKey} extra={extra} />} />
          <Bar dataKey={valueKey} fill={SERIES} radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export { compactINR };
