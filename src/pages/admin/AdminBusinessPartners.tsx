import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Camera, Loader2, Pencil, Plus, Trash2, TrendingDown, TrendingUp, Users, Wallet } from 'lucide-react';
import { db } from '@/config/firebase';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { uploadImage } from '@/services/mediaStorage';
import { subscribeToAllOrders, type Order } from '@/services/orderService';
import { describeError } from '@/lib/errorMessage';
import { formatINR, toDate } from '@/lib/format';
import {
  computeTotals, isoDate, partnerAmount, periodFor, totalSharePercent,
  type BusinessPartner, type IncomeSource, type LedgerEntry, type LedgerKind, type OrderLike, type PeriodKey,
} from '@/lib/partnerShares';

const PARTNERS = 'businessPartners';
const LEDGER = 'businessLedger';

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'thisMonth', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'thisYear', label: 'This year (Apr-Mar)' },
  { key: 'all', label: 'All time' },
];

const SOURCE_LABEL: Record<IncomeSource, string> = {
  sales: 'Store sales (shared)',
  dealers: 'Dealer sales (shared)',
  other: 'Other income (not shared)',
};

const EXPENSE_CATEGORIES = ['Stock / silver', 'Rent', 'Salaries', 'Ads and marketing', 'Packing and delivery', 'Website and apps', 'Other'];

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');

type PartnerDraft = { id?: string; name: string; phone: string; role: string; sharePercent: string; photoUrl: string };
const emptyPartner: PartnerDraft = { name: '', phone: '', role: '', sharePercent: '', photoUrl: '' };

type EntryDraft = { kind: LedgerKind; source: IncomeSource; category: string; amount: string; date: string; note: string };
const newEntry = (kind: LedgerKind): EntryDraft => ({
  kind, source: 'sales', category: EXPENSE_CATEGORIES[0], amount: '', date: isoDate(new Date()), note: '',
});

