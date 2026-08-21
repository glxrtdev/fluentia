import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, AudioLines, BrainCircuit, LineChart, ListChecks, Mic } from 'lucide-react'

import { Logo } from '@/components/brand/logo'
import { ButtonLink } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/session'

const steps = [
  {
    icon: Mic,
    title: 'You speak',
    body: 'Hold the mic and answer like you would with a real teacher. No scripts, no multiple choice.',
  },
  {
    icon: AudioLines,
    title: 'The teacher answers',
    body: 'Your speech is transcribed, understood in context, and answered out loud in a natural voice.',
  },
  {
    icon: ListChecks,
    title: 'Corrections appear beside you',
    body: 'Only the mistakes that matter, shown silently in the feedback panel — the conversation never stops.',
  },
  {
    icon: LineChart,
    title: 'Your profile evolves',
    body: 'Every session updates your level, your recurring mistakes and what the next conversation focuses on.',
  },
]

export default async function LandingPage() {
  if (await getCurrentUser()) redirect('/dashboard')

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-3">
          <Link
            href="/login"
            className="rounded-pill px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            Log in
          </Link>
          <ButtonLink href="/signup" size="sm">
            Start speaking
          </ButtonLink>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 sm:px-8">
        {/* Hero */}
        <section className="grid items-center gap-14 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-pill border border-line bg-surface px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted">
              <span className="size-1.5 rounded-full bg-brand-500" />
              Voice-first English
            </span>

            <h1 className="display mt-6 text-[2.75rem] leading-[1.04] text-ink sm:text-6xl lg:text-[4.1rem]">
              Stop studying English.
              <br />
              <span className="text-brand-600 dark:text-brand-400">Start talking.</span>
            </h1>

            <p className="mt-6 max-w-xl text-[1.0625rem] leading-relaxed text-ink-soft">
              Fluentia is a private English teacher you talk to out loud. It asks, listens, answers
              in voice, and quietly writes down the mistakes worth fixing — so the conversation keeps
              flowing while you actually improve.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <ButtonLink href="/signup" size="lg">
                Have your first conversation
                <ArrowRight className="size-4" />
              </ButtonLink>
              <span className="text-[0.8125rem] text-muted">
                Bring your own OpenAI key · no credits, no subscription
              </span>
            </div>
          </div>

          {/* A real slice of the conversation UI, so the promise is legible at a glance. */}
          <div className="animate-fade-up rounded-card border border-line bg-surface p-4 shadow-[var(--shadow-lift)] sm:p-6">
            <div className="flex items-center gap-3 border-b border-line pb-4">
              <span className="relative flex size-9 items-center justify-center rounded-full bg-brand-500/12">
                <span className="absolute inset-0 rounded-full bg-brand-500/20 animate-halo" />
                <AudioLines className="size-4 text-brand-600 dark:text-brand-400" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">Job interview</p>
                <p className="text-xs text-muted">Upper intermediate · 04:12</p>
              </div>
            </div>

            <div className="space-y-4 py-5 text-[0.9375rem] leading-relaxed">
              <div>
                <p className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-faint">
                  Teacher
                </p>
                <p className="text-ink">Tell me about your current job.</p>
              </div>
              <div>
                <p className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-faint">
                  You
                </p>
                <p className="text-ink-soft">
                  I work in this company since 2025 and I treat data every day.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-line bg-surface-2 p-4">
              <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-faint">
                Feedback
              </p>
              <div className="space-y-3 text-sm">
                <p>
                  <span className="text-rose line-through decoration-rose/40">I work in</span>
                  <span className="mx-1.5 text-faint">→</span>
                  <span className="font-semibold text-brand-700 dark:text-brand-300">
                    I&rsquo;ve worked at
                  </span>
                </p>
                <p>
                  <span className="text-rose line-through decoration-rose/40">treat data</span>
                  <span className="mx-1.5 text-faint">→</span>
                  <span className="font-semibold text-brand-700 dark:text-brand-300">
                    analyse data
                  </span>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-line py-16 sm:py-20">
          <h2 className="display text-3xl text-ink sm:text-4xl">One loop, done well</h2>
          <p className="mt-3 max-w-2xl text-[0.9375rem] leading-relaxed text-muted">
            Everything else in Fluentia exists to make this loop better the next time you open it.
          </p>

          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <li
                key={step.title}
                className="rounded-card border border-line bg-surface p-5 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                    <step.icon className="size-4" />
                  </span>
                  <span className="display text-2xl text-line-strong">0{i + 1}</span>
                </div>
                <h3 className="mt-4 text-[0.9375rem] font-semibold text-ink">{step.title}</h3>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Learning system */}
        <section className="border-t border-line py-16 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h2 className="display text-3xl text-ink sm:text-4xl">
                It remembers how <span className="italic">you</span> speak
              </h2>
              <p className="mt-4 max-w-lg text-[0.9375rem] leading-relaxed text-muted">
                Corrections are not thrown away when the call ends. They become a profile: recurring
                mistakes with real counts, the vocabulary you saved, the levels you handled well.
                Your next conversation is built from that.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: BrainCircuit,
                  title: 'Personal learning profile',
                  body: 'Estimated CEFR level, strengths and weak spots, updated after each report.',
                },
                {
                  icon: ListChecks,
                  title: 'My mistakes',
                  body: '"depend of → depend on · 5 times", grouped by grammar, prepositions, naturalness.',
                },
                {
                  icon: AudioLines,
                  title: 'Session reports',
                  body: 'Speaking, grammar, vocabulary and fluency scores with the expressions you used.',
                },
                {
                  icon: LineChart,
                  title: 'Streaks and goals',
                  body: 'Weekly targets in minutes, sessions, new words and mistakes reviewed.',
                },
              ].map((f) => (
                <div key={f.title} className="rounded-card border border-line bg-surface p-5">
                  <f.icon className="size-4 text-brand-600 dark:text-brand-400" />
                  <h3 className="mt-3 text-sm font-semibold text-ink">{f.title}</h3>
                  <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-line py-16 sm:py-24">
          <div className="grain overflow-hidden rounded-card border border-line bg-linear-to-br from-brand-600 to-brand-800 px-6 py-14 text-center sm:px-12">
            <h2 className="display text-3xl text-white sm:text-[2.75rem]">
              Your first conversation is one click away
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[0.9375rem] leading-relaxed text-brand-100">
              Create an account, paste your own OpenAI key, pick a topic and start talking. Nothing
              is simulated — you speak, it listens.
            </p>
            <ButtonLink
              href="/signup"
              size="lg"
              className="mt-8 bg-white text-brand-800 hover:bg-brand-50 dark:bg-white dark:text-brand-800"
            >
              Create my account
              <ArrowRight className="size-4" />
            </ButtonLink>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-line px-5 py-8 text-[0.8125rem] text-muted sm:flex-row sm:px-8">
        <Logo showWordmark={false} />
        <p>Fluentia · voice-first English practice</p>
        <Link href="/login" className="transition-colors hover:text-ink">
          Log in
        </Link>
      </footer>
    </div>
  )
}
