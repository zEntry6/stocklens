"""
StockLens Engine - Main Scheduler v2.0
Runs hourly analysis and updates signals_cache with Entry, SL, TP

STRICT RULE: Global Markets Only
- ALLOWED: XAUUSD, EURUSD, GBPUSD, TSLA, AAPL, NVDA
- FORBIDDEN: Indonesian assets (IDX, .JK, IDR pairs)
"""
import os
import sys
import argparse
import schedule
import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

from loguru import logger
from dotenv import load_dotenv
from supabase import create_client, Client

# Local imports
from analysis_tech_v2 import TechnicalAnalyzer, TechnicalResult, SignalDirection
from analysis_news import SentimentAnalyzer, SentimentResult
from config import Config

# Load environment
load_dotenv()


class HybridVerdict(Enum):
    """Final verdict combining technical and sentiment"""
    STRONG_BUY = "STRONG_BUY"
    BUY = "BUY"
    HOLD = "HOLD"
    SELL = "SELL"
    STRONG_SELL = "STRONG_SELL"


@dataclass
class AnalysisResult:
    """Complete analysis with trading levels"""
    symbol: str
    asset_id: str
    timeframe: str
    
    # Price data
    current_price: Optional[float]
    price_change_pct: Optional[float]
    high_24h: Optional[float]
    low_24h: Optional[float]
    
    # Technical indicators
    rsi_14: Optional[float]
    rsi_signal: Optional[str]
    atr_14: Optional[float]
    sma_20: Optional[float]
    sma_50: Optional[float]
    
    # Trading levels (ATR-based)
    signal_direction: Optional[str]
    entry_price: Optional[float]
    stop_loss: Optional[float]
    take_profit_1: Optional[float]
    take_profit_2: Optional[float]
    risk_reward_ratio: Optional[float]
    
    # Sentiment
    sentiment_score: Optional[float]
    sentiment_label: Optional[str]
    news_count: int
    
    # Hybrid verdict
    hybrid_score: float
    hybrid_verdict: HybridVerdict
    confidence_level: float
    
    # AI Summary
    ai_summary: str
    
    def to_db_dict(self) -> Dict[str, Any]:
        """Convert to database dictionary"""
        return {
            'asset_id': self.asset_id,
            'symbol': self.symbol,
            'timeframe': self.timeframe,
            'current_price': self.current_price,
            'price_change_pct': self.price_change_pct,
            'high_24h': self.high_24h,
            'low_24h': self.low_24h,
            'rsi_14': self.rsi_14,
            'rsi_signal': self.rsi_signal,
            'atr_14': self.atr_14,
            'sma_20': self.sma_20,
            'sma_50': self.sma_50,
            'signal_direction': self.signal_direction,
            'entry_price': self.entry_price,
            'stop_loss': self.stop_loss,
            'take_profit_1': self.take_profit_1,
            'take_profit_2': self.take_profit_2,
            'risk_reward_ratio': self.risk_reward_ratio,
            'sentiment_score': self.sentiment_score,
            'sentiment_label': self.sentiment_label,
            'news_count': self.news_count,
            'hybrid_score': self.hybrid_score,
            'hybrid_verdict': self.hybrid_verdict.value,
            'confidence_level': self.confidence_level,
            'ai_summary': self.ai_summary,
            'last_updated_at': datetime.now(timezone.utc).isoformat(),
        }


