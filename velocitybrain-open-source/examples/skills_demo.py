#!/usr/bin/env python3
"""Hosted query demo."""

import os

from velocitybrain_client import VelocityBrainClient


def main() -> None:
    api_key = os.getenv("VELOCITYBRAIN_API_KEY")
    if not api_key:
        print("Set VELOCITYBRAIN_API_KEY before running this example.")
        return
    with VelocityBrainClient(api_key) as client:
        print(client.query("Map the hosted auth and API key flow in this repo."))


if __name__ == "__main__":
    main()
