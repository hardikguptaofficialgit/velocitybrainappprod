"""Background maintenance: consolidation, dedup, enrichment, insights."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from psycopg.types.json import Json

from src.core.db import get_conn, serialize_vector
from src.core.logging_config import get_logger
from src.services.embedding_service import EmbeddingService

logger = get_logger('maintenance_service')

_TIMELINE_KEEP = 50
_STALE_DAYS = 90
_CONFIDENCE_FLOOR = 0.35


class MaintenanceService:
    def consolidate_memory(self) -> dict[str, Any]:
        """Trim excess timeline rows per entity to keep storage bounded."""
        deleted = 0
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    WITH ranked AS (
                      SELECT id,
                             ROW_NUMBER() OVER (
                               PARTITION BY entity_id ORDER BY event_ts DESC
                             ) AS rn
                      FROM timeline_events
                    )
                    DELETE FROM timeline_events t
                    USING ranked r
                    WHERE t.id = r.id AND r.rn > %s
                    RETURNING t.id
                    """,
                    (_TIMELINE_KEEP,),
                )
                deleted = cur.rowcount or 0
                conn.commit()
        logger.info('memory_consolidation complete', extra={'deleted_events': deleted})
        return {'deleted_timeline_events': deleted}

    def dedup_merge(self) -> dict[str, Any]:
        """Merge duplicate entities that share the same normalized title."""
        merged = 0
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT LOWER(TRIM(title)) AS norm_title,
                           array_agg(id ORDER BY updated_at DESC) AS ids,
                           array_agg(slug ORDER BY updated_at DESC) AS slugs
                    FROM entities
                    GROUP BY LOWER(TRIM(title))
                    HAVING COUNT(*) > 1
                    LIMIT 25
                    """
                )
                groups = cur.fetchall()
                for group in groups:
                    ids = group['ids']
                    if not ids or len(ids) < 2:
                        continue
                    keeper_id, *dup_ids = ids
                    for dup_id in dup_ids:
                        cur.execute(
                            'UPDATE timeline_events SET entity_id = %s WHERE entity_id = %s',
                            (keeper_id, dup_id),
                        )
                        cur.execute(
                            'UPDATE embeddings SET entity_id = %s WHERE entity_id = %s',
                            (keeper_id, dup_id),
                        )
                        cur.execute(
                            """
                            DELETE FROM relationships
                            WHERE from_entity_id = %s OR to_entity_id = %s
                            """,
                            (dup_id, dup_id),
                        )
                        cur.execute('DELETE FROM entities WHERE id = %s', (dup_id,))
                        merged += 1
                conn.commit()
        logger.info('dedup_merge complete', extra={'merged_entities': merged})
        return {'merged_entities': merged}

    def enrich_entities(self) -> dict[str, Any]:
        """Refresh missing embeddings and decay stale low-confidence entities."""
        embedding = EmbeddingService()
        refreshed = 0
        decayed = 0
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT e.id, e.compiled_truth_md
                    FROM entities e
                    LEFT JOIN embeddings emb ON emb.entity_id = e.id
                    WHERE emb.id IS NULL
                      AND e.compiled_truth_md IS NOT NULL
                      AND LENGTH(e.compiled_truth_md) > 0
                    LIMIT 40
                    """
                )
                missing = cur.fetchall()
                for row in missing:
                    text = (row['compiled_truth_md'] or '')[:1500]
                    if not text.strip():
                        continue
                    emb = embedding.embed_text(text)
                    vector = serialize_vector(emb['vector'])
                    cur.execute(
                        """
                        INSERT INTO embeddings (entity_id, chunk_type, chunk_text, embedding, created_at)
                        VALUES (%s, 'compiled_truth', %s, %s::vector, NOW())
                        """,
                        (row['id'], text, vector),
                    )
                    refreshed += 1

                cur.execute(
                    """
                    UPDATE entities
                    SET confidence = GREATEST(%s, confidence - 0.05)
                    WHERE updated_at < NOW() - make_interval(days => %s)
                      AND confidence > %s
                    """,
                    (_CONFIDENCE_FLOOR, _STALE_DAYS, _CONFIDENCE_FLOOR + 0.05),
                )
                decayed = cur.rowcount or 0
                conn.commit()
        logger.info(
            'entity_enrichment complete',
            extra={'embeddings_refreshed': refreshed, 'entities_decayed': decayed},
        )
        return {'embeddings_refreshed': refreshed, 'entities_decayed': decayed}

    def generate_insights(self) -> dict[str, Any]:
        """Persist lightweight stats as daily brain insights."""
        created = 0
        now = datetime.now(timezone.utc)
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT COUNT(*) AS c FROM entities')
                entity_count = int((cur.fetchone() or {}).get('c') or 0)
                cur.execute(
                    """
                    SELECT type, COUNT(*) AS c
                    FROM entities
                    GROUP BY type
                    ORDER BY c DESC
                    LIMIT 5
                    """
                )
                top_types = cur.fetchall()
                summary_lines = [
                    f'- Total entities: **{entity_count}**',
                ]
                for row in top_types:
                    summary_lines.append(f"- {row['type']}: {row['c']}")
                summary_md = '\n'.join(summary_lines)
                title = f'Brain snapshot {now.date().isoformat()}'
                cur.execute(
                    """
                    SELECT id FROM insights
                    WHERE insight_type = 'daily_snapshot'
                      AND title = %s
                      AND created_at::date = CURRENT_DATE
                    LIMIT 1
                    """,
                    (title,),
                )
                if not cur.fetchone():
                    cur.execute(
                        """
                        INSERT INTO insights (insight_type, title, summary_md, confidence, insight_references)
                        VALUES ('daily_snapshot', %s, %s, %s, %s)
                        """,
                        (title, summary_md, 0.85, Json([{'kind': 'stats', 'entity_count': entity_count}])),
                    )
                    created = 1
                conn.commit()
        logger.info('insight_generation complete', extra={'insights_created': created})
        return {'insights_created': created, 'entity_count': entity_count}
