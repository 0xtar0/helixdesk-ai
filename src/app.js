import { analyzeTicket, testOllama } from "./lib/ai.js";
import { findRelatedArticles, searchRecords } from "./lib/search.js";
import { createId, downloadJson, loadData, resetData, saveData } from "./lib/storage.js";

const app = document.querySelector("#app");

let db = loadData();
let view = "desk";
let selectedTicketId = db.tickets[0]?.id || null;
let filters = { status: "All", priority: "All", query: "" };
let modal = null;
let notice = "";
let busy = "";

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatDate = (value) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));

const saveAndRender = () => {
  saveData(db);
  render();
};

const selectedTicket = () => db.tickets.find((ticket) => ticket.id === selectedTicketId) || db.tickets[0];

const ticketMatches = (ticket) => {
  const query = filters.query.toLowerCase();
  const haystack = `${ticket.id} ${ticket.subject} ${ticket.customer} ${ticket.company} ${ticket.body} ${ticket.tags.join(" ")}`.toLowerCase();
  return (
    (filters.status === "All" || ticket.status === filters.status) &&
    (filters.priority === "All" || ticket.priority === filters.priority) &&
    (!query || haystack.includes(query))
  );
};

const getTickets = () =>
  db.tickets
    .filter(ticketMatches)
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt) || new Date(b.updatedAt) - new Date(a.updatedAt));

const metricValue = (predicate) => db.tickets.filter(predicate).length;

const slaState = (ticket) => {
  const hours = (new Date(ticket.dueAt) - new Date()) / 36e5;
  if (ticket.status === "Resolved") return "ok";
  if (hours < 0) return "breached";
  if (hours < 6) return "risk";
  return "ok";
};

const setNotice = (message) => {
  notice = message;
  window.setTimeout(() => {
    if (notice === message) {
      notice = "";
      render();
    }
  }, 3200);
};

