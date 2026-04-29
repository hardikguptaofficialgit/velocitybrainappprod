from src.core.db import get_conn


class GraphService:
    def get_entity_neighbors(self, slug: str) -> dict:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT id, slug, title, type FROM entities WHERE slug = %s', (slug,))
                root = cur.fetchone()
                if not root:
                    return {'entity': None, 'neighbors': []}
                cur.execute(
                    """
                    SELECT e2.slug, e2.title, e2.type, r.relation_type, r.strength
                    FROM relationships r
                    JOIN entities e2 ON r.to_entity_id = e2.id
                    WHERE r.from_entity_id = %s
                    ORDER BY r.strength DESC, e2.updated_at DESC
                    LIMIT 100
                    """,
                    (root['id'],),
                )
                return {'entity': root, 'neighbors': cur.fetchall()}
