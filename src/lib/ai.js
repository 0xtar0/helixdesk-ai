import { findRelatedArticles } from "./search.js";

const rules = [
  { category: "Authentication", terms: ["login", "sso", "password", "saml", "mfa", "auth"] },
  { category: "Billing", terms: ["invoice", "billing", "charge", "refund", "payment", "seat"] },
  { category: "Bug", terms: ["error", "fails", "bug", "broken", "crash", "invalid"] },
  { category: "Security", terms: ["breach", "token", "secret", "vulnerability", "compromised"] },
  { category: "API", terms: ["api", "webhook", "rate limit", "retry", "integration"] },
  { category: "Performance", terms: ["slow", "latency", "timeout", "performance"] }
];

const prioritySignals = [
  { priority: "Urgent", terms: ["down", "outage", "breach", "blocked", "payroll", "production", "security"] },
  { priority: "High", terms: ["today", "urgent", "deadline", "launch", "cannot", "fails"] },
  { priority: "Low", terms: ["question", "guidance", "recommend", "next week", "can you confirm"] }
];

const sentimentSignals = [
  { sentiment: "Frustrated", terms: ["angry", "frustrated", "again", "unacceptable", "blocked"] },
  { sentiment: "Concerned", terms: ["deadline", "due", "cannot", "fails", "wrong"] },
  { sentiment: "Neutral", terms: ["question", "guidance", "confirm", "recommend"] }
];

const includesAny = (text, terms) => terms.some((term) => text.includes(term));

const pickByRules = (text, config, fallback) => {
  const match = config.find((entry) => includesAny(text, entry.terms));
  return match ? match.category || match.priority || match.sentiment : fallback;
};

const collectTags = (text) => {
  const tags = [
    ["sso", "sso"],
    ["login", "login"],
    ["password", "password"],
    ["invoice", "invoice"],
    ["seat", "seats"],
    ["csv", "csv"],
    ["import", "import"],
    ["date", "date-fields"],
    ["api", "api"],
    ["rate limit", "rate-limit"],
    ["security", "security"],
    ["billing", "billing"]
  ];
  return tags.filter(([term]) => text.includes(term)).map(([, tag]) => tag).slice(0, 5);
};

const firstName = (name) => String(name || "there").split(" ")[0];

const buildFallbackReply = (ticket, articles, settings) => {
  const related = findRelatedArticles(ticket, articles, 2);
  const articleLine = related.length
    ? `I am checking this against our ${related.map((article) => article.title).join(" and ")} runbook.`
    : "I am checking the account details and the recent event history now.";

  return [
    `Hi ${firstName(ticket.customer)},`,
    "",
    `Thanks for the detail. I understand ${ticket.subject.toLowerCase()} is affecting your team, and I am going to work through it with you.`,
    "",
    `${articleLine} My next step is to verify the workspace state, reproduce the symptom from the support side, and send you either a fix or a precise escalation update.`,
    "",
    "I will keep the ticket open until we confirm the issue is resolved.",
    "",
    `-${settings.defaultAssignee || "Support"}`
  ].join("\n");
};

export const analyzeWithFallback = (ticket, articles, settings) => {
  const text = `${ticket.subject} ${ticket.body} ${(ticket.tags || []).join(" ")}`.toLowerCase();
  const category = pickByRules(text, rules, ticket.category || "General");
  const priority = pickByRules(text, prioritySignals, ticket.priority || "Normal");
  const sentiment = pickByRules(text, sentimentSignals, "Neutral");
  const relatedArticles = findRelatedArticles({ ...ticket, category }, articles, 3);
  const tags = [...new Set([...(ticket.tags || []), ...collectTags(text)])].slice(0, 6);

  return {
    provider: "Local rules",
    summary: `${ticket.customer} needs help with ${ticket.subject.toLowerCase()}. The likely queue is ${category}, with ${priority.toLowerCase()} priority.`,
    priority,
    category,
    sentiment,
    tags,
    confidence: relatedArticles.length ? 0.78 : 0.62,
    relatedArticleIds: relatedArticles.map((article) => article.id),
    nextSteps: [
      `Verify the ${category.toLowerCase()} context in the customer's workspace.`,
      relatedArticles.length ? `Use "${relatedArticles[0].title}" as the first runbook.` : "Ask one targeted follow-up question if reproduction details are missing.",
      priority === "Urgent" || priority === "High" ? "Send a first response before the SLA window closes." : "Respond with a clear answer and confirmation path."
    ],
    suggestedReply: buildFallbackReply(ticket, relatedArticles, settings)
  };
};

const buildOllamaPrompt = (ticket, relatedArticles, settings) => `You are a senior support desk triage assistant.
Return strict JSON with these keys: summary, priority, category, sentiment, tags, confidence, nextSteps, suggestedReply.
Use priority as one of Urgent, High, Normal, Low.
Use a ${settings.tone} support tone.

Ticket:
${JSON.stringify(ticket, null, 2)}

Knowledge articles:
${JSON.stringify(relatedArticles, null, 2)}`;

const parseJsonObject = (text) => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Model did not return JSON.");
  return JSON.parse(text.slice(start, end + 1));
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
  }
};

export const analyzeTicket = async (ticket, articles, settings) => {
  const relatedArticles = findRelatedArticles(ticket, articles, 4);
  if (settings.aiProvider !== "ollama") {
    return analyzeWithFallback(ticket, articles, settings);
  }

  try {
    const response = await fetchWithTimeout(`${settings.ollamaEndpoint.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: settings.ollamaModel,
        prompt: buildOllamaPrompt(ticket, relatedArticles, settings),
        stream: false,
        format: "json"
      })
    }, 20000);

    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
    const payload = await response.json();
    const parsed = parseJsonObject(payload.response || "{}");
    return {
      ...analyzeWithFallback(ticket, articles, settings),
      ...parsed,
      provider: `Ollama: ${settings.ollamaModel}`,
      relatedArticleIds: relatedArticles.map((article) => article.id)
    };
  } catch (error) {
    return {
      ...analyzeWithFallback(ticket, articles, settings),
      provider: "Local rules (Ollama unavailable)",
      warning: error.message
    };
  }
};

export const testOllama = async (settings) => {
  const response = await fetchWithTimeout(`${settings.ollamaEndpoint.replace(/\/$/, "")}/api/tags`, {}, 5000);
  if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
  const payload = await response.json();
  return payload.models || [];
};
