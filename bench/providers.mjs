// Model adapters. Model spec format: "<provider>:<model-id>".
//   anthropic:claude-opus-5-5   (needs ANTHROPIC_API_KEY)
//   openai:gpt-6.2-astra        (needs OPENAI_API_KEY)
//   mock:<name>                 (offline, deterministic, for testing the pipeline)

const SYSTEM = "You are a security analyst. Answer only from the evidence given. Be concise and specific.";

export async function complete(spec, prompt) {
  const [provider, ...rest] = spec.split(":");
  const model = rest.join(":");
  if (provider === "anthropic") return anthropic(model, prompt);
  if (provider === "openai") return openai(model, prompt);
  if (provider === "mock") return mock(model, prompt);
  throw new Error(`unknown provider "${provider}" in "${spec}"`);
}

async function anthropic(model, prompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 1024, system: SYSTEM, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

async function openai(model, prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

// Mock returns an empty, well-formed answer so the pipeline can be tested offline.
function mock(name) {
  return JSON.stringify({ verdict: `mock answer from ${name}`, fields: {}, steps: [], remediation: "", confidence: 0 });
}
