const http = require("http");
const fs = require("fs");
const path = require("path");

loadEnv();

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "public");

const providers = {
  openai: {
    name: "OpenAI",
    envKey: "OPENAI_API_KEY",
    models: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini"],
    async chat({ model, messages, temperature }) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ model, messages, temperature })
      });
      const data = await readJson(response);
      return data.choices?.[0]?.message?.content || "";
    }
  },
  anthropic: {
    name: "Anthropic",
    envKey: "ANTHROPIC_API_KEY",
    models: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", "claude-3-opus-latest"],
    async chat({ model, messages, temperature }) {
      const system = messages.find((message) => message.role === "system")?.content || "";
      const userMessages = messages
        .filter((message) => message.role !== "system")
        .map((message) => ({ role: message.role === "assistant" ? "assistant" : "user", content: message.content }));

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          system,
          messages: userMessages,
          temperature,
          max_tokens: 2048
        })
      });
      const data = await readJson(response);
      return data.content?.map((part) => part.text || "").join("") || "";
    }
  },
  gemini: {
    name: "Google Gemini",
    envKey: "GEMINI_API_KEY",
    models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"],
    async chat({ model, messages, temperature }) {
      const contents = messages
        .filter((message) => message.role !== "system")
        .map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }]
        }));
      const systemInstruction = messages.find((message) => message.role === "system")?.content;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
          generationConfig: { temperature }
        })
      });
      const data = await readJson(response);
      return data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
    }
  },
  mistral: {
    name: "Mistral",
    envKey: "MISTRAL_API_KEY",
    models: ["mistral-large-latest", "mistral-small-latest", "open-mistral-nemo"],
    async chat({ model, messages, temperature }) {
      return openAiCompatibleChat({
        url: "https://api.mistral.ai/v1/chat/completions",
        apiKey: process.env.MISTRAL_API_KEY,
        model,
        messages,
        temperature
      });
    }
  },
  groq: {
    name: "Groq",
    envKey: "GROQ_API_KEY",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    async chat({ model, messages, temperature }) {
      return openAiCompatibleChat({
        url: "https://api.groq.com/openai/v1/chat/completions",
        apiKey: process.env.GROQ_API_KEY,
        model,
        messages,
        temperature
      });
    }
  },
  openrouter: {
    name: "OpenRouter",
    envKey: "OPENROUTER_API_KEY",
    models: ["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet", "meta-llama/llama-3.1-70b-instruct"],
    async chat({ model, messages, temperature }) {
      return openAiCompatibleChat({
        url: "https://openrouter.ai/api/v1/chat/completions",
        apiKey: process.env.OPENROUTER_API_KEY,
        model,
        messages,
        temperature,
        extraHeaders: {
          "HTTP-Referer": "http://localhost",
          "X-Title": "AI Nexus"
        }
      });
    }
  },
  ollama: {
    name: "Ollama",
    envKey: null,
    models: ["llama3.1", "mistral", "gemma2"],
    async chat({ model, messages, temperature }) {
      const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: { temperature }
        })
      });
      const data = await readJson(response);
      return data.message?.content || "";
    }
  }
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/providers") {
      return sendJson(res, 200, publicProviderList());
    }

    if (req.method === "POST" && url.pathname === "/api/chat") {
      const body = await readBody(req);
      return handleChat(body, res);
    }

    if (req.method === "GET") {
      return serveStatic(url.pathname, res);
    }

    sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Unexpected server error." });
  }
});

server.listen(PORT, () => {
  console.log(`AI Nexus running at http://localhost:${PORT}`);
});

async function handleChat(body, res) {
  const { provider: providerId, model, messages, temperature = 0.7 } = JSON.parse(body || "{}");
  const provider = providers[providerId];

  if (!provider) {
    return sendJson(res, 400, { error: "Unknown provider." });
  }

  if (provider.envKey && !process.env[provider.envKey]) {
    return sendJson(res, 400, {
      error: `${provider.name} is missing ${provider.envKey}. Add it to your .env file and restart the server.`
    });
  }

  if (!Array.isArray(messages) || !messages.some((message) => message.role === "user")) {
    return sendJson(res, 400, { error: "Send at least one user message." });
  }

  const cleanMessages = messages
    .filter((message) => ["system", "user", "assistant"].includes(message.role) && String(message.content || "").trim())
    .map((message) => ({ role: message.role, content: String(message.content).trim() }));

  const reply = await provider.chat({
    model: model || provider.models[0],
    messages: cleanMessages,
    temperature: Math.max(0, Math.min(2, Number(temperature) || 0.7))
  });

  sendJson(res, 200, { reply });
}

async function openAiCompatibleChat({ url, apiKey, model, messages, temperature, extraHeaders = {} }) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...extraHeaders
    },
    body: JSON.stringify({ model, messages, temperature })
  });
  const data = await readJson(response);
  return data.choices?.[0]?.message?.content || "";
}

async function readJson(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const detail = data.error?.message || data.message || response.statusText;
    throw new Error(detail);
  }
  return data;
}

function publicProviderList() {
  return Object.entries(providers).map(([id, provider]) => ({
    id,
    name: provider.name,
    models: provider.models,
    ready: provider.envKey ? Boolean(process.env[provider.envKey]) : true,
    envKey: provider.envKey
  }));
}

function serveStatic(requestPath, res) {
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendText(res, 403, "Forbidden");
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      return sendText(res, 404, "Not found");
    }
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(content);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body is too large."));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain" });
  res.end(text);
}

function contentType(filePath) {
  const extension = path.extname(filePath);
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8"
  }[extension] || "application/octet-stream";
}

function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