class StockLensEngine:
    """Main engine for running analysis"""
    
    # Global assets only
    SYMBOLS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'TSLA', 'AAPL', 'NVDA']
    
    def __init__(self):
        logger.info("🚀 Initializing StockLens Engine v2.0...")
        
        # Initialize Supabase
        self.supabase: Client = create_client(
            Config.SUPABASE_URL,
            Config.SUPABASE_KEY
        )
        logger.info("✓ Supabase connected")
        
        # Initialize analyzers
        self.tech_analyzer = TechnicalAnalyzer()
        self.sentiment_analyzer = SentimentAnalyzer()
        
        # Cache asset IDs
        self.asset_ids: Dict[str, str] = {}
        self._load_asset_ids()
        
        logger.info("✓ Engine ready")
    
    def _load_asset_ids(self):
        """Load asset IDs from database"""
        try:
            response = self.supabase.table('market_assets').select('id, symbol').execute()
            for asset in response.data:
                self.asset_ids[asset['symbol']] = asset['id']
            logger.info(f"✓ Loaded {len(self.asset_ids)} asset IDs")
        except Exception as e:
            logger.error(f"Failed to load asset IDs: {e}")
    
    def _calculate_hybrid_verdict(
        self,
        tech_result: TechnicalResult,
        sentiment_result: Optional[SentimentResult]
    ) -> tuple[HybridVerdict, float, float, str]:
        """
        Calculate hybrid verdict from technical + sentiment
        
        Returns: (verdict, hybrid_score, confidence, ai_summary)
        """
        # Base on technical signal
        tech_score = 50.0  # Neutral baseline
        
        if tech_result.trading_levels:
            direction = tech_result.trading_levels.direction
            
            if direction == SignalDirection.LONG:
                tech_score = 70.0
                if tech_result.trading_levels.risk_reward_ratio and tech_result.trading_levels.risk_reward_ratio >= 1.5:
                    tech_score = 85.0
            elif direction == SignalDirection.SHORT:
                tech_score = 30.0
                if tech_result.trading_levels.risk_reward_ratio and tech_result.trading_levels.risk_reward_ratio >= 1.5:
                    tech_score = 15.0
        
        # Add sentiment influence
        sentiment_adjustment = 0.0
        if sentiment_result and sentiment_result.sentiment_score is not None:
            # Sentiment ranges from 0-1, convert to -10 to +10 adjustment
            sentiment_adjustment = (sentiment_result.sentiment_score - 0.5) * 20
        
        hybrid_score = tech_score + sentiment_adjustment
        hybrid_score = max(0, min(100, hybrid_score))  # Clamp 0-100
        
        # Determine verdict
        if hybrid_score >= 80:
            verdict = HybridVerdict.STRONG_BUY
        elif hybrid_score >= 60:
            verdict = HybridVerdict.BUY
        elif hybrid_score <= 20:
            verdict = HybridVerdict.STRONG_SELL
        elif hybrid_score <= 40:
            verdict = HybridVerdict.SELL
        else:
            verdict = HybridVerdict.HOLD
        
        # Calculate confidence
        confidence = tech_result.confidence
        if sentiment_result:
            confidence = (confidence + 50) / 2  # Average with sentiment
        
        # Generate AI summary
        summary = self._generate_summary(tech_result, sentiment_result, verdict)
        
        return verdict, hybrid_score, confidence, summary
    
    def _generate_summary(
        self,
        tech: TechnicalResult,
        sentiment: Optional[SentimentResult],
        verdict: HybridVerdict
    ) -> str:
        """Generate human-readable AI summary"""
        parts = []
        
        # Price action
        if tech.current_price:
            parts.append(f"{tech.symbol} is trading at ${tech.current_price:.2f}")
        
        # RSI
        if tech.rsi_14:
            rsi_desc = "oversold (bullish)" if tech.rsi_14 < 30 else "overbought (bearish)" if tech.rsi_14 > 70 else "neutral"
            parts.append(f"RSI({tech.rsi_14:.1f}) indicates {rsi_desc} conditions")
        
        # ATR volatility
        if tech.atr_14:
            parts.append(f"ATR volatility is ${tech.atr_14:.4f}")
        
        # Trading levels
        if tech.trading_levels and tech.trading_levels.direction != SignalDirection.NONE:
            direction = "LONG" if tech.trading_levels.direction == SignalDirection.LONG else "SHORT"
            parts.append(f"Signal: {direction} with Entry=${tech.trading_levels.entry_price:.2f}, SL=${tech.trading_levels.stop_loss:.2f}, TP=${tech.trading_levels.take_profit_1:.2f}")
        
        # Sentiment
        if sentiment and sentiment.sentiment_label:
            parts.append(f"Market sentiment is {sentiment.sentiment_label.lower()}")
        
        # Verdict
        parts.append(f"Overall verdict: {verdict.value}")
        
        return ". ".join(parts) + "."
    
    def analyze_symbol(self, symbol: str, timeframe: str = "H1") -> Optional[AnalysisResult]:
        """Run full analysis on a symbol"""
        logger.info(f"📊 Analyzing {symbol} ({timeframe})...")
        
        # Get asset ID
        asset_id = self.asset_ids.get(symbol)
        if not asset_id:
            logger.error(f"Asset ID not found for {symbol}")
            return None
        
        # Technical analysis
        tech_result = self.tech_analyzer.analyze_symbol(symbol, timeframe)
        
        # Sentiment analysis
        sentiment_result = None
        try:
            sentiment_result = self.sentiment_analyzer.analyze_symbol(symbol)
        except Exception as e:
            logger.warning(f"Sentiment analysis failed for {symbol}: {e}")
        
        # Calculate hybrid verdict
        verdict, hybrid_score, confidence, summary = self._calculate_hybrid_verdict(
            tech_result, sentiment_result
        )
        
        # Build result
        trading_levels = tech_result.trading_levels
        
        return AnalysisResult(
            symbol=symbol,
            asset_id=asset_id,
            timeframe=timeframe,
            current_price=tech_result.current_price,
            price_change_pct=tech_result.price_change_pct,
            high_24h=tech_result.high_24h,
            low_24h=tech_result.low_24h,
            rsi_14=tech_result.rsi_14,
            rsi_signal=tech_result.rsi_signal.value if tech_result.rsi_signal else None,
            atr_14=tech_result.atr_14,
            sma_20=tech_result.sma_20,
            sma_50=tech_result.sma_50,
            signal_direction=trading_levels.direction.value if trading_levels else None,
            entry_price=trading_levels.entry_price if trading_levels else None,
            stop_loss=trading_levels.stop_loss if trading_levels else None,
            take_profit_1=trading_levels.take_profit_1 if trading_levels else None,
            take_profit_2=trading_levels.take_profit_2 if trading_levels else None,
            risk_reward_ratio=trading_levels.risk_reward_ratio if trading_levels else None,
            sentiment_score=sentiment_result.sentiment_score if sentiment_result else None,
            sentiment_label=sentiment_result.sentiment_label.value if sentiment_result and sentiment_result.sentiment_label else None,
            news_count=sentiment_result.news_count if sentiment_result else 0,
            hybrid_score=hybrid_score,
            hybrid_verdict=verdict,
            confidence_level=confidence,
            ai_summary=summary
        )
    
    def save_to_database(self, result: AnalysisResult) -> bool:
        """Save analysis result to Supabase"""
        try:
            data = result.to_db_dict()
            
            # Upsert based on symbol + timeframe
            response = self.supabase.table('signals_cache').upsert(
                data,
                on_conflict='symbol,timeframe'
            ).execute()
            
            logger.info(f"✅ Saved {result.symbol} ({result.timeframe}) to database")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to save {result.symbol}: {e}")
            return False
    
    def run_analysis(self, symbols: List[str] = None, timeframe: str = "H1"):
        """Run analysis on all or specific symbols"""
        symbols = symbols or self.SYMBOLS
        
        logger.info(f"{'='*60}")
        logger.info(f"🔄 Starting analysis run: {len(symbols)} symbols, {timeframe} timeframe")
        logger.info(f"   Timestamp: {datetime.now(timezone.utc).isoformat()}")
        logger.info(f"{'='*60}")
        
        success_count = 0
        for symbol in symbols:
            try:
                result = self.analyze_symbol(symbol, timeframe)
                if result:
                    if self.save_to_database(result):
                        success_count += 1
                    
                    # Log trading setup if signal exists
                    if result.signal_direction and result.signal_direction != "NONE":
                        logger.info(f"📍 {symbol} TRADE SETUP:")
                        logger.info(f"   Direction: {result.signal_direction}")
                        logger.info(f"   Entry: ${result.entry_price:.2f}")
                        logger.info(f"   Stop Loss: ${result.stop_loss:.2f}")
                        logger.info(f"   Take Profit 1: ${result.take_profit_1:.2f}")
                        logger.info(f"   Take Profit 2: ${result.take_profit_2:.2f}")
                        logger.info(f"   Risk:Reward: 1:{result.risk_reward_ratio}")
                
            except Exception as e:
                logger.error(f"❌ Error processing {symbol}: {e}")
        
        logger.info(f"{'='*60}")
        logger.info(f"✅ Analysis complete: {success_count}/{len(symbols)} symbols processed")
        logger.info(f"{'='*60}")
    
    def start_scheduler(self, interval_minutes: int = 60):
        """Start scheduled analysis"""
        logger.info(f"⏰ Starting scheduler (every {interval_minutes} minutes)")
        
        # Run immediately
        self.run_analysis()
        
        # Schedule hourly runs
        schedule.every(interval_minutes).minutes.do(self.run_analysis)
        
        while True:
            schedule.run_pending()
            time.sleep(60)


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="StockLens Analysis Engine v2.0")
    parser.add_argument(
        "--mode",
        choices=["once", "schedule"],
        default="once",
        help="Run mode: 'once' for single run, 'schedule' for continuous"
    )
    parser.add_argument(
        "--symbols",
        nargs="+",
        default=None,
        help="Specific symbols to analyze (default: all)"
    )
    parser.add_argument(
        "--timeframe",
        choices=["H1", "H4", "D1"],
        default="H1",
        help="Timeframe for analysis"
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=60,
        help="Scheduler interval in minutes (for schedule mode)"
    )
    
    args = parser.parse_args()
    
    # Configure logging
    logger.remove()
    logger.add(
        sys.stdout,
        level="INFO",
        format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | {message}",
        colorize=True
    )
    logger.add(
        "logs/engine_{time:YYYY-MM-DD}.log",
        rotation="1 day",
        retention="7 days",
        level="DEBUG"
    )
    
    # Run engine
    engine = StockLensEngine()
    
    if args.mode == "once":
        engine.run_analysis(symbols=args.symbols, timeframe=args.timeframe)
    else:
        engine.start_scheduler(interval_minutes=args.interval)


if __name__ == "__main__":
    main()
