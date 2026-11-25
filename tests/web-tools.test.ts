import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { MCPClient } from '@mastra/mcp';
import { discoverWebRouterTools, getDocsWebTools } from '../src/mastra/tools/docs-web';

const fixture = fileURLToPath(new URL('./fixtures/mcp-server.mjs', import.meta.url));
const client = (args: string[] = []) => new MCPClient({
  registerProcessHooks: false,
  servers: { webrouter: { command: process.execPath, args: [fixture, ...args] } },
});

test('baseline works without Python setup and invalid provider fails visibly', async () => {
  const tools = await getDocsWebTools({});
  assert.deepEqual(Object.keys(tools), ['web_search']);
  await assert.rejects(getDocsWebTools({ DOCS_WEB_PROVIDER: 'typo' }), /DOCS_WEB_PROVIDER/);
  await assert.rejects(getDocsWebTools({ DOCS_WEB_PROVIDER: 'webrouter' }), /WEB_ROUTER_PROJECT/);
});

test('MCP search URLs can be passed to extraction and provider errors are surfaced', async () => {
  const mcp = client();
  try {
    const tools = await discoverWebRouterTools(mcp);
    assert.deepEqual(Object.keys(tools), ['web_search', 'web_extract']);
    const search = await tools.web_search.execute!({ query: 'Example API' });
    const data = JSON.parse(search.content[0].text);
    const page = await tools.web_extract.execute!({ urls: [data.results[0].url] });
    assert.equal(JSON.parse(page.content[0].text).documents[0].url, 'https://example.com/docs');
    assert.match(JSON.parse(page.content[0].text).documents[0].content, /documented API/);
    await assert.rejects(tools.web_search.execute!({ query: 'fail' }), /Provider unavailable/);
  } finally {
    await mcp.disconnect();
  }
});

test('incomplete MCP tool discovery cannot silently fall back to Gateway', async () => {
  const mcp = client(['--missing-extract']);
  try {
    await assert.rejects(discoverWebRouterTools(mcp), /search and extract/);
  } finally {
    await mcp.disconnect();
  }
});
