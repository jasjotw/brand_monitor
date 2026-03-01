import React from "react"
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'CogNerd - AEO/SEO Visibility Dashboard',
  description: 'Monitor your brand visibility across AI engines. Track mentions, citations, and sentiment across ChatGPT, Gemini, Perplexity, and more.',
}

export const viewport: Viewport = {
  themeColor: '#FFF8F0',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
