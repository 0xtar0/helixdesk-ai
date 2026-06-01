import { createSeedData } from "./sample-data.js";

export const STORAGE_KEY = "helixdesk:v1";

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

export const resetData = () => {
  const seeded = createSeedData();
  saveData(seeded);
  return seeded;
};

export const normalizeData = (data) => {
  const seed = createSeedData();
  const tickets = Array.isArray(data?.tickets) ? data.tickets : [];
  const articles = Array.isArray(data?.articles) ? data.articles : [];

  return {
    version: 1,
    tickets: tickets.map((ticket, index) => {
      const createdAt = ticket.createdAt || new Date().toISOString();
      const dueAt = ticket.dueAt || new Date(Date.now() + 24 * 36e5).toISOString();
      return {
        id: ticket.id || createId("TCK"),
        customer: ticket.customer || "Unknown customer",
        email: ticket.email || "",
        company: ticket.company || "Unknown company",
        subject: ticket.subject || `Imported ticket ${index + 1}`,
        body: ticket.body || "",
        channel: ticket.channel || "Email",
        status: ticket.status || "Open",
        priority: ticket.priority || "Normal",
        category: ticket.category || "General",
        assignee: ticket.assignee || data?.settings?.defaultAssignee || seed.settings.defaultAssignee,
        tags: Array.isArray(ticket.tags) ? ticket.tags : [],
        createdAt,
        updatedAt: ticket.updatedAt || createdAt,
        dueAt,
        messages: Array.isArray(ticket.messages) && ticket.messages.length
          ? ticket.messages
          : [{ author: ticket.customer || "Unknown customer", type: "customer", body: ticket.body || "", createdAt }],
        ai: ticket.ai || null
      };
    }),
    articles: articles.map((article, index) => ({
      id: article.id || createId("KB"),
      title: article.title || `Imported article ${index + 1}`,
      collection: article.collection || "General",
      tags: Array.isArray(article.tags) ? article.tags : [],
      updatedAt: article.updatedAt || new Date().toISOString(),
      content: article.content || ""
    })),
    settings: {
      ...seed.settings,
      ...(data?.settings || {})
    }
  };
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
