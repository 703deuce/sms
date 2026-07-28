-- Run this first if you want to see why workspaceId is missing
SELECT c.table_name, c.column_name, c.data_type
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    'messaging_registrations',
    'Membership',
    'Workspace',
    'User',
    'campaign_recipients',
    'campaign_messages',
    'job_queue'
  )
ORDER BY c.table_name, c.ordinal_position;
