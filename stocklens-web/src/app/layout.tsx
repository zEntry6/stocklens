import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "StockLens - Global Forex & US Stock Predictions",
  description: "AI-powered Forex, Commodities (Gold, Silver) and US Stock predictions combining Technical Analysis (RSI, MACD) and Sentiment Analysis for smarter trading decisions.",
  keywords: ["forex", "gold", "XAUUSD", "US stocks", "prediction", "trading", "analysis", "NVDA", "TSLA", "AAPL"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Google Fonts - Inter & JetBrains Mono */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className="bg-background text-text-primary min-h-screen">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
