// Cliente HTTP a CLIProxyAPI (OpenAI-compatible chat completions)
import { logger } from "./logger";

const log = logger("llm");

export interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
}

export interface ChatToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatResponse {
  content: string;
  toolCalls: ChatToolCall[];
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  finishReason: string;
  model: string;
}

interface ChatOpts {
  model?: string;
  messages: LlmMessage[];
  tools?: ChatToolDef[];
  temperature?: number;
  maxTokens?: number;
}

const DEFAULT_MODEL = "claude-sonnet-4-6";

export async function chat(opts: ChatOpts): Promise<ChatResponse> {
  const url = (process.env.CLIPROXY_URL ?? "http://localhost:8317").replace(/\/$/, "");
  const apiKey = process.env.CLIPROXY_API_KEY ?? "";

  const body = {
    model: opts.model ?? DEFAULT_MODEL,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 4000,
    ...(opts.tools && opts.tools.length > 0 ? { tools: opts.tools } : {}),
  };

  log.debug("calling LLM", { model: body.model, msgs: opts.messages.length });

  const r = await fetch(`${url}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`LLM HTTP ${r.status}: ${text.slice(0, 500)}`);
  }

  const data = (await r.json()) as {
    model?: string;
    choices?: Array<{
      message?: { content?: string; tool_calls?: ChatToolCall[] };
      finish_reason?: string;
    }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };

  const choice = data.choices?.[0];
  return {
    content: choice?.message?.content ?? "",
    toolCalls: choice?.message?.tool_calls ?? [],
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
    totalTokens: data.usage?.total_tokens ?? 0,
    finishReason: choice?.finish_reason ?? "stop",
    model: data.model ?? body.model,
  };
}
