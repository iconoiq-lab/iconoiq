// ============================================
// STOCKIST AREA (/dealer, approved dealers): pure views. Inventory from the
// stockist's delivered dealer orders, a log-a-sale form, this month's sales,
// the sale history and the restock alert (spec decision 10).
// src/components/dealer/StockistArea.tsx wires them to Firestore.
// ============================================

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Boxes, PackageCheck, PackagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { PanelSkeleton } from '@/components/skeletons';
import { formatDate, formatINR } from '@/lib/format';
import { DUR, EASE_OUT } from '@/lib/motion';
import { monthSalesValue, restockState, salesNewestFirst, type StockRow, type StockSale } from '@/lib/stockist';
import { cn } from '@/lib/utils';

const enter = (delay = 0) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DUR.modal, ease: EASE_OUT, delay },
});

const panelHeading = 'text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground';
const labelCls = 'text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground';

/** Today in India as yyyy-mm-dd, for the date field. */
export const istToday = (nowMs: number) => new Date(nowMs + 330 * 60_000).toISOString().slice(0, 10);
/** yyyy-mm-dd (India) → noon IST that day, so the sale lands in the right month. */
export const istDateToMs = (v: string) => Date.parse(`${v}T12:00:00+05:30`);

export interface LogSaleInput {
  productId: string;
  qty: number;
  atMs: number;
}

export interface StockistAreaViewProps {
  loading: boolean;
  error?: string | null;
  rows: StockRow[];
  sales: (StockSale & { name: string })[];
  nowMs: number;
  saving: boolean;
  onLog: (sale: LogSaleInput) => Promise<boolean> | boolean;
  onDelete: (saleId: string) => void;
}

export const StockistAreaView = ({ loading, error, rows, sales, nowMs, saving, onLog, onDelete }: StockistAreaViewProps) => {
  if (loading) {
    return (
      <div className="mt-6">
        <PanelSkeleton lines={4} label="Loading your stock" />
      </div>
    );
  }
  return (
    <section aria-labelledby="stockist-heading" className="mt-8">
      <h2 id="stockist-heading" className="font-heading text-2xl font-semibold tracking-tight text-foreground">Your stock</h2>
      <p className="mt-1 max-w-xl text-sm text-muted-foreground">
        Stock comes from your delivered dealer orders. Log each sale here to keep the count right.
      </p>
      {error && (
        <Notice tone="danger" className="mt-4" title="Your stock didn't load">
          {error}
        </Notice>
      )}
      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="space-y-6">
          <motion.div {...enter()}><RestockAndMonth rows={rows} sales={sales} nowMs={nowMs} /></motion.div>
          <motion.div {...enter(0.04)}><InventoryTable rows={rows} /></motion.div>
        </div>
        <div className="space-y-6">
          <motion.div {...enter(0.06)}><LogSaleForm rows={rows} nowMs={nowMs} saving={saving} onLog={onLog} /></motion.div>
          <motion.div {...enter(0.08)}><SaleHistory sales={sales} onDelete={onDelete} /></motion.div>
        </div>
      </div>
    </section>
  );
};

const RestockAndMonth = ({ rows, sales, nowMs }: { rows: StockRow[]; sales: StockSale[]; nowMs: number }) => {
  const r = restockState(rows);
  const month = monthSalesValue(sales, nowMs);
  const pct = Math.round(r.share * 100);
  return (
    <div className="space-y-4">
      {r.alert && (
        <Notice
          tone="warning"
          title="Time to restock"
          action={<Button asChild size="sm"><Link to="/products">Order more stock</Link></Button>}
        >
          You have sold {pct}% of the stock you bought. Order again to keep your shelves full.
        </Notice>
      )}
      <dl className="panel tx-sheet grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
        <div>
          <dt className={labelCls}>Sales this month</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">{formatINR(month.value)}</dd>
          <dd className="text-xs text-muted-foreground">{month.units} {month.units === 1 ? 'unit' : 'units'} at regular prices</dd>
        </div>
        <div>
          <dt className={labelCls}>Stock left</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">{Math.max(0, r.bought - r.sold)}</dd>
          <dd className="text-xs text-muted-foreground">of {r.bought} bought</dd>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <dt className={labelCls}>Sold so far</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">{pct}%</dd>
          <dd className="mt-2">
            <div
              role="progressbar"
              aria-label="Share of your stock sold"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              className="h-1.5 overflow-hidden rounded-full bg-foreground/10"
            >
              <div className={cn('h-full rounded-full', r.alert ? 'bg-status-warning-fg' : 'bg-primary')} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Restock alert at 40%</p>
          </dd>
        </div>
      </dl>
    </div>
  );
};

