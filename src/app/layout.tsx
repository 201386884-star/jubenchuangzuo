import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "词元剧本 - AI短剧剧本生成",
  description: "一句话生成AI短剧剧本，支持多种AI模型，让创作更简单",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <Sidebar />
        <main className="ml-56 min-h-screen flex flex-col">
          <div className="flex-1">
            {children}
          </div>
          <footer className="border-t border-gray-200 py-4 px-6 text-center">
            <p className="text-xs text-gray-400">&copy; {new Date().getFullYear()} 周口词元动漫科技有限公司 · 版权所有</p>
          </footer>
        </main>
      </body>
    </html>
  );
}
