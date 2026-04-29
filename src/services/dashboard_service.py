from src.core.db import get_conn
from src.services.job_queue_service import JobQueueService
from src.services.metrics_service import MetricsService
from src.services.skill_registry import SkillRegistry


class DashboardService:
    def __init__(self):
        self.skills = SkillRegistry('skills')
        self.jobs = JobQueueService()
        self.metrics = MetricsService()

    def summary(self) -> dict:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT COUNT(*) AS c FROM entities')
                entities = cur.fetchone()['c']
                cur.execute('SELECT COUNT(*) AS c FROM timeline_events')
                timeline = cur.fetchone()['c']
                cur.execute('SELECT run_id, status, intent, confidence, created_at FROM agent_runs ORDER BY created_at DESC LIMIT 10')
                recent_runs = cur.fetchall()
                cur.execute('SELECT slug, title, type, updated_at FROM entities ORDER BY updated_at DESC LIMIT 10')
                recent_entities = cur.fetchall()

        queue = self.jobs.list_jobs(limit=50)
        by_status = {}
        for job in queue.get('jobs', []):
            st = job.get('status', 'unknown')
            by_status[st] = by_status.get(st, 0) + 1

        return {
            'kpis': {
                'entities': entities,
                'timeline_events': timeline,
                'enabled_skills': len(self.skills.list_skills()),
                'queued_jobs': by_status.get('queued', 0) + by_status.get('retry', 0),
                'failed_jobs': by_status.get('failed', 0),
            },
            'recent_runs': recent_runs,
            'recent_entities': recent_entities,
            'job_status': by_status,
            'metrics': self.metrics.snapshot(),
        }
