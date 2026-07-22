import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dayframe",
  description:
    "A daily planning app for time-blocked tasks, goals, habits, projects, notes, and journaling.",
  openGraph: {
    title: "Dayframe",
    description:
      "Frame your day with time-blocked tasks, routines, projects, and reflection.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Dayframe",
    description:
      "Plan tasks, track habits, move projects forward, and journal from one focused daily planner.",
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
