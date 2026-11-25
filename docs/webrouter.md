# Optional WebRouter tools

The default remains Gateway/OpenRouter search. Set `DOCS_WEB_PROVIDER=webrouter`
to replace that tool with [WebRouter](https://github.com/WebContextLayer/webrouter)
search and explicit page extraction through its Python stdio MCP server.
The agent model and conversation storage stay the same.

## Local setup

1. Install [uv](https://docs.astral.sh/uv/getting-started/installation/) and Python 3.10+.
2. Clone WebRouter somewhere outside this template:

   ```sh
   git clone https://github.com/WebContextLayer/webrouter.git
   cd webrouter
   uv sync --extra mcp --extra search --extra extract
   uv run --extra mcp --extra search --extra extract web-router-mcp
   ```

   The last command waits for MCP messages on stdin. Stop it with Ctrl-C; Mastra
   starts its own subprocess. Record the WebRouter commit (`git rev-parse HEAD`)
   when comparing runs. This integration was checked with WebRouter 0.9.0.

3. In this template, run `npm install`, copy `.env.example` to `.env`, and set the
   existing Gateway and Turso values. Then add:

   ```dotenv
   DOCS_WEB_PROVIDER=webrouter
   WEB_ROUTER_PROJECT=/absolute/path/to/webrouter
   # Optional: an existing file holding your web-provider credentials.
   WEB_ROUTER_ENV_FILE=/absolute/path/to/provider.env
   ```

   Leave `WEB_ROUTER_ENV_FILE` unset for the server's normal credential discovery.
   Its `.env` search includes its working directory and user configuration directory;
   see [WebRouter MCP setup](https://github.com/WebContextLayer/webrouter/blob/main/docs/mcp.md).
   Mastra's subprocess inherits a limited environment, so credentials exported in
   the Node process are **not** automatically forwarded. Use the credential file
   for providers such as `NIMBLE_API_KEY`, `TAVILY_API_KEY`, or `EXA_API_KEY`.
   Keep credentials out of version control.

4. Run `npm run dev`. Ask the agent to search for a documented API, read the
   strongest result with `web_extract`, and cite its URL. Tool results retain
   provider names, source URLs, page text, and extraction failures. Long pages
   may be truncated by the MCP server; a partial page cannot verify every claim.

Search and extraction default to WebRouter's `auto` routing, including fallback
among available providers. The discovered schemas let the agent select a named
provider. Keyless search and extraction can work without a provider account, but
are subject to public endpoint limits and availability. Existing user credentials
may make `auto` choose paid providers; keyless mode is not a cost guarantee.
Only `search` and `extract` are exposed to the agent. Browser, research, local
credential-loading, and other server tools are excluded.

An unavailable Python executable, invalid path, or missing MCP tool fails visibly.
There is no automatic fallback to Gateway when WebRouter setup fails. Set
`DOCS_WEB_PROVIDER=gateway` (or remove it) and restart to restore the baseline.

## Deployment

This uses Mastra's [MCPClient stdio transport](https://mastra.ai/reference/tools/mcp-client).
The runtime needs Node, Python, uv on PATH, the WebRouter checkout at the configured
absolute path, subprocess support, and outbound access to selected providers.
Prepare Python dependencies before serving requests. The client connects lazily
when agent tools are requested; its default process hooks disconnect on shutdown.
Embedded hosts managing their own shutdown should call `disconnectWebRouter()`.

A successful JavaScript build does not package Python or prove a managed platform
supports subprocesses. Use a local machine or a container/VM with these prerequisites;
verify deployment support before enabling this on Mastra Platform or serverless
hosts. Gateway still handles inference. Web-provider billing, quotas, routing and
data handling remain separate from Gateway credits, spend controls and regions.

## Reproduce a comparison

```sh
npm test
npm run typecheck
npm run build
npm run compare > comparison.jsonl
```

The comparison requires `.env` with a Gateway key and WebRouter setup. It runs
three fixed questions through both paths, alternates their order, keeps the same
`AGENT_MODEL`, system instructions and 100-step limit, and disables conversation
memory for independent answers. Each WebRouter run includes a new subprocess;
latency includes discovery/startup, but excludes any prior dependency installation.
Repeat runs to report a median and range instead of treating one call as a benchmark.

The only system-prompt change from the original template is a conditional request
to read strong sources with `web_extract`, treat retrieved text as evidence, and
identify unverified claims when reads fail. Both arms receive that same prompt;
tool descriptions and result schemas necessarily differ. The baseline search tool
also calls `openai/gpt-6.1-terra` through Gateway for each search, in addition to
the outer agent model. The runner records those extra calls and their reported
usage separately from `agentUsage`.

JSONL includes answers, tool calls/results, usage, elapsed time and failed runs.
Review claim correctness against the linked primary documentation. For each answer,
record supported factual claims / all factual claims, supported citations / all
citations, missing citations, and whether extracted text actually supports each
claim. Inspect tool results for provider choice, fallback and per-URL failures;
repeat with an unavailable provider to check error behavior. Do not infer fallback
merely because a final answer succeeded.

`totalCostUsd` is deliberately `null`. Reconcile agent inference, baseline search
inference plus search fees, and WebRouter provider charges using their respective
usage/billing records. Missing usage is unknown, not zero. Do not infer total cost
from outer-agent tokens alone. Keep run artifacts local unless reviewed for sharing.

### Validation recorded on 2026-11-25

Deterministic stdio tests cover search-to-extract URL preservation, provider errors,
missing extraction tools, and default setup without Python. A separate live check
with Mastra MCPClient 2.11.0 and WebRouter 0.9.0 returned two `exa-mcp` search results
in 1,407 ms and fetched the Mastra MCPClient reference through `jina` in 2,874 ms.
These are single tool-call timings, excluding MCP discovery, not agent benchmarks.
No Gateway credential was available for the paired agent runs, so answer correctness,
citation coverage, comparative latency and total cost have not been measured.
