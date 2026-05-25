from unittest.mock import MagicMock, patch

from src.services.maintenance_service import MaintenanceService


def test_expand_queries_includes_subject():
    from src.services.retrieval_engine import RetrievalEngine

    expansions = RetrievalEngine()._expand_queries('who is Jane Doe')
    assert 'Jane Doe' in expansions
    assert 'Jane Doe summary' in expansions


@patch('src.services.maintenance_service.get_conn')
def test_consolidate_memory_returns_stats(mock_get_conn):
    conn = MagicMock()
    cur = MagicMock()
    cur.rowcount = 3
    conn.cursor.return_value.__enter__.return_value = cur
    mock_get_conn.return_value.__enter__.return_value = conn

    stats = MaintenanceService().consolidate_memory()
    assert stats['deleted_timeline_events'] == 3
