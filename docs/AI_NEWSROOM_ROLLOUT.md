# দৃষ্টিপাতBD AI Newsroom — নিরাপদ রোলআউট

## বর্তমান অবস্থা
- Admin dashboard-এ AI News Queue UI আছে।
- `ai_news_queue` টেবিল তৈরির migration repository-তে আছে; production database-এ এই নতুন hardening migration চালানো হয়নি।
- AI সংগ্রহ/লেখা/যাচাইয়ের scheduled backend এখনো deploy করা হয়নি।
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

## Release checklist
- [ ] RSS/API source allowlist সম্পাদকীয় দল অনুমোদন করেছে
- [ ] OpenAI ও Supabase secrets Cloudflare-এ server-side সেট করা হয়েছে
- [ ] Migration staging-এ চালানো ও পরীক্ষা করা হয়েছে
- [ ] Queue ingestion dry-run অন্তত ৭ দিন পর্যবেক্ষণ করা হয়েছে
- [ ] Source diversity, duplicate detection, false-positive এবং Bengali copy যাচাই করা হয়েছে
- [ ] Auto-publish switch default OFF যাচাই করা হয়েছে
- [ ] Preview UI ও article publication manually tested
- [ ] Production deployment / database change-এর জন্য পৃথক explicit approval নেওয়া হয়েছে
