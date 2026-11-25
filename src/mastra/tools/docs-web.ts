import { MCPClient } from '@mastra/mcp';
import { webSearchTool } from './web-search';

export async function discoverWebRouterTools(client: MCPClient) {
  const { tools, errors } = await client.listToolsWithErrors();
  if (errors.webrouter) throw new Error(`WebRouter startup failed: ${errors.webrouter}`);
  const search = tools.webrouter_search;
  const extract = tools.webrouter_extract;
  if (!search || !extract) {
    throw new Error('WebRouter must expose both search and extract. Check the Python MCP server setup.');
  }
  return { web_search: search, web_extract: extract };
}

let client: MCPClient | undefined;

export async function getDocsWebTools(env: NodeJS.ProcessEnv = process.env) {
  const provider = env.DOCS_WEB_PROVIDER?.trim() || 'gateway';
  if (provider === 'gateway') return { web_search: webSearchTool };
  if (provider !== 'webrouter') throw new Error('DOCS_WEB_PROVIDER must be gateway or webrouter.');
  client ??= new MCPClient({
    id: 'docs-expert-webrouter',
    servers: {
      webrouter: {
        command: 'uvx',
        args: ['--from', 'webrouter[mcp]==0.15.0', 'web-router-mcp'],
        env: {
          WEB_ROUTER_MCP_TOOLS: 'search,extract',
          ...(env.WEB_ROUTER_ENV_FILE ? { WEB_ROUTER_ENV_FILE: env.WEB_ROUTER_ENV_FILE } : {}),
        },
        timeout: 60_000,
      },
    },
  });
  try {
    return await discoverWebRouterTools(client);
  } catch (error) {
    await disconnectWebRouter();
    throw error;
  }
}

export async function disconnectWebRouter() {
  const current = client;
  client = undefined;
  await current?.disconnect();
}
