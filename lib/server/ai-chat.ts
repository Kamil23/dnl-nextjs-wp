// Jeden klient do OpenAI (i API zgodnych z OpenAI) dla wszystkich wywołań
// "odpowiedz JSON-em": draft z TikToka, przypisanie klatek, dopełnianie braków,
// wartości odżywcze, zamienniki, klasyfikacja backlogu. Wcześniej każdy z tych
// modułów miał własny fetch z tą samą obsługą błędów i zdejmowaniem ```json.
//
// Świadomie bez `temperature`: nowsze modele (gpt-5.x, gpt-6) odrzucają ten
// parametr. Limit tokenów idzie jako max_completion_tokens (max_tokens jest
// u OpenAI przestarzałe dla modeli rozumujących).

export type ChatPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

export type ChatUsage = {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
};

export type ChatJsonResult<T> = {
  data: T;
  raw: string;
  model: string;
  usage: ChatUsage | null;
};

export type ChatJsonOptions = {
  model: string;
  system: string;
  user: string | ChatPart[];
  maxTokens?: number;
  reasoningEffort?: "low" | "medium" | "high";
  // Domyślnie OpenAI; AI_COMPAT_* pozwala wskazać inne API zgodne z OpenAI
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
};

export class AiChatError extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "AiChatError";
    this.status = status;
  }
}

export function stripJsonFence(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

export async function chatJson<T = any>(opts: ChatJsonOptions): Promise<ChatJsonResult<T>> {
  const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AiChatError("Brak OPENAI_API_KEY");
  const baseUrl = (opts.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");

  const body: Record<string, unknown> = {
    model: opts.model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  };
  if (opts.maxTokens) body.max_completion_tokens = opts.maxTokens;
  if (opts.reasoningEffort) body.reasoning_effort = opts.reasoningEffort;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 180_000);
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e: any) {
    throw new AiChatError(
      e?.name === "AbortError" ? `Model ${opts.model}: przekroczono czas oczekiwania` : `Model ${opts.model}: ${e?.message}`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Niektóre modele nie przyjmują reasoning_effort - spróbuj raz bez niego
    if (res.status === 400 && opts.reasoningEffort && /reasoning_effort|reasoning/i.test(text)) {
      return chatJson<T>({ ...opts, reasoningEffort: undefined });
    }
    throw new AiChatError(`Model ${opts.model}: ${res.status} ${text.slice(0, 300)}`, res.status);
  }

  const json = await res.json();
  const raw: string = json.choices?.[0]?.message?.content ?? "";
  if (!raw.trim()) {
    const reason = json.choices?.[0]?.finish_reason;
    throw new AiChatError(`Model ${opts.model} zwrócił pustą odpowiedź${reason ? ` (${reason})` : ""}`);
  }
  let data: T;
  try {
    data = JSON.parse(stripJsonFence(raw));
  } catch {
    throw new AiChatError(`Model ${opts.model} zwrócił niepoprawny JSON: ${raw.slice(0, 200)}`);
  }
  const u = json.usage;
  const usage: ChatUsage | null = u
    ? {
        inputTokens: Number(u.prompt_tokens ?? 0),
        outputTokens: Number(u.completion_tokens ?? 0),
        reasoningTokens: Number(u.completion_tokens_details?.reasoning_tokens ?? 0),
      }
    : null;
  return { data, raw, model: json.model ?? opts.model, usage };
}

// Lista modeli czatu dostępnych na kluczu (do selectów w panelu). Cache 10 min
// w pamięci procesu; przy błędzie zwraca pustą listę, panel wtedy pokazuje
// tylko pole tekstowe.
let modelsCache: { at: number; ids: string[] } | null = null;

export async function listChatModels(): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) return [];
  if (modelsCache && Date.now() - modelsCache.at < 10 * 60 * 1000) return modelsCache.ids;
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const ids: string[] = (json.data ?? [])
      .map((m: any) => String(m.id))
      .filter((id: string) => /^(gpt-|o\d)/.test(id))
      .filter((id: string) => !/whisper|tts|embedding|image|realtime|audio|transcribe|search|moderation|codex|instruct/i.test(id))
      .sort();
    modelsCache = { at: Date.now(), ids };
    return ids;
  } catch {
    return [];
  }
}
