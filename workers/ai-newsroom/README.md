# দৃষ্টিপাতBD AI Newsroom Worker

এই Worker সম্পাদক-অনুমোদিত RSS/Atom source registry থেকে সংবাদ-প্রার্থী সংগ্রহ করে, একাধিক স্বাধীন publisher-এর মধ্যে একই ঘটনার মিল খুঁজে বাংলা খসড়া তৈরি করে এবং write mode অনুমোদিত হলে কেবল `ai_news_queue`-তে **pending** হিসেবে রাখে। এতে কোনো auto-publish implementation নেই।

## নিরাপত্তার ডিফল্ট

- `NEWSROOM_ENABLED=false`
- `NEWSROOM_DRY_RUN=true`
- `NEWSROOM_DRAFTS_ENABLED=false` (AI disabled until explicitly enabled)
- `AUTO_PUBLISH_ENABLED=false`; Worker-এ auto-publish route বা code নেই
- Cron প্রতি ৩০ মিনিটে নির্ধারিত, কিন্তু Worker disabled থাকলে কাজ করে না
- Worker deploy করা হয়নি; এই কোড কেবল `ai-newsroom-integration` branch-এ

## Source registry

`NEWSROOM_SOURCES` হলো JSON array। একটি publisher-এর একাধিক feed থাকতে পারে; corroboration গণনায় সেগুলো এক publisher হিসেবেই গণ্য হবে। প্রতিটি feed-এর আলাদা `sourceId` এবং publisher-পরিচিতির জন্য একই `publisherId` ব্যবহার করুন।

প্রতিটি সক্রিয় feed-এ আবশ্যক:
- `sourceId`, `publisherId`, `name`, `domain`, `url`
- `enabled: true`
- `status: "approved"`

সহায়ক metadata:
- `region`, `country`, `language`
- `categories` (যেমন `["politics","business","sports"]`)
- `tier` (`primary`, `tier1`, `tier2`, `specialist`)

নিরাপত্তা ও সীমা:
- সর্বোচ্চ ১০০টি registry entry; সর্বোচ্চ ১০০টি সক্রিয় feed
- কেবল বৈধ তারিখযুক্ত এবং গত ৭২ ঘণ্টার মধ্যে প্রকাশিত feed item গ্রহণ করা হয়; ভবিষ্যতের ৬ ঘণ্টার বেশি timestamp-ও বাদ যায়
- প্রতিটি feed থেকে সর্বোচ্চ ১২টি item; মোট সর্বোচ্চ ৩০০টি item
- একসঙ্গে সর্বোচ্চ ১০টি feed fetch; প্রতিটি request-এ ৮ সেকেন্ড timeout এবং response body সর্বোচ্চ ১.৫ MB
- কেবল HTTPS; URL hostname এবং registered domain হুবহু মিলতে হবে; redirect নিষিদ্ধ
- একই publisher-এর একাধিক feed অনুমোদিত, কিন্তু duplicate `sourceId` নিষিদ্ধ
- HTML page-কে RSS/Atom হিসেবে গ্রহণ করা হয় না
- শুধু সম্পাদকীয়ভাবে যাচাইকৃত ও ব্যবহারের অধিকার/শর্ত পর্যালোচিত feed-ই `approved` এবং `enabled` করা যাবে

### Candidate catalogue

`source-registry.candidates.json`-এ ২৬টি প্রাথমিক candidate রাখা হয়েছে—বাংলাদেশি সংবাদ, আন্তর্জাতিক সংবাদ, খেলাধুলা, বিজ্ঞান, প্রযুক্তি, পরিবেশ ও জাতিসংঘ-সম্পর্কিত উৎসসহ। **সবগুলো disabled; সাধারণ feed review_required, BanglaNews24 stale_review_required এবং Prothom Alo rights_review_required**—কোনোটিই live allowlist নয়। কিছু URL তৃতীয়-পক্ষ feed directory-তে তালিকাভুক্ত; Worker-এ সক্রিয় করার আগে সরাসরি feed response, freshness, publisher identity, editorial standards, correction policy, terms/licensing এবং commercial reuse rights যাচাই করতে হবে। Candidate তালিকা সরাসরি `NEWSROOM_SOURCES`-এ কপি করবেন না।

RSS হলো সংবাদ আবিষ্কারের মাধ্যম, পূর্ণ article পুনঃপ্রকাশের অনুমতি নয়। Feed-এর headline/summary ও source URL-কে lead হিসেবে ব্যবহার করতে হবে; পূর্ণ লেখা বা ছবি কপি করা যাবে না, যদি না স্পষ্ট লাইসেন্স/অনুমতি থাকে। প্রথম আলোর Terms of Use-এ commercial use-এর সীমাবদ্ধতা রয়েছে; তাই লিখিত অনুমতি ছাড়া তাদের content commercial workflow-এ ব্যবহার করা যাবে না।

