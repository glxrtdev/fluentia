'use client'

import { useState, useTransition } from 'react'
import {
  BookmarkPlus,
  Check,
  Loader2,
  RotateCcw,
  Search,
  SearchX,
  TriangleAlert,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/field'
import { Badge, Skeleton } from '@/components/ui/misc'
import { PronounceButton } from '@/components/vocabulary/pronounce-button'
import { TranslateButton } from '@/components/vocabulary/translate-button'
import { addWord } from '@/lib/actions/vocabulary'
import type { DictionaryEntry } from '@/lib/dictionary/types'
import { cn } from '@/lib/utils'

type Failure = { message: string; notFound: boolean }

/** Synonyms and antonyms share a layout; only the label and tone differ. */
function RelatedWords({
  label,
  words,
  tone,
  onPick,
}: {
  label: string
  words: string[]
  tone: 'accent' | 'muted'
  onPick: (word: string) => void
}) {
  if (words.length === 0) return null

  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[0.75rem] font-medium text-faint">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {words.map((word) => (
          <button
            key={word}
            type="button"
            onClick={() => onPick(word)}
            className={cn(
              'rounded-pill border px-2.5 py-1 text-[0.75rem] transition-colors',
              tone === 'accent'
                ? 'border-brand-500/25 bg-brand-500/8 text-brand-600 hover:bg-brand-500/15 dark:text-brand-400'
                : 'border-line text-muted hover:border-line-strong hover:text-ink',
            )}
          >
            {word}
          </button>
        ))}
      </div>
    </div>
  )
}

export function WordSearch() {
  const [term, setTerm] = useState('')
  const [entry, setEntry] = useState<DictionaryEntry | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const lookup = async (word: string) => {
    const query = word.trim()
    if (!query) return

    setTerm(query)
    setLoading(true)
    setFailure(null)
    setEntry(null)
    setSaved(null)

    try {
      const response = await fetch(`/api/dictionary?word=${encodeURIComponent(query)}`)
      const data = await response.json()

      if (response.ok) setEntry(data as DictionaryEntry)
      else setFailure({ message: data?.error ?? 'Nothing found.', notFound: response.status === 404 })
    } catch {
      setFailure({ message: 'The lookup failed. Check your connection.', notFound: false })
    } finally {
      setLoading(false)
    }
  }

  const save = () => {
    if (!entry) return
    const first = entry.meanings[0]

    startTransition(async () => {
      const outcome = await addWord({
        word: entry.word,
        partOfSpeech: first.partOfSpeech,
        phonetic: entry.phonetic,
        definition: first.senses[0].definition,
        example: first.senses[0].example,
        audioUrl: entry.audioUrl,
        related: entry.synonyms.slice(0, 8),
        source: 'dictionary',
      })
      if (outcome?.error && !outcome.ok) {
        setFailure({ message: outcome.error, notFound: false })
      } else {
        setSaved(entry.word)
      }
    })
  }

  return (
    <div>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void lookup(term)
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Look up a word — entrepreneurship, deadline, thrive…"
            className="pl-9"
            autoCapitalize="none"
            spellCheck={false}
            aria-label="Search the dictionary"
          />
        </div>
        <Button type="submit" loading={loading}>
          Search
        </Button>
      </form>

      {/* Loading */}
      {loading && (
        <Card className="mt-5 space-y-3">
          <p className="flex items-center gap-2 text-[0.8125rem] text-muted">
            <Loader2 className="size-3.5 animate-spin" />
            Checking the dictionary…
          </p>
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </Card>
      )}

      {/* Not found, or the API is unhappy */}
      {failure && !loading && (
        <Card className="mt-5">
          <div className="flex gap-3">
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-control',
                failure.notFound ? 'bg-surface-2 text-faint' : 'bg-rose/10 text-rose',
              )}
            >
              {failure.notFound ? <SearchX className="size-4" /> : <TriangleAlert className="size-4" />}
            </span>
            <div role="alert">
              <p className="text-[0.9375rem] font-medium text-ink">
                {failure.notFound ? 'No entry for that word' : 'The dictionary is unavailable'}
              </p>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">{failure.message}</p>
              {failure.notFound ? (
                <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">
                  Check the spelling, or try the base form of the word — dictionaries list{' '}
                  <em>run</em>, not <em>running</em>.
                </p>
              ) : (
                /* The upstream dictionary is free and drops requests now and
                   then, so the useful thing to offer is another go. */
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  onClick={() => void lookup(term)}
                >
                  <RotateCcw className="size-3.5" />
                  Try again
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Result */}
      {entry && !loading && (
        <Card className="mt-5 animate-fade-up">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="display text-[1.75rem] leading-none text-ink">{entry.word}</h2>
              <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                {entry.phonetic && (
                  <span className="font-mono text-[0.8125rem] text-muted">{entry.phonetic}</span>
                )}
                <PronounceButton word={entry.word} audioUrl={entry.audioUrl} label="Listen" />
                <TranslateButton
                  word={entry.word}
                  definition={entry.meanings[0].senses[0].definition}
                />
              </div>
            </div>

            <Button
              variant={saved === entry.word ? 'secondary' : 'primary'}
              size="sm"
              onClick={save}
              loading={pending}
              disabled={saved === entry.word}
            >
              {saved === entry.word ? (
                <>
                  <Check className="size-3.5" />
                  In my vocabulary
                </>
              ) : (
                <>
                  <BookmarkPlus className="size-3.5" />
                  Add to my vocabulary
                </>
              )}
            </Button>
          </div>

          <div className="mt-6 space-y-6 border-t border-line pt-5">
            {entry.meanings.map((meaning) => (
              <section key={meaning.partOfSpeech}>
                <Badge tone="accent">{meaning.partOfSpeech}</Badge>

                <ol className="mt-3 space-y-3.5">
                  {meaning.senses.map((sense, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="mt-0.5 text-[0.75rem] font-medium tabular-nums text-faint">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[0.9375rem] leading-relaxed text-ink">
                          {sense.definition}
                        </p>
                        {sense.example && (
                          <p className="mt-1.5 border-l-2 border-line pl-3 text-[0.8125rem] italic leading-relaxed text-muted">
                            &ldquo;{sense.example}&rdquo;
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>

                <RelatedWords
                  label="Synonyms"
                  words={meaning.synonyms}
                  tone="accent"
                  onPick={lookup}
                />
                <RelatedWords
                  label="Antonyms"
                  words={meaning.antonyms}
                  tone="muted"
                  onPick={lookup}
                />
              </section>
            ))}
          </div>

          <p className="mt-6 border-t border-line pt-4 text-xs text-faint">
            Definitions from{' '}
            <a
              href="https://dictionaryapi.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 transition-colors hover:text-muted"
            >
              {entry.source}
            </a>
          </p>
        </Card>
      )}
    </div>
  )
}
