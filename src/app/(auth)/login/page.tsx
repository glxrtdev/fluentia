import type { Metadata } from 'next'

import { AuthForm } from '@/components/auth/auth-form'
import { signIn } from '@/lib/auth/actions'

export const metadata: Metadata = { title: 'Entrar' }

export default function LoginPage() {
  return <AuthForm mode="login" action={signIn} />
}
