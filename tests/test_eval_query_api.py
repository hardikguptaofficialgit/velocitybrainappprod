from fastapi.testclient import TestClient

from src.main import app


def test_eval_query_endpoint_returns_metrics(monkeypatch):
    client = TestClient(app)

    def fake_eval_query(question, expected_slugs, k=5, org_key=None):
        return {
            'question': question,
            'k': k,
            'precision_at_k': 1.0,
            'recall_at_k': 1.0,
            'groundedness': 1.0,
            'hallucination_risk': 0.0,
            'returned_slugs': expected_slugs,
            'expected_slugs': expected_slugs,
            'type_distribution': {'person': 1},
        }

    monkeypatch.setattr('src.api.routes.evaluation.eval_query', fake_eval_query)
    mock_token = type(
        'MockToken',
        (),
        {
            'actor': 'test-user',
            'scopes': ['read'],
            'is_expired': lambda self: False,
        },
    )()
    monkeypatch.setattr('src.api.routes.token_manager.validate_token', lambda _: mock_token)

    response = client.post(
        '/v1/eval/query',
        json={'question': 'What do I know about Hardik Gupta?', 'expected_slugs': ['jane-doe'], 'k': 3},
        headers={'Authorization': 'Bearer valid-token'},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload['precision_at_k'] == 1.0
    assert payload['type_distribution'] == {'person': 1}
    assert 'trace_id' in payload
    assert payload['user'] == 'test-user'
