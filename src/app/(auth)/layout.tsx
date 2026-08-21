import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Quote } from 'lucide-react'

import { Logo } from '@/components/brand/logo'
import { getCurrentUser } from '@/lib/auth/session'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect('/dashboard')

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      {/* Brand panel — hidden on mobile so the form owns the screen. */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-linear-to-br from-brand-700 to-brand-900 p-10 lg:flex">
        <Logo href="/" className="[&_span:last-child]:text-white" />

        <div className="max-w-md">
          <Quote className="size-6 text-brand-300" />
          <p className="display mt-5 text-[2rem] leading-[1.15] text-white">
            The fastest way to speak English is to speak English.
          </p>
          <p className="mt-5 text-sm leading-relaxed text-brand-100">
            Fluentia gives you somewhere to do that every day — with a teacher that listens,
            answers out loud, and remembers what you keep getting wrong.
          </p>
        </div>

        <p className="text-xs text-brand-200">
          Bring your own OpenAI key · your conversations stay in your own database
        </p>
      </aside>

      <main className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between lg:hidden">
          <Logo href="/" />
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm animate-fade-up">{children}</div>
        </div>

        <p className="text-center text-xs text-faint">
          <Link href="/" className="transition-colors hover:text-muted">
            Back to home
          </Link>
        </p>
      </main>
    </div>
  )
}
