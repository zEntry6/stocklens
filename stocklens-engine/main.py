"""
StockLens Engine - Main Orchestrator
Scheduled job that runs analysis and updates the database

STRICT RULE: Global Markets Only
- NO Indonesian assets (IDX, .JK, IDR pairs)  
- ALLOWED: Forex, Commodities (XAU/XAG), US Stocks
"""
import sys
import os
import time
import signal
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from enum import Enum
from datetime import datetime, timezone
import schedule
from loguru import logger

from config import Config
from database import db
from analysis_tech import tech_analyzer, TechnicalSignal, TechnicalResult
from analysis_news import news_analyzer, SentimentLabel, SentimentResult


# Health check server for Railway
class HealthCheckHandler(BaseHTTPRequestHandler):
    """Simple HTTP handler for health checks"""
    
    def do_GET(self):
        if self.path == '/' or self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = '{"status": "healthy", "service": "stocklens-engine"}'
            self.wfile.write(response.encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        # Suppress HTTP logs
        pass


def start_health_server():
    """Start a simple HTTP server for health checks"""
    port = int(os.environ.get('PORT', 8080))
    server = HTTPServer(('0.0.0.0', port), HealthCheckHandler)
    logger.info(f"✓ Health check server running on port {port}")
    server.serve_forever()


# Configure logging
logger.remove()
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level="INFO"
)
logger.add(
    "logs/stocklens_{time:YYYY-MM-DD}.log",
    rotation="1 day",
    retention="7 days",
    level="DEBUG"
)


class HybridVerdict(Enum):
    """Final verdict combining technical and sentiment analysis"""
    STRONG_BUY = "STRONG_BUY"
    BUY = "BUY"
    HOLD = "HOLD"
    SELL = "SELL"
    STRONG_SELL = "STRONG_SELL"


