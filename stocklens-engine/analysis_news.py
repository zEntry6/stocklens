"""
StockLens Engine - News Sentiment Analysis Module
Fetches news from Marketaux and calculates sentiment scores

STRICT RULE: Global Markets Only
- NO Indonesian assets (IDX, .JK, IDR pairs)  
- ALLOWED: Forex, Commodities (XAU/XAG), US Stocks
- Language: English only (language=en)
"""
import requests
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from enum import Enum
from datetime import datetime, timezone, timedelta
import time
import backoff
from loguru import logger

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from config import Config
from database import db


class SentimentLabel(Enum):
    """Sentiment classification labels"""
    POSITIVE = "POSITIVE"
    NEUTRAL = "NEUTRAL"
    NEGATIVE = "NEGATIVE"


@dataclass
class NewsArticle:
    """Represents a single news article"""
    title: str
    description: str
    source: str
    published_at: datetime
    url: str
    sentiment_score: float  # -1 to 1
    relevance_score: float  # 0 to 1


@dataclass
class SentimentResult:
    """Result of sentiment analysis"""
    symbol: str
    sentiment_score: float  # -1 to 1 (aggregated)
    sentiment_label: SentimentLabel
    news_count: int
    articles: List[NewsArticle]
    confidence: float  # 0-100
    last_news_date: Optional[datetime]
    error: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for database storage"""
        return {
            'sentiment_score': self.sentiment_score,
            'sentiment_label': self.sentiment_label.value,
            'news_count': self.news_count,
        }


class MarketauxClient:
    """
    Client for Marketaux News API
    
    IMPORTANT: Free tier has 100 requests/month limit!
    We implement aggressive caching to stay within quota.
    """
    
    BASE_URL = "https://api.marketaux.com/v1/news/all"
    
    # Monthly quota management
    MONTHLY_QUOTA = 100
    CACHE_HOURS = 24  # Only fetch news if cache is older than 24 hours
    
    def __init__(self):
        self.api_key = Config.MARKETAUX_API_KEY
        if not self.api_key:
            raise ValueError("MARKETAUX_API_KEY not configured")
        self._request_count = 0
        logger.info("✓ Marketaux client initialized")
        logger.warning(f"⚠ Marketaux quota: {self.MONTHLY_QUOTA} requests/month")
    
    def _check_quota(self) -> bool:
        """Check if we're within monthly quota"""
        # In production, you'd track this in database
        if self._request_count >= self.MONTHLY_QUOTA:
            logger.error("Marketaux monthly quota exceeded!")
            return False
        return True
    
    @backoff.on_exception(
        backoff.expo,
        (requests.exceptions.RequestException, requests.exceptions.Timeout),
        max_tries=2,  # Fewer retries to save quota
        max_time=30
    )
    def _make_request(self, params: Dict[str, str]) -> Optional[Dict]:
        """Make API request with error handling"""
        if not self._check_quota():
            return None
        
        params['api_token'] = self.api_key
        
        try:
            response = requests.get(
                self.BASE_URL,
                params=params,
                timeout=30
            )
            
            self._request_count += 1
            logger.info(f"Marketaux API call #{self._request_count} (quota: {self.MONTHLY_QUOTA})")
            
            response.raise_for_status()
            data = response.json()
            
            # Check for API errors
            if 'error' in data:
                logger.error(f"Marketaux API error: {data['error']}")
                return None
            
            return data
            
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                logger.error("Marketaux rate limit exceeded!")
            elif e.response.status_code == 401:
                logger.error("Marketaux API key invalid!")
            else:
                logger.error(f"Marketaux HTTP error: {e}")
            return None
        except requests.exceptions.RequestException as e:
            logger.error(f"Marketaux request error: {e}")
            raise
    
    def fetch_news(
        self,
        symbols: List[str],
        limit: int = 10,
        published_after: Optional[datetime] = None
    ) -> Optional[Dict]:
        """
        Fetch news articles for given symbols
        
        Args:
            symbols: List of stock symbols to search for
            limit: Max number of articles (1-50)
            published_after: Only fetch news after this date
        
        Returns:
            API response dict or None on error
        """
        # Convert symbols to search format
        # Marketaux expects symbols like "AAPL,TSLA" or entity names
        search_terms = ",".join(symbols)
        
        params = {
            "symbols": search_terms,
            "filter_entities": "true",
            "limit": str(min(limit, 50)),
            "language": "en",
            "sort": "published_desc"
        }
        
        if published_after:
            params["published_after"] = published_after.strftime("%Y-%m-%dT%H:%M")
        
        logger.info(f"Fetching news for: {search_terms}")
        return self._make_request(params)
    
    def search_news(
        self,
        query: str,
        limit: int = 10
    ) -> Optional[Dict]:
        """
        Search news by keyword query
        
        Args:
            query: Search term (e.g., "Bank Indonesia", "rupiah")
            limit: Max number of articles
        
        Returns:
            API response dict or None on error
        """
        params = {
            "search": query,
            "limit": str(min(limit, 50)),
            "language": "en",
            "sort": "published_desc"
        }
        
        logger.info(f"Searching news for: {query}")
        return self._make_request(params)


