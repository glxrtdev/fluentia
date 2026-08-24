'use client'

import { cloneElement, forwardRef, useId } from 'react'

import { cn } from '@/lib/utils'

const control =
  'w-full rounded-control border border-line bg-surface px-3 py-2 text-[0.875rem] text-ink placeholder:text-faint ' +
  'transition-colors duration-150 hover:border-line-strong focus:border-brand-500 focus:outline-none ' +
  'focus:ring-2 focus:ring-brand-500/25 disabled:opacity-50'

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(control, className)} {...props} />
  },
)

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(control, 'min-h-24 resize-y', className)} {...props} />
})

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>
  className?: string
}) {
  const id = useId()
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ')

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-[0.8125rem] font-medium text-ink-soft">
        {label}
      </label>
      {cloneElement(children, {
        id,
        'aria-describedby': describedBy || undefined,
        'aria-invalid': error ? true : undefined,
      })}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-rose">
          {error}
        </p>
      )}
    </div>
  )
}
