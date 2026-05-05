"""Hosted-only CLI for the public VelocityBrain client."""

from __future__ import annotations

import argparse
import json
import os
import sys
import webbrowser
from pathlib import Path
from typing import Any

from velocitybrain_client.client import VelocityBrainClient
from velocitybrain_client.client.exceptions import VelocityBrainError


DEFAULT_BASE_URL = "https://velocity.linkitapp.in"


def _config_path() -> Path:
    return Path.home() / ".velocitybrain" / "config.json"


def load_config() -> dict[str, Any]:
    api_key = os.getenv("VELOCITYBRAIN_API_KEY")
    base_url = os.getenv("VELOCITYBRAIN_BASE_URL", DEFAULT_BASE_URL)
    if not api_key and _config_path().exists():
        config = json.loads(_config_path().read_text(encoding="utf-8"))
        api_key = config.get("api_key")
        base_url = config.get("base_url", base_url)
    if not api_key:
        raise SystemExit(
            "VelocityBrain API key not found. Set VELOCITYBRAIN_API_KEY or run "
            "`velocitybrain config --set-key <key>`."
        )
    return {"api_key": api_key, "base_url": base_url}


def _emit_json(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, indent=2, ensure_ascii=False))


def _proof_fields(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "result": payload.get("result") or payload.get("answer", ""),
        "reused": bool(payload.get("reused", False)),
        "reuse_confidence": float(payload.get("reuse_confidence", 0.0)),
        "tokens_saved": int(payload.get("tokens_saved", 0)),
        "percent_saved": float(payload.get("percent_saved", 0.0)),
    }


def _normalize_result(payload: dict[str, Any]) -> dict[str, Any]:
    if {"result", "reused", "reuse_confidence", "tokens_saved", "percent_saved"} <= payload.keys():
        return _proof_fields(payload)
    reuse = payload.get("reuse", {})
    savings = payload.get("savings", {})
    return {
        "result": payload.get("result") or payload.get("answer", ""),
        "reused": bool(payload.get("reused", reuse.get("hit_type", "none") != "none")),
        "reuse_confidence": float(payload.get("reuse_confidence", reuse.get("confidence", 0.0))),
        "tokens_saved": int(payload.get("tokens_saved", savings.get("avoided_input_tokens", 0))),
        "percent_saved": float(payload.get("percent_saved", savings.get("saved_percent", 0.0))),
    }


def cmd_run(args: argparse.Namespace) -> int:
    config = load_config()
    try:
        with VelocityBrainClient(config["api_key"], config["base_url"]) as client:
            payload = _normalize_result(client.run(args.task, response_style=args.response_style))
        _emit_json(payload) if args.json else print(json.dumps(payload, indent=2))
        return 0
    except VelocityBrainError as exc:
        print(f"VelocityBrain run failed: {exc}")
        return 1


def cmd_status(args: argparse.Namespace) -> int:
    config = load_config()
    try:
        with VelocityBrainClient(config["api_key"], config["base_url"]) as client:
            payload = client.get_status()
        _emit_json(payload) if args.json else print(json.dumps(payload, indent=2))
        return 0
    except VelocityBrainError as exc:
        print(f"VelocityBrain status failed: {exc}")
        return 1


def cmd_integrations(args: argparse.Namespace) -> int:
    config = load_config()
    try:
        with VelocityBrainClient(config["api_key"], config["base_url"]) as client:
            payload = client.get_integrations()
        _emit_json(payload) if args.json else print(json.dumps(payload, indent=2))
        return 0
    except VelocityBrainError as exc:
        print(f"VelocityBrain integrations failed: {exc}")
        return 1


def cmd_integrations_connect(args: argparse.Namespace) -> int:
    config = load_config()
    try:
        with VelocityBrainClient(config["api_key"], config["base_url"]) as client:
            payload = client.start_integration(args.provider)
        auth_url = payload.get("authUrl")
        if auth_url:
            try:
                webbrowser.open(auth_url)
            except Exception:
                pass
            print(auth_url)
        _emit_json(payload) if args.json else print(json.dumps(payload, indent=2))
        return 0
    except VelocityBrainError as exc:
        print(f"VelocityBrain integration connect failed: {exc}")
        return 1


def cmd_config(args: argparse.Namespace) -> int:
    config_dir = _config_path().parent
    config_dir.mkdir(parents=True, exist_ok=True)
    payload = {"api_key": args.set_key, "base_url": args.base_url or DEFAULT_BASE_URL}
    _config_path().write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Saved VelocityBrain config to {_config_path()}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="VelocityBrain hosted client CLI")
    parser.add_argument("--json", action="store_true", help="Output JSON")
    parser.add_argument(
        "--response-style",
        choices=["normal", "lite", "full", "ultra"],
        default="normal",
        help="Hosted response style",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_run = sub.add_parser("run", help="Run a hosted coding task")
    p_run.add_argument("task")
    p_run.set_defaults(func=cmd_run)

    p_status = sub.add_parser("status", help="Get hosted reuse usage metrics")
    p_status.set_defaults(func=cmd_status)

    p_integrations = sub.add_parser("integrations", help="Show connected company integrations")
    p_integrations.set_defaults(func=cmd_integrations)

    p_integrations_connect = sub.add_parser("integrations-connect", help="Start a browser-assisted company integration flow")
    p_integrations_connect.add_argument("provider", choices=["slack", "google", "github"])
    p_integrations_connect.set_defaults(func=cmd_integrations_connect)

    p_config = sub.add_parser("config", help="Save hosted credentials")
    p_config.add_argument("--set-key", required=True)
    p_config.add_argument("--base-url")
    p_config.set_defaults(func=cmd_config)
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    sys.exit(args.func(args))
