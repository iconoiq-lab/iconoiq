// The approved stockist's inventory on /dealer: loads the delivered dealer
// orders once and listens to the logged sales. Views: StockistViews.tsx.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { describeError } from '@/lib/errorMessage';
import { stockRows, type StockPurchaseLine } from '@/lib/stockist';
import {
  deleteStockSale,
  loadStockPurchases,
  logStockSale,
  subscribeStockSales,
  type LoggedSale,
} from '@/services/stockistService';
import { StockistAreaView, type LogSaleInput } from './StockistViews';

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
