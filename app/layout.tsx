import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "하루 시작",
  description: "할 일, 목표, 습관, 프로젝트, 노트와 저널을 한 곳에서 정리하는 아침 생산성 앱.",
  openGraph: {
    title: "하루 시작",
    description:
      "아침 루틴을 정리하고 오늘의 실행력을 높이는 개인 생산성 대시보드.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "하루 시작",
    description: "오늘의 할 일, 목표, 습관, 프로젝트, 저널을 한 화면에서 정리하세요.",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
