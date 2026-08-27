'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { userSettings } from '@/lib/db/schema'
import {
  createWorkspace,
  deleteWorkspace,
  switchWorkspace,
  WorkspaceError,
} from '@/lib/domain/workspace'
import { workspaceSchema } from '@/lib/validation'

export type WorkspaceState = { error?: string } | undefined

/*
 * Switching languages changes what almost every page shows, so the whole app
 * is revalidated rather than a hand-kept list of routes that would drift.
 */
const revalidateEverything = () => revalidatePath('/', 'layout')

export async function switchToWorkspace(workspaceId: string): Promise<void> {
  const user = await requireUser()
  try {
    await switchWorkspace(user.id, workspaceId)
  } catch (error) {
    if (error instanceof WorkspaceError) return
    throw error
  }
  revalidateEverything()
  redirect('/dashboard')
}

export async function addWorkspace(
  _prev: WorkspaceState,
  formData: FormData,
): Promise<WorkspaceState> {
  const user = await requireUser()

  const parsed = workspaceSchema.safeParse({ language: formData.get('language') })
  if (!parsed.success) return { error: 'Escolha um idioma para praticar.' }

  try {
    await createWorkspace(user.id, parsed.data.language)
  } catch (error) {
    if (error instanceof WorkspaceError) return { error: error.message }
    throw error
  }

  revalidateEverything()
  redirect('/dashboard')
}

export async function removeWorkspace(workspaceId: string): Promise<WorkspaceState> {
  const user = await requireUser()
  try {
    await deleteWorkspace(user.id, workspaceId)
  } catch (error) {
    if (error instanceof WorkspaceError) return { error: error.message }
    throw error
  }
  revalidateEverything()
  redirect('/dashboard')
}
