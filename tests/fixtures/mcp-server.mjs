import { createInterface } from 'node:readline';

// A deterministic MCP peer: no network, credentials, or Python required.
const tools = ['search', 'extract', 'load_env'].map(name => ({
  name,
  description: name,
  outputSchema: { type: 'object', additionalProperties: true },
  inputSchema: { type: 'object', properties: { query: { type: 'string' }, urls: { type: 'array', items: { type: 'string' } } } },
}));
for await (const line of createInterface({ input: process.stdin })) {
  const request = JSON.parse(line);
  if (request.id === undefined) continue;
  let result;
  if (request.method === 'initialize') {
    result = { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'fixture', version: '1' } };
  } else if (request.method === 'tools/list') {
    result = { tools: process.argv.includes('--missing-extract') ? tools.filter(t => t.name !== 'extract') : tools };
  } else if (request.method === 'tools/call') {
    const { name, arguments: args } = request.params;
    result = args.query === 'fail'
      ? { isError: true, content: [{ type: 'text', text: 'Provider unavailable' }] }
      : { structuredContent: name === 'search'
        ? { results: [{ title: 'Example docs', url: 'https://example.com/docs', content: 'Use the documented API.' }] }
        : { documents: [{ url: args.urls[0], content: 'Use the documented API.' }], failures: [] }, content: [] };
  } else if (request.method === 'ping') {
    result = {};
  } else {
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, error: { code: -32601, message: 'Method not found' } }) + '\n');
    continue;
  }
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }) + '\n');
}
