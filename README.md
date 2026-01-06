# StockLens

AI-powered Forex, Commodities & US Stock prediction platform for Global Markets.

**STRICT RULE: Global Markets Only**
- ❌ NO Indonesian assets (IDX, .JK, IDR pairs)
- ✅ ALLOWED: Commodities (XAUUSD, XAGUSD), Forex (EURUSD, GBPUSD, USDJPY), US Stocks (AAPL, TSLA, NVDA, MSFT, GOOGL)

## Project Structure

```
/stocklens
├── stocklens-web/     # Next.js 14 Frontend
├── stocklens-engine/  # Python Backend Engine
└── info.txt           # Secrets (DO NOT COMMIT)
```

## Features

- 📈 Technical Analysis (RSI, MACD, SMA)
- 📰 Sentiment Analysis (English news-based)
- 🎯 Buy/Sell/Hold recommendations with confidence scores
- 💎 Freemium model (Free vs Premium IDR 25k via Midtrans)

## Supported Assets

| Type | Symbols |
|------|---------|
| Commodities | XAUUSD (Gold), XAGUSD (Silver) |
| Forex | EURUSD, GBPUSD, USDJPY |
| US Stocks | AAPL, TSLA, NVDA, MSFT, GOOGL |

## Tech Stack

- **Frontend:** Next.js 14, Tailwind CSS, TradingView Lightweight Charts
- **Backend:** Python (pandas, vaderSentiment), Supabase
- **APIs:** AlphaVantage (prices), Marketaux (news)

## Setup

### 1. Web Application

```bash
cd stocklens-web
npm install
npm run dev
```

### 2. Python Engine

```bash
cd stocklens-engine
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
python config.py  # Test configuration
```

## Environment Variables

Copy the `.env.example` files and fill in your credentials:

- `stocklens-web/.env.local`
- `stocklens-engine/.env`

## Deployment

- **Web:** Vercel
- **Engine:** Railway

## License

Private - All rights reserved.
