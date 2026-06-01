const normalize = (value) => String(value || "").toLowerCase();

export const scoreArticle = (ticket, article) => {
  const haystack = normalize(`${article.title} ${article.collection} ${article.tags.join(" ")} ${article.content}`);
  const terms = normalize(`${ticket.subject} ${ticket.body} ${ticket.category} ${(ticket.tags || []).join(" ")}`)
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2);
  const uniqueTerms = [...new Set(terms)];
  return uniqueTerms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
};

export const findRelatedArticles = (ticket, articles, limit = 3) =>
  articles
    .map((article) => ({ article, score: scoreArticle(ticket, article) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title))
    .slice(0, limit)
    .map((entry) => entry.article);

export const searchRecords = (records, query, fields) => {
  const needle = normalize(query);
  if (!needle) return records;
  return records.filter((record) =>
    fields.some((field) => normalize(typeof field === "function" ? field(record) : record[field]).includes(needle))
  );
};
