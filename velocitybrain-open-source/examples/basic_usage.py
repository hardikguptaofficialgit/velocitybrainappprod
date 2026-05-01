#!/usr/bin/env python3
"""Minimal hosted client example."""

import os

from velocitybrain_client import VelocityBrainClient
from velocitybrain_client.client.exceptions import VelocityBrainError


def main() -> None:
    api_key = os.getenv("VELOCITYBRAIN_API_KEY")
    if not api_key:
        print("Set VELOCITYBRAIN_API_KEY before running this example.")
        return
    try:
        with VelocityBrainClient(api_key) as client:
            result = client.run("Map the hosted auth and API key flow in this repo.")
            print(result)
    except VelocityBrainError as exc:
        print(f"VelocityBrain error: {exc}")


if __name__ == "__main__":
    main()