class SentimentAnalyzer:
    """
    Sentiment analysis using VADER (Valence Aware Dictionary and sEntiment Reasoner)
    Optimized for financial/market news
    """
    
    def __init__(self):
        self.vader = SentimentIntensityAnalyzer()
        
        # Add finance-specific words to VADER lexicon
        finance_lexicon = {
            # Positive
            'bullish': 3.0,
            'surge': 2.5,
            'rally': 2.5,
            'soar': 2.5,
            'boom': 2.0,
            'breakout': 2.0,
            'upgrade': 2.0,
            'outperform': 2.0,
            'beat': 1.5,
            'gain': 1.5,
            'profit': 1.5,
            'growth': 1.5,
            'recovery': 1.5,
            'uptrend': 1.5,
            'strong': 1.0,
            'buy': 1.0,
            
            # Negative
            'bearish': -3.0,
            'crash': -3.0,
            'plunge': -2.5,
            'tumble': -2.5,
            'slump': -2.5,
            'crisis': -2.5,
            'collapse': -2.5,
            'downgrade': -2.0,
            'underperform': -2.0,
            'miss': -1.5,
            'loss': -1.5,
            'decline': -1.5,
            'drop': -1.5,
            'fall': -1.5,
            'weak': -1.0,
            'sell': -1.0,
            'risk': -1.0,
            'volatility': -0.5,
        }
        
        self.vader.lexicon.update(finance_lexicon)
        logger.info("✓ Sentiment analyzer initialized with finance lexicon")
    
    def analyze_text(self, text: str) -> float:
        """
        Analyze sentiment of a text
        
        Returns:
            Score from -1 (very negative) to 1 (very positive)
        """
        if not text:
            return 0.0
        
        scores = self.vader.polarity_scores(text)
        return scores['compound']  # -1 to 1
    
    def analyze_article(self, article: Dict) -> NewsArticle:
        """
        Analyze a single news article
        
        Args:
            article: Raw article dict from Marketaux
        
        Returns:
            NewsArticle with sentiment score
        """
        title = article.get('title', '')
        description = article.get('description', '')
        
        # Combine title and description for analysis
        # Title is weighted more (appears first, more impactful)
        full_text = f"{title}. {description}"
        
        sentiment_score = self.analyze_text(full_text)
        
        # Parse published date
        published_str = article.get('published_at', '')
        try:
            published_at = datetime.fromisoformat(published_str.replace('Z', '+00:00'))
        except:
            published_at = datetime.now(timezone.utc)
        
        return NewsArticle(
            title=title,
            description=description[:500] if description else '',  # Truncate
            source=article.get('source', 'Unknown'),
            published_at=published_at,
            url=article.get('url', ''),
            sentiment_score=sentiment_score,
            relevance_score=article.get('relevance_score', 0.5)
        )
    
    @staticmethod
    def get_sentiment_label(score: float) -> SentimentLabel:
        """Convert numeric score to label"""
        if score >= 0.15:
            return SentimentLabel.POSITIVE
        elif score <= -0.15:
            return SentimentLabel.NEGATIVE
        else:
            return SentimentLabel.NEUTRAL
    
    def aggregate_sentiment(
        self,
        articles: List[NewsArticle],
        recency_weight: bool = True
    ) -> float:
        """
        Aggregate sentiment from multiple articles
        
        Args:
            articles: List of analyzed articles
            recency_weight: If True, recent articles have more weight
        
        Returns:
            Aggregated sentiment score (-1 to 1)
        """
        if not articles:
            return 0.0
        
        if not recency_weight:
            # Simple average
            return sum(a.sentiment_score for a in articles) / len(articles)
        
        # Weighted average by recency
        now = datetime.now(timezone.utc)
        total_weight = 0
        weighted_sum = 0
        
        for article in articles:
            # Calculate recency weight (exponential decay)
            age_hours = (now - article.published_at).total_seconds() / 3600
            weight = max(0.1, 1.0 / (1 + age_hours / 24))  # Decay over 24 hours
            
            # Also factor in relevance (handle None)
            relevance = article.relevance_score if article.relevance_score is not None else 0.5
            weight *= relevance
            
            weighted_sum += article.sentiment_score * weight
            total_weight += weight
        
        return weighted_sum / total_weight if total_weight > 0 else 0.0


