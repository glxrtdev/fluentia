import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, AudioLines, BrainCircuit, LineChart, ListChecks, Mic } from 'lucide-react'

import { Logo } from '@/components/brand/logo'
import { ButtonLink } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/session'

const steps = [
  {
    icon: Mic,
    title: 'Você fala',
    body: 'Segure o microfone e responda como responderia a um professor de verdade. Sem roteiro, sem múltipla escolha.',
  },
  {
    icon: AudioLines,
    title: 'O professor responde',
    body: 'Sua fala é transcrita, entendida no contexto e respondida em voz alta, com voz natural.',
  },
  {
    icon: ListChecks,
    title: 'As correções aparecem ao lado',
    body: 'Só os erros que importam, mostrados em silêncio no painel — a conversa não para nunca.',
  },
  {
    icon: LineChart,
    title: 'Seu perfil evolui',
    body: 'Cada sessão atualiza seu nível, seus erros recorrentes e o foco da próxima conversa.',
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
            Entrar
          </Link>
          <ButtonLink href="/signup" size="sm">
            Começar a falar
          </ButtonLink>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 sm:px-8">
        {/* Hero */}
        <section className="grid items-center gap-14 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-pill border border-line bg-surface px-3 py-1.5 text-[0.75rem] font-medium text-muted">
              <span className="size-1.5 rounded-full bg-brand-500" />
              Por voz, em dez idiomas
            </span>

            <h1 className="display mt-6 text-[2.75rem] leading-[1.04] text-ink sm:text-6xl lg:text-[4.1rem]">
              Pare de estudar um idioma.
              <br />
              <span className="text-brand-600 dark:text-brand-400">Comece a falar.</span>
            </h1>

            <p className="mt-6 max-w-xl text-[1.0625rem] leading-relaxed text-ink-soft">
              A Fluentia é uma professora particular de idiomas com quem você fala em voz alta —
              inglês, espanhol, francês, japonês e mais seis. Ela pergunta, escuta, responde falando
              e anota em silêncio os erros que valem a pena corrigir, para a conversa seguir fluindo
              enquanto você melhora de verdade.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <ButtonLink href="/signup" size="lg">
                Ter minha primeira conversa
                <ArrowRight className="size-4" />
              </ButtonLink>
              <span className="text-[0.8125rem] text-muted">
                Use sua própria chave da OpenAI · sem créditos, sem assinatura
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
                <p className="text-sm font-semibold text-ink">Entrevista de emprego</p>
                <p className="text-xs text-muted">Intermediário avançado · 04:12</p>
              </div>
            </div>

            <div className="space-y-4 py-5 text-[0.9375rem] leading-relaxed">
              <div>
                <p className="mb-1 text-[0.75rem] font-medium text-muted">
                  Professor
                </p>
                <p className="text-ink">Tell me about your current job.</p>
              </div>
              <div>
                <p className="mb-1 text-[0.75rem] font-medium text-muted">
                  Você
                </p>
                <p className="text-ink-soft">
                  I work in this company since 2025 and I treat data every day.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-line bg-surface-2 p-4">
              <p className="mb-3 text-[0.75rem] font-medium text-muted">
                Correções
              </p>
              <div className="space-y-3 text-sm">
                <p>
                  <span className="text-rose line-through decoration-rose/40">I work in</span>
                  <span className="mx-1.5 text-faint">→</span>
                  <span className="font-semibold text-brand-600 dark:text-brand-400">
                    I&rsquo;ve worked at
                  </span>
                </p>
                <p>
                  <span className="text-rose line-through decoration-rose/40">treat data</span>
                  <span className="mx-1.5 text-faint">→</span>
                  <span className="font-semibold text-brand-600 dark:text-brand-400">
                    analyse data
                  </span>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-line py-16 sm:py-20">
          <h2 className="display text-3xl text-ink sm:text-4xl">Um ciclo, bem feito</h2>
          <p className="mt-3 max-w-2xl text-[0.9375rem] leading-relaxed text-muted">
            Todo o resto da Fluentia existe para deixar esse ciclo melhor na próxima vez que você abrir.
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
                Ela lembra de como <span className="italic">você</span> fala
              </h2>
              <p className="mt-4 max-w-lg text-[0.9375rem] leading-relaxed text-muted">
                As correções não são jogadas fora quando a conversa acaba. Elas viram um perfil:
                erros recorrentes com a contagem real, o vocabulário que você salvou, os níveis que
                você deu conta. A sua próxima conversa é montada a partir disso.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: BrainCircuit,
                  title: 'Perfil de aprendizado',
                  body: 'Nível CEFR estimado, pontos fortes e fracos, atualizados depois de cada relatório.',
                },
                {
                  icon: ListChecks,
                  title: 'Meus erros',
                  body: '"depend of → depend on · 5 vezes", agrupados por gramática, preposições e naturalidade.',
                },
                {
                  icon: AudioLines,
                  title: 'Relatórios de sessão',
                  body: 'Notas de fala, gramática, vocabulário e fluência, com as expressões que você usou.',
                },
                {
                  icon: LineChart,
                  title: 'Sequência e metas',
                  body: 'Metas semanais de minutos, sessões, palavras novas e erros revisados.',
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
          <div className="edge-glow overflow-hidden rounded-card bg-pitch px-6 py-16 text-center sm:px-12">
            <h2 className="display text-3xl text-on-pitch sm:text-[2.5rem]">
              Sua primeira conversa está a um clique
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[0.9375rem] leading-relaxed text-white/60">
              Crie uma conta, cole sua chave da OpenAI, escolha um tema e comece a falar. Nada é
              simulado — você fala, ela escuta.
            </p>
            <ButtonLink
              href="/signup"
              size="lg"
              className="mt-9"
            >
              Criar minha conta
              <ArrowRight className="size-4" />
            </ButtonLink>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-line px-5 py-8 text-[0.8125rem] text-muted sm:flex-row sm:px-8">
        <Logo showWordmark={false} />
        <p>Fluentia · prática de idiomas por voz</p>
        <Link href="/login" className="transition-colors hover:text-ink">
          Entrar
        </Link>
      </footer>
    </div>
  )
}
