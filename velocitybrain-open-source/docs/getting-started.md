# VelocityBrain Client Quick Start

Install the public client:

```bash
pip install velocitybrain-client
```

Set credentials:

```bash
export VELOCITYBRAIN_API_KEY="vb_live_xxx"
```

Run a hosted task:

```bash
velocitybrain run "Map the hosted auth and API key flow in this repo."
```

Use the Python client:

```python
from velocitybrain_client import VelocityBrainClient

with VelocityBrainClient(api_key="vb_live_xxx") as client:
    result = client.run("Map the hosted auth and API key flow in this repo.")
    print(result)
```

