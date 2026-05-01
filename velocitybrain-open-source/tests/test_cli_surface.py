from velocitybrain_client.cli.main import build_parser


def test_public_cli_only_exposes_product_commands():
    parser = build_parser()
    subactions = next(action for action in parser._actions if hasattr(action, "choices") and isinstance(action.choices, dict))
    commands = set(subactions.choices.keys())
    assert commands == {"run", "status", "config"}
