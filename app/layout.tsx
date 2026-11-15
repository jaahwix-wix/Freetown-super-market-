import type { Metadata } from 'next';
import { Bricolage_Grotesque, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Freetown Supermarket — Fresh Groceries, Secure Checkout & Live Inventory',
  description:
    'Shop fresh produce, Sierra Leone pantry staples, bakery, dairy, and chilled beverages from Freetown Supermarket with real-time stock tracking, secure payments, and automated order email notifications.',
  openGraph: {
    title: 'Freetown Supermarket — Fresh Groceries & Live Inventory',
    description:
      'Shop fresh produce, pantry staples, bakery, and chilled beverages in Freetown with real-time stock updates and instant email order receipts.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Freetown Supermarket',
    description: 'Fresh groceries, secure payment gateway, and live inventory in Freetown.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${jakarta.variable} ${jetbrainsMono.variable}`}
    >
      <body
        suppressHydrationWarning
        className="min-h-screen bg-[#F8F9F8] text-[#141715] font-sans antialiased selection:bg-[#156145]/15 selection:text-[#156145]"
      >
        {children}
      </body>
    </html>
  );
}
