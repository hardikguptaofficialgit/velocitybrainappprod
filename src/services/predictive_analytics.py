"""
Predictive Analytics Service for Velocity Brain.

This service provides advanced analytics including trend analysis,
forecasting, anomaly detection, and business intelligence insights.
"""

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass
from collections import defaultdict, deque

import numpy as np

try:
    import pandas as pd
except ImportError:  # pragma: no cover - optional dependency
    pd = None

try:
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler
    from sklearn.linear_model import LinearRegression
    from sklearn.metrics import mean_absolute_error, mean_squared_error
except ImportError:  # pragma: no cover - optional dependency
    IsolationForest = None
    StandardScaler = None
    LinearRegression = None
    mean_absolute_error = None
    mean_squared_error = None

from src.core.db import get_conn
from src.core.logging_config import get_logger
from src.core.config import settings


@dataclass
class TrendAnalysis:
    """Trend analysis results."""
    metric_name: str
    trend_direction: str  # 'increasing', 'decreasing', 'stable'
    trend_strength: float  # 0.0 to 1.0
    confidence: float
    time_period_days: int
    data_points: List[Tuple[datetime, float]]


@dataclass
class Forecast:
    """Forecast results."""
    metric_name: str
    forecast_values: List[float]
    prediction_horizon_days: int
    confidence_interval: Tuple[float, float]
    model_accuracy: float
    created_at: datetime


@dataclass
class AnomalyDetection:
    """Anomaly detection results."""
    metric_name: str
    anomaly_value: float
    expected_range: Tuple[float, float]
    anomaly_score: float  # Higher = more anomalous
    detected_at: datetime
    context: Dict[str, Any]


@dataclass
class BusinessInsight:
    """Business intelligence insight."""
    insight_type: str
    title: str
    description: str
    impact_level: str  # 'low', 'medium', 'high', 'critical'
    confidence: float
    recommendations: List[str]
    supporting_data: Dict[str, Any]
    created_at: datetime


