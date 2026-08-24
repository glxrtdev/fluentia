'use client'

import { useState, useTransition } from 'react'
import { BookmarkPlus, Check, Loader2, Search, Volume2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/field'
import { Badge, Skeleton } from '@/components/ui/misc'
import { TranslateButton } from '@/components/vocabulary/translate-button'
import { addWord } from '@/lib/actions/vocabulary'
import type { DictionaryResult } from '@/app/api/dictionary/route'

export function WordSearch() {
  const [term, setTerm] = useState('')
  const [result, setResult] = useState<DictionaryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const search = async (event: React.FormEvent) => {
    event.preventDefault()
    const word = term.trim()
    if (!word) return

    setLoading(true)
    setError(null)
    setResult(null)
    setSaved(null)

    try {
      const response = await fetch(`/api/dictionary?word=${encodeURIComponent(word)}`)
      const data = await response.json()
      if (!response.ok) setError(data?.error ?? 'Nothing found.')
      else setResult(data as DictionaryResult)
    } catch {
      setError('The lookup failed. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const save = () => {
    if (!result) return
    const primary = result.definitions[0]

    startTransition(async () => {
      const outcome = await addWord({
        word: result.word,
        partOfSpeech: primary.partOfSpeech,
        phonetic: result.phonetic,
        definition: primary.definition,
        example: primary.example,
        audioUrl: result.audioUrl,
        related: result.related.slice(0, 8),
        source: 'dictionary',
      })
      if (outcome?.error && !outcome.ok) setError(outcome.error)
      else setSaved(result.word)
    })
  }

  return (
    <div>
      <form onSubmit={search} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Look up a word — entrepreneurship, deadline, thrive…"
            className="pl-10"
            autoCapitalize="none"
            spellCheck={false}
            aria-label="Search the dictionary"
          />
        </div>
        <Button type="submit" loading={loading}>
          Search
        </Button>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-[0.8125rem] font-medium text-rose">
          {error}
        </p>
      )}

      {result && (
        <Card className="mt-5 animate-fade-up">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="display text-[1.75rem] leading-none text-ink">{result.word}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2.5">
                {result.phonetic && (
                  <span className="font-mono text-[0.8125rem] text-muted">{result.phonetic}</span>
                )}
                {result.audioUrl && (
                  <button
                    type="button"
                    onClick={() => void new Audio(result.audioUrl!).play()}
                    className="inline-flex items-center gap-1.5 rounded-pill border border-line px-2.5 py-1 text-[0.6875rem] font-semibold text-muted transition-colors hover:text-ink"
                  >
                    <Volume2 className="size-3" />
                    Listen
                  </button>
                )}
                <TranslateButton
                  word={result.word}
                  definition={result.definitions[0].definition}
                />
              </div>
            </div>

            <Button
              variant={saved === result.word ? 'secondary' : 'primary'}
              size="sm"
              onClick={save}
              loading={pending}
              disabled={saved === result.word}
            >
              {saved === result.word ? (
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

          <ol className="mt-5 space-y-4 border-t border-line pt-5">
            {result.definitions.map((definition, index) => (
              <li key={index} className="flex gap-3">
                <span className="mt-0.5 text-[0.6875rem] font-bold tabular-nums text-faint">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <Badge tone="accent" className="mb-1.5">
                    {definition.partOfSpeech}
                  </Badge>
                  <p className="text-[0.9375rem] leading-relaxed text-ink">
                    {definition.definition}
                  </p>
                  {definition.example && (
                    <p className="mt-1.5 border-l-2 border-line pl-3 text-[0.8125rem] italic leading-relaxed text-muted">
                      &ldquo;{definition.example}&rdquo;
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {result.related.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <p className="mb-2 text-[0.75rem] font-medium text-muted">
                Related words
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.related.map((word) => (
                  <button
                    key={word}
                    type="button"
                    onClick={() => {
                      setTerm(word)
                      setResult(null)
                    }}
                    className="rounded-pill border border-line px-2.5 py-1 text-[0.75rem] text-muted transition-colors hover:border-line-strong hover:text-ink"
                  >
                    {word}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {loading && (
        <div className="mt-5 space-y-3 rounded-card border border-line bg-surface p-5">
          <p className="flex items-center gap-2 text-[0.8125rem] text-muted">
            <Loader2 className="size-3.5 animate-spin" />
            Checking the dictionary…
          </p>
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      )}
    </div>
  )
}
