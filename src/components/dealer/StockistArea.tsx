// The approved stockist's inventory on /dealer: loads the delivered dealer
// orders once and listens to the logged sales. Views: StockistViews.tsx.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { describeError } from '@/lib/errorMessage';
import { restockState, stockRows, type StockPurchaseLine } from '@/lib/stockist';
import { PanelSkeleton } from '@/components/skeletons';
import {
  deleteStockSale,
  loadStockPurchases,
  loadStockSales,
  logStockSale,
  subscribeStockSales,
  type LoggedSale,
} from '@/services/stockistService';
import { InventoryTable, SaleHistory, StockistAreaView, type LogSaleInput } from './StockistViews';

export const StockistArea = ({ uid }: { uid: string }) => {
  const [purchases, setPurchases] = useState<StockPurchaseLine[] | null>(null);
  const [sales, setSales] = useState<LoggedSale[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nowMs] = useState(() => Date.now());

  useEffect(() => {
    let live = true;
    loadStockPurchases(uid)
      .then((p) => live && setPurchases(p))
      .catch((e) => {
        if (!live) return;
        setPurchases([]);
        setError(describeError(e));
      });
    const off = subscribeStockSales(uid, setSales, (e) => {
      setSales([]);
      setError(describeError(e));
    });
    return () => {
      live = false;
      off();
    };
  }, [uid]);

  const rows = useMemo(() => stockRows(purchases ?? [], sales ?? []), [purchases, sales]);

  const onLog = useCallback(
    async (s: LogSaleInput) => {
      const row = rows.find((r) => r.productId === s.productId);
      if (!row) return false;
      setSaving(true);
      try {
        await logStockSale(uid, { productId: row.productId, name: row.name, qty: s.qty, unitPrice: row.regularPrice, atMs: s.atMs });
        toast.success('Sale logged');
        return true;
      } catch (e) {
        toast.error(describeError(e));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [rows, uid],
  );

  const onDelete = useCallback(
    async (id: string) => {
      try {
        await deleteStockSale(uid, id);
        toast('Sale deleted');
      } catch (e) {
        toast.error(describeError(e));
      }
    },
    [uid],
  );

  return (
    <StockistAreaView
      loading={purchases === null || sales === null}
      error={error}
      rows={rows}
      sales={sales ?? []}
      nowMs={nowMs}
      saving={saving}
      onLog={onLog}
      onDelete={(id) => void onDelete(id)}
    />
  );
};

/** Admin > Dealers: a stockist's inventory and logged sales, read-only. */
export const StockistReadOnly = ({ uid }: { uid: string }) => {
  const [data, setData] = useState<{ purchases: StockPurchaseLine[]; sales: LoggedSale[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setData(null);
    Promise.all([loadStockPurchases(uid), loadStockSales(uid)])
      .then(([purchases, sales]) => live && setData({ purchases, sales }))
      .catch((e) => live && setError(describeError(e)));
    return () => {
      live = false;
    };
  }, [uid]);
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <PanelSkeleton lines={3} label="Loading stock" />;
  const rows = stockRows(data.purchases, data.sales);
  const r = restockState(rows);
  return (
    <div className="space-y-4">
      {r.alert && (
        <p className="rounded-card bg-status-warning-bg px-3 py-2 text-xs font-medium text-status-warning-fg">
          {Math.round(r.share * 100)}% of the stock bought is sold: time to restock.
        </p>
      )}
      <InventoryTable rows={rows} />
      <SaleHistory sales={data.sales} />
    </div>
  );
};
