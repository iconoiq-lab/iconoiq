import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowLeft, ArrowUp, ChevronDown, EyeOff, FolderTree, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { IconButton } from '@/components/ui/icon-button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Notice } from '@/components/ui/notice';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  subscribeToCategories,
  seedDefaultCategories,
  healDuplicateCategories,
  getProductRefs,
  createCategory,
  renameCategory,
  addSubcategoryNamed,
  setCategoryHidden,
  saveCategoryOrder,
  removeCategory,
  CategoryInUseError,
  type Category,
  type SubCategory,
} from '@/services/categoryService';
import { moveItem, nameProblem, productsIn, type ProductRef } from '@/lib/categoryTree';

/** Which name is being edited: a category, or one of its subcategories. */
type EditTarget = { slug: string; sub?: string };
type RemoveTarget = { cat: Category; sub?: SubCategory; count: number };

const errorText = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong. Try again.');
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Admin > Categories: add, rename, reorder, hide and remove the store's
 * categories, and add, rename or remove their subcategories.
 *
 * A rename keeps the address (slug), so links, showcases and menu icons keep
 * working, and the service copies the new name onto products, coupons and the
 * footer. Removing is refused while products are filed there.
 */
const AdminCategories = () => {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [products, setProducts] = useState<ProductRef[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newError, setNewError] = useState<string | null>(null);
  const [subDrafts, setSubDrafts] = useState<Record<string, string>>({});
  const [subErrors, setSubErrors] = useState<Record<string, string | null>>({});
  const [removing, setRemoving] = useState<RemoveTarget | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const listRef = useRef<HTMLOListElement>(null);
  const removeReturnRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // A fresh store gets its default categories on the first admin visit.
    seedDefaultCategories().then(() => healDuplicateCategories());
    return subscribeToCategories((cats) => {
      setCategories(cats);
      setLoaded(true);
    }, { includeHidden: true });
  }, []);

  const loadCounts = () =>
    getProductRefs()
      .then(setProducts)
      .catch((error) => {
        console.error('[AdminCategories] product counts failed', error);
        setProducts(null);
      });

  useEffect(() => {
    void loadCounts();
  }, []);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    if (!products) return map;
    for (const cat of categories) {
      map.set(cat.slug, productsIn(products, cat, categories).length);
      for (const sub of cat.subcategories || []) {
        map.set(`${cat.slug}/${sub.slug}`, productsIn(products, cat, categories, sub).length);
      }
    }
    return map;
  }, [products, categories]);

  const countLabel = (key: string) => {
    if (!products) return 'Counting products';
    return plural(counts.get(key) ?? 0, 'product');
  };

  // ── Add ────────────────────────────────────────────

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = nameProblem(newName, categories);
    setNewError(problem);
    if (problem) return;
    setBusy('add');
    try {
      await createCategory(newName, categories);
      toast.success(`Added ${newName.trim()}`, { description: 'It is at the end of the list and in the store now.' });
      setNewName('');
    } catch (error) {
      toast.error('Could not add the category', { description: errorText(error) });
    } finally {
      setBusy(null);
    }
  };

  // ── Rename ─────────────────────────────────────────

  const startEdit = (target: EditTarget, current: string) => {
    setEditing(target);
    setDraft(current);
    setDraftError(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraftError(null);
  };

  const saveEdit = async (cat: Category, sub?: SubCategory) => {
    const siblings = sub ? cat.subcategories : categories;
    const current = sub ?? cat;
    const problem = nameProblem(draft, siblings, current);
    setDraftError(problem);
    if (problem) return;
    if (draft.trim() === current.name) return cancelEdit();

    setBusy(`rename:${cat.slug}/${sub?.slug ?? ''}`);
    try {
      const changed = await renameCategory(cat, categories, draft, sub?.slug);
      toast.success(`Renamed to ${draft.trim()}`, {
        description: changed ? `${plural(changed, 'product')} moved with it.` : 'Links to it still work.',
      });
      setEditing(null);
      void loadCounts();
    } catch (error) {
      toast.error('Could not rename', { description: errorText(error) });
    } finally {
      setBusy(null);
    }
  };

  // ── Order and visibility ───────────────────────────

  const move = async (index: number, delta: -1 | 1) => {
    const next = moveItem(categories, index, delta);
    if (next === categories) return;
    const moved = categories[index];
    const to = index + delta;
    setCategories(next);
    setAnnouncement(`${moved.name} moved to position ${to + 1} of ${next.length}.`);
    // Keep focus on the arrow that was pressed (or its partner at the edge of the list).
    requestAnimationFrame(() => {
      const edge = to === 0 ? 'down' : to === next.length - 1 ? 'up' : delta === -1 ? 'up' : 'down';
      listRef.current?.querySelector<HTMLButtonElement>(`[data-move="${edge}"][data-slug="${moved.slug}"]`)?.focus();
    });
    try {
      await saveCategoryOrder(next);
    } catch (error) {
      toast.error('Could not save the new order', { description: errorText(error) });
    }
  };

  const toggleHidden = async (cat: Category, inStore: boolean) => {
    setBusy(`hide:${cat.slug}`);
    try {
      await setCategoryHidden(cat, !inStore);
      toast.success(inStore ? `${cat.name} is in the store again` : `${cat.name} is hidden`, {
        description: inStore ? undefined : 'Its products still show in search and All products.',
      });
    } catch (error) {
      toast.error('Could not change it', { description: errorText(error) });
    } finally {
      setBusy(null);
    }
  };

  // ── Subcategories ──────────────────────────────────

  const toggleExpanded = (slug: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  const handleAddSub = async (event: React.FormEvent, cat: Category) => {
    event.preventDefault();
    const name = subDrafts[cat.slug] ?? '';
    const problem = nameProblem(name, cat.subcategories);
    setSubErrors((prev) => ({ ...prev, [cat.slug]: problem }));
    if (problem) return;
    setBusy(`addsub:${cat.slug}`);
    try {
      await addSubcategoryNamed(cat, name);
      toast.success(`Added ${name.trim()} to ${cat.name}`);
      setSubDrafts((prev) => ({ ...prev, [cat.slug]: '' }));
    } catch (error) {
      toast.error('Could not add the subcategory', { description: errorText(error) });
    } finally {
      setBusy(null);
    }
  };

  // ── Remove ─────────────────────────────────────────

  const askRemove = (cat: Category, sub?: SubCategory) => {
    removeReturnRef.current = document.activeElement as HTMLElement | null;
    const count = counts.get(sub ? `${cat.slug}/${sub.slug}` : cat.slug) ?? 0;
    setRemoving({ cat, sub, count });
  };

  const confirmRemove = async () => {
    if (!removing) return;
    const { cat, sub, count } = removing;
    if (count > 0) {
      // Blocked: the dialog offers the useful alternative instead.
      if (!sub && !cat.hidden) await toggleHidden(cat, false);
      else navigate('/admin/products');
      return;
    }
    try {
      await removeCategory(cat, categories, sub?.slug);
      toast.success(`Removed ${sub ? sub.name : cat.name}`);
    } catch (error) {
      if (error instanceof CategoryInUseError) void loadCounts();
      toast.error('Not removed', { description: errorText(error) });
    }
  };

  const removeDialog = (() => {
    if (!removing) return null;
    const { cat, sub, count } = removing;
    const name = sub ? sub.name : cat.name;
    if (count > 0) {
      const hideInstead = !sub && !cat.hidden;
      return {
        title: `${name} still has products`,
        description: `${plural(count, 'product is', 'products are')} filed here. Move ${count === 1 ? 'it' : 'them'} to another ${sub ? 'subcategory' : 'category'} in Products first${hideInstead ? ', or hide this category so shoppers stop seeing it' : ''}.`,
        confirmLabel: hideInstead ? 'Hide it instead' : 'Go to products',
        tone: 'default' as const,
      };
    }
    return {
      title: `Remove ${name}?`,
      description: sub
        ? `It leaves ${cat.name} and the filters on its page. No products use it.`
        : 'No products use it. Its page and menu entry go, and its footer link is removed. Coupons limited to it stop applying to anything.',
      confirmLabel: sub ? 'Remove subcategory' : 'Remove category',
      tone: 'danger' as const,
    };
  })();

  // ── Rendering ──────────────────────────────────────

  const nameEditor = (cat: Category, sub?: SubCategory) => {
    const id = `edit-${cat.slug}${sub ? `-${sub.slug}` : ''}`;
    const saving = busy === `rename:${cat.slug}/${sub?.slug ?? ''}`;
    return (
      <form
        className="flex min-w-0 flex-1 flex-col gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void saveEdit(cat, sub);
        }}
      >
        <Label htmlFor={id} className="sr-only">
          New name for {sub ? sub.name : cat.name}
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id={id}
            autoFocus
            value={draft}
            maxLength={60}
            onChange={(e) => {
              setDraft(e.target.value);
              if (draftError) setDraftError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
              }
            }}
            aria-invalid={!!draftError || undefined}
            aria-describedby={draftError ? `${id}-error` : undefined}
            className="h-10 min-w-0 flex-1 basis-40"
          />
          <Button type="submit" size="sm" disabled={saving}>
            {saving && <Spinner />}
            Save
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>
            Cancel
          </Button>
        </div>
        {draftError && (
          <p id={`${id}-error`} className="text-sm text-destructive">
            {draftError}
          </p>
        )}
      </form>
    );
  };

  const header = (
    <AdminPageHeader
      title="Categories"
      description="The shelves shoppers browse. The order here is the order of the menu."
      leading={
        <IconButton label="Back to dashboard" tooltip onClick={() => navigate('/admin')}>
          <ArrowLeft />
        </IconButton>
      }
    />
  );

  if (!loaded) {
    return (
      <div className="mx-auto max-w-4xl">
        {header}
        <div className="space-y-3" aria-busy="true" aria-label="Loading categories">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-card" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      {header}

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <Notice tone="info" className="mb-6">
        Renaming keeps every link working and updates the products filed there. Hidden categories leave the menu, home page and
        footer; their products still show in search and All products.
      </Notice>

      <section aria-labelledby="add-category-title" className="mb-6 rounded-card border border-border bg-card p-4 shadow-sm sm:p-6">
        <h2 id="add-category-title" className="text-base font-semibold text-foreground">
          Add a category
        </h2>
        <form onSubmit={handleAdd} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <Label htmlFor="new-category" className="sr-only">
              Category name
            </Label>
            <Input
              id="new-category"
              value={newName}
              maxLength={60}
              placeholder="Category name"
              onChange={(e) => {
                setNewName(e.target.value);
                if (newError) setNewError(null);
              }}
              aria-invalid={!!newError || undefined}
              aria-describedby={newError ? 'new-category-error' : 'new-category-hint'}
            />
            {newError ? (
              <p id="new-category-error" className="mt-1.5 text-sm text-destructive">
                {newError}
              </p>
            ) : (
              <p id="new-category-hint" className="mt-1.5 text-xs text-muted-foreground">
                It goes at the end of the menu with a general icon.
              </p>
            )}
          </div>
          <Button type="submit" disabled={busy === 'add'} className="sm:w-auto">
            {busy === 'add' ? <Spinner /> : <Plus aria-hidden="true" />}
            Add category
          </Button>
        </form>
      </section>

      <section aria-labelledby="category-list-title" className="rounded-card border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <h2 id="category-list-title" className="text-base font-semibold text-foreground">
            All categories <span className="font-normal tabular-nums text-muted-foreground">({categories.length})</span>
          </h2>
        </div>

        {categories.length === 0 ? (
          <div className="m-4 rounded-card border border-dashed border-border px-4 py-12 sm:m-6">
            <EmptyState icon={FolderTree} title="No categories yet" description="Add your first one above." />
          </div>
        ) : (
          <ol ref={listRef} className="divide-y divide-border">
            {categories.map((cat, index) => {
              const isEditing = editing?.slug === cat.slug && !editing.sub;
              const open = expanded.has(cat.slug);
              const subs = cat.subcategories || [];
              const panelId = `subs-${cat.slug}`;
              return (
                <motion.li
                  key={cat.id || cat.slug}
                  layout={reduceMotion ? false : 'position'}
                  transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                  className="px-3 py-3 sm:px-6 sm:py-4"
                >
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="flex shrink-0 flex-col">
                      <IconButton
                        size="sm"
                        label={`Move ${cat.name} up`}
                        data-move="up"
                        data-slug={cat.slug}
                        disabled={index === 0}
                        onClick={() => void move(index, -1)}
                      >
                        <ArrowUp />
                      </IconButton>
                      <IconButton
                        size="sm"
                        label={`Move ${cat.name} down`}
                        data-move="down"
                        data-slug={cat.slug}
                        disabled={index === categories.length - 1}
                        onClick={() => void move(index, 1)}
                      >
                        <ArrowDown />
                      </IconButton>
                    </div>

                    <div className="min-w-0 flex-1 pt-1">
                      {isEditing ? (
                        nameEditor(cat)
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <h3 className="break-words text-base font-semibold text-foreground">{cat.name}</h3>
                            {cat.hidden && <StatusBadge tone="neutral" icon={EyeOff} label="Hidden" />}
                          </div>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            <span className="tabular-nums">{countLabel(cat.slug)}</span>
                            <span aria-hidden="true"> · </span>
                            {plural(subs.length, 'subcategory', 'subcategories')}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">/category/{cat.slug}</p>
                        </>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2 pt-1.5">
                      <Label htmlFor={`instore-${cat.slug}`} className="text-sm text-muted-foreground">
                        In store
                      </Label>
                      <Switch
                        id={`instore-${cat.slug}`}
                        checked={!cat.hidden}
                        disabled={busy === `hide:${cat.slug}`}
                        onCheckedChange={(on) => void toggleHidden(cat, on)}
                      />
                    </div>
                  </div>

                  {!isEditing && (
                    <div className="-ml-2 mt-2 flex flex-wrap gap-x-0.5 gap-y-1 sm:ml-0 sm:pl-12">
                      <Button size="sm" variant="ghost" onClick={() => startEdit({ slug: cat.slug }, cat.name)}>
                        <Pencil aria-hidden="true" />
                        Rename
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-expanded={open}
                        aria-controls={panelId}
                        onClick={() => toggleExpanded(cat.slug)}
                      >
                        <ChevronDown
                          aria-hidden="true"
                          className={`transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
                        />
                        Subcategories
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => askRemove(cat)}
                      >
                        <Trash2 aria-hidden="true" />
                        Remove
                      </Button>
                    </div>
                  )}

                  {open && (
                    <div id={panelId} className="mt-3 rounded-card border border-border bg-muted/40 p-3 sm:ml-12 sm:p-4">
                      {subs.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No subcategories yet.</p>
                      ) : (
                        <ul className="divide-y divide-border">
                          {subs.map((sub) => {
                            const editingSub = editing?.slug === cat.slug && editing.sub === sub.slug;
                            return (
                              <li key={sub.slug} className="flex flex-wrap items-center gap-2 py-2">
                                {editingSub ? (
                                  nameEditor(cat, sub)
                                ) : (
                                  <>
                                    <div className="min-w-0 flex-1">
                                      <p className="break-words text-sm font-medium text-foreground">{sub.name}</p>
                                      <p className="text-xs tabular-nums text-muted-foreground">
                                        {countLabel(`${cat.slug}/${sub.slug}`)}
                                      </p>
                                    </div>
                                    <IconButton
                                      size="sm"
                                      label={`Rename ${sub.name}`}
                                      tooltip
                                      onClick={() => startEdit({ slug: cat.slug, sub: sub.slug }, sub.name)}
                                    >
                                      <Pencil />
                                    </IconButton>
                                    <IconButton
                                      size="sm"
                                      label={`Remove ${sub.name}`}
                                      tooltip
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => askRemove(cat, sub)}
                                    >
                                      <Trash2 />
                                    </IconButton>
                                  </>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      <form
                        onSubmit={(e) => void handleAddSub(e, cat)}
                        className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-start"
                      >
                        <div className="min-w-0 flex-1">
                          <Label htmlFor={`newsub-${cat.slug}`} className="sr-only">
                            New subcategory in {cat.name}
                          </Label>
                          <Input
                            id={`newsub-${cat.slug}`}
                            value={subDrafts[cat.slug] ?? ''}
                            maxLength={60}
                            placeholder="Subcategory name"
                            onChange={(e) => {
                              const value = e.target.value;
                              setSubDrafts((prev) => ({ ...prev, [cat.slug]: value }));
                              if (subErrors[cat.slug]) setSubErrors((prev) => ({ ...prev, [cat.slug]: null }));
                            }}
                            aria-invalid={!!subErrors[cat.slug] || undefined}
                            aria-describedby={subErrors[cat.slug] ? `newsub-${cat.slug}-error` : undefined}
                            className="h-10"
                          />
                          {subErrors[cat.slug] && (
                            <p id={`newsub-${cat.slug}-error`} className="mt-1.5 text-sm text-destructive">
                              {subErrors[cat.slug]}
                            </p>
                          )}
                        </div>
                        <Button type="submit" size="sm" variant="outline" disabled={busy === `addsub:${cat.slug}`}>
                          {busy === `addsub:${cat.slug}` ? <Spinner /> : <Plus aria-hidden="true" />}
                          Add subcategory
                        </Button>
                      </form>
                    </div>
                  )}
                </motion.li>
              );
            })}
          </ol>
        )}
      </section>

      {removeDialog && (
        <ConfirmDialog
          open={!!removing}
          onOpenChange={(open) => !open && setRemoving(null)}
          title={removeDialog.title}
          description={removeDialog.description}
          confirmLabel={removeDialog.confirmLabel}
          tone={removeDialog.tone}
          onConfirm={confirmRemove}
          returnFocusRef={removeReturnRef}
        />
      )}
    </div>
  );
};

export default AdminCategories;