class NewsSentimentEngine:
    """
    Main engine for news sentiment analysis
    Handles caching logic to stay within API quota
    
    GLOBAL MARKETS ONLY - NO INDONESIAN ASSETS
    """
    
    def __init__(self):
        self.client = MarketauxClient()
        self.analyzer = SentimentAnalyzer()
        
        # Symbol to search term mapping for GLOBAL MARKETS ONLY
        # NO Indonesian stocks (.JK), NO IDR pairs
        self.symbol_mapping = {
            # Commodities
            'XAUUSD': ['gold price', 'gold market', 'XAU', 'gold futures'],
            'XAGUSD': ['silver price', 'silver market', 'XAG', 'silver futures'],
            
            # Forex Pairs
            'EURUSD': ['euro dollar', 'EUR USD', 'ECB', 'European Central Bank'],
            'GBPUSD': ['pound dollar', 'GBP USD', 'Bank of England', 'sterling'],
            'USDJPY': ['dollar yen', 'USD JPY', 'Bank of Japan', 'yen'],
            
            # US Tech Stocks
            'AAPL': ['Apple', 'iPhone', 'AAPL'],
            'TSLA': ['Tesla', 'Elon Musk', 'TSLA', 'electric vehicle'],
            'NVDA': ['NVIDIA', 'AI chips', 'NVDA', 'GPU'],
            'MSFT': ['Microsoft', 'Azure', 'MSFT', 'Windows'],
            'GOOGL': ['Google', 'Alphabet', 'GOOGL', 'search'],
        }
    
    def should_fetch_news(self, symbol: str) -> bool:
        """
        Check if we should fetch news for a symbol
        
        Returns True if:
        - No cached data exists
        - Cached data is older than CACHE_HOURS
        
        This is CRITICAL to stay within the 100 req/month quota!
        """
        return db.should_fetch_news(symbol, hours=MarketauxClient.CACHE_HOURS)
    
    def get_search_terms(self, symbol: str) -> List[str]:
        """Get search terms for a symbol (Global Markets Only)"""
        if symbol in self.symbol_mapping:
            return self.symbol_mapping[symbol]
        
        # For unknown symbols, just use the symbol itself
        return [symbol]
    
    def analyze(self, symbol: str, force_fetch: bool = False) -> SentimentResult:
        """
        Perform sentiment analysis for a symbol
        
        Args:
            symbol: Stock/Forex symbol
            force_fetch: If True, ignore cache and fetch new data
        
        Returns:
            SentimentResult with sentiment score and articles
        """
        logger.info(f"Sentiment analysis for {symbol}...")
        
        # Check if we should fetch (quota management)
        if not force_fetch and not self.should_fetch_news(symbol):
            logger.info(f"Using cached sentiment for {symbol} (within {MarketauxClient.CACHE_HOURS}h)")
            
            # Return cached data from database
            cached = db.get_signal_by_symbol(symbol)
            if cached:
                return SentimentResult(
                    symbol=symbol,
                    sentiment_score=cached.get('sentiment_score', 0) or 0,
                    sentiment_label=SentimentLabel(cached.get('sentiment_label', 'NEUTRAL') or 'NEUTRAL'),
                    news_count=cached.get('news_count', 0) or 0,
                    articles=[],  # Don't store articles in cache
                    confidence=50,  # Lower confidence for cached data
                    last_news_date=None,
                    error=None
                )
            
            # No cache, but shouldn't fetch - return neutral
            return SentimentResult(
                symbol=symbol,
                sentiment_score=0,
                sentiment_label=SentimentLabel.NEUTRAL,
                news_count=0,
                articles=[],
                confidence=0,
                last_news_date=None,
                error="No cached data and fetch skipped"
            )
        
        try:
            # Get search terms for this symbol
            search_terms = self.get_search_terms(symbol)
            
            # Fetch news
            all_articles = []
            
            # Try symbol-based search first
            response = self.client.fetch_news([symbol])
            if response and response.get('data'):
                all_articles.extend(response['data'])
            
            # If few results, also try keyword search
            if len(all_articles) < 5 and search_terms:
                for term in search_terms[:1]:  # Only first term to save quota
                    response = self.client.search_news(term, limit=5)
                    if response and response.get('data'):
                        all_articles.extend(response['data'])
            
            if not all_articles:
                logger.warning(f"No news found for {symbol}")
                return SentimentResult(
                    symbol=symbol,
                    sentiment_score=0,
                    sentiment_label=SentimentLabel.NEUTRAL,
                    news_count=0,
                    articles=[],
                    confidence=0,
                    last_news_date=None,
                    error="No news articles found"
                )
            
            # Analyze each article
            analyzed_articles = [
                self.analyzer.analyze_article(article) 
                for article in all_articles[:20]  # Limit to 20 articles
            ]
            
            # Aggregate sentiment
            aggregated_score = self.analyzer.aggregate_sentiment(analyzed_articles)
            sentiment_label = self.analyzer.get_sentiment_label(aggregated_score)
            
            # Calculate confidence based on article count and recency
            base_confidence = min(80, 30 + len(analyzed_articles) * 5)
            
            # Most recent article date
            last_news_date = max(a.published_at for a in analyzed_articles) if analyzed_articles else None
            
            logger.info(f"✓ {symbol}: Sentiment={aggregated_score:.2f} ({sentiment_label.value}), "
                       f"Articles={len(analyzed_articles)}, Confidence={base_confidence}%")
            
            return SentimentResult(
                symbol=symbol,
                sentiment_score=aggregated_score,
                sentiment_label=sentiment_label,
                news_count=len(analyzed_articles),
                articles=analyzed_articles,
                confidence=base_confidence,
                last_news_date=last_news_date
            )
            
        except Exception as e:
            logger.error(f"Error analyzing sentiment for {symbol}: {e}")
            return SentimentResult(
                symbol=symbol,
                sentiment_score=0,
                sentiment_label=SentimentLabel.NEUTRAL,
                news_count=0,
                articles=[],
                confidence=0,
                last_news_date=None,
                error=str(e)
            )


