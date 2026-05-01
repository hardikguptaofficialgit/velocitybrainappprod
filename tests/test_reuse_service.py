from src.services.reuse_service import ReuseService


def test_reuse_service_records_exact_hit_and_savings():
    service = ReuseService()
    service.reset_state()

    first = service.record_reuse_decision(
        run_id='run-1',
        task_text='Map the auth system in repo billing-api',
        response_text='Auth map with Firebase session flow and API key validation.',
        artifact_kind='repo_map',
        metadata={'workspace_id': 'acme', 'repo_id': 'billing-api'},
    )
    assert first['reuse']['hit_type'] == 'none'
    assert first['savings']['avoided_input_tokens'] == 0

    second = service.record_reuse_decision(
        run_id='run-2',
        task_text='Map the auth system in repo billing-api',
        response_text='Reused auth map.',
        artifact_kind='repo_map',
        metadata={'workspace_id': 'acme', 'repo_id': 'billing-api'},
    )
    assert second['reuse']['hit_type'] == 'exact'
    assert second['savings']['avoided_input_tokens'] > 0
    assert second['savings']['estimated_cost_saved'] > 0


def test_reuse_service_scopes_artifacts_by_repo():
    service = ReuseService()
    service.reset_state()

    service.record_reuse_decision(
        run_id='run-a',
        task_text='Review billing flow',
        response_text='Billing flow summary',
        artifact_kind='summary',
        metadata={'workspace_id': 'acme', 'repo_id': 'billing-api'},
    )

    result = service.retrieve_reuse_context(
        'Review billing flow',
        metadata={'workspace_id': 'acme', 'repo_id': 'auth-api'},
    )

    assert result['hit_type'] != 'exact'
    assert all(artifact['repo_id'] != 'billing-api' or result['hit_type'] != 'repo_context' for artifact in result['artifacts'])


def test_reuse_service_reports_overview():
    service = ReuseService()
    service.reset_state()
    service.record_reuse_decision(
        run_id='run-1',
        task_text='Prepare PR review for auth repo',
        response_text='First fresh response',
        artifact_kind='plan',
        metadata={'workspace_id': 'acme', 'repo_id': 'auth-repo'},
    )
    service.record_reuse_decision(
        run_id='run-2',
        task_text='Prepare PR review for auth repo',
        response_text='Reused review plan',
        artifact_kind='plan',
        metadata={'workspace_id': 'acme', 'repo_id': 'auth-repo'},
    )

    overview = service.get_savings_overview()
    assert overview['total_saved_tokens'] >= 0
    assert 'recent_runs' in overview
    assert 'top_reusable_repos' in overview
    assert 'repeat_rate' in overview


def test_reuse_service_tracks_user_metrics_and_repeat_runs():
    service = ReuseService()
    service.reset_state()
    metadata = {'workspace_id': 'acme', 'repo_id': 'auth-repo', 'user_id': 'user-1'}
    service.record_reuse_decision(
        run_id='run-1',
        task_text='Map the auth flow',
        response_text='fresh auth flow',
        artifact_kind='summary',
        metadata=metadata,
    )
    service.record_reuse_decision(
        run_id='run-2',
        task_text='Map the auth flow',
        response_text='reused auth flow',
        artifact_kind='summary',
        metadata=metadata,
    )

    usage = service.get_user_usage_summary('user-1')
    recent = service.get_recent_runs_for_user('user-1', limit=5)

    assert usage['total_runs'] == 2
    assert usage['repeat_rate'] == 50.0
    assert usage['reuse_hit_rate'] >= 50.0
    assert len(recent) == 2
    assert recent[0]['reused'] is True


def test_reuse_service_tracks_repo_metrics_and_wedge_insights():
    service = ReuseService()
    service.reset_state()
    for index in range(3):
        service.record_reuse_decision(
            run_id=f'run-auth-{index}',
            task_text='Map the auth flow',
            response_text='auth flow summary',
            artifact_kind='summary',
            metadata={'workspace_id': 'acme', 'repo_id': 'auth-repo', 'user_id': 'user-2'},
        )
    for index in range(2):
        service.record_reuse_decision(
            run_id=f'run-billing-{index}',
            task_text='Review billing flow',
            response_text='billing flow summary',
            artifact_kind='summary',
            metadata={'workspace_id': 'acme', 'repo_id': 'billing-repo', 'user_id': 'user-2'},
        )

    repo_metrics = service.get_repo_metrics_for_user('user-2')
    insights = service.get_wedge_insights('user-2')
    usage = service.get_user_usage_summary('user-2')

    assert len(repo_metrics) == 2
    assert repo_metrics[0]['repo_id'] in {'auth-repo', 'billing-repo'}
    assert insights['best_repo'] in {'auth-repo', 'billing-repo'}
    assert len(insights['top_3_repos_by_usage']) <= 3
    assert usage['classification'] in {'power_user', 'emerging_user', 'low_value_user'}


def test_reuse_service_uses_broad_repo_context_for_shared_files():
    service = ReuseService()
    service.reset_state()
    service.store_artifact(
        task_text='Map the hosted auth and API key flow across this repo.',
        artifact_text='[src/cli.py] login flow [src/core_api/auth.py] validation flow',
        artifact_kind='repo_map',
        source_run_id='seed-1',
        metadata={
            'workspace_id': 'acme',
            'repo_id': 'velocitybrain',
            'context_paths': ['src/cli.py', 'src/core_api/auth.py'],
        },
    )

    result = service.retrieve_reuse_context(
        'Which files should I edit to change hosted auth without breaking API key validation?',
        metadata={
            'workspace_id': 'acme',
            'repo_id': 'velocitybrain',
            'context_paths': ['src/cli.py', 'src/core_api/auth.py'],
        },
        include_debug=True,
    )

    assert result['hit_type'] == 'repo_context'
    assert result['debug']['path_overlap'] > 0
