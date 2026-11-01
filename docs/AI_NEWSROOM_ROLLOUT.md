# দৃষ্টিপাতBD AI Newsroom — নিরাপদ রোলআউট

## বর্তমান অবস্থা
- Admin dashboard-এ AI News Queue UI আছে।
- `ai_news_queue` টেবিল তৈরির migration repository-তে আছে; production database-এ এই নতুন hardening migration চালানো হয়নি।
- AI সংগ্রহ/খসড়া তৈরির Worker source code `workers/ai-newsroom/`-এ integration branch-এ প্রস্তুত; deploy করা হয়নি।
- Worker default-এ disabled এবং dry-run; এতে কোনো auto-publish code নেই।
- `ai-newsroom-integration` হলো পরীক্ষামূলক branch; `main`-ই Production branch।

## Editorial policy
1. সাধারণ সংবাদ, মতামত, ধর্ম/জীবনধারা এবং অযাচাইকৃত তথ্য সবসময় `pending` থাকবে।
2. Live sports update কেবল অনুমোদিত source allowlist, সময়-সংবেদনশীলতা, দুই বা ততোধিক স্বাধীন corroborating source এবং >= 0.950 verification confidence পূরণ করলে auto-publish বিবেচনা করা যাবে।
3. Breaking / urgent domestic / urgent international-এর auto-publish আলাদা policy switch দিয়ে নিয়ন্ত্রিত হবে। শুধু AI confidence যথেষ্ট নয়; official/primary source এবং independent corroboration আবশ্যক।
4. Source evidence, original URLs, timestamps, verification notes, model/version, reviewer, এবং correction history সংরক্ষণ করতে হবে।
5. Quote, statistic, date, score, casualty count, attribution বা statement বানিয়ে লেখা যাবে না। Source-এ নেই এমন তথ্য বাদ দিতে হবে।
6. Duplicate event/story dedupe key দিয়ে আটকে দিতে হবে। conflicting reports হলে `conflicting` এবং manual review।
7. Auto-publish-এর global kill switch default OFF থাকবে। প্রথমে dry-run only; editorial approval ছাড়া live auto-publish চালু হবে না।
8. Ad scripts / tracking scripts AI-generated article content-এ কখনো inject করা যাবে না।

## Queue publication guard
Admin UI এখন AI story প্রকাশের আগে বাধ্যতামূলকভাবে চায়:
- `verification_status = verified`
- অন্তত ২টি `source_evidence` record
- `confidence_score >= 0.950`

যাচাই অসম্পূর্ণ হলে UI থেকে publish করা যাবে না। পুরোনো confirmation prompt দিয়ে verification bypass আর অনুমোদিত নয়।

## Database migration
`supabase/migrations/202611010001_harden_ai_newsroom_verification.sql` additive fields, audit history, evidence array, confidence score, allowlisted automation policy এবং database-level auto-publish guard যোগ করে।

**এটি শুধু integration branch-এ লেখা হয়েছে; Supabase-এ চালানো হয়নি।** Production migration-এর আগে backup, staging test, constraint validation এবং আলাদা অনুমোদন লাগবে।

## Automation backend — পরবর্তী বাস্তবায়ন
Cloudflare Worker + Cron (বা সমতুল্য scheduled backend) ব্যবহার করতে হবে। Browser-side JavaScript-এ কোনো privileged key থাকবে না। Backend-এর secret bindings:
- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (শুধু server-side secret)
- `NEWSROOM_ENABLED` (default false)
- `AUTO_PUBLISH_ENABLED` (default false)

Worker-এর কাজ:
1. Allowlisted RSS/API sources থেকে candidate সংগ্রহ।
2. Canonical URL ও normalized headline দিয়ে deduplicate।
3. একই ঘটনার independent sources মিলিয়ে source evidence তৈরি।
4. AI দিয়ে বাংলা খসড়া, headline, excerpt, category, source map এবং fact-check report তৈরি।
5. Unsupported facts/quotes reject; uncertainty/conflict হলে pending/manual review।
6. প্রথম rollout-এ সবকিছু queue-তে pending রাখবে; কোনো স্বয়ংক্রিয় প্রকাশ নয়।
7. Dry-run ফলাফল ও সম্পাদকীয় পরীক্ষার পর পৃথক policy দিয়ে কেবল অনুমোদিত live sports / urgent categories চালু করা যাবে।
8. প্রতিটি action audit log-এ লিখবে; kill switch তাৎক্ষণিকভাবে automation বন্ধ করবে।

