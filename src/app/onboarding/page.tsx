import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { OnboardingFlow } from '@/components/onboarding/onboarding-flow'
import { getProfile, requireUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Set up your profile' }

export default async function OnboardingPage() {
  const user = await requireUser()
  const profile = await getProfile(user.id)

  if (profile.onboardedAt) redirect('/dashboard')

  return <OnboardingFlow name={user.name} />
}
