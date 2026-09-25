'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Pencil, Trash2 } from 'lucide-react';
import { addresses } from '@/services/account';
import { AddressForm, AddressText } from '@/components/account/AddressForm';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/providers/ToastProvider';
import { errorMessage } from '@/lib/api';
import type { Address } from '@/types';

export default function AddressesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['addresses'], queryFn: addresses.list });
  const [editing, setEditing] = useState<Address | 'new' | null>(null);
  const refresh = () => void qc.invalidateQueries({ queryKey: ['addresses'] });

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast(msg);
      refresh();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl font-semibold">Saved addresses</h1>
        {Boolean(q.data?.length) && (
          <Button onClick={() => setEditing('new')} size="sm">
            <Plus className="h-4 w-4" /> Add address
          </Button>
        )}
      </div>
      <div className="mt-6">
        {q.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
          </div>
        ) : q.isError ? (
          <ErrorState message="Couldn't load addresses." onRetry={() => void q.refetch()} />
        ) : !q.data?.length ? (
          <EmptyState icon={MapPin} title="No saved addresses" description="Save your home or office address for a faster checkout." action={<Button onClick={() => setEditing('new')}>Add address</Button>} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {q.data.map((a) => (
              <div key={a.id} className="card relative p-5">
                {a.isDefault && <span className="absolute right-4 top-4 rounded-full bg-gold-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-gold-700">Default</span>}
                <AddressText a={a} />
                <div className="mt-4 flex flex-wrap gap-3 border-t border-line pt-3 text-xs font-semibold">
                  <button onClick={() => setEditing(a)} className="flex items-center gap-1 text-plum-700">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  {!a.isDefault && (
                    <button onClick={() => void act(() => addresses.setDefault(a.id), 'Default address updated')} className="text-plum-700">
                      Set as default
                    </button>
                  )}
                  <button onClick={() => confirm('Delete this address?') && void act(() => addresses.remove(a.id), 'Address deleted')} className="ml-auto flex items-center gap-1 text-ink-muted hover:text-danger">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add address' : 'Edit address'} size="lg">
        {editing !== null && (
          <AddressForm
            initial={editing === 'new' ? undefined : editing}
            onSaved={() => {
              toast('Address saved');
              setEditing(null);
              refresh();
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}
