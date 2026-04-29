from src.services.response_style import apply_response_style, compress_text, normalize_response_style


def test_normalize_response_style_defaults_to_normal_for_unknown():
    assert normalize_response_style('unknown') == 'normal'


def test_compress_text_lite_reduces_filler_words():
    text = 'The reason is that it is likely that this means that you should retry.'
    out = compress_text(text, 'lite')
    assert len(out) < len(text)
    assert 'likely' not in out.lower()


def test_apply_response_style_marks_mode_and_keeps_shape():
    payload = {
        'answer': 'The reason is that retries are needed.',
        'reasoning_summary': 'This means that you should retry with backoff.',
        'confidence': 0.9,
    }
    styled = apply_response_style(payload, 'full')

    assert styled['response_style'] == 'full'
    assert 'answer' in styled
    assert 'reasoning_summary' in styled
    assert styled['confidence'] == 0.9

    def test_ultra_mode_supported_and_more_compact():
        text = 'The database returns a response because the configuration is invalid in this function.'
        full = compress_text(text, 'full')
        ultra = compress_text(text, 'ultra')
        assert normalize_response_style('ultra') == 'ultra'
        assert len(ultra) <= len(full)
        assert 'db' in ultra.lower() or 'config' in ultra.lower()
