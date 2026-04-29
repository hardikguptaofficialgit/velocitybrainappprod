import re
from datetime import datetime, timezone
from typing import Any

from psycopg.types.json import Json

from src.core.db import get_conn, serialize_vector
from src.services.embedding_service import EmbeddingService


class MemoryEngine:
    def __init__(self):
        self.embedding = EmbeddingService()

    def _slugify(self, text: str) -> str:
        return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')

    def upsert_from_text(
        self,
        source: str,
        content: str,
        access_level: str = 'private',
        org_key: str | None = None,
        actor: str | None = None,
        owners: list[str] | None = None,
    ) -> dict:
        name_match = re.search(r'([A-Z][a-z]+\s+[A-Z][a-z]+)', content)
        company_match = re.search(r'\b(?:from|at)\s+([A-Z][A-Za-z0-9& -]{1,40})', content)
        title = name_match.group(1) if name_match else f'{source}-note-{datetime.now(timezone.utc).date()}'
        slug = self._slugify(title)
        entity_type = 'person' if name_match else 'note'
        now = datetime.now(timezone.utc)
        owner_list = list(dict.fromkeys((owners or []) + ([actor] if actor else [])))

        metadata = {
            'org_key': org_key,
            'owners': owner_list,
            'source': source,
            'updated_by': actor,
        }

        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT id, compiled_truth_md, confidence FROM entities WHERE slug = %s', (slug,))
                row = cur.fetchone()
                compiled_truth = content.strip()[:4000]
                if row:
                    cur.execute(
                        'INSERT INTO entity_versions (entity_id, previous_compiled_truth_md, next_compiled_truth_md, change_reason, confidence_before, confidence_after) VALUES (%s,%s,%s,%s,%s,%s)',
                        (row['id'], row['compiled_truth_md'], compiled_truth, f'updated from {source}', row['confidence'], 0.75),
                    )
                    cur.execute(
                        'UPDATE entities SET compiled_truth_md = %s, confidence = %s, metadata = %s, updated_at = NOW() WHERE id = %s',
                        (compiled_truth, 0.75, Json(metadata), row['id']),
                    )
                    entity_id = row['id']
                else:
                    cur.execute(
                        'INSERT INTO entities (slug, type, title, access_level, compiled_truth_md, confidence, metadata) VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id',
                        (slug, entity_type, title, access_level, compiled_truth, 0.7, Json(metadata)),
                    )
                    entity_id = cur.fetchone()['id']

                cur.execute(
                    'INSERT INTO timeline_events (entity_id, event_ts, source_type, source_ref, event_md, event_payload) VALUES (%s,%s,%s,%s,%s,%s)',
                    (entity_id, now, source, source, content[:1000], Json({'ingested': True, 'org_key': org_key, 'actor': actor})),
                )

                emb = self.embedding.embed_text(compiled_truth)
                vector = serialize_vector(emb['vector'])
                cur.execute('DELETE FROM embeddings WHERE entity_id = %s AND chunk_type = %s', (entity_id, 'compiled_truth'))
                cur.execute(
                    'INSERT INTO embeddings (entity_id, chunk_type, chunk_text, embedding, created_at) VALUES (%s,%s,%s,%s::vector,NOW())',
                    (entity_id, 'compiled_truth', compiled_truth[:1500], vector),
                )

                if name_match and company_match:
                    company_title = company_match.group(1).strip()
                    company_slug = self._slugify(company_title)
                    cur.execute('SELECT id FROM entities WHERE slug = %s', (company_slug,))
                    crow = cur.fetchone()
                    if crow:
                        company_id = crow['id']
                    else:
                        cur.execute(
                            'INSERT INTO entities (slug, type, title, access_level, compiled_truth_md, confidence, metadata) VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id',
                            (
                                company_slug,
                                'company',
                                company_title,
                                access_level,
                                f'{company_title} referenced in {source}.',
                                0.55,
                                Json({'org_key': org_key, 'owners': owner_list}),
                            ),
                        )
                        company_id = cur.fetchone()['id']

                    cur.execute(
                        """
                        INSERT INTO relationships (from_entity_id, to_entity_id, relation_type, strength, evidence, first_seen, last_seen)
                        VALUES (%s,%s,%s,%s,%s,%s,%s)
                        ON CONFLICT (from_entity_id, to_entity_id, relation_type)
                        DO UPDATE SET
                          strength = LEAST(1.0, relationships.strength + 0.05),
                          last_seen = EXCLUDED.last_seen,
                          evidence = relationships.evidence || EXCLUDED.evidence
                        """,
                        (
                            entity_id,
                            company_id,
                            'affiliated_with',
                            0.6,
                            Json([{'source': source, 'snippet': content[:140], 'org_key': org_key}]),
                            now,
                            now,
                        ),
                    )
                conn.commit()

        return {
            'slug': slug,
            'title': title,
            'type': entity_type,
            'compiled_truth_md': compiled_truth,
            'org_key': org_key,
        }

    def get_entity(self, slug: str) -> dict | None:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT * FROM entities WHERE slug = %s', (slug,))
                e = cur.fetchone()
                if not e:
                    return None
                cur.execute(
                    'SELECT event_ts, source_type, source_ref, event_md FROM timeline_events WHERE entity_id = %s ORDER BY event_ts DESC LIMIT 25',
                    (e['id'],),
                )
                timeline = cur.fetchall()
                e['timeline'] = timeline
                return e
