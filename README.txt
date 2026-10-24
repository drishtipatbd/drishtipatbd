দৃষ্টিপাতBD — Netlify-ready static website
========================================

ফাইল:
- index.html: public news website
- admin.html: admin dashboard
- assets/app.js: public website logic
- assets/admin.js: admin login and content management
- assets/style.css: responsive styles
- schema.sql: Supabase tables and row-level security policies
- config.js.example: Supabase frontend configuration template
- netlify.toml / _redirects: Netlify static hosting configuration

প্রথম সেটআপ:
1. Supabase project তৈরি করুন।
2. Supabase SQL Editor-এ schema.sql-এর সম্পূর্ণ SQL চালান।
3. Supabase Authentication > Users থেকে admin user তৈরি করুন (email/password)।
4. ওই user-এর UUID কপি করুন। SQL Editor-এ চালান:
   insert into public.admin_users (user_id) values ('PASTE-ADMIN-USER-UUID-HERE');
5. config.js.example ফাইল কপি করে config.js নামে রাখুন। নিজের Supabase Project URL এবং Publishable/anon key বসান।
6. config.js GitHub-এ আপলোড করবেন না। Netlify-তে config.js আলাদা করে deploy file হিসেবে যোগ করতে হবে, অথবা repository-তে config.js রাখতে হলে সেখানে শুধু public URL ও publishable/anon key রাখুন; কোনো secret নয়। নিরাপদে রাখার জন্য deployment-এর সময় config.js তৈরি করার পরামর্শ দেওয়া হচ্ছে।
7. index.html, admin.html, assets/, netlify.toml, _redirects, schema.sql GitHub-এ আপলোড করুন।
8. Netlify-তে GitHub repository import করুন। Build command খালি এবং Publish directory "." রাখুন।
9. Supabase Authentication URL Configuration-এ আপনার Netlify site URL এবং redirect URL যোগ করুন।
10. /admin.html খুলে Supabase admin email/password দিয়ে লগইন করুন।

নিরাপত্তা:
- Supabase service_role key কখনো frontend/config.js-এ দেবেন না।
- admin_users-এ অনুমোদিত user UUID যোগ না করলে ওই ব্যবহারকারী admin হিসেবে কাজ করতে পারবেন না।
- Supabase RLS সক্রিয় থাকে; public users শুধু published news পড়তে পারবেন।
- বিজ্ঞাপনের HTML/JavaScript শুধু বিশ্বস্ত Adsterra কোড থেকে দিন।
- public news images-এর জন্য সরাসরি HTTPS image URL ব্যবহার করুন।

সীমাবদ্ধতা:
- এটি একটি static frontend; article image upload সরাসরি নেই। ছবি URL ব্যবহার করতে হবে।
- Admin login এবং database কাজ করার জন্য Supabase configuration ও SQL setup আবশ্যক।
- Supabase Storage upload চাইলে আলাদা bucket এবং policies সেটআপ করতে হবে।
