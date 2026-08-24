import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'

import lockup from '@/assets/logo-lockup.webp'
import { Logo, LogoMark } from '@/components/brand/logo'
import { getCurrentUser } from '@/lib/auth/session'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect('/dashboard')

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      {/*
        Brand panel — hidden on mobile so the form owns the screen. The lockup
        carries its own dark background, which is exactly why it lives here and
        not on the light surfaces.
      */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-pitch p-10 lg:flex">
        <Link href="/" aria-label="Fluentia home" className="w-fit rounded-lg">
          <LogoMark />
        </Link>

        <div className="max-w-md">
          <Image
            src={lockup}
            alt="Fluentia"
            priority
            sizes="(min-width: 1024px) 22rem, 0px"
            className="mb-8 w-[22rem] max-w-full"
          />
          <p className="display text-[1.75rem] leading-[1.2] text-on-pitch">
            The fastest way to speak English is to speak English.
          </p>
          <p className="mt-5 text-[0.875rem] leading-relaxed text-white/55">
            Fluentia gives you somewhere to do that every day — with a teacher that listens,
            answers out loud, and remembers what you keep getting wrong.
          </p>
        </div>

        <p className="text-xs text-white/40">
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