# Global instance
news_analyzer = NewsSentimentEngine()


# Test
if __name__ == "__main__":
    from config import Config
    Config.print_status()
    
    print("\nTesting Sentiment Analysis (Global Markets Only)...")
    print("=" * 50)
    
    # Test with VADER only (no API call)
    analyzer = SentimentAnalyzer()
    
    test_headlines = [
        "Gold surges 5% as investors seek safe haven amid market uncertainty",
        "Tesla stock crashes 15% after disappointing earnings report",
        "Apple reports quarterly results in line with analyst expectations",
        "Federal Reserve signals potential rate cuts boosting equities",
        "NVIDIA shares rally on strong AI chip demand forecast",
    ]
    
    print("\nVADER Sentiment Test (Global Markets Headlines):")
    for headline in test_headlines:
        score = analyzer.analyze_text(headline)
        label = analyzer.get_sentiment_label(score)
        print(f"  [{label.value:8}] ({score:+.2f}) {headline[:60]}...")
    
    # Test full analysis (will use API quota!)
    print("\n" + "=" * 50)
    print("Full Analysis Test (will use API quota!):")
    print("Uncomment the code below to test with real API")
    
    # Uncomment to test with real API:
    # result = news_analyzer.analyze("XAUUSD", force_fetch=True)
    # print(f"\nSymbol: {result.symbol}")
    # print(f"Sentiment: {result.sentiment_score:.2f} ({result.sentiment_label.value})")
    # print(f"Articles: {result.news_count}")
    # print(f"Confidence: {result.confidence}%")
