-- Add displayName/userDataId metadata to legacy rows without changing row IDs.
-- Safe first step before moving from name-based IDs to internal IDs.

begin;

update public.user_data
set data = jsonb_set(
    jsonb_set(
        coalesce(data::jsonb, '{}'::jsonb),
        '{displayName}',
        to_jsonb(coalesce(data::jsonb ->> 'displayName', id::text)),
        true
    ),
    '{userDataId}',
    to_jsonb(coalesce(data::jsonb ->> 'userDataId', id::text)),
    true
)
where id not in ('__GLOBAL_SETTINGS__', 'Master_Debug', '__admin__', '__teacher__')
  and (
      not (coalesce(data::jsonb, '{}'::jsonb) ? 'displayName')
      or not (coalesce(data::jsonb, '{}'::jsonb) ? 'userDataId')
  );

update public.test_user_data
set data = jsonb_set(
    jsonb_set(
        coalesce(data::jsonb, '{}'::jsonb),
        '{displayName}',
        to_jsonb(coalesce(data::jsonb ->> 'displayName', id::text)),
        true
    ),
    '{userDataId}',
    to_jsonb(coalesce(data::jsonb ->> 'userDataId', id::text)),
    true
)
where id not in ('__GLOBAL_SETTINGS__', 'Master_Debug', '__admin__', '__teacher__')
  and (
      not (coalesce(data::jsonb, '{}'::jsonb) ? 'displayName')
      or not (coalesce(data::jsonb, '{}'::jsonb) ? 'userDataId')
  );

commit;

select id, data->>'displayName' as display_name, data->>'userDataId' as user_data_id
from public.test_user_data
order by id;
