import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dayframe",
  description:
    "A morning productivity dashboard for tasks, goals, habits, projects, notes, and journaling.",
  openGraph: {
    title: "Dayframe",
    description:
      "Frame your day with a focused morning dashboard for planning, routines, and reflection.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Dayframe",
    description:
      "Plan tasks, track habits, move projects forward, and journal from one focused dashboard.",
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
