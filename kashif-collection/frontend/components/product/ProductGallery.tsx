'use client';

import { useState, type MouseEvent } from 'react';
import { X, ZoomIn } from 'lucide-react';
import clsx from 'clsx';
import type { ProductImage } from '@/types';
import { SmartImage } from '@/components/ui/SmartImage';

export function ProductGallery({ images, name }: { images: ProductImage[]; name: string }) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const current = images[active];

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  if (!current) return <div className="aspect-square rounded-3xl bg-sand" />;

  return (
    <div className="flex flex-col-reverse gap-3 md:flex-row md:gap-4">
      <div className="no-scrollbar flex gap-2.5 overflow-x-auto md:w-20 md:flex-col md:overflow-visible" role="tablist" aria-label="Product images">
        {images.map((img, i) => (
          <button
            key={img.url}
            role="tab"
            aria-selected={i === active}
            aria-label={`Image ${i + 1}`}
            onClick={() => setActive(i)}
            className={clsx('relative aspect-square w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-sand transition md:w-20', i === active ? 'border-plum-600' : 'border-transparent opacity-70 hover:opacity-100')}
          >
            <SmartImage src={img.url} alt="" fill sizes="80px" className="object-cover" />
          </button>
        ))}
      </div>
      <div
        className="group relative aspect-square flex-1 cursor-zoom-in overflow-hidden rounded-3xl bg-sand"
        onMouseMove={onMove}
        onMouseLeave={() => setZoom(null)}
        onClick={() => setLightbox(true)}
      >
        <SmartImage
          src={current.url}
          alt={current.altText ?? name}
          fill
          priority
          sizes="(min-width:1024px) 50vw, 100vw"
          className="object-cover transition-transform duration-200"
          style={zoom ? { transform: 'scale(2)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
        />
        <span className="pointer-events-none absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-ink-soft md:opacity-0 md:transition md:group-hover:opacity-100">
          <ZoomIn className="h-3.5 w-3.5" /> <span className="hidden md:inline">Hover to zoom ·</span> Tap to expand
        </span>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[95] flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label={`${name} images`}>
          <button onClick={() => setLightbox(false)} aria-label="Close" className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white">
            <X className="h-6 w-6" />
          </button>
          <div className="relative flex-1">
            <SmartImage src={current.url} alt={current.altText ?? name} fill sizes="100vw" className="object-contain" />
          </div>
          <div className="flex justify-center gap-2 p-4">
            {images.map((img, i) => (
              <button key={img.url} onClick={() => setActive(i)} aria-label={`Image ${i + 1}`} className={clsx('h-2.5 w-2.5 rounded-full', i === active ? 'bg-white' : 'bg-white/30')} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
