import { createSeedData } from "../src/lib/sample-data.js";
import { analyzeWithFallback } from "../src/lib/ai.js";
import { findRelatedArticles } from "../src/lib/search.js";
import { normalizeData } from "../src/lib/storage.js";
import fs from "node:fs";

const requiredFiles = ["index.html", "README.md", "LICENSE", "src/app.js", "src/styles.css", "assets/readme-banner.png"];
const missing = requiredFiles.filter((file) => !fs.existsSync(new URL(`../${file}`, import.meta.url)));

if (missing.length) {
  throw new Error(`Missing required files: ${missing.join(", ")}`);
}

const seed = createSeedData();
if (seed.tickets.length < 4 || seed.articles.length < 4) {
  throw new Error("Expected seeded tickets and knowledge articles.");
}

const analysis = analyzeWithFallback(seed.tickets[0], seed.articles, seed.settings);
if (!analysis.suggestedReply || !analysis.summary || !analysis.relatedArticleIds.length) {
  throw new Error("Fallback AI analysis did not produce the expected support artifacts.");
}

if (analysis.priority !== "Urgent" || analysis.category !== "Authentication") {
  throw new Error("Fallback AI triage did not classify the seeded SSO ticket correctly.");
}

const related = findRelatedArticles(seed.tickets[2], seed.articles);
if (!related.some((article) => article.title.includes("CSV"))) {
  throw new Error("Knowledge search did not find the expected CSV article.");
}

const imported = normalizeData({
  tickets: [{ subject: "Imported ticket", body: "Needs help" }],
  articles: [{ title: "Imported article" }]
});

if (!imported.tickets[0].tags || !imported.tickets[0].messages.length || !imported.settings.defaultAssignee) {
  throw new Error("Import normalization did not hydrate required defaults.");
}

console.log("HelixDesk AI smoke test passed.");
