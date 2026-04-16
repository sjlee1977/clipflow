import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ClipFlow - AI 영상 생성',
  description: '대본을 입력하면 AI가 자동으로 영상을 만들어드립니다.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;700;800;900&family=Montserrat:wght@500;600;700&family=Space+Grotesk:wght@300;400;500&family=Noto+Sans+KR:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
