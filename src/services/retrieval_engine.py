import re
from typing import Any

from src.core.db import get_conn, serialize_vector
from src.core.logging_config import get_logger
from src.services.embedding_service import EmbeddingService

logger = get_logger('retrieval_engine')


class RetrievalEngine:
    def __init__(self):
        self.embedding = EmbeddingService()

    def _expand_queries(self, query: str) -> list[str]:
        q = query.strip()
        lowered = q.lower()
        expansions = [q]
        if lowered.startswith('what do i know about '):
            expansions.append(q.replace('What do I know about', 'Summary of', 1))
            subject = q[len('what do i know about ') :].strip()
            if subject:
                expansions.append(subject)
        for prefix in ('who is ', 'tell me about ', 'what is '):
            if lowered.startswith(prefix):
                subject = q[len(prefix) :].strip()
                if subject:
                    expansions.extend([subject, f'{subject} summary'])
                break
        if 'meeting' in lowered:
            expansions.append(f'{q} timeline')
        if 'pattern' in lowered:
            expansions.append(f'{q} trend')
        if 'decision' in lowered or 'decided' in lowered:
            expansions.append(f'{q} outcome')
        return list(dict.fromkeys(expansions))

    def keyword_search(self, query: str, limit: int = 10, org_key: str | None = None) -> list[dict[str, Any]]:
        tokens = [t for t in re.split(r'\W+', query.lower()) if t]
        if not tokens:
            return []
        like_fragments = [f"%{t}%" for t in tokens]
        sql = """
        SELECT slug, type, title, compiled_truth_md, confidence, access_level, metadata
        FROM entities
        WHERE (
          LOWER(title) LIKE ANY(%s)
          OR LOWER(compiled_truth_md) LIKE ANY(%s)
          OR LOWER(slug) LIKE ANY(%s)
        )
        AND (
                    %s::text IS NULL
                    OR metadata->>'org_key' = %s::text
          OR access_level = 'public'
        )
        ORDER BY confidence DESC, updated_at DESC
        LIMIT %s
        """
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (like_fragments, like_fragments, like_fragments, org_key, org_key, limit))
                return cur.fetchall()

    def vector_search(self, query: str, limit: int = 10, org_key: str | None = None) -> list[dict[str, Any]]:
        try:
            emb = self.embedding.embed_text(query)
            vector_literal = serialize_vector(emb['vector'])
            sql = """
            SELECT e.slug, e.type, e.title, e.compiled_truth_md, e.confidence, e.access_level, e.metadata,
                   (1 - (emb.embedding <=> %s::vector))::float AS vector_score
            FROM embeddings emb
            JOIN entities e ON e.id = emb.entity_id
            WHERE emb.embedding IS NOT NULL
              AND (
                                %s::text IS NULL
                                OR e.metadata->>'org_key' = %s::text
                OR e.access_level = 'public'
              )
            ORDER BY emb.embedding <=> %s::vector
            LIMIT %s
            """
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, (vector_literal, org_key, org_key, vector_literal, limit))
                    return cur.fetchall()
        except Exception as exc:
            logger.warning('vector_search failed; falling back to keyword-only', extra={'error': str(exc)})
            return []

    def _lexical_overlap_score(self, query: str, text: str) -> float:
        q_tokens = {t for t in re.split(r'\W+', query.lower()) if t}
        t_tokens = {t for t in re.split(r'\W+', text.lower()) if t}
        if not q_tokens or not t_tokens:
            return 0.0
        return len(q_tokens & t_tokens) / len(q_tokens)

    def hybrid_search(self, query: str, limit: int = 10, org_key: str | None = None) -> list[dict[str, Any]]:
        all_hits: dict[str, dict[str, Any]] = {}
        expansions = self._expand_queries(query)[:4]

        for qidx, q in enumerate(expansions):
            kw_hits = self.keyword_search(q, limit=min(40, limit * 4), org_key=org_key)
            # Skip vector pass when keyword hits are already strong (saves embed API calls).
            vec_hits = (
                []
                if qidx > 0 and len(kw_hits) >= limit
                else self.vector_search(q, limit=min(30, limit * 3), org_key=org_key)
            )

            for ridx, h in enumerate(kw_hits):
                key = h['slug']
                score = 1.0 / (40 + ridx + (qidx * 2))
                if key not in all_hits:
                    all_hits[key] = {**h, '_fusion_score': score, '_kw_rank': ridx, '_vec_score': 0.0}
                else:
                    all_hits[key]['_fusion_score'] += score

            for ridx, h in enumerate(vec_hits):
                key = h['slug']
                vec_score = float(h.get('vector_score') or 0.0)
                score = 1.2 / (45 + ridx + (qidx * 2))
                if key not in all_hits:
                    all_hits[key] = {**h, '_fusion_score': score, '_kw_rank': 999, '_vec_score': vec_score}
                else:
                    all_hits[key]['_fusion_score'] += score
                    all_hits[key]['_vec_score'] = max(all_hits[key].get('_vec_score', 0.0), vec_score)

        ranked = []
        for row in all_hits.values():
            lexical = self._lexical_overlap_score(query, row.get('compiled_truth_md', '')[:500])
            rerank = (
                row.get('_fusion_score', 0.0) * 0.55
                + float(row.get('confidence', 0.0)) * 0.2
                + float(row.get('_vec_score', 0.0)) * 0.15
                + lexical * 0.1
            )
            row['_rerank_score'] = rerank
            ranked.append(row)

        ranked.sort(key=lambda x: (x['_rerank_score'], x.get('confidence', 0.0)), reverse=True)
        for row in ranked:
            row.pop('_fusion_score', None)
            row.pop('_kw_rank', None)
            row.pop('_vec_score', None)
            row.pop('_rerank_score', None)
        return ranked[:limit]
