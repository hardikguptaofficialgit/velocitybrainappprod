# Architecture

VelocityBrain has three main layers.

## 1. Core runtime

The Python runtime handles the memory logic, MCP bridge, and local command surface.

## 2. Hosted backend

The backend manages authentication, API keys, and account-level services.

## 3. Dashboard

The dashboard is where users sign in, create API keys, and manage access.

## How the flow works

1. The user creates an API key.
2. The CLI stores that key locally.
3. The MCP client points to `velocitybrain serve mcp`.
4. The agent requests memory through MCP.
5. VelocityBrain returns the best available context.

## Why this shape works

- local agent compatibility
- hosted account management
- simple setup for users
- narrow interface between client and memory layer
