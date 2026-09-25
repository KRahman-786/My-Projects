'use client';

import { useState } from 'react';
import { Star, ImagePlus, X } from 'lucide-react';
import clsx from 'clsx';
import { misc } from '@/services/account';
import { errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/providers/ToastProvider';

export function ReviewForm({ productId, orderItemId, onDone }: { productId: string; orderItemId?: string; onDone: () => void }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [image, setImage] = useState<{ url: string; publicId: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const upload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return setError('Image must be under 5 MB');
    setUploading(true);
    setError('');
    try {
      setImage(await misc.uploadReviewImage(file));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) return setError('Please choose a star rating');
    if (body.trim().length < 10) return setError('Please write at least 10 characters');
    setSaving(true);
    setError('');
    try {
      const res = await misc.createReview({ productId, orderItemId, rating, title: title || undefined, body, imageUrl: image?.url, imagePublicId: image?.publicId });
      toast(res.message ?? 'Thanks for your review!');
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium text-ink-soft">Your rating</p>
        <div className="flex gap-1" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" role="radio" aria-checked={rating === i} aria-label={`${i} star${i > 1 ? 's' : ''}`} onMouseEnter={() => setHover(i)} onClick={() => setRating(i)}>
              <Star className={clsx('h-8 w-8 transition', (hover || rating) >= i ? 'fill-gold-400 text-gold-400' : 'text-gold-200')} strokeWidth={1.4} />
            </button>
          ))}
        </div>
      </div>
      <Input label="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Sum it up in a few words" />
      <Textarea label="Your review" required value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="What did you like? How was the colour, quality, fit?" />
      <div>
        {image ? (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt="Review upload" className="h-24 w-24 rounded-xl object-cover" />
            <button type="button" onClick={() => setImage(null)} className="absolute -right-2 -top-2 rounded-full bg-white p-1 shadow" aria-label="Remove image">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-line px-4 py-2 text-sm text-ink-soft hover:border-plum-300">
            <ImagePlus className="h-4 w-4" /> {uploading ? 'Uploading…' : 'Add a photo (optional)'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
          </label>
        )}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" loading={saving} block>
        Submit review
      </Button>
    </form>
  );
}
