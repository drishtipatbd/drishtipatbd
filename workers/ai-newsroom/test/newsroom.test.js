import test from "node:test";
import assert from "node:assert/strict";
import {
  safeIsoDate,
  parseFeed,
  loadSources,
  hasIndependentCorroboration,
  buildDraftMessages,
  parseDraftResponse,
  draftStories,
  shouldGenerateDraftAt
} from "../src/index.js";

const source = (overrides = {}) => ({
  publisherId: "publisher-a",
  sourceId: "publisher-a:main",
  name: "Publisher A",
  domain: "news.example",
  url: "https://news.example/rss.xml",
  region: "international",
  country: "Example",
  language: "en",
  categories: ["world"],
  tier: "tier1",
  ...overrides
});

const rss = (dateTag = "") => `<?xml version="1.0"?><rss><channel><item>
<title>Test headline</title><link>https://news.example/story-1</link>
<description>Test description</description>${dateTag}
</item></channel></rss>`;

test("safeIsoDate rejects malformed and missing dates", () => {
  assert.equal(safeIsoDate("not-a-date"), null);
  assert.equal(safeIsoDate(""), null);
  assert.equal(typeof safeIsoDate("2026-11-01T12:00:00Z"), "string");
});

test("parseFeed accepts a recent dated RSS item", () => {
  const recent = new Date(Date.now() - 60 * 60 * 1000).toUTCString();
  const items = parseFeed(rss(`<pubDate>${recent}</pubDate>`), source());
  assert.equal(items.length, 1);
  assert.equal(items[0].publisherId, "publisher-a");
});

test("parseFeed rejects stale, undated, and excessively future-dated items", () => {
  const stale = new Date(Date.now() - 73 * 60 * 60 * 1000).toUTCString();
  const future = new Date(Date.now() + 7 * 60 * 60 * 1000).toUTCString();
  assert.equal(parseFeed(rss(`<pubDate>${stale}</pubDate>`), source()).length, 0);
  assert.equal(parseFeed(rss(""), source()).length, 0);
  assert.equal(parseFeed(rss(`<pubDate>${future}</pubDate>`), source()).length, 0);
});

test("loadSources requires an explicitly approved and enabled HTTPS feed", () => {
  assert.throws(() => loadSources(JSON.stringify([source({ enabled: false, status: "approved" })])), /No sources are active/);
  assert.throws(() => loadSources(JSON.stringify([source({ enabled: true, status: "approved", url: "http://news.example/rss.xml" })])), /HTTPS/);
  assert.throws(() => loadSources(JSON.stringify([source({ enabled: true, status: "approved", domain: "other.example" })])), /exactly match/);
});

test("multiple feeds from one publisher do not count as independent corroboration", () => {
  const samePublisher = [
    { publisherId: "publisher-a", domain: "a.example" },
    { publisherId: "publisher-a", domain: "b.example" }
  ];
  assert.equal(hasIndependentCorroboration(samePublisher), false);
});

test("independent publishers on distinct domains corroborate", () => {
  const independent = [
    { publisherId: "publisher-a", domain: "a.example" },
    { publisherId: "publisher-b", domain: "b.example" }
  ];
  assert.equal(hasIndependentCorroboration(independent), true);
});

test("Workers AI prompt stays inside the daily free-tier character budget", () => {
  const items = Array.from({ length: 10 }, (_, index) => ({
    publisher: "Publisher " + index,
    publisherId: "publisher-" + index,
    domain: "news" + index + ".example",
    region: "international",
    categories: ["world"],
    url: "https://news" + index + ".example/story",
    title: "Headline " + index + " ".repeat(180),
    description: "Long source description ".repeat(20) + index,
    publishedAt: "2026-11-01T12:00:00.000Z"
  }));
  const prompt = buildDraftMessages(items);
  assert.ok(prompt.prompt_chars <= 1800);
  assert.ok(prompt.source_count >= 1);
  assert.ok(prompt.source_count <= items.length);
});

test("Workers AI parser accepts fenced JSON and normalizes unknown news types", () => {
  const result = parseDraftResponse('\\`\\`\\`json\\n{"stories":[{"source_indexes":[0,1],"title":"শিরোনাম","excerpt":"সারাংশ","body":"বিস্তারিত","category":"বাংলাদেশ","news_type":"made_up","verification_notes":"দুটি উৎসে মিলেছে"}]}\\n\\`\\`\\`');
  assert.equal(result.length, 1);
  assert.equal(result[0].news_type, "general");
});

test("AI draft generation is limited to the top of each UTC hour", () => {
  assert.equal(shouldGenerateDraftAt("2026-11-01T10:00:00.000Z"), true);
  assert.equal(shouldGenerateDraftAt("2026-11-01T10:30:00.000Z"), false);
});


test("Gemini draft adapter sends a bounded JSON-mode request with the server secret", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        stories: [{
          source_indexes: [0],
          title: "বাংলা শিরোনাম",
          excerpt: "সংক্ষিপ্ত সারাংশ",
          body: "উৎসসমর্থিত খসড়া",
          category: "বাংলাদেশ",
          news_type: "general",
          verification_notes: "সম্পাদকীয় যাচাই প্রয়োজন"
        }]
      }) }] } }]
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const items = [{
      publisher: "Publisher A",
      publisherId: "publisher-a",
      domain: "a.example",
      url: "https://a.example/story",
      title: "Source A headline",
      description: "Source A summary",
      publishedAt: "2026-11-01T10:00:00.000Z"
    }];
    const drafts = await draftStories({ GEMINI_API_KEY: "test-secret", GEMINI_MODEL: "gemini-2.5-flash" }, items);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /gemini-2\.5-flash:generateContent$/);
    assert.equal(calls[0].options.headers["x-goog-api-key"], "test-secret");
    const body = JSON.parse(calls[0].options.body);
    assert.equal(body.generationConfig.responseMimeType, "application/json");
    assert.equal(body.generationConfig.maxOutputTokens, 500);
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].title, "বাংলা শিরোনাম");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
