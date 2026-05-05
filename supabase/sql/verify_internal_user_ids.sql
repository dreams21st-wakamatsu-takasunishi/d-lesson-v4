-- Read-only check for legacy name-based user row IDs.
-- Rows with id not starting with student_ are still compatible, but for public
-- operation it is safer to move student rows to internal IDs and keep names in data.displayName.

with all_rows as (
  select
    'test_user_data' as table_name,
    id,
    data ->> 'displayName' as display_name,
    data ->> 'userDataId' as user_data_id
  from public.test_user_data
  union all
  select
    'user_data' as table_name,
    id,
    data ->> 'displayName' as display_name,
    data ->> 'userDataId' as user_data_id
  from public.user_data
),
classified as (
  select
    table_name,
    id,
    display_name,
    user_data_id,
    case
      when id in ('__GLOBAL_SETTINGS__', 'Master_Debug', '__admin__', '__teacher__') then 'system'
      when id like 'student_%' then 'internal_id'
      else 'legacy_name_id'
    end as id_type
  from all_rows
)
select *
from classified
order by table_name, id_type desc, id;

-- Access rows that point to legacy name-based user_data_id values.
select
  access.auth_user_id,
  auth_users.email,
  access.user_data_id,
  access.role,
  access.scope_type,
  access.scope_value,
  access.created_at
from public.lesson_user_access access
left join auth.users auth_users on auth_users.id = access.auth_user_id
where access.user_data_id not in ('__admin__', '__teacher__', '__GLOBAL_SETTINGS__', 'Master_Debug')
  and access.user_data_id not like 'student_%'
order by access.created_at desc;
