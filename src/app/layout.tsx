import type { Metadata, Viewport } from 'next'
import { Instrument_Serif, Inter } from 'next/font/google'
import { cookies } from 'next/headers'

import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const display = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Fluentia — Speak English with an AI teacher',
    template: '%s · Fluentia',
  },
  description:
    'Fluentia is a voice-first English tutor. Have real conversations, get corrections as you speak, and watch your own learning profile evolve.',
  applicationName: 'Fluentia',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfaf8' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0c0e' },
  ],
  width: 'device-width',
  initialScale: 1,
}

/** Applied before paint so the theme never flashes. */
const themeScript = `(function(){try{
var t=document.cookie.match(/(?:^|; )fluentia_theme=([^;]+)/);
t=t?decodeURIComponent(t[1]):'system';
var dark=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.classList.toggle('dark',dark);
}catch(e){}})();`

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get('fluentia_theme')?.value ?? 'system'

  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body data-theme={theme}>{children}</body>
    </html>
  )
}
