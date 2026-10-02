-- Maat-test ONLY. Synthetic SQL identities; no passwords, identities or sessions.
-- Run once before workspaces-security-test.sql. Do not execute on production.
insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-4000-8000-000000000061','authenticated','authenticated','maat-fixture-a@example.invalid',now(),'{"provider":"email"}','{}',now(),now()),
('00000000-0000-4000-8000-000000000062','authenticated','authenticated','maat-fixture-b@example.invalid',now(),'{"provider":"email"}','{}',now(),now());
