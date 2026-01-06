"""
StockLens - News Sentiment Client
Fetches news and calculates sentiment for assets using Marketaux API
"""
import os
import requests
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from dotenv import load_dotenv
from loguru import logger

load_dotenv()


class SentimentClient:
    """Client for fetching news sentiment from Marketaux API"""
    
    def __init__(self):
        self.api_key = os.getenv("MARKETAUX_API_KEY")
        self.base_url = "https://api.marketaux.com/v1/news/all"
        
        if not self.api_key:
            logger.warning("⚠️ MARKETAUX_API_KEY not set - sentiment analysis disabled")
    
    def get_sentiment(self, symbol: str, days: int = 3) -> Optional[Dict]:
        """
        Get news sentiment for a symbol
        
        Returns:
            {
                "sentiment_score": float (-1 to 1),
                "sentiment_label": str (POSITIVE/NEGATIVE/NEUTRAL),
                "news_count": int,
                "headlines": list
            }
        """
        if not self.api_key:
            return None
        
        try:
            # Map symbol to search terms
            search_terms = self._get_search_terms(symbol)
            
            # Calculate date range
            date_from = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
            
            params = {
                "api_token": self.api_key,
                "symbols": search_terms.get("symbols", ""),
                "search": search_terms.get("search", ""),
                "filter_entities": "true",
                "language": "en",
                "published_after": date_from,
                "limit": 10,
            }
            
            # Remove empty params
            params = {k: v for k, v in params.items() if v}
            
            response = requests.get(self.base_url, params=params, timeout=10)
            
            if response.status_code != 200:
                logger.warning(f"Marketaux API error: {response.status_code}")
                return None
            
            data = response.json()
            articles = data.get("data", [])
            
            if not articles:
                return {
                    "sentiment_score": 0,
                    "sentiment_label": "NEUTRAL",
                    "news_count": 0,
                    "headlines": [],
                }
            
            # Calculate average sentiment from articles
            sentiments = []
            headlines = []
            
            for article in articles[:10]:  # Max 10 articles
                # Marketaux provides sentiment in entities
                entities = article.get("entities", [])
                for entity in entities:
                    if entity.get("sentiment_score") is not None:
                        sentiments.append(entity["sentiment_score"])
                
                headlines.append({
                    "title": article.get("title", ""),
                    "source": article.get("source", ""),
                    "published": article.get("published_at", ""),
                })
            
            # Calculate average sentiment
            if sentiments:
                avg_sentiment = sum(sentiments) / len(sentiments)
            else:
                # If no entity sentiment, use a neutral default
                avg_sentiment = 0
            
            # Determine label
            if avg_sentiment > 0.15:
                label = "POSITIVE"
            elif avg_sentiment < -0.15:
                label = "NEGATIVE"
            else:
                label = "NEUTRAL"
            
            return {
                "sentiment_score": round(avg_sentiment, 3),
                "sentiment_label": label,
                "news_count": len(articles),
                "headlines": headlines[:5],  # Top 5 headlines
            }
            
        except Exception as e:
            logger.error(f"Sentiment fetch error for {symbol}: {e}")
            return None
    
    def _get_search_terms(self, symbol: str) -> Dict[str, str]:
        """Map symbol to Marketaux search terms"""
        
        # Stock symbols can be searched directly
        stock_symbols = ["AAPL", "TSLA", "NVDA", "MSFT", "GOOGL", "AMZN", "META"]
        
        if symbol in stock_symbols:
            return {"symbols": symbol}
        
        # Forex/Commodities need search terms
        search_map = {
            "XAUUSD": {"search": "gold price"},
            "EURUSD": {"search": "EUR USD euro dollar forex"},
            "GBPUSD": {"search": "GBP USD pound dollar forex"},
            "USDJPY": {"search": "USD JPY dollar yen forex"},
            "BTCUSD": {"search": "bitcoin BTC"},
            "ETHUSD": {"search": "ethereum ETH"},
        }
        
        return search_map.get(symbol, {"search": symbol})


# Test
if __name__ == "__main__":
    client = SentimentClient()
    
    test_symbols = ["AAPL", "TSLA", "XAUUSD", "EURUSD"]
    
    for symbol in test_symbols:
        print(f"\n{'='*50}")
        print(f"Testing {symbol}...")
        result = client.get_sentiment(symbol)
        
        if result:
            print(f"  Sentiment: {result['sentiment_score']:.3f} ({result['sentiment_label']})")
            print(f"  News Count: {result['news_count']}")
            if result['headlines']:
                print(f"  Latest: {result['headlines'][0]['title'][:60]}...")
        else:
            print(f"  No data available")
