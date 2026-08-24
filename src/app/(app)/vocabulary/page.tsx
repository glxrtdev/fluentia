import type { Metadata } from 'next'
import { desc, eq } from 'drizzle-orm'

import { PageHeader, PageShell } from '@/components/shell/page-header'
import { WordList } from '@/components/vocabulary/word-list'
import { WordSearch } from '@/components/vocabulary/word-search'
import { SectionTitle } from '@/components/ui/card'
import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { vocabulary } from '@/lib/db/schema'

export const metadata: Metadata = { title: 'Vocabulary' }

export default async function VocabularyPage() {
  const user = await requireUser()

  const words = await db
    .select()
    .from(vocabulary)
    .where(eq(vocabulary.userId, user.id))
    .orderBy(desc(vocabulary.createdAt))

  return (
    <PageShell>
      <PageHeader
        eyebrow="Vocabulary"
        title="Words you own"
        description="Look a word up in a real dictionary, save it, and the teacher will start slipping it into your conversations."
      />

      <div className="mt-8">
        <WordSearch />
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <SectionTitle>My vocabulary</SectionTitle>
          <span className="text-[0.8125rem] text-muted">
            {words.length} {words.length === 1 ? 'word' : 'words'}
          </span>
        </div>

        <WordList
          words={words.map((word) => ({
            id: word.id,
            word: word.word,
            partOfSpeech: word.partOfSpeech,
            phonetic: word.phonetic,
            definition: word.definition,
            example: word.example,
            audioUrl: word.audioUrl,
            translation: word.translation,
            status: word.status,
            createdAt: word.createdAt,
          }))}
        />
      </section>
    </PageShell>
  )
}
