'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2, Loader2 } from 'lucide-react';
import { admin, toPaise, toRupees, type AdminProduct } from '@/services/admin';
import { Panel } from './ui';
import { Input, Select, Textarea, Checkbox } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { SmartImage } from '@/components/ui/SmartImage';
import { useToast } from '@/components/providers/ToastProvider';
import { ApiError, errorMessage } from '@/lib/api';

interface VariantState {
  id?: string;
  sku: string;
  name: string;
  color: string;
  colorHex: string;
  size: string;
  price: string;
  mrp: string;
  isActive: boolean;
  initialStock: string;
  lowStockThreshold: string;
  stockInfo?: string;
}

export function ProductForm({ product }: { product?: AdminProduct }) {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const cats = useQuery({ queryKey: ['admin-categories'], queryFn: admin.categories });
  const [f, setF] = useState({
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    slug: product?.slug ?? '',
    brand: product?.brand ?? 'Kashif Collection',
    categoryId: product?.categoryId ?? '',
    subcategoryId: product?.subcategoryId ?? '',
    shortDescription: product?.shortDescription ?? '',
    description: product?.description ?? '',
    mrp: toRupees(product?.mrp),
    price: toRupees(product?.price),
    gstRate: String(product?.gstRate ?? 18),
    hsnCode: product?.hsnCode ?? '',
    weightGrams: String(product?.weightGrams ?? 100),
    tags: product?.tags.join(', ') ?? '',
    ingredients: product?.ingredients ?? '',
    howToUse: product?.howToUse ?? '',
    isFeatured: product?.isFeatured ?? false,
    isBestSeller: product?.isBestSeller ?? false,
    isNewArrival: product?.isNewArrival ?? true,
    isActive: product?.isActive ?? true,
    metaTitle: product?.metaTitle ?? '',
    metaDescription: product?.metaDescription ?? '',
  });
  const [images, setImages] = useState(product?.images.map((i) => ({ url: i.url, publicId: i.publicId, altText: i.altText ?? '' })) ?? []);
  const [specs, setSpecs] = useState(product?.specifications ?? []);
  const [variants, setVariants] = useState<VariantState[]>(
    product?.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      name: v.name,
      color: v.color ?? '',
      colorHex: v.colorHex ?? '',
      size: v.size ?? '',
      price: toRupees(v.price),
      mrp: toRupees(v.mrp),
      isActive: v.isActive ?? true,
      initialStock: '',
      lowStockThreshold: String(v.inventory?.lowStockThreshold ?? 5),
      stockInfo: v.inventory ? `${v.inventory.availableStock} available · ${v.inventory.reservedStock} reserved` : undefined,
    })) ?? [{ sku: '', name: 'Standard', color: '', colorHex: '', size: '', price: '', mrp: '', isActive: true, initialStock: '0', lowStockThreshold: '5' }],
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const category = cats.data?.find((c) => c.id === f.categoryId);

  const upload = async (files: FileList) => {
    setUploading(true);
    try {
      const up = await admin.upload(Array.from(files).slice(0, 10));
      setImages((imgs) => [...imgs, ...up.map((u) => ({ url: u.url, publicId: u.publicId, altText: f.name }))]);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setUploading(false);
    }
  };

  const move = (i: number, d: -1 | 1) =>
    setImages((imgs) => {
      const next = [...imgs];
      const j = i + d;
      if (j < 0 || j >= next.length) return imgs;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const setVariant = (i: number, k: keyof VariantState, v: string | boolean) => setVariants((vs) => vs.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!f.categoryId) errs.categoryId = 'Choose a category';
    if (!f.mrp || !f.price) errs.price = 'Enter MRP and selling price';
    else if (Number(f.price) > Number(f.mrp)) errs.price = 'Selling price cannot exceed MRP';
    if (variants.some((v) => !v.sku || !v.name)) errs.variants = 'Every variant needs a SKU and a name';
    setErrors(errs);
    if (Object.keys(errs).length) return toast('Please fix the highlighted fields', 'error');

    const body = {
      name: f.name,
      sku: f.sku,
      ...(f.slug ? { slug: f.slug } : {}),
      brand: f.brand,
      categoryId: f.categoryId,
      subcategoryId: f.subcategoryId || null,
      shortDescription: f.shortDescription,
      description: f.description,
      mrp: toPaise(f.mrp),
      price: toPaise(f.price),
      gstRate: Number(f.gstRate),
      hsnCode: f.hsnCode,
      weightGrams: Number(f.weightGrams),
      tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
      ingredients: f.ingredients,
      howToUse: f.howToUse,
      isFeatured: f.isFeatured,
      isBestSeller: f.isBestSeller,
      isNewArrival: f.isNewArrival,
      isActive: f.isActive,
      metaTitle: f.metaTitle,
      metaDescription: f.metaDescription,
      images: images.map((i) => ({ url: i.url, publicId: i.publicId, altText: i.altText || f.name })),
      specifications: specs.filter((s) => s.label && s.value),
      variants: variants.map((v) => ({
        ...(v.id ? { id: v.id } : { initialStock: Number(v.initialStock || 0) }),
        sku: v.sku,
        name: v.name,
        color: v.color || undefined,
        colorHex: /^#[0-9a-fA-F]{6}$/.test(v.colorHex) ? v.colorHex : undefined,
        size: v.size || undefined,
        price: v.price ? toPaise(v.price) : null,
        mrp: v.mrp ? toPaise(v.mrp) : null,
        isActive: v.isActive,
        lowStockThreshold: Number(v.lowStockThreshold || 5),
      })),
    };
    setSaving(true);
    try {
      const saved = product ? await admin.updateProduct(product.id, body) : await admin.createProduct(body);
      toast(product ? 'Product updated' : 'Product created');
      void qc.invalidateQueries({ queryKey: ['admin-products'] });
      if (!product) router.push(`/admin/products/${saved.id}`);
      else void qc.invalidateQueries({ queryKey: ['admin-product', product.id] });
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.details)) setErrors(Object.fromEntries((err.details as { field: string; message: string }[]).map((d) => [d.field.split('.')[0]!, d.message])));
      toast(errorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-5 xl:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <Panel title="Basic information">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Input wrapClassName="sm:col-span-2" label="Product name" required value={f.name} onChange={set('name')} error={errors.name} />
            <Input label="SKU" required value={f.sku} onChange={set('sku')} error={errors.sku} />
            <Input label="URL slug" value={f.slug} onChange={set('slug')} hint="Leave empty to generate from the name" error={errors.slug} />
            <Input label="Brand" value={f.brand} onChange={set('brand')} />
            <Input label="Tags" value={f.tags} onChange={set('tags')} hint="Comma separated, e.g. matte, bridal" />
            <Textarea wrapClassName="sm:col-span-2" label="Short description" value={f.shortDescription} onChange={set('shortDescription')} maxLength={300} className="min-h-[70px]" />
            <Textarea wrapClassName="sm:col-span-2" label="Description" required value={f.description} onChange={set('description')} error={errors.description} className="min-h-[160px]" />
            <Textarea label="Ingredients (cosmetics)" value={f.ingredients} onChange={set('ingredients')} />
            <Textarea label="How to use" value={f.howToUse} onChange={set('howToUse')} />
          </div>
        </Panel>

        <Panel title="Images">
          <div className="p-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {images.map((img, i) => (
                <div key={img.url + i} className="group relative overflow-hidden rounded-xl border border-line">
                  <div className="relative aspect-square bg-sand">
                    <SmartImage src={img.url} alt={img.altText} fill sizes="160px" className="object-cover" />
                    {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-plum-700 px-2 py-0.5 text-[10px] font-bold text-white">Cover</span>}
                  </div>
                  <input value={img.altText} onChange={(e) => setImages((imgs) => imgs.map((x, idx) => (idx === i ? { ...x, altText: e.target.value } : x)))} placeholder="Alt text" aria-label="Alt text" className="w-full border-t border-line px-2 py-1.5 text-xs" />
                  <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <button type="button" onClick={() => move(i, -1)} className="rounded-md bg-white/95 p-1" aria-label="Move left">
                      <ArrowUp className="h-3.5 w-3.5 -rotate-90" />
                    </button>
                    <button type="button" onClick={() => move(i, 1)} className="rounded-md bg-white/95 p-1" aria-label="Move right">
                      <ArrowDown className="h-3.5 w-3.5 -rotate-90" />
                    </button>
                    <button type="button" onClick={() => setImages((imgs) => imgs.filter((_, idx) => idx !== i))} className="rounded-md bg-white/95 p-1 text-danger" aria-label="Remove image">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-sm text-ink-muted hover:border-plum-300">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                {uploading ? 'Uploading…' : 'Upload images'}
                <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={(e) => e.target.files && void upload(e.target.files)} />
              </label>
            </div>
            <p className="mt-3 text-xs text-ink-muted">JPG/PNG/WEBP up to 5 MB. Images are stored on Cloudinary and optimised automatically (WebP/AVIF, resized).</p>
          </div>
        </Panel>

        <Panel title="Variants & stock">
          <div className="space-y-3 p-5">
            {errors.variants && <p className="text-sm text-danger">{errors.variants}</p>}
            {variants.map((v, i) => (
              <div key={v.id ?? i} className="rounded-xl border border-line p-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  <Input label="Variant name" value={v.name} onChange={(e) => setVariant(i, 'name', e.target.value)} placeholder="e.g. Ruby Red" />
                  <Input label="SKU" value={v.sku} onChange={(e) => setVariant(i, 'sku', e.target.value)} />
                  <Input label="Colour" value={v.color} onChange={(e) => setVariant(i, 'color', e.target.value)} />
                  <div className="flex items-end gap-2">
                    <Input label="Swatch (hex)" value={v.colorHex} onChange={(e) => setVariant(i, 'colorHex', e.target.value)} placeholder="#9B1B30" />
                    <input type="color" aria-label="Pick swatch" value={/^#[0-9a-fA-F]{6}$/.test(v.colorHex) ? v.colorHex : '#ffffff'} onChange={(e) => setVariant(i, 'colorHex', e.target.value)} className="mb-1 h-9 w-9 rounded" />
                  </div>
                  <Input label="Size" value={v.size} onChange={(e) => setVariant(i, 'size', e.target.value)} />
                  <Input label="Price override (₹)" inputMode="decimal" value={v.price} onChange={(e) => setVariant(i, 'price', e.target.value)} placeholder="Product price" />
                  <Input label="MRP override (₹)" inputMode="decimal" value={v.mrp} onChange={(e) => setVariant(i, 'mrp', e.target.value)} placeholder="Product MRP" />
                  <Input label="Low-stock alert at" inputMode="numeric" value={v.lowStockThreshold} onChange={(e) => setVariant(i, 'lowStockThreshold', e.target.value)} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  {v.id ? (
                    <p className="text-xs text-ink-muted">Stock: {v.stockInfo} — adjust from Inventory</p>
                  ) : (
                    <Input wrapClassName="w-40" label="Initial stock" inputMode="numeric" value={v.initialStock} onChange={(e) => setVariant(i, 'initialStock', e.target.value)} />
                  )}
                  <Checkbox label="Active" checked={v.isActive} onChange={(e) => setVariant(i, 'isActive', e.target.checked)} />
                  {variants.length > 1 && (
                    <button type="button" onClick={() => setVariants((vs) => vs.filter((_, idx) => idx !== i))} className="ml-auto text-xs font-semibold text-danger">
                      Remove variant
                    </button>
                  )}
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setVariants((vs) => [...vs, { sku: `${f.sku}-${String(vs.length + 1).padStart(2, '0')}`, name: '', color: '', colorHex: '', size: '', price: '', mrp: '', isActive: true, initialStock: '0', lowStockThreshold: '5' }])}
            >
              <Plus className="h-4 w-4" /> Add variant
            </Button>
          </div>
        </Panel>

        <Panel title="Specifications">
          <div className="space-y-2 p-5">
            {specs.map((s, i) => (
              <div key={i} className="flex gap-2">
                <input value={s.label} onChange={(e) => setSpecs((ss) => ss.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))} placeholder="Label" aria-label="Specification label" className="h-10 w-1/3 rounded-xl border border-line px-3 text-sm" />
                <input value={s.value} onChange={(e) => setSpecs((ss) => ss.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))} placeholder="Value" aria-label="Specification value" className="h-10 flex-1 rounded-xl border border-line px-3 text-sm" />
                <button type="button" onClick={() => setSpecs((ss) => ss.filter((_, idx) => idx !== i))} className="px-2 text-ink-muted hover:text-danger" aria-label="Remove specification">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={() => setSpecs((ss) => [...ss, { label: '', value: '' }])}>
              <Plus className="h-4 w-4" /> Add specification
            </Button>
          </div>
        </Panel>
      </div>

      <div className="space-y-5">
        <Panel title="Publish">
          <div className="space-y-3 p-5">
            <Checkbox label="Active (visible in store)" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} />
            <Checkbox label="Featured" checked={f.isFeatured} onChange={(e) => setF({ ...f, isFeatured: e.target.checked })} />
            <Checkbox label="Best seller" checked={f.isBestSeller} onChange={(e) => setF({ ...f, isBestSeller: e.target.checked })} />
            <Checkbox label="New arrival" checked={f.isNewArrival} onChange={(e) => setF({ ...f, isNewArrival: e.target.checked })} />
            <Button type="submit" block loading={saving}>
              {product ? 'Save changes' : 'Create product'}
            </Button>
          </div>
        </Panel>
        <Panel title="Pricing & tax">
          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-1">
            <Input label="MRP (₹)" inputMode="decimal" required value={f.mrp} onChange={set('mrp')} />
            <Input label="Selling price (₹)" inputMode="decimal" required value={f.price} onChange={set('price')} error={errors.price} hint={f.mrp && f.price && Number(f.mrp) > 0 ? `${Math.round(((Number(f.mrp) - Number(f.price)) / Number(f.mrp)) * 100)}% off` : undefined} />
            <Select label="GST rate" value={f.gstRate} onChange={set('gstRate')}>
              {['0', '3', '5', '12', '18', '28'].map((r) => (
                <option key={r} value={r}>
                  {r}%
                </option>
              ))}
            </Select>
            <Input label="HSN code" value={f.hsnCode} onChange={set('hsnCode')} />
            <Input label="Weight (grams)" inputMode="numeric" value={f.weightGrams} onChange={set('weightGrams')} />
          </div>
        </Panel>
        <Panel title="Organisation">
          <div className="space-y-3 p-5">
            <Select label="Category" required value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value, subcategoryId: '' })} error={errors.categoryId}>
              <option value="">Choose…</option>
              {cats.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select label="Subcategory" value={f.subcategoryId} onChange={set('subcategoryId')} disabled={!category}>
              <option value="">None</option>
              {category?.subcategories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        </Panel>
        <Panel title="SEO">
          <div className="space-y-3 p-5">
            <Input label="Meta title" value={f.metaTitle} onChange={set('metaTitle')} maxLength={160} />
            <Textarea label="Meta description" value={f.metaDescription} onChange={set('metaDescription')} maxLength={320} className="min-h-[80px]" />
          </div>
        </Panel>
      </div>
    </form>
  );
}
