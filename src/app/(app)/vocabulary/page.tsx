import type { Metadata } from 'next'
import { desc, eq } from 'drizzle-orm'

import { PageHeader, PageShell } from '@/components/shell/page-header'
import { WordList } from '@/components/vocabulary/word-list'
import { WordSearch } from '@/components/vocabulary/word-search'
import { SectionTitle } from '@/components/ui/card'
import { requireUser, requireWorkspace } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { vocabulary } from '@/lib/db/schema'

export const metadata: Metadata = { title: 'Vocabulário' }

export default async function VocabularyPage() {
  const user = await requireUser()
  const workspace = await requireWorkspace(user.id)

  const words = await db
    .select()
    .from(vocabulary)
    .where(eq(vocabulary.workspaceId, workspace.id))
    .orderBy(desc(vocabulary.createdAt))

  return (
    <PageShell>
      <PageHeader
        eyebrow="Vocabulário"
        title="Palavras que você domina"
        description="Busque uma palavra num dicionário de verdade, salve, e o professor vai começar a encaixá-la nas suas conversas."
      />

      <div className="mt-8">
        <WordSearch />
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <SectionTitle>Meu vocabulário</SectionTitle>
          <span className="text-[0.8125rem] text-muted">
            {words.length} {words.length === 1 ? 'palavra' : 'palavras'}
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