const render = () => {
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">H</div>
          <div>
            <strong>HelixDesk AI</strong>
            <span>Local support ops</span>
          </div>
        </div>
        <nav class="nav">
          ${navButton("desk", "Desk", "Queue and replies")}
          ${navButton("knowledge", "Knowledge", "Runbooks and answers")}
          ${navButton("analytics", "Analytics", "Queue health")}
          ${navButton("settings", "Settings", "Local AI and data")}
        </nav>
        <div class="privacy-card">
          <span class="status-dot"></span>
          <div>
            <strong>Local-first</strong>
            <p>Data stays in this browser unless you export it or enable a local AI endpoint.</p>
          </div>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div>
            <p class="eyebrow">${db.settings.workspaceName}</p>
            <h1>${pageTitle()}</h1>
          </div>
          <div class="topbar-actions">
            ${busy ? `<span class="busy">${escapeHtml(busy)}</span>` : ""}
            <button class="secondary" data-action="export-data">Export</button>
            <button class="primary" data-action="new-ticket">New ticket</button>
          </div>
        </header>
        ${notice ? `<div class="notice">${escapeHtml(notice)}</div>` : ""}
        ${renderView()}
      </main>
    </div>
    <div id="modal-root">${renderModal()}</div>
    <input id="import-file" type="file" accept="application/json" hidden />
  `;
  bindEvents();
};

const navButton = (target, label, hint) => `
  <button class="nav-item ${view === target ? "active" : ""}" data-view="${target}">
    <span>${escapeHtml(label)}</span>
    <small>${escapeHtml(hint)}</small>
  </button>
`;

const pageTitle = () =>
  ({
    desk: "Agent Desk",
    knowledge: "Knowledge Base",
    analytics: "Operations Analytics",
    settings: "Settings"
  })[view];

const renderView = () => {
  if (view === "knowledge") return renderKnowledge();
  if (view === "analytics") return renderAnalytics();
  if (view === "settings") return renderSettings();
  return renderDesk();
};

const renderDesk = () => {
  const tickets = getTickets();
  const current = selectedTicket() || tickets[0];
  if (current && !selectedTicketId) selectedTicketId = current.id;

  return `
    <section class="metrics-grid">
      ${metric("Open", metricValue((ticket) => ticket.status === "Open"), "Needs agent action")}
      ${metric("SLA risk", metricValue((ticket) => slaState(ticket) !== "ok"), "Due soon or overdue")}
      ${metric("AI drafted", metricValue((ticket) => Boolean(ticket.ai?.suggestedReply)), "Ready to review")}
      ${metric("Resolved", metricValue((ticket) => ticket.status === "Resolved"), "Closed locally")}
    </section>
    <section class="desk-grid">
      <div class="panel queue-panel">
        <div class="panel-heading">
          <div>
            <h2>Queue</h2>
            <p>${tickets.length} visible tickets</p>
          </div>
          <button class="secondary" data-action="analyze-all">Run AI</button>
        </div>
        <div class="filters">
          <input id="filter-query" value="${escapeHtml(filters.query)}" placeholder="Search tickets" />
          ${select("filter-status", ["All", "Open", "Waiting", "Resolved"], filters.status)}
          ${select("filter-priority", ["All", "Urgent", "High", "Normal", "Low"], filters.priority)}
        </div>
        <div class="ticket-list">
          ${tickets.map(renderTicketRow).join("") || `<div class="empty">No tickets match this filter.</div>`}
        </div>
      </div>
      <div class="panel detail-panel">
        ${current ? renderTicketDetail(current) : `<div class="empty">Create a ticket to start.</div>`}
      </div>
    </section>
  `;
};

const metric = (label, value, caption) => `
  <article class="metric">
    <span>${escapeHtml(label)}</span>
    <strong>${value}</strong>
    <small>${escapeHtml(caption)}</small>
  </article>
`;

const renderTicketRow = (ticket) => `
  <button class="ticket-row ${ticket.id === selectedTicketId ? "selected" : ""}" data-ticket-id="${ticket.id}">
    <span class="row-top">
      <strong>${escapeHtml(ticket.subject)}</strong>
      <span class="priority ${ticket.priority.toLowerCase()}">${escapeHtml(ticket.priority)}</span>
    </span>
    <span class="row-meta">${escapeHtml(ticket.customer)} · ${escapeHtml(ticket.company)}</span>
    <span class="row-bottom">
      <span>${escapeHtml(ticket.category)}</span>
      <span class="sla ${slaState(ticket)}">${formatDate(ticket.dueAt)}</span>
    </span>
  </button>
`;

const renderTicketDetail = (ticket) => {
  const articles = ticket.ai?.relatedArticleIds?.length
    ? ticket.ai.relatedArticleIds.map((id) => db.articles.find((article) => article.id === id)).filter(Boolean)
    : findRelatedArticles(ticket, db.articles, 3);

  return `
    <div class="ticket-header">
      <div>
        <p class="eyebrow">${escapeHtml(ticket.id)} · ${escapeHtml(ticket.channel)}</p>
        <h2>${escapeHtml(ticket.subject)}</h2>
        <p>${escapeHtml(ticket.customer)} · <a href="mailto:${escapeHtml(ticket.email)}">${escapeHtml(ticket.email)}</a></p>
      </div>
      <button class="primary" data-action="analyze-ticket" data-id="${ticket.id}">Analyze</button>
    </div>
    <div class="field-grid">
      ${fieldSelect(ticket, "status", ["Open", "Waiting", "Resolved"])}
      ${fieldSelect(ticket, "priority", ["Urgent", "High", "Normal", "Low"])}
      ${fieldInput(ticket, "category")}
      ${fieldInput(ticket, "assignee")}
    </div>
    <div class="split">
      <section>
        <h3>Conversation</h3>
        <div class="message-list">
          ${ticket.messages.map(renderMessage).join("")}
        </div>
        <label class="composer">
          <span>Reply</span>
          <textarea id="reply-box" placeholder="Write a customer reply"></textarea>
        </label>
        <div class="button-row">
          <button class="secondary" data-action="insert-draft" data-id="${ticket.id}" ${ticket.ai?.suggestedReply ? "" : "disabled"}>Insert AI draft</button>
          <button class="secondary" data-action="save-note" data-id="${ticket.id}">Save note</button>
          <button class="primary" data-action="send-reply" data-id="${ticket.id}">Send reply</button>
        </div>
      </section>
      <aside class="insights">
        ${renderAiCard(ticket)}
        <div class="insight-card">
          <div class="insight-title">
            <h3>Related knowledge</h3>
            <button class="ghost" data-action="new-article">Add</button>
          </div>
          ${articles.map(renderArticleMini).join("") || `<p class="muted">No related articles yet.</p>`}
        </div>
      </aside>
    </div>
  `;
};

const fieldSelect = (ticket, name, options) => `
  <label>
    <span>${name}</span>
    <select class="ticket-field" data-id="${ticket.id}" data-field="${name}">
      ${options.map((option) => `<option ${ticket[name] === option ? "selected" : ""}>${option}</option>`).join("")}
    </select>
  </label>
`;

const fieldInput = (ticket, name) => `
  <label>
    <span>${name}</span>
    <input class="ticket-field" data-id="${ticket.id}" data-field="${name}" value="${escapeHtml(ticket[name])}" />
  </label>
`;

const renderMessage = (message) => `
  <article class="message ${message.type}">
    <div>
      <strong>${escapeHtml(message.author)}</strong>
      <span>${formatDate(message.createdAt)}</span>
    </div>
    <p>${escapeHtml(message.body)}</p>
  </article>
`;

const renderAiCard = (ticket) => {
  if (!ticket.ai) {
    return `
      <div class="insight-card ai-empty">
        <h3>AI triage</h3>
        <p>Run analysis to summarize the ticket, match knowledge, detect urgency, and draft a reply.</p>
      </div>
    `;
  }

  return `
    <div class="insight-card">
      <div class="insight-title">
        <h3>AI triage</h3>
        <span>${escapeHtml(ticket.ai.provider)}</span>
      </div>
      ${ticket.ai.warning ? `<p class="warning">${escapeHtml(ticket.ai.warning)}</p>` : ""}
      <p>${escapeHtml(ticket.ai.summary)}</p>
      <div class="pill-row">
        <span>${escapeHtml(ticket.ai.priority)}</span>
        <span>${escapeHtml(ticket.ai.category)}</span>
        <span>${escapeHtml(ticket.ai.sentiment)}</span>
        <span>${Math.round((ticket.ai.confidence || 0) * 100)}% confidence</span>
      </div>
      <h4>Next steps</h4>
      <ul>${(ticket.ai.nextSteps || []).map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ul>
      <h4>Draft</h4>
      <pre>${escapeHtml(ticket.ai.suggestedReply)}</pre>
    </div>
  `;
};

const renderArticleMini = (article) => `
  <article class="article-mini">
    <strong>${escapeHtml(article.title)}</strong>
    <span>${escapeHtml(article.collection)} · ${article.tags.map(escapeHtml).join(", ")}</span>
  </article>
`;

const select = (id, options, value) => `
  <select id="${id}">
    ${options.map((option) => `<option ${value === option ? "selected" : ""}>${option}</option>`).join("")}
  </select>
`;

const renderKnowledge = () => {
  const query = filters.query;
  const articles = searchRecords(db.articles, query, ["title", "collection", "content", (article) => article.tags.join(" ")]);
  return `
    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>Knowledge base</h2>
          <p>${articles.length} articles available for AI matching</p>
        </div>
        <button class="primary" data-action="new-article">New article</button>
      </div>
      <div class="filters one-line">
        <input id="filter-query" value="${escapeHtml(query)}" placeholder="Search articles" />
      </div>
      <div class="article-grid">
        ${articles.map(renderArticleCard).join("")}
      </div>
    </section>
  `;
};

const renderArticleCard = (article) => `
  <article class="article-card">
    <div>
      <span class="eyebrow">${escapeHtml(article.collection)}</span>
      <h3>${escapeHtml(article.title)}</h3>
      <p>${escapeHtml(article.content)}</p>
    </div>
    <div class="article-footer">
      <span>${article.tags.map(escapeHtml).join(", ")}</span>
      <div>
        <button class="ghost" data-action="edit-article" data-id="${article.id}">Edit</button>
        <button class="ghost danger" data-action="delete-article" data-id="${article.id}">Delete</button>
      </div>
    </div>
  </article>
`;

const renderAnalytics = () => {
  const byPriority = countBy("priority");
  const byCategory = countBy("category");
  const byStatus = countBy("status");
  return `
    <section class="analytics-grid">
      <div class="panel">
        <h2>Queue health</h2>
        ${barChart(byStatus)}
      </div>
      <div class="panel">
        <h2>Priority mix</h2>
        ${barChart(byPriority)}
      </div>
      <div class="panel wide">
        <h2>Category mix</h2>
        ${barChart(byCategory)}
      </div>
      <div class="panel wide">
        <h2>SLA watchlist</h2>
        <div class="watchlist">
          ${db.tickets
            .filter((ticket) => slaState(ticket) !== "ok")
            .map(
              (ticket) => `
                <button class="watch-row" data-ticket-id="${ticket.id}">
                  <strong>${escapeHtml(ticket.subject)}</strong>
                  <span>${escapeHtml(ticket.priority)} · ${formatDate(ticket.dueAt)}</span>
                </button>
              `
            )
            .join("") || `<div class="empty">No SLA risk right now.</div>`}
        </div>
      </div>
    </section>
  `;
};

const countBy = (field) =>
  db.tickets.reduce((acc, ticket) => {
    acc[ticket[field]] = (acc[ticket[field]] || 0) + 1;
    return acc;
  }, {});

const barChart = (data) => {
  const max = Math.max(...Object.values(data), 1);
  return `
    <div class="bars">
      ${Object.entries(data)
        .sort((a, b) => b[1] - a[1])
        .map(
          ([label, value]) => `
            <div class="bar-row">
              <span>${escapeHtml(label)}</span>
              <div><i style="width:${(value / max) * 100}%"></i></div>
              <strong>${value}</strong>
            </div>
          `
        )
        .join("")}
    </div>
  `;
};

const renderSettings = () => `
  <section class="settings-grid">
    <form class="panel settings-form" id="settings-form">
      <h2>Workspace</h2>
      <label><span>Workspace name</span><input name="workspaceName" value="${escapeHtml(db.settings.workspaceName)}" /></label>
      <label><span>Default assignee</span><input name="defaultAssignee" value="${escapeHtml(db.settings.defaultAssignee)}" /></label>
      <label><span>Reply tone</span><input name="tone" value="${escapeHtml(db.settings.tone)}" /></label>
      <h2>AI provider</h2>
      <label>
        <span>Mode</span>
        <select name="aiProvider">
          <option value="fallback" ${db.settings.aiProvider === "fallback" ? "selected" : ""}>Local rules fallback</option>
          <option value="ollama" ${db.settings.aiProvider === "ollama" ? "selected" : ""}>Ollama</option>
        </select>
      </label>
      <label><span>Ollama endpoint</span><input name="ollamaEndpoint" value="${escapeHtml(db.settings.ollamaEndpoint)}" /></label>
      <label><span>Ollama model</span><input name="ollamaModel" value="${escapeHtml(db.settings.ollamaModel)}" /></label>
      <div class="button-row">
        <button class="secondary" type="button" data-action="test-ollama">Test connection</button>
        <button class="primary" type="submit">Save settings</button>
      </div>
    </form>
    <div class="panel">
      <h2>Data controls</h2>
      <p>Back up or restore the local workspace. Imports replace the current browser data after validation.</p>
      <div class="button-stack">
        <button class="secondary" data-action="export-data">Export JSON</button>
        <button class="secondary" data-action="import-data">Import JSON</button>
        <button class="danger-button" data-action="reset-data">Reset demo data</button>
      </div>
    </div>
  </section>
`;

const renderModal = () => {
  if (modal === "ticket") {
    return `
      <div class="modal-backdrop">
        <form class="modal-card" id="ticket-form">
          <div class="modal-heading"><h2>New ticket</h2><button type="button" class="ghost" data-action="close-modal">Close</button></div>
          <label><span>Customer</span><input name="customer" required /></label>
          <label><span>Email</span><input name="email" type="email" required /></label>
          <label><span>Company</span><input name="company" /></label>
          <label><span>Subject</span><input name="subject" required /></label>
          <label><span>Message</span><textarea name="body" required></textarea></label>
          <div class="field-grid">
            <label><span>Channel</span>${formSelect("channel", ["Email", "Chat", "Portal"])}</label>
            <label><span>Priority</span>${formSelect("priority", ["Normal", "High", "Urgent", "Low"])}</label>
          </div>
          <button class="primary" type="submit">Create ticket</button>
        </form>
      </div>
    `;
  }

  if (modal?.type === "article") {
    const article = modal.article || { title: "", collection: "", tags: [], content: "" };
    return `
      <div class="modal-backdrop">
        <form class="modal-card" id="article-form" data-id="${escapeHtml(article.id || "")}">
          <div class="modal-heading"><h2>${article.id ? "Edit article" : "New article"}</h2><button type="button" class="ghost" data-action="close-modal">Close</button></div>
          <label><span>Title</span><input name="title" value="${escapeHtml(article.title)}" required /></label>
          <label><span>Collection</span><input name="collection" value="${escapeHtml(article.collection)}" required /></label>
          <label><span>Tags</span><input name="tags" value="${escapeHtml((article.tags || []).join(", "))}" /></label>
          <label><span>Content</span><textarea name="content" required>${escapeHtml(article.content)}</textarea></label>
          <button class="primary" type="submit">Save article</button>
        </form>
      </div>
    `;
  }

  return "";
};

const formSelect = (name, options) => `
  <select name="${name}">
    ${options.map((option) => `<option>${option}</option>`).join("")}
  </select>
`;

const bindEvents = () => {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      view = button.dataset.view;
      render();
    });
  });

  document.querySelectorAll("[data-ticket-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedTicketId = button.dataset.ticketId;
      view = "desk";
      render();
    });
  });

  document.querySelector("#filter-query")?.addEventListener("input", (event) => {
    filters.query = event.target.value;
    render();
  });

  document.querySelector("#filter-status")?.addEventListener("change", (event) => {
    filters.status = event.target.value;
    render();
  });

  document.querySelector("#filter-priority")?.addEventListener("change", (event) => {
    filters.priority = event.target.value;
    render();
  });

  document.querySelectorAll(".ticket-field").forEach((field) => {
    field.addEventListener("change", updateTicketField);
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", handleAction);
  });

  document.querySelector("#ticket-form")?.addEventListener("submit", createTicket);
  document.querySelector("#article-form")?.addEventListener("submit", saveArticle);
  document.querySelector("#settings-form")?.addEventListener("submit", saveSettings);
  document.querySelector("#import-file")?.addEventListener("change", importData);
};

const handleAction = async (event) => {
  const action = event.currentTarget.dataset.action;
  const id = event.currentTarget.dataset.id;

  if (action === "new-ticket") modal = "ticket";
  if (action === "close-modal") modal = null;
  if (action === "new-article") modal = { type: "article" };
  if (action === "edit-article") modal = { type: "article", article: db.articles.find((article) => article.id === id) };
  if (action === "delete-article") deleteArticle(id);
  if (action === "insert-draft") insertDraft(id);
  if (action === "send-reply") sendReply(id, "agent");
  if (action === "save-note") sendReply(id, "internal");
  if (action === "export-data") downloadJson(db, `helixdesk-export-${new Date().toISOString().slice(0, 10)}.json`);
  if (action === "import-data") document.querySelector("#import-file").click();
  if (action === "reset-data") {
    if (confirm("Reset HelixDesk AI to the seeded demo workspace?")) {
      db = resetData();
      selectedTicketId = db.tickets[0]?.id || null;
      setNotice("Demo data restored.");
    }
  }
  if (action === "analyze-ticket") await runAnalysis(id);
  if (action === "analyze-all") await runAnalysisForVisibleTickets();
  if (action === "test-ollama") await runConnectionTest();

  render();
};

const createTicket = async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const now = new Date().toISOString();
  const due = new Date();
  due.setHours(due.getHours() + 24);
  const ticket = {
    id: createId("TCK"),
    customer: form.get("customer"),
    email: form.get("email"),
    company: form.get("company") || "Unknown company",
    subject: form.get("subject"),
    body: form.get("body"),
    channel: form.get("channel"),
    status: "Open",
    priority: form.get("priority"),
    category: "General",
    assignee: db.settings.defaultAssignee,
    tags: [],
    createdAt: now,
    updatedAt: now,
    dueAt: due.toISOString(),
    messages: [{ author: form.get("customer"), type: "customer", body: form.get("body"), createdAt: now }],
    ai: null
  };
  db.tickets.unshift(ticket);
  selectedTicketId = ticket.id;
  modal = null;
  saveData(db);
  await runAnalysis(ticket.id, false);
  setNotice("Ticket created and triaged.");
};

const saveArticle = (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const id = event.currentTarget.dataset.id || createId("KB");
  const article = {
    id,
    title: form.get("title"),
    collection: form.get("collection"),
    tags: String(form.get("tags") || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    content: form.get("content"),
    updatedAt: new Date().toISOString()
  };
  const index = db.articles.findIndex((item) => item.id === id);
  if (index === -1) db.articles.unshift(article);
  else db.articles[index] = article;
  modal = null;
  saveAndRender();
  setNotice("Knowledge article saved.");
};

const deleteArticle = (id) => {
  if (!confirm("Delete this article?")) return;
  db.articles = db.articles.filter((article) => article.id !== id);
  saveAndRender();
  setNotice("Knowledge article deleted.");
};

const saveSettings = (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  db.settings = {
    ...db.settings,
    workspaceName: form.get("workspaceName"),
    defaultAssignee: form.get("defaultAssignee"),
    tone: form.get("tone"),
    aiProvider: form.get("aiProvider"),
    ollamaEndpoint: form.get("ollamaEndpoint"),
    ollamaModel: form.get("ollamaModel")
  };
  saveAndRender();
  setNotice("Settings saved.");
};

const updateTicketField = (event) => {
  const ticket = db.tickets.find((item) => item.id === event.target.dataset.id);
  if (!ticket) return;
  ticket[event.target.dataset.field] = event.target.value;
  ticket.updatedAt = new Date().toISOString();
  saveAndRender();
};

const insertDraft = (id) => {
  const ticket = db.tickets.find((item) => item.id === id);
  const box = document.querySelector("#reply-box");
  if (ticket?.ai?.suggestedReply && box) box.value = ticket.ai.suggestedReply;
};

const sendReply = (id, type) => {
  const box = document.querySelector("#reply-box");
  const body = box?.value.trim();
  if (!body) {
    setNotice("Write a reply or note first.");
    return;
  }
  const ticket = db.tickets.find((item) => item.id === id);
  ticket.messages.push({
    author: type === "internal" ? `${db.settings.defaultAssignee} (internal)` : db.settings.defaultAssignee,
    type,
    body,
    createdAt: new Date().toISOString()
  });
  ticket.status = type === "internal" ? ticket.status : "Waiting";
  ticket.updatedAt = new Date().toISOString();
  saveAndRender();
  setNotice(type === "internal" ? "Internal note saved." : "Reply added to the conversation.");
};

const runAnalysis = async (id, shouldRender = true) => {
  const ticket = db.tickets.find((item) => item.id === id);
  if (!ticket) return;
  busy = "Analyzing ticket...";
  if (shouldRender) render();
  ticket.ai = await analyzeTicket(ticket, db.articles, db.settings);
  ticket.priority = ticket.ai.priority || ticket.priority;
  ticket.category = ticket.ai.category || ticket.category;
  ticket.tags = ticket.ai.tags || ticket.tags;
  ticket.updatedAt = new Date().toISOString();
  busy = "";
  saveData(db);
  if (shouldRender) setNotice("AI triage updated.");
};

const runAnalysisForVisibleTickets = async () => {
  const tickets = getTickets();
  busy = `Analyzing ${tickets.length} tickets...`;
  render();
  for (const ticket of tickets) {
    ticket.ai = await analyzeTicket(ticket, db.articles, db.settings);
    ticket.priority = ticket.ai.priority || ticket.priority;
    ticket.category = ticket.ai.category || ticket.category;
    ticket.tags = ticket.ai.tags || ticket.tags;
    ticket.updatedAt = new Date().toISOString();
  }
  busy = "";
  saveAndRender();
  setNotice("Visible tickets analyzed.");
};

const runConnectionTest = async () => {
  busy = "Testing Ollama...";
  render();
  try {
    const models = await testOllama(db.settings);
    setNotice(models.length ? `Ollama connected. ${models.length} model(s) found.` : "Ollama connected.");
  } catch (error) {
    setNotice(`Ollama test failed: ${error.message}`);
  } finally {
    busy = "";
    render();
  }
};

const importData = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const next = JSON.parse(await file.text());
    if (!Array.isArray(next.tickets) || !Array.isArray(next.articles) || !next.settings) {
      throw new Error("Invalid HelixDesk export.");
    }
    db = next;
    selectedTicketId = db.tickets[0]?.id || null;
    saveAndRender();
    setNotice("Workspace imported.");
  } catch (error) {
    setNotice(`Import failed: ${error.message}`);
  } finally {
    event.target.value = "";
  }
};

render();
