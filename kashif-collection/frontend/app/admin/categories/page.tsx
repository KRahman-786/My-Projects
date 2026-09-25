'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { admin } from '@/services/admin';
import { PageHeader, Panel, Toggle } from '@/components/admin/ui';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/providers/ToastProvider';
import { errorMessage } from '@/lib/api';
import type { Category, Subcategory } from '@/types';

type Editing = { kind: 'category'; item?: Category } | { kind: 'subcategory'; categoryId: string; item?: Subcategory } | null;

export default function CategoriesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['admin-categories'], queryFn: admin.categories });
  const [editing, setEditing] = useState<Editing>(null);
  const [form, setForm] = useState({ name: '', slug: '', description: '', imageUrl: '', sortOrder: '0' });
  const [saving, setSaving] = useState(false);

  const open = (e: NonNullable<Editing>) => {
    const item = e.item;
    setForm({ name: item?.name ?? '', slug: item?.slug ?? '', description: item?.description ?? '', imageUrl: (item as Category | undefined)?.imageUrl ?? '', sortOrder: String(item?.sortOrder ?? 0) });
    setEditing(e);
  };
  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin-categories'] });
  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast(msg);
      refresh();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    const body = { name: form.name, ...(form.slug ? { slug: form.slug } : {}), description: form.description, sortOrder: Number(form.sortOrder) || 0, ...(editing.kind === 'category' && form.imageUrl ? { imageUrl: form.imageUrl } : {}) };
    try {
      if (editing.kind === 'category') await (editing.item ? admin.updateCategory(editing.item.id, body) : admin.createCategory(body));
      else await (editing.item ? admin.updateSubcategory(editing.item.id, body) : admin.createSubcategory({ ...body, categoryId: editing.categoryId }));
      toast('Saved');
      setEditing(null);
      refresh();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Categories"
        description="Organise the catalogue. Categories with products cannot be deleted — move or archive the products first."
        actions={
          <Button size="sm" onClick={() => open({ kind: 'category' })}>
            <Plus className="h-4 w-4" /> Add category
          </Button>
        }
      />
      {q.isLoading ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          {q.data?.map((c) => (
            <Panel
              key={c.id}
              title={`${c.name} · ${c.productCount ?? 0} products`}
              actions={
                <div className="flex items-center gap-2">
                  <Toggle checked={c.isActive ?? true} onChange={(v) => void act(() => admin.updateCategory(c.id, { isActive: v }), v ? 'Category shown' : 'Category hidden')} label={`${c.name} active`} />
                  <button onClick={() => open({ kind: 'category', item: c })} className="rounded-lg p-1.5 text-ink-muted hover:bg-sand" aria-label="Edit category">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => confirm(`Delete ${c.name}?`) && void act(() => admin.deleteCategory(c.id), 'Category deleted')} className="rounded-lg p-1.5 text-ink-muted hover:text-danger" aria-label="Delete category">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              }
            >
              <ul className="divide-y divide-line">
                {c.subcategories.map((s) => (
                  <li key={s.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span>
                      {s.name} <span className="text-xs text-ink-muted">/{s.slug} · {s.productCount ?? 0} products</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Toggle checked={s.isActive ?? true} onChange={(v) => void act(() => admin.updateSubcategory(s.id, { isActive: v }), 'Updated')} label={`${s.name} active`} />
                      <button onClick={() => open({ kind: 'subcategory', categoryId: c.id, item: s })} className="rounded-lg p-1.5 text-ink-muted hover:bg-sand" aria-label="Edit subcategory">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => confirm(`Delete ${s.name}?`) && void act(() => admin.deleteSubcategory(s.id), 'Subcategory deleted')} className="rounded-lg p-1.5 text-ink-muted hover:text-danger" aria-label="Delete subcategory">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </li>
                ))}
                <li className="px-5 py-2.5">
                  <button onClick={() => open({ kind: 'subcategory', categoryId: c.id })} className="flex items-center gap-1 text-xs font-semibold text-plum-700">
                    <Plus className="h-3.5 w-3.5" /> Add subcategory
                  </button>
                </li>
              </ul>
            </Panel>
          ))}
        </div>
      )}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={`${editing?.item ? 'Edit' : 'New'} ${editing?.kind ?? ''}`}>
        <form onSubmit={save} className="space-y-4">
          <Input label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} hint="Leave empty to generate from name" />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          {editing?.kind === 'category' && <Input label="Image URL" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />}
          <Input label="Sort order" inputMode="numeric" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
          <Button type="submit" block loading={saving}>
            Save
          </Button>
        </form>
      </Modal>
    </>
  );
}
