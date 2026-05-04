import json
from pathlib import Path

from src.cli import _connect_command_for_client, build_parser


REPO_ROOT = Path(__file__).resolve().parents[1]


def test_documented_mcp_config_assets_exist_and_match_cli_contract():
    expected = {
        "claude-code": REPO_ROOT / "integrations" / "mcp" / "claude-code" / "mcpServers.velocitybrain.json",
        "openclaw": REPO_ROOT / "integrations" / "mcp" / "openclaw" / "mcpServers.velocitybrain.json",
        "codex": REPO_ROOT / "integrations" / "mcp" / "codex" / "mcpServers.velocitybrain.json",
    }

    for client, path in expected.items():
        assert path.exists(), f"missing MCP config asset for {client}: {path}"
        payload = json.loads(path.read_text(encoding="utf-8"))
        assert payload == {
            "mcpServers": {
                "velocitybrain": {
                    "command": "velocitybrain",
                    "args": ["serve", "mcp"],
                }
            }
        }


def test_cli_parser_exposes_connect_and_serve_mcp_story():
    parser = build_parser()

    connect_args = parser.parse_args(["connect", "codex"])
    assert connect_args.command == "connect"
    assert connect_args.client == "codex"

    serve_args = parser.parse_args(["serve", "mcp"])
    assert serve_args.command == "serve"
    assert serve_args.mode == "mcp"

    assert _connect_command_for_client("codex") == "codex mcp add velocitybrain -- velocitybrain serve mcp"


def test_canonical_cli_module_exists():
    cli_module = REPO_ROOT / "src" / "cli.py"

    assert cli_module.exists()
    content = cli_module.read_text(encoding="utf-8")
    assert "def main() -> int:" in content
