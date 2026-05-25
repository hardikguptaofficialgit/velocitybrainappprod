from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timezone

from src.core.db import get_conn
from src.core.logging_config import get_logger
from src.services.maintenance_service import MaintenanceService

scheduler = BackgroundScheduler(timezone='UTC')
logger = get_logger('scheduler')
_maintenance = MaintenanceService()


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


def _run_job(job_name: str, handler):
    try:
        stats = handler()
        _mark_job(job_name, 'ok')
        logger.info(f'{job_name} finished', extra={'stats': stats})
    except Exception as exc:
        _mark_job(job_name, 'error')
        logger.error(f'{job_name} failed', extra={'error': str(exc)})


def consolidate_memory():
    _run_job('memory_consolidation', _maintenance.consolidate_memory)


def enrich_entities():
    _run_job('entity_enrichment', _maintenance.enrich_entities)


def dedup_merge():
    _run_job('duplicate_merge', _maintenance.dedup_merge)


def generate_insights():
    _run_job('insight_generation', _maintenance.generate_insights)


def start_scheduler():
    if scheduler.running:
        return
    scheduler.add_job(consolidate_memory, 'cron', minute='*/20', id='memory_consolidation', replace_existing=True)
    scheduler.add_job(enrich_entities, 'cron', minute='*/30', id='entity_enrichment', replace_existing=True)
    scheduler.add_job(dedup_merge, 'cron', hour='*/2', id='dedup_merge', replace_existing=True)
    scheduler.add_job(generate_insights, 'cron', hour='6', minute='0', id='insight_generation_daily', replace_existing=True)
    scheduler.start()
