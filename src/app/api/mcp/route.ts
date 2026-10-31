import { eurostatSeries, searchDatasets, worldBankSeries } from "@/lib/datasets";

// Stateless streamable HTTP MCP server. Otari connects to it during a recount.
const TOOLS = [
  {
    name: "search_datasets",
    description: "Find official statistics by keywords in the World Bank and Eurostat catalogues.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Keywords, e.g. 'unemployment rate youth'" } },
      required: ["query"],
    },
  },
  {
    name: "get_world_bank_series",
    description: "Yearly values of a World Bank indicator for one country or aggregate.",
    inputSchema: {
      type: "object",
      properties: {
        indicator: { type: "string", description: "Indicator id, e.g. SP.POP.TOTL" },
        country: { type: "string", description: "ISO2 or ISO3 code, e.g. IN" },
        start_year: { type: "integer" },
        end_year: { type: "integer" },
      },
      required: ["indicator", "country", "start_year", "end_year"],
    },
  },
  {
    name: "get_eurostat_series",
    description: "Rows from a Eurostat dataset. Narrow with filters such as geo, time, unit.",
    inputSchema: {
      type: "object",
      properties: {
        dataset: { type: "string", description: "Dataset code, e.g. une_rt_a" },
        filters: {
          type: "object",
          description: "Dimension filters, e.g. {\"geo\": \"DE\", \"time\": \"2023\"}",
          additionalProperties: { type: "string" },
        },
      },
      required: ["dataset"],
    },
  },
];

async function callTool(name: string, args: Record<string, never>) {
  if (name === "search_datasets") return searchDatasets(args.query);
  if (name === "get_world_bank_series")
    return worldBankSeries(args.indicator, args.country, args.start_year, args.end_year);
  if (name === "get_eurostat_series") return eurostatSeries(args.dataset, args.filters ?? {});
  throw new Error(`Unknown tool: ${name}`);
}

type RpcRequest = { id?: number | string; method: string; params?: Record<string, never> };

async function respond(rpc: RpcRequest) {
  if (rpc.method === "initialize")
    return {
      protocolVersion: "2025-03-26",
      capabilities: { tools: {} },
      serverInfo: { name: "recount-data", version: "0.1.0" },
    };
  if (rpc.method === "ping") return {};
  if (rpc.method === "tools/list") return { tools: TOOLS };
  if (rpc.method === "tools/call") {
    const { name, arguments: args } = rpc.params as unknown as { name: string; arguments: Record<string, never> };
    try {
      const result = await callTool(name, args ?? {});
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: String(error) }], isError: true };
    }
  }
  return null;
}

export async function POST(request: Request) {
  const rpc = (await request.json()) as RpcRequest;
  if (rpc.id === undefined) return new Response(null, { status: 202 });
  const result = await respond(rpc);
  return Response.json(
    result
      ? { jsonrpc: "2.0", id: rpc.id, result }
      : { jsonrpc: "2.0", id: rpc.id, error: { code: -32601, message: "Method not found" } },
  );
}

export const GET = () => new Response(null, { status: 405 });