## প্রয়োজনীয় server-side secrets / variables

Cloudflare Worker settings-এ (browser code-এ নয়) configure করতে হবে:
- Cloudflare Workers AI binding `AI` (Gemma 4 26B A4B; no external API key)
- Secret `SUPABASE_SERVICE_ROLE_KEY`
- Secret `NEWSROOM_RUN_TOKEN`
- Variable `SUPABASE_URL`
- Variable `NEWSROOM_SOURCES` — কেবল approved ও enabled feed-এর JSON
- Variable `NEWSROOM_AI_MODEL` — default `@cf/google/gemma-4-26b-a4b-it`

## কার্যপ্রবাহ

1. Approved registry থেকে bounded concurrency-তে feed fetch।
2. XML type, HTTPS URL এবং feed link পরীক্ষা; duplicate URL বাদ।
3. Cloudflare Workers AI (Gemma 4 26B A4B) দিয়ে source index-সহ বাংলা draft proposal; inference শুধু নির্ধারিত UTC hourly run-এ।
4. অন্তত দুইটি আলাদা publisherId এবং দুইটি আলাদা domain না থাকলে draft বাদ।
5. Dry-run-এ database write হয় না।
6. Write mode-এ verification schema না থাকলে fail-closed।
7. Write সফল হলেও সব row `pending`, `auto_publish=false`, `verification_status=needs_review`, `confidence_score=0`, `auto_publish_rule=manual_only`।
8. Feed success/failure count response-এ ফেরত আসে; কোনো feed ব্যর্থ হলে সেটি নির্দিষ্ট source ID ও domain-সহ রিপোর্ট হয়।

AI corroboration proposal সম্পাদকীয় যাচাইয়ের বিকল্প নয়। একই publisher-এর একাধিক feed স্বাধীন corroborating source হিসেবে গণ্য হবে না।

## Manual run

`NEWSROOM_ENABLED=true` এবং `NEWSROOM_RUN_TOKEN` configure করার পর manual endpoint দিয়ে RSS collection পরীক্ষা করা যাবে। Manual `/run` কখনো AI model call করে না। AI draft generation কেবল `NEWSROOM_DRAFTS_ENABLED=true`, `NEWSROOM_DRY_RUN=false` এবং UTC hourly scheduled run—এই তিনটি শর্ত পূরণ হলে চলে।

## সীমাবদ্ধতা

- RSS/Atom metadata ও description-এর বাইরে paywalled/full article extraction হয় না।
- Source-এর tier কোনো তথ্যকে নিজে থেকে verified করে না।
- Conflicting reports হলে manual review আবশ্যক।
- Breaking, sports বা অন্য কোনো category স্বয়ংক্রিয়ভাবে প্রকাশ করা হয় না।
- Worker deploy, secrets configuration, migration apply, branch merge বা Production release এই কাজের অংশ নয়।


## Safety test suite and source-health telemetry

The Node.js test suite in `test/newsroom.test.js` covers:
- malformed, missing, stale, and future RSS dates;
- explicit enablement/approval and HTTPS/domain validation;
- independent-publisher corroboration (multiple feeds from one publisher do not count twice).

The CI workflow runs these tests in addition to syntax, disabled-candidate-registry, AI-binding, prompt/output budget and disabled-default validation.

When write mode is explicitly enabled, the Worker records per-feed results in `public.ai_news_source_runs` using a shared run ID. Statuses are `ok`, `no_fresh_items`, and `error`. The table is intended for admin-only reading; inserts use the server-side service role. The additive migration `20261101191707_ai_news_source_health.sql` was applied to the connected Supabase project on 2026-11-01; table and RLS were verified. Dry-run mode continues to perform no database writes.


**Cost guard:** RSS feed checks run without model usage. AI draft generation is disabled by default and requires `NEWSROOM_DRAFTS_ENABLED=true`, write mode, and a scheduled UTC hourly run. The Worker uses Cloudflare Workers AI's published 10,000-neuron daily free allocation; it limits inference to 24 calls/day, a 1,800-character total prompt, and 500 output tokens. At the published Gemma 4 rates this is estimated at about 2,300 neurons/day under a conservative 5-token-per-character input assumption, below the free allocation. Dry-run and manual `/run` never call the model. No OpenAI API key is required.
