'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

export type SelectOption = {
  value: string
  label: string
  /** Optional second line, for when the label alone is not enough to choose. */
  description?: string
  /** Options carrying the same group name are rendered under one heading. */
  group?: string
  disabled?: boolean
}

type Props = {
  name: string
  options: SelectOption[]
  defaultValue?: string
  placeholder?: string
  disabled?: boolean
  id?: string
  className?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  onChange?: (value: string) => void
}

/**
 * A listbox that looks the same on every platform.
 *
 * A native `<select>` renders its popup through the operating system, so no
 * amount of CSS reaches it. This keeps the form semantics — a hidden input
 * carries the value — while owning the appearance and the keyboard behaviour.
 */
export function Select({
  name,
  options,
  defaultValue,
  placeholder = 'Select…',
  disabled,
  id,
  className,
  onChange,
  ...aria
}: Props) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  const listId = `${controlId}-listbox`

  const [value, setValue] = useState(defaultValue ?? '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [dropUp, setDropUp] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const typeahead = useRef({ query: '', at: 0 })

  const selectable = useMemo(() => options.filter((option) => !option.disabled), [options])
  const selected = options.find((option) => option.value === value)

  const groups = useMemo(() => {
    const map = new Map<string, SelectOption[]>()
    for (const option of options) {
      const key = option.group ?? ''
      map.set(key, [...(map.get(key) ?? []), option])
    }
    return [...map.entries()]
  }, [options])

  const commit = useCallback(
    (next: string) => {
      setValue(next)
      onChange?.(next)
      setOpen(false)
    },
    [onChange],
  )

  /* Close on outside click or focus leaving the component. */
  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  /* Keep the highlighted option in view. */
  useEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const openList = () => {
    if (disabled) return
    const index = selectable.findIndex((option) => option.value === value)
    setActive(index >= 0 ? index : 0)

    /*
     * A list that opens downward from a trigger near the bottom of a phone
     * lands off the screen. Measure the room below before choosing a side.
     */
    const trigger = rootRef.current?.getBoundingClientRect()
    const below = trigger ? window.innerHeight - trigger.bottom : Infinity
    setDropUp(below < 220 && trigger !== undefined && trigger.top > below)

    setOpen(true)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return

    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault()
        openList()
      }
      return
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        setOpen(false)
        return
      case 'Tab':
        setOpen(false)
        return
      case 'ArrowDown':
        event.preventDefault()
        setActive((i) => Math.min(selectable.length - 1, i + 1))
        return
      case 'ArrowUp':
        event.preventDefault()
        setActive((i) => Math.max(0, i - 1))
        return
      case 'Home':
        event.preventDefault()
        setActive(0)
        return
      case 'End':
        event.preventDefault()
        setActive(selectable.length - 1)
        return
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (selectable[active]) commit(selectable[active].value)
        return
    }

    // Type-ahead: jump to the first option starting with what was typed.
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
      const now = Date.now()
      const query =
        now - typeahead.current.at < 800 ? typeahead.current.query + event.key : event.key
      typeahead.current = { query, at: now }

      const match = selectable.findIndex((option) =>
        option.label.toLowerCase().startsWith(query.toLowerCase()),
      )
      if (match >= 0) setActive(match)
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <input type="hidden" name={name} value={value} />

      <button
        type="button"
        id={controlId}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={cn(
          // 44px is the smallest comfortable tap target, and it is kept all the
          // way to lg — where the app switches to the pointer-driven sidebar
          // layout. The desktop density is left exactly as it was.
          'flex min-h-11 w-full items-center justify-between gap-2 rounded-control border bg-surface px-3 py-2 text-left lg:min-h-0',
          'text-[0.875rem] transition-colors duration-150 disabled:opacity-50',
          'focus:outline-none focus:ring-2 focus:ring-brand-500/25',
          open ? 'border-brand-500' : 'border-line hover:border-line-strong',
        )}
        {...aria}
      >
        <span className={cn('truncate', selected ? 'text-ink' : 'text-faint')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-faint transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={controlId}
          tabIndex={-1}
          className={cn(
            'absolute z-50 max-h-72 w-full overflow-y-auto rounded-control border border-line',
            'bg-surface p-1 shadow-[var(--shadow-lift)] scroll-slim animate-fade-in',
            dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          )}
        >
          {groups.map(([group, entries]) => (
            <li key={group || 'ungrouped'}>
              {group && (
                <p className="px-2.5 pb-1 pt-2.5 text-[0.75rem] font-medium text-faint">{group}</p>
              )}
              <ul role="none">
                {entries.map((option) => {
                  const index = selectable.indexOf(option)
                  const isActive = index === active
                  const isSelected = option.value === value

                  return (
                    <li
                      key={option.value}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={option.disabled}
                      data-index={index}
                      onMouseEnter={() => index >= 0 && setActive(index)}
                      onClick={() => !option.disabled && commit(option.value)}
                      className={cn(
                        'flex min-h-11 cursor-pointer items-start gap-2 rounded-[0.4rem] px-2.5 py-2 transition-colors lg:min-h-0',
                        isActive && 'bg-surface-2',
                        option.disabled && 'cursor-not-allowed opacity-40',
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'block truncate text-[0.875rem]',
                            isSelected ? 'font-medium text-ink' : 'text-ink-soft',
                          )}
                        >
                          {option.label}
                        </span>
                        {option.description && (
                          <span className="mt-0.5 block text-[0.75rem] leading-snug text-muted">
                            {option.description}
                          </span>
                        )}
                      </span>
                      {isSelected && (
                        <Check className="mt-0.5 size-3.5 shrink-0 text-brand-600 dark:text-brand-400" />
                      )}
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