@dataclass
class AnalysisResult:
    """Complete analysis result for a symbol"""
    symbol: str
    asset_id: str
    
    # Technical data
    current_price: Optional[float]
    price_change_24h: Optional[float]
    high_24h: Optional[float]
    low_24h: Optional[float]
    volume_24h: Optional[float]
    rsi_14: Optional[float]
    rsi_signal: Optional[str]
    sma_20: Optional[float]
    sma_50: Optional[float]
    macd_line: Optional[float]
    macd_signal_line: Optional[float]
    macd_histogram: Optional[float]
    macd_trend: Optional[str]
    
    # Sentiment data
    sentiment_score: Optional[float]
    sentiment_label: Optional[str]
    news_count: int
    
    # Hybrid verdict
    hybrid_score: float
    hybrid_verdict: HybridVerdict
    confidence_level: float
    
    # AI Summary (generated)
    ai_summary: str
    
    def to_db_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for database upsert
        
        Note: MACD columns are commented out as they may not exist in older schemas.
        If you want MACD data, run this SQL in Supabase:
        ALTER TABLE signals_cache ADD COLUMN IF NOT EXISTS macd_line DECIMAL(20, 8);
        ALTER TABLE signals_cache ADD COLUMN IF NOT EXISTS macd_signal_line DECIMAL(20, 8);
        ALTER TABLE signals_cache ADD COLUMN IF NOT EXISTS macd_histogram DECIMAL(20, 8);
        ALTER TABLE signals_cache ADD COLUMN IF NOT EXISTS macd_trend VARCHAR(20);
        """
        return {
            'asset_id': self.asset_id,
            'symbol': self.symbol,
            'current_price': self.current_price,
            'price_change_24h': self.price_change_24h,
            'high_24h': self.high_24h,
            'low_24h': self.low_24h,
            'volume_24h': self.volume_24h,
            'rsi_14': self.rsi_14,
            'rsi_signal': self.rsi_signal,
            'sma_20': self.sma_20,
            'sma_50': self.sma_50,
            # MACD columns - uncomment if your schema has them
            # 'macd_line': self.macd_line,
            # 'macd_signal_line': self.macd_signal_line,
            # 'macd_histogram': self.macd_histogram,
            # 'macd_trend': self.macd_trend,
            'macd_signal': self.macd_trend,  # Use existing column if available
            'sentiment_score': self.sentiment_score,
            'sentiment_label': self.sentiment_label,
            'news_count': self.news_count,
            'hybrid_score': self.hybrid_score,
            'hybrid_verdict': self.hybrid_verdict.value,
            'confidence_level': self.confidence_level,
            'ai_summary': self.ai_summary,
            'data_source': 'alphavantage',
        }


class HybridAnalyzer:
    """
    Combines Technical and Sentiment analysis to produce a Hybrid Verdict
    
    Scoring Logic:
    - Technical Analysis: 60% weight
    - Sentiment Analysis: 40% weight
    
    Verdict Thresholds:
    - Score >= 75: STRONG_BUY
    - Score >= 60: BUY
    - Score <= 25: STRONG_SELL
    - Score <= 40: SELL
    - Otherwise: HOLD
    """
    
    TECH_WEIGHT = 0.6
    SENTIMENT_WEIGHT = 0.4
    
    def __init__(self):
        logger.info("✓ Hybrid analyzer initialized")
    
    def _tech_signal_to_score(self, signal: TechnicalSignal) -> float:
        """Convert technical signal to numeric score (0-100)"""
        mapping = {
            TechnicalSignal.STRONG_BUY: 90,
            TechnicalSignal.BUY: 70,
            TechnicalSignal.HOLD: 50,
            TechnicalSignal.SELL: 30,
            TechnicalSignal.STRONG_SELL: 10,
        }
        return mapping.get(signal, 50)
    
    def _sentiment_to_score(self, sentiment_score: float, label: SentimentLabel) -> float:
        """
        Convert sentiment score (-1 to 1) to numeric score (0-100)
        """
        # Map -1..1 to 0..100
        base_score = (sentiment_score + 1) * 50
        
        # Adjust based on label for clearer signals
        if label == SentimentLabel.POSITIVE:
            base_score = max(base_score, 60)
        elif label == SentimentLabel.NEGATIVE:
            base_score = min(base_score, 40)
        
        return base_score
    
    def _generate_ai_summary(
        self,
        symbol: str,
        tech_result: TechnicalResult,
        sentiment_result: SentimentResult,
        verdict: HybridVerdict
    ) -> str:
        """Generate a brief AI-style summary of the analysis"""
        parts = []
        
        # Price summary
        if tech_result.current_price:
            change_str = ""
            if tech_result.price_change_24h:
                direction = "up" if tech_result.price_change_24h > 0 else "down"
                change_str = f" ({direction} {abs(tech_result.price_change_24h):.1f}%)"
            parts.append(f"{symbol} trading at {tech_result.current_price:,.2f}{change_str}.")
        
        # RSI summary
        if tech_result.rsi_14:
            if tech_result.rsi_14 < 30:
                parts.append(f"RSI at {tech_result.rsi_14:.0f} indicates oversold conditions.")
            elif tech_result.rsi_14 > 70:
                parts.append(f"RSI at {tech_result.rsi_14:.0f} indicates overbought conditions.")
            else:
                parts.append(f"RSI at {tech_result.rsi_14:.0f} shows neutral momentum.")
        
        # Sentiment summary
        if sentiment_result.news_count > 0:
            sentiment_desc = {
                SentimentLabel.POSITIVE: "positive",
                SentimentLabel.NEUTRAL: "neutral",
                SentimentLabel.NEGATIVE: "negative"
            }
            desc = sentiment_desc.get(sentiment_result.sentiment_label, "neutral")
            parts.append(f"Market sentiment is {desc} based on {sentiment_result.news_count} recent articles.")
        
        # Verdict
        verdict_text = {
            HybridVerdict.STRONG_BUY: "Strong buying opportunity detected.",
            HybridVerdict.BUY: "Favorable conditions for buying.",
            HybridVerdict.HOLD: "Maintain current position.",
            HybridVerdict.SELL: "Consider reducing exposure.",
            HybridVerdict.STRONG_SELL: "Strong selling pressure indicated.",
        }
        parts.append(verdict_text.get(verdict, ""))
        
        return " ".join(parts)
    
    def analyze(
        self,
        symbol: str,
        asset_id: str,
        asset_type: str,
        include_sentiment: bool = True
    ) -> AnalysisResult:
        """
        Perform hybrid analysis combining technical and sentiment data
        
        Args:
            symbol: Asset symbol
            asset_id: Database asset ID
            asset_type: 'STOCK', 'FOREX', etc.
            include_sentiment: Whether to include sentiment analysis
        
        Returns:
            Complete AnalysisResult
        """
        logger.info(f"🔍 Hybrid analysis for {symbol}...")
        
        # Run technical analysis
        tech_result = tech_analyzer.analyze(symbol, asset_type)
        tech_score = self._tech_signal_to_score(tech_result.technical_signal)
        
        # Run sentiment analysis (if enabled and quota allows)
        if include_sentiment:
            sentiment_result = news_analyzer.analyze(symbol)
            sentiment_score_raw = sentiment_result.sentiment_score
            sentiment_label = sentiment_result.sentiment_label
            sentiment_score = self._sentiment_to_score(sentiment_score_raw, sentiment_label)
            news_count = sentiment_result.news_count
        else:
            sentiment_result = SentimentResult(
                symbol=symbol,
                sentiment_score=0,
                sentiment_label=SentimentLabel.NEUTRAL,
                news_count=0,
                articles=[],
                confidence=0,
                last_news_date=None
            )
            sentiment_score_raw = 0
            sentiment_label = SentimentLabel.NEUTRAL
            sentiment_score = 50  # Neutral
            news_count = 0
        
        # Calculate hybrid score
        if news_count > 0:
            # Full hybrid calculation
            hybrid_score = (
                tech_score * self.TECH_WEIGHT +
                sentiment_score * self.SENTIMENT_WEIGHT
            )
        else:
            # Technical only (no sentiment data)
            hybrid_score = tech_score
        
        # Determine verdict
        if hybrid_score >= 75:
            verdict = HybridVerdict.STRONG_BUY
        elif hybrid_score >= 60:
            verdict = HybridVerdict.BUY
        elif hybrid_score <= 25:
            verdict = HybridVerdict.STRONG_SELL
        elif hybrid_score <= 40:
            verdict = HybridVerdict.SELL
        else:
            verdict = HybridVerdict.HOLD
        
        # Calculate confidence
        tech_confidence = tech_result.confidence
        sentiment_confidence = sentiment_result.confidence if include_sentiment else 0
        
        if news_count > 0:
            confidence = (tech_confidence * 0.6 + sentiment_confidence * 0.4)
        else:
            confidence = tech_confidence * 0.8  # Lower confidence without sentiment
        
        # Generate AI summary
        ai_summary = self._generate_ai_summary(
            symbol, tech_result, sentiment_result, verdict
        )
        
        logger.info(f"✅ {symbol}: Score={hybrid_score:.0f}, Verdict={verdict.value}, Confidence={confidence:.0f}%")
        
        return AnalysisResult(
            symbol=symbol,
            asset_id=asset_id,
            current_price=tech_result.current_price,
            price_change_24h=tech_result.price_change_24h,
            high_24h=tech_result.high_24h,
            low_24h=tech_result.low_24h,
            volume_24h=tech_result.volume_24h,
            rsi_14=tech_result.rsi_14,
            rsi_signal=tech_result.rsi_signal.value if tech_result.rsi_signal else None,
            sma_20=tech_result.sma_20,
            sma_50=tech_result.sma_50,
            macd_line=tech_result.macd_line,
            macd_signal_line=tech_result.macd_signal_line,
            macd_histogram=tech_result.macd_histogram,
            macd_trend=tech_result.macd_trend,
            sentiment_score=sentiment_score_raw,
            sentiment_label=sentiment_label.value if sentiment_label else None,
            news_count=news_count,
            hybrid_score=hybrid_score,
            hybrid_verdict=verdict,
            confidence_level=confidence,
            ai_summary=ai_summary
        )


class StockLensEngine:
    """
    Main engine that orchestrates the entire analysis pipeline
    
    GLOBAL MARKETS ONLY - NO INDONESIAN ASSETS
    """
    
    def __init__(self):
        self.analyzer = HybridAnalyzer()
        self._running = False
        
        # Priority assets for sentiment analysis (to manage quota)
        # Only these will get news sentiment, others are technical-only
        # Uses Config.PRIORITY_SENTIMENT_ASSETS for consistency
        self.priority_assets = Config.PRIORITY_SENTIMENT_ASSETS
        
        logger.info("✓ StockLens Engine initialized (Global Markets Only)")
        logger.info(f"  Priority Sentiment Assets: {self.priority_assets}")
    
    def run_analysis_cycle(self):
        """Run a complete analysis cycle for all assets"""
        logger.info("=" * 60)
        logger.info("🚀 Starting analysis cycle...")
        logger.info("=" * 60)
        
        start_time = time.time()
        
        # Get all active assets from database
        assets = db.get_active_assets()
        
        if not assets:
            logger.warning("No active assets found in database!")
            return
        
        logger.info(f"Found {len(assets)} active assets to analyze")
        
        results = []
        errors = []
        
        for i, asset in enumerate(assets, 1):
            symbol = asset['symbol']
            asset_id = asset['id']
            asset_type = asset['asset_type']
            
            logger.info(f"\n[{i}/{len(assets)}] Processing {symbol}...")
            
            try:
                # Check if this asset should get sentiment analysis
                include_sentiment = symbol in self.priority_assets
                
                if not include_sentiment:
                    logger.debug(f"{symbol} not in priority list, skipping sentiment")
                
                # Run analysis
                result = self.analyzer.analyze(
                    symbol=symbol,
                    asset_id=asset_id,
                    asset_type=asset_type,
                    include_sentiment=include_sentiment
                )
                
                # Save to database
                db_data = result.to_db_dict()
                db.upsert_signal(db_data)
                
                results.append(result)
                
            except Exception as e:
                logger.error(f"Error processing {symbol}: {e}")
                errors.append((symbol, str(e)))
                continue
            
            # Small delay between assets to avoid rate limits
            time.sleep(1)
        
        # Summary
        elapsed = time.time() - start_time
        logger.info("\n" + "=" * 60)
        logger.info("📊 Analysis Cycle Complete!")
        logger.info("=" * 60)
        logger.info(f"Processed: {len(results)}/{len(assets)} assets")
        logger.info(f"Errors: {len(errors)}")
        logger.info(f"Duration: {elapsed:.1f} seconds")
        
        if errors:
            logger.warning("Errors encountered:")
            for symbol, error in errors:
                logger.warning(f"  - {symbol}: {error}")
        
        # Print summary by verdict
        verdict_counts = {}
        for result in results:
            v = result.hybrid_verdict.value
            verdict_counts[v] = verdict_counts.get(v, 0) + 1
        
        logger.info("\nVerdict Summary:")
        for verdict, count in sorted(verdict_counts.items()):
            logger.info(f"  {verdict}: {count}")
        
        return results
    
    def run_scheduled(self, interval_minutes: int = 60):
        """
        Run the engine on a schedule
        
        Args:
            interval_minutes: How often to run analysis (default: 60 min)
        """
        logger.info(f"Starting scheduled mode (every {interval_minutes} minutes)")
        
        self._running = True
        
        # Run immediately on start
        self.run_analysis_cycle()
        
        # Schedule periodic runs
        schedule.every(interval_minutes).minutes.do(self.run_analysis_cycle)
        
        # Handle graceful shutdown
        def signal_handler(signum, frame):
            logger.info("Shutdown signal received...")
            self._running = False
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        # Run loop
        while self._running:
            schedule.run_pending()
            time.sleep(1)
        
        logger.info("Engine stopped.")
    
    def run_once(self, symbols: Optional[List[str]] = None):
        """
        Run analysis once (for testing or manual trigger)
        
        Args:
            symbols: Optional list of specific symbols to analyze
        """
        if symbols:
            logger.info(f"Running one-time analysis for: {symbols}")
            
            results = []
            for symbol in symbols:
                asset = db.get_asset_by_symbol(symbol)
                if not asset:
                    logger.warning(f"Asset not found: {symbol}")
                    continue
                
                result = self.analyzer.analyze(
                    symbol=symbol,
                    asset_id=asset['id'],
                    asset_type=asset['asset_type'],
                    include_sentiment=symbol in self.priority_assets
                )
                
                db.upsert_signal(result.to_db_dict())
                results.append(result)
            
            return results
        else:
            return self.run_analysis_cycle()


# Global engine instance
engine = StockLensEngine()


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='StockLens Analysis Engine')
    parser.add_argument(
        '--mode',
        choices=['once', 'scheduled'],
        default='once',
        help='Run mode: once (single run) or scheduled (continuous)'
    )
    parser.add_argument(
        '--interval',
        type=int,
        default=60,
        help='Interval in minutes for scheduled mode (default: 60)'
    )
    parser.add_argument(
        '--symbols',
        nargs='+',
        help='Specific symbols to analyze (for once mode)'
    )
    parser.add_argument(
        '--test',
        action='store_true',
        help='Run in test mode (no database writes)'
    )
    
    args = parser.parse_args()
    
    # Validate configuration
    logger.info("StockLens Analysis Engine")
    logger.info("=" * 40)
    Config.print_status()
    
    if not Config.validate():
        logger.error("Configuration incomplete! Check your .env file.")
        sys.exit(1)
    
    # Start health check server in background thread (for Railway)
    if args.mode == 'scheduled':
        health_thread = threading.Thread(target=start_health_server, daemon=True)
        health_thread.start()
        logger.info("✓ Health check server started in background")
    
    # Run engine
    if args.mode == 'scheduled':
        engine.run_scheduled(interval_minutes=args.interval)
    else:
        if args.symbols:
            engine.run_once(symbols=args.symbols)
        else:
            engine.run_once()


if __name__ == "__main__":
    main()
