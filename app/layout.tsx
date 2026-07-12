import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'plango AI — Family Grocery OS',
  description: 'Multi-agent conversational family grocery planning for Sri Lanka',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
