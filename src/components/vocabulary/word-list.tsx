'use client'

import { useState, useTransition } from 'react'
import { Check, RotateCcw, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/misc'
import { PronounceButton } from '@/components/vocabulary/pronounce-button'
import { TranslateButton } from '@/components/vocabulary/translate-button'
import { removeWord, setWordStatus } from '@/lib/actions/vocabulary'
import { cn, formatRelative } from '@/lib/utils'

export type SavedWord = {
  id: string
  word: string
  partOfSpeech: string | null
  phonetic: string | null
  definition: string
  example: string | null
  audioUrl: string | null
  translation: string | null
  status: 'learning' | 'learned' | 'review'
  createdAt: Date | string
}

const FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'learning', label: 'Aprendendo' },
  { id: 'review', label: 'Revisar' },
  { id: 'learned', label: 'Aprendidas' },
] as const

const STATUS_TONE = {
  learning: 'neutral',
  review: 'neutral',
  learned: 'accent',
} as const

/** The stored status is an English enum; the badge is what a person reads. */
const STATUS_LABEL: Record<string, string> = {
  learning: 'aprendendo',
  review: 'revisar',
  learned: 'aprendida',
}

/*
 * Wiktionary tags every entry in English. Translating the common ones keeps
 * the badge in the panel's language; anything unmapped falls through as it
 * came, which is better than hiding it.
 */
const PART_OF_SPEECH: Record<string, string> = {
  noun: 'substantivo',
  verb: 'verbo',
  adjective: 'adjetivo',
  adverb: 'advérbio',
  pronoun: 'pronome',
  preposition: 'preposição',
  conjunction: 'conjunção',
  interjection: 'interjeição',
  article: 'artigo',
  numeral: 'numeral',
  'proper noun': 'nome próprio',
  particle: 'partícula',
  determiner: 'determinante',
  suffix: 'sufixo',
  prefix: 'prefixo',
  word: 'palavra',
}

export function WordList({ words }: { words: SavedWord[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all')
  const [, startTransition] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)

  const visible = filter === 'all' ? words : words.filter((word) => word.status === filter)

  const act = (id: string, fn: () => Promise<unknown>) => {
    setBusy(id)
    startTransition(async () => {
      await fn()
      setBusy(null)
    })
  }

  const counts = {
    all: words.length,
    learning: words.filter((w) => w.status === 'learning').length,
    review: words.filter((w) => w.status === 'review').length,
    learned: words.filter((w) => w.status === 'learned').length,
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFilter(option.id)}
            aria-pressed={filter === option.id}
            className={cn(
              'rounded-pill border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors',
              filter === option.id
                ? 'border-brand-500 bg-brand-500/8 text-ink'
                : 'border-line text-muted hover:border-line-strong hover:text-ink',
            )}
          >
            {option.label}
            <span className="ml-1.5 text-[0.6875rem] text-faint">{counts[option.id]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-card border border-dashed border-line px-5 py-10 text-center text-[0.8125rem] text-muted">
          Nenhuma palavra nesta lista ainda.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {visible.map((word) => (
            <li
              key={word.id}
              className={cn(
                'flex flex-wrap items-start justify-between gap-4 p-4 sm:px-5',
                busy === word.id && 'opacity-50',
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[0.9375rem] font-semibold text-ink">{word.word}</span>
                  {word.phonetic && (
                    <span className="font-mono text-xs text-faint">{word.phonetic}</span>
                  )}
                  {word.partOfSpeech && (
                    <Badge>{PART_OF_SPEECH[word.partOfSpeech] ?? word.partOfSpeech}</Badge>
                  )}
                  <Badge tone={STATUS_TONE[word.status]}>{STATUS_LABEL[word.status] ?? word.status}</Badge>
                </div>

                <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">
                  {word.definition}
                </p>
                {word.example && (
                  <p className="mt-1.5 text-[0.8125rem] italic leading-relaxed text-faint">
                    &ldquo;{word.example}&rdquo;
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <TranslateButton
                    word={word.word}
                    definition={word.definition}
                    vocabularyId={word.id}
                    initial={word.translation}
                    compact
                  />
                  <span className="text-[0.6875rem] text-faint">
                    salva {formatRelative(word.createdAt)}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <PronounceButton word={word.word} audioUrl={word.audioUrl} />
                {word.status !== 'learned' && (
                  <button
                    type="button"
                    onClick={() => act(word.id, () => setWordStatus(word.id, 'learned'))}
                    aria-label={`Mark ${word.word} as learned`}
                    className="rounded-lg p-2 text-faint transition-colors hover:bg-brand-500/10 hover:text-brand-600"
                  >
                    <Check className="size-4" />
                  </button>
                )}
                {word.status !== 'review' && (
                  <button
                    type="button"
                    onClick={() => act(word.id, () => setWordStatus(word.id, 'review'))}
                    aria-label={`Move ${word.word} to review`}
                    className="rounded-lg p-2 text-faint transition-colors hover:bg-brand-500/10 hover:text-brand-600 dark:text-brand-400"
                  >
                    <RotateCcw className="size-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => act(word.id, () => removeWord(word.id))}
                  aria-label={`Remove ${word.word}`}
                  className="rounded-lg p-2 text-faint transition-colors hover:bg-rose/10 hover:text-rose"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
