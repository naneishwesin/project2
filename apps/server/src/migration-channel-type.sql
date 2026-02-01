-- Run this if your channels table was created before the "type" column was added.
-- New installs use schema.sql which already includes type.

alter table channels add column if not exists type text not null default 'text' check (type in ('text','voice'));
