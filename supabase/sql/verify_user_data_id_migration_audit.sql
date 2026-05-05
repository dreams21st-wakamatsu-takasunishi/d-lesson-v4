-- Read the private audit trail created by migrate_user_data_named_ids.sql.

select
  batch_id,
  table_name,
  old_id,
  new_id,
  display_name,
  access_rows_updated,
  created_at
from private.d_lesson_user_data_id_migration_audit
order by created_at desc, display_name;

