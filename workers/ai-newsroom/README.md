# দৃষ্টিপাতBD AI Newsroom Worker

এই Worker কেবল RSS/Atom source থেকে সংবাদ-প্রার্থী সংগ্রহ করে, একাধিক উৎসে একই ঘটনা corroborate হলে বাংলা খসড়া তৈরি করে এবং অনুমোদিত হলে `ai_news_queue`-তে **pending** হিসেবে সংরক্ষণ করে। এতে কোনো auto-publish implementation নেই।

## নিরাপত্তার ডিফল্ট

- `NEWSROOM_ENABLED=false`
- `NEWSROOM_DRY_RUN=true`
- `AUTO_PUBLISH_ENABLED=false` (তথ্যগত guard; Worker কখনো publish করে না)
- Cron: প্রতি ৩০ মিনিটে; UTC schedule, কিন্তু Worker disabled থাকলে কিছুই করে না
- Production-এ deploy করা হয়নি; এটি শুধু `ai-newsroom-integration` branch-এর source code

## প্রয়োজনীয় bindings / secrets

Cloudflare Worker settings-এ server-side সেট করতে হবে:

- Secret `OPENAI_API_KEY`
- Secret `SUPABASE_SERVICE_ROLE_KEY`
- Secret `NEWSROOM_RUN_TOKEN` (manual `POST /run` endpoint-এর জন্য)
- Variable `SUPABASE_URL`
- Variable `NEWSROOM_SOURCES` — সম্পাদক-অনুমোদিত RSS/Atom feed allowlist-এর JSON array
- Variable `OPENAI_MODEL` — default `gpt-4.1-mini`

উদাহরণ allowlist format (বাস্তব source নয়; সম্পাদকীয় অনুমোদিত URL দিয়ে পূরণ করতে হবে):

```json
[
  {
    "publisherId": "publisher-a",
    "name": "Publisher A",
    "domain": "news.example",
    "url": "https://news.example/rss.xml"
  },
  {
    "publisherId": "publisher-b",
    "name": "Publisher B",
    "domain": "world.example",
    "url": "https://world.example/feed.xml"
  }
]
```

প্রতিটি URL অবশ্যই HTTPS হবে এবং `domain`-এর সঙ্গে URL hostname হুবহু মিলতে হবে। একই publisherId পুনরাবৃত্তি করা যাবে না। Redirect বন্ধ রাখা হয়েছে, যাতে allowlist-এর বাইরের host-এ feed request চলে না যায়।

## কার্যপ্রবাহ

1. Allowlist-এর feed fetch করে; প্রতি feed সর্বোচ্চ ২০টি item এবং মোট সর্বোচ্চ ১০০টি item নেয়।
2. একই URL duplicate বাদ দেয়।
3. OpenAI Responses API-এর Structured Outputs দিয়ে source index-সহ candidate draft তৈরি করে।
4. অন্তত দুইটি পৃথক publisherId এবং দুইটি পৃথক domain না থাকলে candidate বাতিল করে।
5. Dry-run-এ কোনো database write হয় না।
6. Write mode চালু হলেও verification migration না থাকলে Worker fail-closed করে।
7. Write সফল হলে সব story `workflow_status=pending`, `auto_publish=false`, `verification_status=needs_review`, `confidence_score=0`, `auto_publish_rule=manual_only` হিসেবে সেভ হয়।

AI-এর লেখা কখনো নিজে থেকে verified ধরা হয় না। Admin review ও স্বাধীন fact-check আবশ্যক।

## Database prerequisite

`supabase/migrations/202611010001_harden_ai_newsroom_verification.sql` এখনও Production database-এ প্রয়োগ করা হয়নি। Worker-এর write mode-এ যাওয়ার আগে staging-এ migration প্রয়োগ, schema যাচাই এবং আলাদা অনুমোদন প্রয়োজন। Worker migration চালায় না এবং schema পরিবর্তন করে না।

## Manual run

`NEWSROOM_ENABLED=true` এবং `NEWSROOM_RUN_TOKEN` configure করার পর:

```bash
curl -X POST https://<worker-host>/run \
  -H "Authorization: Bearer $NEWSROOM_RUN_TOKEN"
```

Dry-run বন্ধ না করা পর্যন্ত কোনো queue row লেখা হবে না। `NEWSROOM_DRY_RUN=false` করার আগে source allowlist, staging migration, secrets, editorial prompt এবং output review পরীক্ষা করতে হবে।

## গুরুত্বপূর্ণ সীমাবদ্ধতা

- RSS/Atom metadata ও description-এর বাইরে paywalled/full article extraction করা হয় না।
- AI-এর corroboration proposal সম্পাদকীয় যাচাইয়ের বিকল্প নয়।
- Breaking, sports বা অন্য কোনো category স্বয়ংক্রিয়ভাবে প্রকাশ করা হয় না।
- Source allowlist ফাঁকা থাকলে run ব্যর্থ হবে; কোনো publisher নিজে থেকে যোগ করা হয়নি।
- Worker deploy, secrets configuration, migration apply, branch merge বা Production release এই implementation-এর অংশ নয়।
