-- Index AI newsroom queue foreign keys to keep reviewer and article lookups efficient.
create index if not exists ai_news_queue_category_id_idx
  on public.ai_news_queue (category_id);
create index if not exists ai_news_queue_published_article_id_idx
  on public.ai_news_queue (published_article_id);
create index if not exists ai_news_queue_reviewed_by_idx
  on public.ai_news_queue (reviewed_by);
create index if not exists ai_news_queue_published_by_idx
  on public.ai_news_queue (published_by);
