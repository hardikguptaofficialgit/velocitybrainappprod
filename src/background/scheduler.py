from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timezone
from src.core.db import get_conn

scheduler = BackgroundScheduler(timezone='UTC')


def _mark_job(job_name: str, status: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO optimization_jobs (job_name, priority_tier, schedule_cron, enabled, last_run_at, last_status)
                VALUES (%s,'tier2','system',true,%s,%s)
                ON CONFLICT (job_name)
                DO UPDATE SET last_run_at = EXCLUDED.last_run_at, last_status = EXCLUDED.last_status
                """,
                (job_name, datetime.now(timezone.utc), status),
            )
            conn.commit()


def consolidate_memory():
    _mark_job('memory_consolidation', 'ok')


def enrich_entities():
    _mark_job('entity_enrichment', 'ok')


def dedup_merge():
    _mark_job('duplicate_merge', 'ok')


def generate_insights():
    _mark_job('insight_generation', 'ok')


def start_scheduler():
    if scheduler.running:
        return
    scheduler.add_job(consolidate_memory, 'cron', minute='*/20', id='memory_consolidation', replace_existing=True)
    scheduler.add_job(enrich_entities, 'cron', minute='*/30', id='entity_enrichment', replace_existing=True)
    scheduler.add_job(dedup_merge, 'cron', hour='*/2', id='dedup_merge', replace_existing=True)
    scheduler.add_job(generate_insights, 'cron', hour='6', minute='0', id='insight_generation_daily', replace_existing=True)
    scheduler.start()
