#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

MCP_CONFIG = {
    "mcpServers": {
        "velocitybrain": {
            "command": "velocitybrain",
            "args": ["serve", "mcp"],
        }
    }
}


def _run(command: list[str]) -> int:
    completed = subprocess.run(command, capture_output=True, text=True)
    print(f"$ {' '.join(command)}")
    if completed.stdout:
        print(completed.stdout.rstrip())
    if completed.stderr:
        print(completed.stderr.rstrip(), file=sys.stderr)
    return completed.returncode


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    print('OpenClaw smoke helper for Velocity Brain')
    print('MCP config:')
    print(json.dumps(MCP_CONFIG, indent=2))
    print()

    commands = [
        [sys.executable, '-m', 'src.cli', '--no-color', 'about'],
        [sys.executable, '-m', 'src.cli', '--no-color', 'skills', '--limit', '3'],
    ]

    for command in commands:
        exit_code = _run(command)
        if exit_code != 0:
            return exit_code

    print()
    print('Recommended OpenClaw checks:')
    print('- healthz')
    print('- list_skills')
    print('- query')
    print('- run_agent')
    print()
    print(f'Workspace root: {root}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