## Worker implementation (integration branch only)
- `workers/ai-newsroom/src/index.js` allowlisted RSS/Atom feeds সংগ্রহ করে, পৃথক publisher/domain থেকে একই ঘটনার corroboration proposal তৈরি করে এবং OpenAI Responses Structured Outputs দিয়ে বাংলা খসড়া তৈরি করে।
- Dry-run default-এ কোনো database write হয় না। Write mode-এ যাওয়ার আগে Worker verification columns পরীক্ষা করে; migration অনুপস্থিত হলে fail-closed করে।
- Write mode কেবল `pending`, `needs_review`, `confidence_score=0`, `auto_publish=false`, `manual_only` হিসেবে queue-তে সংরক্ষণ করতে পারে।
- `/run` endpoint bearer token ছাড়া চালানো যায় না; `/health`-এ কোনো secret প্রকাশ হয় না।
- `wrangler.jsonc`-এ Cron আছে, কিন্তু `NEWSROOM_ENABLED=false`; Worker deploy করা হয়নি এবং কোনো secret সেট করা হয়নি।
- `.github/workflows/ai-newsroom-worker-check.yml` শুধু JavaScript syntax check করে; deploy step নেই।

## Release checklist
- [ ] RSS/API source allowlist সম্পাদকীয় দল অনুমোদন করেছে
- [ ] OpenAI ও Supabase secrets Cloudflare-এ server-side সেট করা হয়েছে
- [ ] Migration staging-এ চালানো ও পরীক্ষা করা হয়েছে
- [ ] Queue ingestion dry-run অন্তত ৭ দিন পর্যবেক্ষণ করা হয়েছে
- [ ] Source diversity, duplicate detection, false-positive এবং Bengali copy যাচাই করা হয়েছে
- [ ] Auto-publish switch default OFF যাচাই করা হয়েছে
- [ ] Preview UI ও article publication manually tested
- [ ] Production deployment / database change-এর জন্য পৃথক explicit approval নেওয়া হয়েছে

## Expandable source registry (integration branch)
- Worker source registry limit ২০ থেকে ১০০ feed-এ উন্নীত; প্রতি feed ১২ item, মোট ৩০০ item, bounded concurrency ১০ এবং প্রতি feed ৮ সেকেন্ড timeout।
- একই publisher-এর একাধিক section feed আলাদা `sourceId`-এ রাখা যাবে; একই `publisherId`-এর একাধিক feed corroboration-এ একটি publisher হিসেবেই গণ্য হবে।
- প্রতিটি feed-এ region, country, language, categories এবং tier metadata বহন করা হয়।
- কেবল `enabled=true` এবং `status=approved` feed-ই run-এ অংশ নেয়। HTTPS, exact hostname match, no credentials, no redirect এবং RSS/Atom content checks প্রয়োগ করা হয়।
- `workers/ai-newsroom/source-registry.candidates.json`-এ ২৬টি candidate feed আছে—sports, science, technology, environment এবং UN/world news category-সহ; সবগুলো `disabled`; সাধারণ feed `review_required`, BanglaNews24 `stale_review_required` এবং Prothom Alo `rights_review_required`। এগুলো সরাসরি active allowlist নয়। প্রতিটি feed-এর direct availability, freshness, source identity, editorial policy এবং licensing/terms আলাদাভাবে যাচাই করতে হবে।
- একাধিক feed fetch করার সময় bounded concurrency ব্যবহৃত হয়; প্রতি feed failure আলাদাভাবে রিপোর্ট হয়। একই publisher-এর দুটি feed কখনো দুইটি স্বাধীন publisher হিসেবে গণ্য হবে না।
- RSS/Atom কেবল discovery metadata; full article/image republishing নয়। Terms/licensing অনুমতি না থাকলে commercial reuse করা যাবে না। Prothom Alo-এর Terms of Use-এ commercial content use সীমাবদ্ধ, তাই স্পষ্ট অনুমতি ছাড়া তাদের content commercial workflow-এ যুক্ত করা হবে না।



## Source health history and automated tests

The Integration branch adds `ai_news_source_runs` (migration `202611010002_ai_news_source_health.sql`) for durable per-feed telemetry: run ID, source/publisher/domain, status, checked time, item count, freshness window, and bounded error message. RLS allows authenticated admin-role reads only; the Worker writes through the service role. This migration is not applied to Supabase.

The Worker records these rows only when write mode is explicitly enabled. Dry-run remains database-write-free. CI now runs Node's built-in test runner for RSS date freshness, disabled/unapproved feed rejection, HTTPS/domain matching, and distinct-publisher corroboration.


**Cost guard:** RSS feed checks can run without model usage. AI draft generation is disabled by default and requires the explicit `NEWSROOM_DRAFTS_ENABLED=true` setting; this calls the metered OpenAI API. Dry-run does not write to the database, and with draft generation disabled it also avoids model API charges.
