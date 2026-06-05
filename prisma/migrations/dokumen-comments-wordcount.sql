-- Mentee Dokumen content-depth: threaded comments + word-count.
-- Additive only (nullable columns + new table). Already applied to the
-- live project via Supabase migration "dokumen_comments_and_wordcount";
-- this file documents it for reproducibility. Safe to re-run.

alter table "Document" add column if not exists "wordCount" integer;
alter table "Document" add column if not exists "targetWords" integer;

create table if not exists "DocumentComment" (
  id              text primary key,
  "documentId"    text not null references "Document"(id) on delete cascade,
  "authorId"      text not null references "User"(id) on delete cascade,
  body            text not null,
  "suggestedQuote" text,
  "createdAt"     timestamptz not null default now()
);
create index if not exists "DocumentComment_documentId_idx" on "DocumentComment"("documentId");