export const InventoryTable = ({ rows, title = 'Stock inventory' }: { rows: StockRow[]; title?: string }) => (
  <section aria-labelledby="stock-inv-heading" className="panel tx-sheet p-5">
    <h3 id="stock-inv-heading" className={cn(panelHeading, 'mb-4')}>{title}</h3>
    {rows.length === 0 ? (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <Boxes aria-hidden="true" className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">No stock yet</p>
        <p className="max-w-xs text-xs text-muted-foreground">Items from your dealer orders show here once they are delivered.</p>
      </div>
    ) : (
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full min-w-[22rem] text-sm">
          <caption className="sr-only">Stock per product: bought, sold and left</caption>
          <thead>
            <tr className="border-b border-foreground/[0.08] text-left text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <th scope="col" className="px-5 py-2 font-semibold">Product</th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">Bought</th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">Sold</th>
              <th scope="col" className="px-5 py-2 text-right font-semibold">Left</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.productId} className="border-b border-foreground/[0.05] last:border-0">
                <th scope="row" className="max-w-[12rem] px-5 py-2.5 text-left font-medium text-foreground">
                  <span className="line-clamp-2 break-words">{r.name || 'Product'}</span>
                </th>
                <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">{r.bought}</td>
                <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">{r.sold}</td>
                <td className={cn('px-5 py-2.5 text-right font-semibold tabular-nums', r.left === 0 ? 'text-destructive' : 'text-foreground')}>
                  {r.left}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

const LogSaleForm = ({
  rows,
  nowMs,
  saving,
  onLog,
}: {
  rows: StockRow[];
  nowMs: number;
  saving: boolean;
  onLog: (sale: LogSaleInput) => Promise<boolean> | boolean;
}) => {
  const inStock = useMemo(() => rows.filter((r) => r.left > 0), [rows]);
  const today = istToday(nowMs);
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const chosen = inStock.find((r) => r.productId === productId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const n = Math.floor(Number(qty));
    if (!chosen) return setError('Choose a product.');
    if (!(n >= 1)) return setError('Enter how many you sold (1 or more).');
    if (n > chosen.left) return setError(`You have ${chosen.left} left of this product.`);
    if (!date || date > today) return setError('Choose a date up to today.');
    setError(null);
    const ok = await onLog({ productId: chosen.productId, qty: n, atMs: istDateToMs(date) });
    if (ok) {
      setQty('1');
      setProductId('');
    }
  };

  return (
    <section aria-labelledby="log-sale-heading" className="panel tx-sheet p-5">
      <div className="mb-4 flex items-center gap-2">
        <PackagePlus aria-hidden="true" className="size-4 text-primary" />
        <h3 id="log-sale-heading" className={panelHeading}>Log a sale</h3>
      </div>
      {inStock.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing in stock to log a sale from.</p>
      ) : (
        <form noValidate onSubmit={submit} className="grid gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="sale-product" className={labelCls}>Product</label>
            <Select value={productId} onValueChange={(v) => { setProductId(v); setError(null); }}>
              <SelectTrigger id="sale-product" aria-describedby={error ? 'sale-error' : undefined}>
                <SelectValue placeholder="Choose a product" />
              </SelectTrigger>
              <SelectContent>
                {inStock.map((r) => (
                  <SelectItem key={r.productId} value={r.productId}>
                    {r.name || 'Product'} ({r.left} left)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="sale-qty" className={labelCls}>Quantity</label>
              <Input
                id="sale-qty"
                type="number"
                inputMode="numeric"
                min={1}
                max={chosen?.left}
                value={qty}
                onChange={(e) => { setQty(e.target.value); setError(null); }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="sale-date" className={labelCls}>Date</label>
              <Input id="sale-date" type="date" max={today} value={date} onChange={(e) => { setDate(e.target.value); setError(null); }} />
            </div>
          </div>
          {error && <p id="sale-error" role="alert" className="text-xs text-destructive">{error}</p>}
          <Button type="submit" disabled={saving} className="w-full sm:w-auto">
            {saving ? <Spinner /> : <PackageCheck aria-hidden="true" className="size-4" />}
            Log sale
          </Button>
        </form>
      )}
    </section>
  );
};

export const SaleHistory = ({ sales, onDelete }: { sales: (StockSale & { name: string })[]; onDelete?: (id: string) => void }) => {
  const list = salesNewestFirst(sales) as (StockSale & { name: string })[];
  return (
    <section aria-labelledby="sale-history-heading" className="panel tx-sheet p-5">
      <h3 id="sale-history-heading" className={cn(panelHeading, 'mb-3')}>Sale history</h3>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sales logged yet.</p>
      ) : (
        <ul className="divide-y divide-foreground/[0.06]">
          {list.slice(0, 50).map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{s.name || 'Product'}</p>
                <p className="text-xs text-muted-foreground">
                  {s.atMs ? formatDate(s.atMs) : ''} · {s.qty} × {formatINR(s.unitPrice)}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{formatINR(s.qty * s.unitPrice)}</p>
              {onDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Delete the sale of ${s.qty} ${s.name || 'product'}`}
                  onClick={() => onDelete(s.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