class PredictiveAnalyticsService:
    """Advanced predictive analytics and business intelligence."""
    
    def __init__(self):
        self.logger = get_logger('predictive_analytics')
        self.anomaly_detector = None
        self.scaler = StandardScaler() if StandardScaler else None
        self._initialize_models()
        
    def _initialize_models(self):
        """Initialize ML models for analytics."""
        try:
            if not IsolationForest:
                self.logger.warning("scikit-learn is not installed; predictive analytics will use fallbacks")
                self.anomaly_detector = None
                return

            # Initialize anomaly detection model
            self.anomaly_detector = IsolationForest(
                n_estimators=100,
                contamination=0.1,
                random_state=42
            )
            self.logger.info("Initialized predictive analytics models")
            
        except Exception as exc:
            self.logger.error(f"Failed to initialize analytics models: {exc}")
            self.anomaly_detector = None
    
    def analyze_trends(self, metric_name: str, days: int = 30) -> TrendAnalysis:
        """
        Analyze trends for a specific metric over time.
        
        Supports metrics like: entity creation rate, query volume, task completion rate.
        """
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    # Get historical data for the metric
                    cur.execute("""
                        SELECT 
                            DATE_TRUNC('day', created_at) as date,
                            COUNT(*) as value
                        FROM timeline_events
                        WHERE event_ts >= NOW() - INTERVAL '%s days'
                        AND source_type = %s
                        GROUP BY DATE_TRUNC('day', created_at)
                        ORDER BY date ASC
                    """, (days, metric_name))
                    
                    data = cur.fetchall()
                    
                    if not data:
                        return TrendAnalysis(
                            metric_name=metric_name,
                            trend_direction='stable',
                            trend_strength=0.0,
                            confidence=0.0,
                            time_period_days=days,
                            data_points=[]
                        )
                    
                    # Convert to numpy arrays for analysis
                    dates = [datetime.fromisoformat(row['date']) for row in data]
                    values = [float(row['value']) for row in data]

                    # Calculate trend using linear regression
                    if len(values) >= 2 and LinearRegression:
                        x = np.arange(len(values)).reshape(-1, 1)
                        y = np.array(values)
                        
                        model = LinearRegression()
                        model.fit(x, y)
                        slope = model.coef_[0]
                        
                        # Determine trend direction and strength
                        if slope > 0.01:
                            trend_direction = 'increasing'
                            trend_strength = min(abs(slope) * 10, 1.0)
                        elif slope < -0.01:
                            trend_direction = 'decreasing'
                            trend_strength = min(abs(slope) * 10, 1.0)
                        else:
                            trend_direction = 'stable'
                            trend_strength = 0.0
                        
                        # Calculate confidence based on R²
                        confidence = max(model.score(x, y), 0.0)
                        
                    else:
                        trend_direction = 'stable'
                        trend_strength = 0.0
                        confidence = 0.5
                    
                    return TrendAnalysis(
                        metric_name=metric_name,
                        trend_direction=trend_direction,
                        trend_strength=trend_strength,
                        confidence=confidence,
                        time_period_days=days,
                        data_points=list(zip(dates, values))
                    )
                    
        except Exception as exc:
            self.logger.error(f"Trend analysis failed for {metric_name}: {exc}")
            return TrendAnalysis(
                metric_name=metric_name,
                trend_direction='stable',
                trend_strength=0.0,
                confidence=0.0,
                time_period_days=days,
                data_points=[]
            )
    
    def generate_forecast(self, metric_name: str, horizon_days: int = 7) -> Forecast:
        """
        Generate forecast for a metric using time series analysis.
        
        Uses historical data to predict future values with confidence intervals.
        """
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    # Get more historical data for better forecasting
                    cur.execute("""
                        SELECT 
                            DATE_TRUNC('day', created_at) as date,
                            COUNT(*) as value
                        FROM timeline_events
                        WHERE event_ts >= NOW() - INTERVAL '90 days'
                        AND source_type = %s
                        GROUP BY DATE_TRUNC('day', created_at)
                        ORDER BY date ASC
                    """, (metric_name))
                    
                    data = cur.fetchall()
                    
                    if len(data) < 14:  # Need at least 2 weeks of data
                        return Forecast(
                            metric_name=metric_name,
                            forecast_values=[],
                            prediction_horizon_days=horizon_days,
                            confidence_interval=(0.0, 0.0),
                            model_accuracy=0.0,
                            created_at=datetime.now(timezone.utc)
                        )
                    
                    if not pd or not LinearRegression or not mean_absolute_error:
                        self.logger.warning("Forecast dependencies are unavailable; returning empty forecast")
                        return Forecast(
                            metric_name=metric_name,
                            forecast_values=[],
                            prediction_horizon_days=horizon_days,
                            confidence_interval=(0.0, 0.0),
                            model_accuracy=0.0,
                            created_at=datetime.now(timezone.utc)
                        )

                    # Prepare data for forecasting
                    df = pd.DataFrame(data)
                    df['date'] = pd.to_datetime(df['date'])
                    df['value'] = df['value'].astype(float)
                    
                    # Create features for time series forecasting
                    df['day_of_week'] = df['date'].dt.dayofweek
                    df['day_of_month'] = df['date'].dt.day
                    df['week_of_year'] = df['date'].dt.isocalendar().week
                    
                    # Simple linear regression with time features
                    features = ['day_of_week', 'day_of_month', 'week_of_year']
                    X = df[features]
                    y = df['value']
                    
                    model = LinearRegression()
                    model.fit(X, y)
                    
                    # Generate future dates
                    last_date = df['date'].max()
                    future_dates = [last_date + timedelta(days=i+1) for i in range(horizon_days)]
                    
                    # Create features for future dates
                    future_features = []
                    for date in future_dates:
                        future_features.append([
                            date.dayofweek,
                            date.day,
                            date.isocalendar().week
                        ])
                    
                    # Make predictions
                    forecast_values = model.predict(future_features).tolist()
                    
                    # Calculate confidence intervals (simplified)
                    residuals = y - model.predict(X)
                    mae = mean_absolute_error(y, model.predict(X))
                    confidence_interval = (max(0, forecast_values[0] - mae), forecast_values[0] + mae)
                    
                    # Calculate model accuracy
                    accuracy = max(0, 1 - (mae / np.mean(y)))
                    
                    return Forecast(
                        metric_name=metric_name,
                        forecast_values=forecast_values,
                        prediction_horizon_days=horizon_days,
                        confidence_interval=confidence_interval,
                        model_accuracy=accuracy,
                        created_at=datetime.now(timezone.utc)
                    )
                    
        except Exception as exc:
            self.logger.error(f"Forecast generation failed for {metric_name}: {exc}")
            return Forecast(
                metric_name=metric_name,
                forecast_values=[],
                prediction_horizon_days=horizon_days,
                confidence_interval=(0.0, 0.0),
                model_accuracy=0.0,
                created_at=datetime.now(timezone.utc)
            )
    
    def detect_anomalies(self, metric_name: str, threshold_days: int = 7) -> List[AnomalyDetection]:
        """
        Detect anomalies in metrics using machine learning.
        
        Identifies unusual patterns that may indicate issues or opportunities.
        """
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    # Get recent data for anomaly detection
                    cur.execute("""
                        SELECT 
                            DATE_TRUNC('hour', created_at) as hour,
                            COUNT(*) as value
                        FROM timeline_events
                        WHERE event_ts >= NOW() - INTERVAL '%s days'
                        AND source_type = %s
                        GROUP BY DATE_TRUNC('hour', created_at)
                        ORDER BY hour ASC
                    """, (threshold_days, metric_name))
                    
                    data = cur.fetchall()
                    
                    if len(data) < 10:  # Need sufficient data for anomaly detection
                        return []
                    
                    if not self.anomaly_detector:
                        return self._simple_anomaly_detection(data, metric_name)
                    
                    # Prepare data for ML-based anomaly detection
                    if not pd:
                        return self._simple_anomaly_detection(data, metric_name)

                    df = pd.DataFrame(data)
                    values = df['value'].values.reshape(-1, 1)
                    
                    # Fit and predict anomalies
                    anomaly_scores = self.anomaly_detector.fit_predict(values)
                    
                    anomalies = []
                    for i, (row, score) in enumerate(zip(data, anomaly_scores)):
                        if score == -1:  # IsolationForest marks anomalies as -1
                            # Calculate expected range from historical data
                            historical_values = df['value'].values
                            q25, q75 = np.percentile(historical_values, [25, 75])
                            
                            anomalies.append(AnomalyDetection(
                                metric_name=metric_name,
                                anomaly_value=float(row['value']),
                                expected_range=(float(q25), float(q75)),
                                anomaly_score=1.0,
                                detected_at=datetime.fromisoformat(row['hour']),
                                context={
                                    'hour': row['hour'],
                                    'deviation_from_expected': float(row['value']) - np.mean(historical_values),
                                    'percentile': float(np.percentile(historical_values, [row['value']] * 100)),
                                }
                            ))
                    
                    return anomalies
                    
        except Exception as exc:
            self.logger.error(f"Anomaly detection failed for {metric_name}: {exc}")
            return []
    
    def _simple_anomaly_detection(self, data: List[Dict], metric_name: str) -> List[AnomalyDetection]:
        """Simple statistical anomaly detection when ML models fail."""
        values = [float(row['value']) for row in data]
        if len(values) < 3:
            return []
        
        # Calculate statistical thresholds
        mean_val = np.mean(values)
        std_val = np.std(values)
        threshold = mean_val + 2 * std_val  # 2 standard deviations
        
        anomalies = []
        for row in data:
            value = float(row['value'])
            if value > threshold:
                anomalies.append(AnomalyDetection(
                    metric_name=metric_name,
                    anomaly_value=value,
                    expected_range=(mean_val - 2*std_val, mean_val + 2*std_val),
                    anomaly_score=min((value - threshold) / std_val, 1.0),
                    detected_at=datetime.fromisoformat(row['hour']),
                    context={
                        'detection_method': 'statistical',
                        'z_score': (value - mean_val) / std_val,
                        'threshold': threshold
                    }
                ))
        
        return anomalies
    
    def generate_business_insights(self) -> List[BusinessInsight]:
        """
        Generate business intelligence insights from system data.
        
        Analyzes patterns and provides actionable insights.
        """
        insights = []
        
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    # Get various metrics for analysis
                    cur.execute("""
                        SELECT 
                            'entity_creation' as metric,
                            COUNT(*) as daily_count,
                            DATE_TRUNC('day', created_at) as date
                        FROM timeline_events
                        WHERE source_type = 'entity_created'
                        AND created_at >= NOW() - INTERVAL '30 days'
                        GROUP BY DATE_TRUNC('day', created_at)
                        
                        UNION ALL
                        
                        SELECT 
                            'query_volume' as metric,
                            COUNT(*) as daily_count,
                            DATE_TRUNC('day', created_at) as date
                        FROM timeline_events
                        WHERE source_type = 'query_executed'
                        AND created_at >= NOW() - INTERVAL '30 days'
                        GROUP BY DATE_TRUNC('day', created_at)
                        
                        UNION ALL
                        
                        SELECT 
                            'task_completion' as metric,
                            COUNT(*) as daily_count,
                            DATE_TRUNC('day', created_at) as date
                        FROM agent_runs
                        WHERE status = 'completed'
                        AND created_at >= NOW() - INTERVAL '30 days'
                        GROUP BY DATE_TRUNC('day', created_at)
                    """)
                    
                    metrics_data = cur.fetchall()
                    
                    # Analyze each metric type
                    metrics_by_type = defaultdict(list)
                    for row in metrics_data:
                        metrics_by_type[row['metric']].append(row)
                    
                    for metric_type, data in metrics_by_type.items():
                        if len(data) < 7:
                            continue
                        
                        # Calculate trends and patterns
                        values = [float(row['daily_count']) for row in data]
                        dates = [row['date'] for row in data]
                        
                        # Simple trend analysis
                        recent_avg = np.mean(values[-7:])
                        previous_avg = np.mean(values[-14:-7]) if len(values) >= 14 else recent_avg
                        
                        trend_change = (recent_avg - previous_avg) / previous_avg if previous_avg > 0 else 0
                        
                        # Generate insight based on trend
                        if trend_change > 0.2:  # 20% increase
                            insight = BusinessInsight(
                                insight_type='growth_opportunity',
                                title=f'{metric_type.replace("_", " ").title()} Growth Detected',
                                description=f'{metric_type.replace("_", " ").title()} increased by {trend_change:.1%} in the last week compared to previous period.',
                                impact_level='high' if trend_change > 0.5 else 'medium',
                                confidence=0.8,
                                recommendations=[
                                    f'Consider scaling resources for increased {metric_type.replace("_", " ").title()}',
                                    f'Investigate drivers of {metric_type.replace("_", " ").title()} growth',
                                    f'Plan for continued growth trajectory'
                                ],
                                supporting_data={
                                    'trend_change': float(trend_change),
                                    'recent_avg': float(recent_avg),
                                    'previous_avg': float(previous_avg),
                                    'data_points': len(values)
                                },
                                created_at=datetime.now(timezone.utc)
                            )
                            insights.append(insight)
                        
                        elif trend_change < -0.2:  # 20% decrease
                            insight = BusinessInsight(
                                insight_type='decline_alert',
                                title=f'{metric_type.replace("_", " ").title()} Decline Detected',
                                description=f'{metric_type.replace("_", " ").title()} decreased by {abs(trend_change):.1%} in the last week.',
                                impact_level='high' if abs(trend_change) > 0.5 else 'medium',
                                confidence=0.8,
                                recommendations=[
                                    f'Investigate causes of {metric_type.replace("_", " ").title()} decline',
                                    f'Review recent changes that may impact {metric_type.replace("_", " ").title()}',
                                    f'Consider engagement strategies'
                                ],
                                supporting_data={
                                    'trend_change': float(trend_change),
                                    'recent_avg': float(recent_avg),
                                    'previous_avg': float(previous_avg),
                                    'data_points': len(values)
                                },
                                created_at=datetime.now(timezone.utc)
                            )
                            insights.append(insight)
            
            return insights
            
        except Exception as exc:
            self.logger.error(f"Business insights generation failed: {exc}")
            return []
    
    def store_analytics_results(self, result: Any, result_type: str) -> None:
        """Store analytics results in database."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO timeline_events (entity_id, event_ts, source_type, source_ref, event_md, event_payload)
                        VALUES (
                            (SELECT id FROM entities WHERE slug = 'system' LIMIT 1),
                            NOW(),
                            %s,
                            'predictive_analytics',
                            %s,
                            %s,
                            %s
                        )
                    """, (
                        f"Analytics: {result_type}",
                        result_type,
                        f"Generated {result_type} analytics results",
                        json.dumps(result, default=str)
                    ))
                conn.commit()
                
            self.logger.info(f"Stored analytics results: {result_type}")
            
        except Exception as exc:
            self.logger.error(f"Failed to store analytics results: {exc}")


# Global instance
predictive_analytics = PredictiveAnalyticsService()
