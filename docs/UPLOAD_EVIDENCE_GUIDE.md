# Upload Evidence Guide

This guide is for the "Proof of Use and Proof of Influence" upload section.

## Goal

Submit the strongest possible proof that:

1. You actively use AI tools.
2. You built a real AI-agent product.
3. The product is live in code and has a real workflow.

## Best Upload Set

Use these 4 items in this order:

1. **AI billing screenshot**
2. **Terminal screenshot showing Velocity Brain running**
3. **Product screenshot or short demo video**
4. **GitHub repository link**

If you can upload 5 items, add:

5. **MCP client integration screenshot**

## What To Upload

### 1. AI billing screenshot

Upload a screenshot from the last 30 days from one or more major AI platforms.

Examples:

- OpenAI billing / usage
- Anthropic billing / usage
- Gemini / Google AI billing
- Cursor / other paid AI developer tooling

What the screenshot should show:

- platform name
- recent date range
- spending or usage

## 2. Terminal screenshot

Take a screenshot of a terminal session inside this repo that shows real usage.

Best commands to show:

```powershell
velocitybrain doctor
velocitybrain serve mcp
```

If you want a stronger second terminal capture, use:

```powershell
velocitybrain query "What do we know about auth and API key flows in this repo?"
```

What this proves:

- the project runs
- it has a CLI
- it supports MCP
- it performs real memory-backed queries

## 3. Product screenshot or short demo video

Best option: a short video of the product working.

Show one of these:

- dashboard open and usable
- usage page
- agent integrations/settings page
- an end-to-end flow where the app is running and you use the memory / MCP workflow

If you do screenshots instead of video, capture:

- one dashboard/product screen
- one screen that clearly references agents, memory, MCP, usage, or context retrieval

## 4. GitHub link

Use the correct repo link in the form field.

Current git remote in this workspace:

```text
https://github.com/hardikguptaofficialgit/velocitybrainappprod.git
```

Important:

- The screenshot you shared shows `https://github.com/hardikguptaofficialgit/velocitybrain`
- The actual configured `origin` for this repo is `velocitybrainappprod`

Before submitting, use the repo URL that matches the code you are uploading and the repository you want reviewers to inspect.

## 5. Optional MCP integration screenshot

If you still have upload space, this is a very strong proof item.

Take a screenshot showing one of:

- `codex mcp list`
- MCP config using `velocitybrain serve mcp`
- client integration setup from the repo docs

Relevant repo docs:

- `README.md`
- `docs/CLIENT_INTEGRATIONS.md`

## Recommended Final Submission

If you want the strongest 3-file pack:

1. AI billing screenshot
2. terminal screenshot with `velocitybrain serve mcp` or `velocitybrain doctor`
3. short product demo video

If you want the strongest 5-item pack:

1. AI billing screenshot
2. terminal screenshot with `velocitybrain doctor`
3. terminal screenshot with `velocitybrain serve mcp` or `velocitybrain query`
4. product screenshot or demo video
5. GitHub repo link in the link field

## Short Captions You Can Reuse

Use short labels if the form allows descriptions:

- `Recent AI platform billing and usage`
- `Velocity Brain CLI runtime and MCP server`
- `Velocity Brain memory-backed query workflow`
- `Product dashboard / live demo`
- `GitHub repository for the project`

## Best Proof For This Repo

Based on this repository, the strongest evidence themes are:

- AI agent memory
- MCP integration
- CLI and API workflow
- production-ready dashboard / usage flow
- internal retrieval before action

Focus your uploads on those, not generic code screenshots.
