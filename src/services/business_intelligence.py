"""
Business Intelligence Service for Velocity Brain.

This service provides advanced analytics, KPI tracking, and business insights
for organizational decision making and performance optimization.
"""

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass
from collections import defaultdict, deque
import numpy as np

from src.core.db import get_conn
from src.core.logging_config import get_logger
from src.core.config import settings


@dataclass
class KPI:
    """Key Performance Indicator."""
    name: str
    value: float
    target: Optional[float]
    unit: str
    trend_direction: str  # 'up', 'down', 'stable'
    trend_percentage: float
    last_updated: datetime
    category: str  # 'productivity', 'engagement', 'quality', 'efficiency'


@dataclass
class BusinessMetric:
    """Business metric with analysis."""
    metric_name: str
    current_value: float
    previous_value: float
    change_percentage: float
    trend_strength: float
    confidence: float
    insights: List[str]
    recommendations: List[str]
    time_period_days: int


@dataclass
class PerformanceReport:
    """Comprehensive performance report."""
    report_id: str
    generated_at: datetime
    time_period_days: int
    kpis: List[KPI]
    metrics: List[BusinessMetric]
    insights: List[str]
    action_items: List[str]
    overall_score: float


class BusinessIntelligenceService:
    """Advanced business intelligence and analytics service."""
    
    def __init__(self):
        self.logger = get_logger('business_intelligence')
        self.kpi_definitions = self._load_kpi_definitions()
        
    def _load_kpi_definitions(self) -> Dict[str, Dict]:
        """Load KPI definitions from configuration or defaults."""
        return {
            'daily_active_users': {
                'name': 'Daily Active Users',
                'unit': 'count',
                'category': 'engagement',
                'target': 100,
                'description': 'Number of unique users per day'
            },
            'knowledge_entities': {
                'name': 'Knowledge Entities',
                'unit': 'count',
                'category': 'productivity',
                'target': None,
                'description': 'Total number of knowledge entities'
            },
            'queries_per_day': {
                'name': 'Queries Per Day',
                'unit': 'count',
                'category': 'engagement',
                'target': 50,
                'description': 'Number of queries executed per day'
            },
            'task_completion_rate': {
                'name': 'Task Completion Rate',
                'unit': 'percentage',
                'category': 'efficiency',
                'target': 85,
                'description': 'Percentage of tasks completed successfully'
            },
            'response_time_ms': {
                'name': 'Average Response Time',
                'unit': 'milliseconds',
                'category': 'performance',
                'target': 500,
                'description': 'Average response time for queries'
            },
            'error_rate': {
                'name': 'Error Rate',
                'unit': 'percentage',
                'category': 'quality',
                'target': 5,
                'description': 'Percentage of operations resulting in errors'
            }
        }
    
    def calculate_kpis(self, days: int = 7) -> List[KPI]:
        """
        Calculate KPIs for the specified time period.
        
        Analyzes system usage, performance, and business metrics.
        """
        kpis = []
        
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    # Calculate daily active users
                    cur.execute("""
                        SELECT COUNT(DISTINCT actor) as daily_users
                        FROM timeline_events
                        WHERE event_ts >= NOW() - INTERVAL '%s days'
                        AND actor IS NOT NULL
                    """, (days))
                    
                    user_result = cur.fetchone()
                    daily_users = float(user_result['daily_users']) if user_result else 0.0
                    
                    # Calculate knowledge entities
                    cur.execute("""
                        SELECT COUNT(*) as total_entities
                        FROM entities
                        WHERE updated_at >= NOW() - INTERVAL '%s days'
                    """, (days))
                    
                    entity_result = cur.fetchone()
                    total_entities = float(entity_result['total_entities']) if entity_result else 0.0
                    
                    # Calculate queries per day
                    cur.execute("""
                        SELECT COUNT(*) / %s as queries_per_day
                        FROM timeline_events
                        WHERE event_ts >= NOW() - INTERVAL '%s days'
                        AND source_type = 'query_executed'
                    """, (days))
                    
                    query_result = cur.fetchone()
                    queries_per_day = float(query_result['queries_per_day']) if query_result else 0.0
                    
                    # Calculate task completion rate
                    cur.execute("""
                        SELECT 
                            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                            COUNT(*) as total
                        FROM agent_runs
                        WHERE created_at >= NOW() - INTERVAL '%s days'
                    """, (days))
                    
                    task_result = cur.fetchone()
                    if task_result and task_result['total'] > 0:
                        completion_rate = (task_result['completed'] / task_result['total']) * 100
                    else:
                        completion_rate = 0.0
                    
                    # Calculate average response time
                    cur.execute("""
                        SELECT AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) * 1000) as avg_response_ms
                        FROM agent_runs
                        WHERE status = 'completed'
                        AND created_at >= NOW() - INTERVAL '%s days'
                    """, (days))
                    
                    response_result = cur.fetchone()
                    avg_response_time = float(response_result['avg_response_ms']) if response_result else 0.0
                    
                    # Calculate error rate
                    cur.execute("""
                        SELECT 
                            COUNT(CASE WHEN status = 'failed' THEN 1 END) as errors,
                            COUNT(*) as total
                        FROM agent_runs
                        WHERE created_at >= NOW() - INTERVAL '%s days'
                    """, (days))
                    
                    error_result = cur.fetchone()
                    if error_result and error_result['total'] > 0:
                        error_rate = (error_result['errors'] / error_result['total']) * 100
                    else:
                        error_rate = 0.0
                    
                    # Create KPI objects
                    kpi_configs = self.kpi_definitions
                    
                    kpis.append(KPI(
                        name=kpi_configs['daily_active_users']['name'],
                        value=daily_users,
                        target=kpi_configs['daily_active_users']['target'],
                        unit=kpi_configs['daily_active_users']['unit'],
                        trend_direction=self._calculate_trend(daily_users, 'daily_active_users'),
                        trend_percentage=self._calculate_trend_percentage(daily_users, 'daily_active_users'),
                        last_updated=datetime.now(timezone.utc),
                        category=kpi_configs['daily_active_users']['category']
                    ))
                    
                    kpis.append(KPI(
                        name=kpi_configs['knowledge_entities']['name'],
                        value=total_entities,
                        target=kpi_configs['knowledge_entities']['target'],
                        unit=kpi_configs['knowledge_entities']['unit'],
                        trend_direction=self._calculate_trend(total_entities, 'knowledge_entities'),
                        trend_percentage=self._calculate_trend_percentage(total_entities, 'knowledge_entities'),
                        last_updated=datetime.now(timezone.utc),
                        category=kpi_configs['knowledge_entities']['category']
                    ))
                    
                    kpis.append(KPI(
                        name=kpi_configs['queries_per_day']['name'],
                        value=queries_per_day,
                        target=kpi_configs['queries_per_day']['target'],
                        unit=kpi_configs['queries_per_day']['unit'],
                        trend_direction=self._calculate_trend(queries_per_day, 'queries_per_day'),
                        trend_percentage=self._calculate_trend_percentage(queries_per_day, 'queries_per_day'),
                        last_updated=datetime.now(timezone.utc),
                        category=kpi_configs['queries_per_day']['category']
                    ))
                    
                    kpis.append(KPI(
                        name=kpi_configs['task_completion_rate']['name'],
                        value=completion_rate,
                        target=kpi_configs['task_completion_rate']['target'],
                        unit=kpi_configs['task_completion_rate']['unit'],
                        trend_direction=self._calculate_trend(completion_rate, 'task_completion_rate'),
                        trend_percentage=self._calculate_trend_percentage(completion_rate, 'task_completion_rate'),
                        last_updated=datetime.now(timezone.utc),
                        category=kpi_configs['task_completion_rate']['category']
                    ))
                    
                    kpis.append(KPI(
                        name=kpi_configs['response_time_ms']['name'],
                        value=avg_response_time,
                        target=kpi_configs['response_time_ms']['target'],
                        unit=kpi_configs['response_time_ms']['unit'],
                        trend_direction=self._calculate_trend(avg_response_time, 'response_time_ms'),
                        trend_percentage=self._calculate_trend_percentage(avg_response_time, 'response_time_ms'),
                        last_updated=datetime.now(timezone.utc),
                        category=kpi_configs['response_time_ms']['category']
                    ))
                    
                    kpis.append(KPI(
                        name=kpi_configs['error_rate']['name'],
                        value=error_rate,
                        target=kpi_configs['error_rate']['target'],
                        unit=kpi_configs['error_rate']['unit'],
                        trend_direction=self._calculate_trend(error_rate, 'error_rate'),
                        trend_percentage=self._calculate_trend_percentage(error_rate, 'error_rate'),
                        last_updated=datetime.now(timezone.utc),
                        category=kpi_configs['error_rate']['category']
                    ))
            
            return kpis
            
        except Exception as exc:
            self.logger.error(f"KPI calculation failed: {exc}")
            return []
    
    def _calculate_trend(self, current_value: float, metric_name: str) -> str:
        """Calculate trend direction based on historical data."""
        # This would need historical data storage
        # For now, use a simple heuristic
        return 'stable'  # Would be enhanced with historical comparison
    
    def _calculate_trend_percentage(self, current_value: float, metric_name: str) -> float:
        """Calculate trend percentage."""
        # Placeholder for actual trend calculation
        return 0.0  # Would be enhanced with historical comparison
    
    def generate_insights(self, kpis: List[KPI]) -> List[str]:
        """
        Generate business insights from KPI data.
        
        Identifies patterns, anomalies, and opportunities.
        """
        insights = []
        
        for kpi in kpis:
            insights.extend(self._analyze_kpi_performance(kpi))
            insights.extend(self._identify_kpi_opportunities(kpi))
            insights.extend(self._detect_kpi_anomalies(kpi))
        
        return insights
    
    def _analyze_kpi_performance(self, kpi: KPI) -> List[str]:
        """Analyze KPI performance and generate insights."""
        insights = []
        
        # Performance against target
        if kpi.target is not None:
            performance_ratio = kpi.value / kpi.target
            
            if kpi.category == 'performance' and kpi.unit == 'milliseconds':
                # Lower is better for response time
                if performance_ratio > 1.2:  # 20% slower than target
                    insights.append(f"{kpi.name} is {performance_ratio:.1%} slower than target ({kpi.target:.0f}ms)")
                elif performance_ratio < 0.8:  # 20% faster than target
                    insights.append(f"{kpi.name} is {abs(performance_ratio - 1):.1%} faster than target ({kpi.target:.0f}ms)")
            
            elif kpi.category == 'quality':
                if performance_ratio > 1.1:  # 10% worse than target
                    insights.append(f"{kpi.name} is {performance_ratio:.1%} higher than target ({kpi.target:.1f}%)")
                elif performance_ratio < 0.9:  # 10% better than target
                    insights.append(f"{kpi.name} is {abs(performance_ratio - 1):.1%} better than target ({kpi.target:.1f}%)")
            
            elif kpi.category == 'efficiency':
                if performance_ratio < 0.8:  # 20% below target
                    insights.append(f"{kpi.name} is {abs(performance_ratio - 1):.1%} below target ({kpi.target:.1f}%)")
            
            elif kpi.category == 'engagement':
                if performance_ratio < 0.7:  # 30% below target
                    insights.append(f"{kpi.name} is {abs(performance_ratio - 1):.1%} below target ({kpi.target:.1f})")
        
        return insights
    
    def _identify_kpi_opportunities(self, kpi: KPI) -> List[str]:
        """Identify opportunities for improvement."""
        opportunities = []
        
        # High-performing areas to leverage
        if kpi.trend_direction == 'up' and kpi.value > (kpi.target or 0) * 1.1:
            opportunities.append(f"Strong performance in {kpi.name} presents scaling opportunity")
        
        # Areas needing attention
        if kpi.trend_direction == 'down' and kpi.value < (kpi.target or 0) * 0.8:
            opportunities.append(f"Declining {kpi.name} requires immediate attention and intervention")
        
        # Stable but below target
        if kpi.trend_direction == 'stable' and kpi.value < (kpi.target or 0) * 0.9:
            opportunities.append(f"{kpi.name} consistently below target - consider process improvements")
        
        return opportunities
    
    def _detect_kpi_anomalies(self, kpi: KPI) -> List[str]:
        """Detect anomalies in KPI data."""
        anomalies = []
        
        # Simple anomaly detection based on trend changes
        if kpi.trend_direction == 'down' and kpi.trend_percentage < -0.3:  # 30% drop
            anomalies.append(f"Significant decline detected in {kpi.name} ({kpi.trend_percentage:.1f}%)")
        
        elif kpi.trend_direction == 'up' and kpi.trend_percentage > 0.5:  # 50% increase
            anomalies.append(f"Unusual growth detected in {kpi.name} ({kpi.trend_percentage:.1f}%) - verify data quality")
        
        return anomalies
    
    def generate_performance_report(self, days: int = 30) -> PerformanceReport:
        """
        Generate comprehensive performance report.
        
        Combines KPIs, metrics, and insights for decision making.
        """
        try:
            # Calculate KPIs
            kpis = self.calculate_kpis(days)
            
            # Generate business metrics
            metrics = self._calculate_business_metrics(kpis, days)
            
            # Generate insights
            insights = self.generate_insights(kpis)
            
            # Generate action items
            action_items = self._generate_action_items(kpis, insights)
            
            # Calculate overall score
            overall_score = self._calculate_overall_score(kpis)
            
            report = PerformanceReport(
                report_id=f"report_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
                generated_at=datetime.now(timezone.utc),
                time_period_days=days,
                kpis=kpis,
                metrics=metrics,
                insights=insights,
                action_items=action_items,
                overall_score=overall_score
            )
            
            # Store report
            self._store_performance_report(report)
            
            return report
            
        except Exception as exc:
            self.logger.error(f"Performance report generation failed: {exc}")
            return PerformanceReport(
                report_id=f"error_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
                generated_at=datetime.now(timezone.utc),
                time_period_days=days,
                kpis=[],
                metrics=[],
                insights=[f"Report generation failed: {str(exc)}"],
                action_items=[],
                overall_score=0.0
            )
    
    def _calculate_business_metrics(self, kpis: List[KPI], days: int) -> List[BusinessMetric]:
        """Calculate business metrics from KPIs."""
        metrics = []
        
        # Group KPIs by category
        kpis_by_category = defaultdict(list)
        for kpi in kpis:
            kpis_by_category[kpi.category].append(kpi)
        
        for category, category_kpis in kpis_by_category.items():
            if len(category_kpis) >= 2:
                # Calculate aggregate metrics for category
                total_value = sum(kpi.value for kpi in category_kpis)
                avg_value = total_value / len(category_kpis)
                
                # Calculate trend
                trend_values = [kpi.trend_percentage for kpi in category_kpis if kpi.trend_percentage != 0]
                avg_trend = np.mean(trend_values) if trend_values else 0.0
                
                metrics.append(BusinessMetric(
                    metric_name=f"{category.title()} Performance",
                    current_value=avg_value,
                    previous_value=avg_value,  # Would be historical
                    change_percentage=avg_trend,
                    trend_strength=abs(avg_trend),
                    confidence=0.8,
                    insights=[f"Average {category.title()} performance: {avg_value:.2f}"],
                    recommendations=self._get_category_recommendations(category, category_kpis),
                    time_period_days=days
                ))
        
        return metrics
    
    def _get_category_recommendations(self, category: str, kpis: List[KPI]) -> List[str]:
        """Get recommendations for a KPI category."""
        recommendations = []
        
        if category == 'engagement':
            low_performers = [kpi for kpi in kpis if kpi.value < (kpi.target or 0) * 0.8]
            if low_performers:
                recommendations.append("Review user engagement strategies and content relevance")
            
        elif category == 'performance':
            slow_performers = [kpi for kpi in kpis if kpi.value > (kpi.target or 0) * 1.2]
            if slow_performers:
                recommendations.append("Investigate performance bottlenecks and optimize system resources")
            
        elif category == 'quality':
            high_error_rates = [kpi for kpi in kpis if kpi.value > (kpi.target or 0) * 1.1]
            if high_error_rates:
                recommendations.append("Implement quality assurance measures and error monitoring")
        
        elif category == 'efficiency':
            low_completion_rates = [kpi for kpi in kpis if kpi.value < (kpi.target or 0) * 0.8]
            if low_completion_rates:
                recommendations.append("Streamline workflows and remove process bottlenecks")
        
        return recommendations
    
    def _generate_action_items(self, kpis: List[KPI], insights: List[str]) -> List[str]:
        """Generate actionable items from KPIs and insights."""
        action_items = []
        
        # Critical issues requiring immediate attention
        critical_kpis = [kpi for kpi in kpis if kpi.value < (kpi.target or 0) * 0.7]
        for kpi in critical_kpis:
            action_items.append(f"URGENT: Address {kpi.name} - currently {kpi.value:.1f} vs target {kpi.target:.1f}")
        
        # Opportunities to leverage
        high_performers = [kpi for kpi in kpis if kpi.value > (kpi.target or 0) * 1.2]
        for kpi in high_performers:
            action_items.append(f"OPPORTUNITY: Scale success of {kpi.name} - currently {kpi.value:.1f} vs target {kpi.target:.1f}")
        
        # Anomalies to investigate
        for insight in insights:
            if 'decline' in insight.lower() or 'anomaly' in insight.lower():
                action_items.append(f"INVESTIGATE: {insight}")
        
        return action_items
    
    def _calculate_overall_score(self, kpis: List[KPI]) -> float:
        """Calculate overall performance score."""
        if not kpis:
            return 0.0
        
        # Weight different categories differently
        weights = {
            'engagement': 0.3,
            'productivity': 0.25,
            'performance': 0.2,
            'efficiency': 0.15,
            'quality': 0.1
        }
        
        total_score = 0.0
        total_weight = 0.0
        
        for kpi in kpis:
            if kpi.target is not None:
                # Calculate performance score (100% = target)
                performance_score = min(kpi.value / kpi.target * 100, 150)  # Cap at 150%
                
                category_weight = weights.get(kpi.category, 0.1)
                weighted_score = (performance_score / 100) * category_weight
                
                total_score += weighted_score
                total_weight += category_weight
        
        return total_score if total_weight > 0 else 0.0
    
    def _store_performance_report(self, report: PerformanceReport) -> None:
        """Store performance report in database."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO timeline_events 
                            (entity_id, event_ts, source_type, source_ref, event_md, event_payload)
                        VALUES (
                            (SELECT id FROM entities WHERE slug = 'system' LIMIT 1),
                            NOW(),
                            'performance_report',
                            %s,
                            %s,
                            %s,
                            %s
                        )
                    """, (
                        report.report_id,
                        f"Performance Report for {report.time_period_days} days",
                        json.dumps({
                            'report_id': report.report_id,
                            'overall_score': report.overall_score,
                            'kpi_count': len(report.kpis),
                            'insight_count': len(report.insights),
                            'action_item_count': len(report.action_items),
                            'time_period_days': report.time_period_days
                        }, default=str)
                    ))
                conn.commit()
                    
            self.logger.info(f"Stored performance report: {report.report_id}")
            
        except Exception as exc:
            self.logger.error(f"Failed to store performance report: {exc}")


# Global instances used by API routes
business_intelligence = BusinessIntelligenceService()
business_intel = business_intelligence
