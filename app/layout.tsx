import type { Metadata } from "next";
import AppHeader from "./AppHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Cut Arena",
  description: "AI role-driven candidate assessment MVP"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <main className="shell">
          <AppHeader />
          {children}
        </main>
      </body>
    </html>
  );
}
