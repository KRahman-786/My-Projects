import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';

const control =
  'w-full rounded-xl border border-line bg-white px-4 py-2.5 text-[15px] text-ink placeholder:text-ink-muted/70 transition focus:border-plum-400 focus:outline-none focus:ring-2 focus:ring-plum-100 disabled:bg-sand';

interface FieldWrapProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  id?: string;
  children: ReactNode;
  className?: string;
}

export function FieldWrap({ label, error, hint, required, id, children, className }: FieldWrapProps) {
  return (
    <div className={clsx('space-y-1.5', className)}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-ink-soft">
          {label}
          {required && <span className="text-danger"> *</span>}
        </label>
      )}
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; hint?: string; wrapClassName?: string };
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, error, hint, wrapClassName, className, id, name, required, ...props }, ref) {
  const fid = id ?? name;
  return (
    <FieldWrap label={label} error={error} hint={hint} required={required} id={fid} className={wrapClassName}>
      <input ref={ref} id={fid} name={name} required={required} aria-invalid={Boolean(error)} className={clsx(control, error && 'border-danger', className)} {...props} />
    </FieldWrap>
  );
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string; wrapClassName?: string };
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, error, wrapClassName, className, id, name, required, children, ...props }, ref) {
  const fid = id ?? name;
  return (
    <FieldWrap label={label} error={error} required={required} id={fid} className={wrapClassName}>
      <select ref={ref} id={fid} name={name} required={required} className={clsx(control, 'appearance-none pr-10', className)} {...props}>
        {children}
      </select>
    </FieldWrap>
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string; wrapClassName?: string };
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, error, wrapClassName, className, id, name, required, ...props }, ref) {
  const fid = id ?? name;
  return (
    <FieldWrap label={label} error={error} required={required} id={fid} className={wrapClassName}>
      <textarea ref={ref} id={fid} name={name} required={required} className={clsx(control, 'min-h-[110px]', className)} {...props} />
    </FieldWrap>
  );
});

export function Checkbox({ label, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={clsx('inline-flex cursor-pointer items-center gap-2.5 text-sm text-ink-soft', className)}>
      <input type="checkbox" className="h-4 w-4 rounded border-line text-plum-700 accent-plum-700 focus:ring-plum-300" {...props} />
      {label}
    </label>
  );
}
