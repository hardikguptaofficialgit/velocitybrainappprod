from src.services.caveman_ops import caveman_commit, caveman_review


def test_caveman_commit_generates_prefixed_subject():
    out = caveman_commit('Fix null user check in auth middleware and add guard')
    assert out.startswith('chore:') or ':' in out
    assert len(out) <= 57


def test_caveman_review_returns_one_line_text():
    out = caveman_review('L42 null user dereference can crash request path. add guard before access')
    assert '\n' not in out
    assert len(out) > 0
