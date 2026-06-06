import { createSeedData } from "./sample-data.js";

export const STORAGE_KEY = "helixdesk:v1";
export const DRAFTS_KEY = "helixdesk:drafts:v1";
const VALID_STATUSES = new Set(["Open", "Waiting", "Escalated", "Resolved"]);
const VALID_PRIORITIES = new Set(["Urgent", "High", "Normal", "Low"]);

export const createId = (prefix) => {
  const value = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${value}`;
};

export const loadData = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      const seeded = createSeedData();
      saveData(seeded);
      return seeded;
    }
    const normalized = normalizeData(JSON.parse(stored));
    saveData(normalized);
    return normalized;
  } catch (error) {
    console.warn("Unable to load HelixDesk data; resetting seed data.", error);
    const seeded = createSeedData();
    saveData(seeded);
    return seeded;
  }
};

export const saveData = (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const loadDrafts = () => {
  try {
    return JSON.parse(localStorage.getItem(DRAFTS_KEY) || "{}");
  } catch (error) {
    console.warn("Unable to load HelixDesk drafts; clearing draft storage.", error);
    localStorage.removeItem(DRAFTS_KEY);
    return {};
  }
};

export const saveDrafts = (drafts) => {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
};

export const clearDrafts = () => {
  localStorage.removeItem(DRAFTS_KEY);
};

export const resetData = () => {
  const seeded = createSeedData();
  saveData(seeded);
  clearDrafts();
  return seeded;
};

export const normalizeData = (data) => {
  const seed = createSeedData();
  const tickets = Array.isArray(data?.tickets) ? data.tickets : [];
  const articles = Array.isArray(data?.articles) ? data.articles : [];

  return {
    version: 1,
    tickets: tickets.map((ticket, index) => {
      const now = new Date().toISOString();
      const createdAt = isValidDate(ticket.createdAt) ? ticket.createdAt : now;
      const dueAt = isValidDate(ticket.dueAt) ? ticket.dueAt : new Date(Date.now() + 24 * 36e5).toISOString();
      return {
        id: ticket.id || createId("TCK"),
        customer: ticket.customer || "Unknown customer",
        email: ticket.email || "",
        company: ticket.company || "Unknown company",
        subject: ticket.subject || `Imported ticket ${index + 1}`,
        body: ticket.body || "",
        channel: ticket.channel || "Email",
        status: VALID_STATUSES.has(ticket.status) ? ticket.status : "Open",
        priority: VALID_PRIORITIES.has(ticket.priority) ? ticket.priority : "Normal",
        category: ticket.category || "General",
        assignee: ticket.assignee || data?.settings?.defaultAssignee || seed.settings.defaultAssignee,
        tags: Array.isArray(ticket.tags) ? ticket.tags : [],
        createdAt,
        updatedAt: isValidDate(ticket.updatedAt) ? ticket.updatedAt : createdAt,
        dueAt,
        messages: normalizeMessages(ticket, createdAt),
        ai: ticket.ai || null
      };
    }),
    articles: articles.map((article, index) => ({
      id: article.id || createId("KB"),
      title: article.title || `Imported article ${index + 1}`,
      collection: article.collection || "General",
      tags: Array.isArray(article.tags) ? article.tags : [],
      updatedAt: isValidDate(article.updatedAt) ? article.updatedAt : new Date().toISOString(),
      content: article.content || ""
    })),
    settings: {
      ...seed.settings,
      ...(data?.settings || {})
    }
  };
};

const isValidDate = (value) => {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
};

const normalizeMessages = (ticket, fallbackDate) => {
  const messages = Array.isArray(ticket.messages) && ticket.messages.length
    ? ticket.messages
    : [{ author: ticket.customer || "Unknown customer", type: "customer", body: ticket.body || "", createdAt: fallbackDate }];

  return messages.map((message) => ({
    author: message.author || ticket.customer || "Unknown customer",
    type: ["customer", "agent", "internal"].includes(message.type) ? message.type : "customer",
    body: message.body || "",
    createdAt: isValidDate(message.createdAt) ? message.createdAt : fallbackDate
  }));
};

export const downloadJson = (data, filename) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
