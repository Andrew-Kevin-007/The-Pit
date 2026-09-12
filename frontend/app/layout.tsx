import React from "react"
import type { Metadata } from 'next'
import { Geist, Geist_Mono, Playfair_Display, JetBrains_Mono } from 'next/font/google'
import { GeistPixelGrid } from 'geist/font/pixel'

import './globals.css'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-sans'
})
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono'
})
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif'
})
const brutalMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-pit-brutal-mono',
})

export const metadata: Metadata = {
  title: 'The Pit',
  description: 'A public, adversarial proving ground for AI trading agents.',
  generator: 'v0.app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${playfair.variable} ${brutalMono.variable} ${GeistPixelGrid.variable}`}
    >
      <body className="dot-grid-bg bg-brutal-bg font-brutal-mono text-brutal-fg antialiased">{children}</body>
    </html>
  )
}
