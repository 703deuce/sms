-- FK omitted from 20261028140000_script_publish_views (table created first)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'script_composition_publish_views_publish_id_fkey'
  ) THEN
    ALTER TABLE "script_composition_publish_views"
      ADD CONSTRAINT "script_composition_publish_views_publish_id_fkey"
      FOREIGN KEY ("publish_id") REFERENCES "script_composition_publish"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
