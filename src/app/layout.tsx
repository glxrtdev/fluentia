import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { cookies } from 'next/headers'

import './globals.css'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Fluentia — Speak a new language with an AI teacher',
    template: '%s · Fluentia',
  },
  description:
    'Fluentia is a voice-first language tutor for ten languages. Have real conversations, get corrections as you speak, and watch your own learning profile evolve.',
  applicationName: 'Fluentia',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fcfcfd' },
    { media: '(prefers-color-scheme: dark)', color: '#08090a' },
  ],
  width: 'device-width',
  initialScale: 1,
  /*
   * Fixed scale: Fluentia is used as an app, and pinch-zoom on a voice screen
   * mostly happens by accident. iOS Safari has ignored user-scalable since iOS
   * 10, so the zoom that actually bites — Safari enlarging the page when you
   * focus an input under 16px — is prevented by the input sizes instead.
   */
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
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
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body data-theme={theme}>{children}</body>
    </html>
  )
}