function StatTile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'up' | 'down' | 'main' }) {
  return (
    <div className={`rounded-card border p-4 ${tone === 'main' ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'}`}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone === 'down' ? 'text-destructive' : 'text-foreground'}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function AdminBusinessPartners() {
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodKey, setPeriodKey] = useState<PeriodKey>('thisMonth');

  const [partnerDraft, setPartnerDraft] = useState<PartnerDraft | null>(null);
  const [savingPartner, setSavingPartner] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [entryDraft, setEntryDraft] = useState<EntryDraft | null>(null);
  const [savingEntry, setSavingEntry] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'partner' | 'entry'; id: string; label: string } | null>(null);

  useEffect(() => {
    const onErr = (e: Error) => { console.error(e); toast.error('Could not load', { description: describeError(e) }); setLoading(false); };
    const u1 = onSnapshot(query(collection(db, PARTNERS), orderBy('createdAt', 'asc')), (s) => {
      setPartners(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BusinessPartner, 'id'>) })));
      setLoading(false);
    }, onErr);
    const u2 = onSnapshot(query(collection(db, LEDGER), orderBy('date', 'desc')), (s) => {
      setEntries(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LedgerEntry, 'id'>) })));
    }, onErr);
    const u3 = subscribeToAllOrders(setOrders, onErr);
    return () => { u1(); u2(); u3(); };
  }, []);

  const period = useMemo(() => periodFor(periodKey), [periodKey]);
  const orderRows: OrderLike[] = useMemo(() => orders.map((o) => {
    const d = toDate(o.createdAt);
    return { total: o.total, status: o.status, paymentStatus: o.paymentStatus, pricing: o.pricing, date: d ? isoDate(d) : '' };
  }), [orders]);
  const totals = useMemo(() => computeTotals(orderRows, entries, period), [orderRows, entries, period]);
  const shareTotal = totalSharePercent(partners);
  const periodEntries = entries.filter((e) => (!period.from || e.date >= period.from) && (!period.to || e.date <= period.to));

  // ---- partners ----
  const pickPhoto = async (file: File | undefined) => {
    if (!file || !partnerDraft) return;
    setUploading(true);
    try {
      const res = await uploadImage(file, { category: 'testimonials', autoCompress: true });
      setPartnerDraft((d) => (d ? { ...d, photoUrl: res.url } : d));
    } catch (e) {
      toast.error('Photo did not upload', { description: describeError(e) });
    } finally {
      setUploading(false);
    }
  };

  const savePartner = async () => {
    if (!partnerDraft) return;
    const name = partnerDraft.name.trim();
    const share = Number(partnerDraft.sharePercent);
    if (!name) return toast.error('Enter the partner name');
    if (!Number.isFinite(share) || share < 0 || share > 100) return toast.error('Share must be between 0 and 100 %');
    const others = totalSharePercent(partners.filter((p) => p.id !== partnerDraft.id));
    if (others + share > 100.001) return toast.error(`Shares would total ${others + share} %. Keep them at 100 % or less.`);
    setSavingPartner(true);
    const data = { name, phone: partnerDraft.phone.trim(), role: partnerDraft.role.trim(), sharePercent: share, photoUrl: partnerDraft.photoUrl, updatedAt: serverTimestamp() };
    try {
      if (partnerDraft.id) await updateDoc(doc(db, PARTNERS, partnerDraft.id), data);
      else await addDoc(collection(db, PARTNERS), { ...data, createdAt: serverTimestamp() });
      toast.success(partnerDraft.id ? 'Partner updated' : 'Partner added');
      setPartnerDraft(null);
    } catch (e) {
      toast.error('Could not save the partner', { description: describeError(e) });
    } finally {
      setSavingPartner(false);
    }
  };

  // ---- ledger ----
  const saveEntry = async () => {
    if (!entryDraft) return;
    const amount = Number(entryDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error('Enter an amount above 0');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDraft.date)) return toast.error('Pick a date');
    setSavingEntry(true);
    try {
      await addDoc(collection(db, LEDGER), {
        kind: entryDraft.kind,
        ...(entryDraft.kind === 'income' ? { source: entryDraft.source } : { category: entryDraft.category }),
        amount: Math.round(amount * 100) / 100,
        date: entryDraft.date,
        note: entryDraft.note.trim(),
        createdAt: serverTimestamp(),
      });
      toast.success(entryDraft.kind === 'income' ? 'Income added' : 'Expense added');
      setEntryDraft(null);
    } catch (e) {
      toast.error('Could not save', { description: describeError(e) });
    } finally {
      setSavingEntry(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteDoc(doc(db, confirmDelete.kind === 'partner' ? PARTNERS : LEDGER, confirmDelete.id));
      toast.success('Removed');
    } catch (e) {
      toast.error('Could not remove', { description: describeError(e) });
    } finally {
      setConfirmDelete(null);
    }
  };

  const periodLabel = PERIODS.find((p) => p.key === periodKey)?.label ?? '';

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Business partners"
        description="The partners of ICONOIQ, their share, and the money in and out. Only store sales and dealer sales are shared."
        actions={<Button onClick={() => setPartnerDraft({ ...emptyPartner })}><Plus className="mr-1.5 size-4" />Add partner</Button>}
      />

      <ToggleGroup type="single" value={periodKey} onValueChange={(v) => v && setPeriodKey(v as PeriodKey)} className="flex-wrap justify-start" aria-label="Period">
        {PERIODS.map((p) => <ToggleGroupItem key={p.key} value={p.key} size="sm" className="px-3">{p.label}</ToggleGroupItem>)}
      </ToggleGroup>

      {/* ---- Summary ---- */}
      <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Store sales" value={formatINR(totals.storeSales)} hint={`${totals.storeOrders} paid orders + entries`} />
        <StatTile label="Dealer sales" value={formatINR(totals.dealerSales)} hint={`${totals.dealerOrders} dealer orders + entries`} />
        <StatTile label="Expenses" value={formatINR(totals.expenses)} tone="down" />
        <StatTile label="Profit to share" value={formatINR(totals.profit)} hint="Store + dealer - expenses" tone="main" />
        <StatTile label="Other income" value={formatINR(totals.otherIncome)} hint="Not shared" />
      </section>

      {/* ---- Partners ---- */}
      <section aria-labelledby="bp-partners" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="bp-partners" className="text-lg font-semibold text-foreground">Partners and their share <span className="text-sm font-normal text-muted-foreground">({periodLabel})</span></h2>
          {partners.length > 0 && (
            <p className={`text-sm tabular-nums ${Math.abs(shareTotal - 100) < 0.001 ? 'text-muted-foreground' : 'font-medium text-destructive'}`}>
              Shares total {shareTotal} %{Math.abs(shareTotal - 100) < 0.001 ? '' : ' (should be 100 %)'}
            </p>
          )}
        </div>
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading…</div>
        ) : partners.length === 0 ? (
          <div className="rounded-card border border-dashed border-border p-8 text-center">
            <Users className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">No partners yet. Add each partner with their photo and share %.</p>
            <Button className="mt-4" variant="outline" onClick={() => setPartnerDraft({ ...emptyPartner })}><Plus className="mr-1.5 size-4" />Add partner</Button>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {partners.map((p) => {
              const amt = partnerAmount(totals.profit, p.sharePercent);
              return (
                <li key={p.id} className="flex gap-4 rounded-card border border-border bg-card p-4">
                  {p.photoUrl ? (
                    <img src={p.photoUrl} alt={p.name} className="size-16 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground">{initials(p.name)}</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">{p.name}</p>
                    {(p.role || p.phone) && <p className="truncate text-xs text-muted-foreground">{[p.role, p.phone].filter(Boolean).join(' · ')}</p>}
                    <p className="mt-2 text-sm text-muted-foreground"><span className="font-medium tabular-nums text-foreground">{p.sharePercent} %</span> share</p>
                    <p className={`text-lg font-semibold tabular-nums ${amt < 0 ? 'text-destructive' : 'text-foreground'}`}>{formatINR(amt)}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="icon" variant="ghost" aria-label={`Edit ${p.name}`} onClick={() => setPartnerDraft({ id: p.id, name: p.name, phone: p.phone ?? '', role: p.role ?? '', sharePercent: String(p.sharePercent), photoUrl: p.photoUrl ?? '' })}><Pencil className="size-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label={`Remove ${p.name}`} onClick={() => setConfirmDelete({ kind: 'partner', id: p.id, label: p.name })}><Trash2 className="size-4" /></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---- Income and expenses ---- */}
      <section aria-labelledby="bp-ledger" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="bp-ledger" className="text-lg font-semibold text-foreground">Income and expenses <span className="text-sm font-normal text-muted-foreground">({periodLabel})</span></h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEntryDraft(newEntry('income'))}><TrendingUp className="mr-1.5 size-4" />Add income</Button>
            <Button size="sm" variant="outline" onClick={() => setEntryDraft(newEntry('expense'))}><TrendingDown className="mr-1.5 size-4" />Add expense</Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Paid website orders count by themselves (cancelled, returned and refunded ones are left out). Add here only money from outside the website: shop or dealer sales paid by cash or bank, and every expense.</p>
        {periodEntries.length === 0 ? (
          <div className="rounded-card border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            <Wallet className="mx-auto mb-2 size-6" />No entries in this period.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-card border border-border bg-card">
            {periodEntries.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${e.kind === 'income' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                  {e.kind === 'income' ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{e.kind === 'income' ? SOURCE_LABEL[e.source ?? 'sales'] : e.category}</p>
                  <p className="truncate text-xs text-muted-foreground">{e.date}{e.note ? ` · ${e.note}` : ''}</p>
                </div>
                <p className={`whitespace-nowrap text-sm font-semibold tabular-nums ${e.kind === 'income' ? 'text-foreground' : 'text-destructive'}`}>{e.kind === 'income' ? '+' : '−'}{formatINR(e.amount)}</p>
                <Button size="icon" variant="ghost" aria-label="Remove entry" onClick={() => setConfirmDelete({ kind: 'entry', id: e.id, label: `${e.kind} of ${formatINR(e.amount)}` })}><Trash2 className="size-4" /></Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Partner dialog ---- */}
      <Dialog open={!!partnerDraft} onOpenChange={(o) => !o && setPartnerDraft(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{partnerDraft?.id ? 'Edit partner' : 'Add partner'}</DialogTitle>
            <DialogDescription>Their share % decides their part of the profit from store and dealer sales.</DialogDescription>
          </DialogHeader>
          {partnerDraft && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {partnerDraft.photoUrl ? (
                  <img src={partnerDraft.photoUrl} alt="" className="size-20 rounded-full object-cover" />
                ) : (
                  <div className="flex size-20 items-center justify-center rounded-full bg-muted text-muted-foreground"><Camera className="size-6" /></div>
                )}
                <div>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Partner photo" onChange={(e) => { pickPhoto(e.target.files?.[0]); e.target.value = ''; }} />
                  <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                    {uploading ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Camera className="mr-1.5 size-4" />}{partnerDraft.photoUrl ? 'Change photo' : 'Add photo'}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5"><Label htmlFor="bp-name">Name</Label><Input id="bp-name" value={partnerDraft.name} onChange={(e) => setPartnerDraft({ ...partnerDraft, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label htmlFor="bp-share">Share %</Label><Input id="bp-share" inputMode="decimal" value={partnerDraft.sharePercent} onChange={(e) => setPartnerDraft({ ...partnerDraft, sharePercent: e.target.value })} placeholder="e.g. 50" /></div>
                <div className="space-y-1.5"><Label htmlFor="bp-phone">Phone</Label><Input id="bp-phone" inputMode="tel" value={partnerDraft.phone} onChange={(e) => setPartnerDraft({ ...partnerDraft, phone: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label htmlFor="bp-role">Role (optional)</Label><Input id="bp-role" value={partnerDraft.role} onChange={(e) => setPartnerDraft({ ...partnerDraft, role: e.target.value })} placeholder="e.g. Founder" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPartnerDraft(null)}>Cancel</Button>
            <Button onClick={savePartner} disabled={savingPartner || uploading}>{savingPartner && <Loader2 className="mr-1.5 size-4 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Entry dialog ---- */}
      <Dialog open={!!entryDraft} onOpenChange={(o) => !o && setEntryDraft(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{entryDraft?.kind === 'income' ? 'Add income' : 'Add expense'}</DialogTitle>
            <DialogDescription>{entryDraft?.kind === 'income' ? 'Money that came in outside the website.' : 'Money the business spent.'}</DialogDescription>
          </DialogHeader>
          {entryDraft && (
            <div className="space-y-4">
              {entryDraft.kind === 'income' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="bp-source">From</Label>
                  <Select value={entryDraft.source} onValueChange={(v) => setEntryDraft({ ...entryDraft, source: v as IncomeSource })}>
                    <SelectTrigger id="bp-source"><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(SOURCE_LABEL) as IncomeSource[]).map((k) => <SelectItem key={k} value={k}>{SOURCE_LABEL[k]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="bp-cat">Type</Label>
                  <Select value={entryDraft.category} onValueChange={(v) => setEntryDraft({ ...entryDraft, category: v })}>
                    <SelectTrigger id="bp-cat"><SelectValue /></SelectTrigger>
                    <SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label htmlFor="bp-amt">Amount (₹)</Label><Input id="bp-amt" inputMode="decimal" value={entryDraft.amount} onChange={(e) => setEntryDraft({ ...entryDraft, amount: e.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="bp-date">Date</Label><Input id="bp-date" type="date" value={entryDraft.date} onChange={(e) => setEntryDraft({ ...entryDraft, date: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label htmlFor="bp-note">Note (optional)</Label><Input id="bp-note" value={entryDraft.note} onChange={(e) => setEntryDraft({ ...entryDraft, note: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntryDraft(null)}>Cancel</Button>
            <Button onClick={saveEntry} disabled={savingEntry}>{savingEntry && <Loader2 className="mr-1.5 size-4 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Confirm delete ---- */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove this?</DialogTitle>
            <DialogDescription>{confirmDelete?.label} will be removed. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Keep</Button>
            <Button variant="destructive" onClick={doDelete}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
