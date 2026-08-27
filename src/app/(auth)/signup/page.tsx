import type { Metadata } from 'next'

import { AuthForm } from '@/components/auth/auth-form'
import { signUp } from '@/lib/auth/actions'

export const metadata: Metadata = { title: 'Criar conta' }

export default function SignupPage() {
  return <AuthForm mode="signup" action={signUp} />
}
