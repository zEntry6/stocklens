"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, Menu, X, Star, TrendingUp } from "lucide-react";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Activity className="h-8 w-8 text-accent" />
            <span className="text-xl font-bold text-text-primary">StockLens</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link 
              href="/" 
              className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              <TrendingUp className="h-4 w-4" />
              Screener
            </Link>
            <Link 
              href="/watchlist" 
              className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              <Star className="h-4 w-4" />
              Watchlist
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-text-secondary hover:text-text-primary"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col gap-4">
              <Link 
                href="/" 
                className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                <TrendingUp className="h-4 w-4" />
                Screener
              </Link>
              <Link 
                href="/watchlist" 
                className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Star className="h-4 w-4" />
                Watchlist
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
