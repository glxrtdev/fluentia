import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { NewWorkspaceForm } from '@/components/workspaces/new-workspace-form'
import { requireUser } from '@/lib/auth/session'
import { listWorkspaces, MAX_WORKSPACES } from '@/lib/domain/workspace'
import { LANGUAGES } from '@/lib/languages'

export const metadata: Metadata = { title: 'Add a language' }

export default async function NewWorkspacePage() {
  const user = await requireUser()
  const existing = await listWorkspaces(user.id)

  // The cap is also enforced in the domain layer; this just avoids offering a
  // form that could only be refused.
  if (existing.length >= MAX_WORKSPACES) redirect('/settings')

  const taken = new Set(existing.map((workspace) => workspace.language))
  const options = LANGUAGES.filter((language) => !taken.has(language.code)).map((language) => ({
    code: language.code,
    name: language.name.pt,
    nativeName: language.nativeName,
    badge: language.badge,
    distance: language.distance,
  }))

  return (
    <NewWorkspaceForm
      options={options}
      remaining={MAX_WORKSPACES - existing.length}
      max={MAX_WORKSPACES}
    />
  )
}
