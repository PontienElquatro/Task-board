begin;

-- Align accounts that existed when Premium was introduced with the contractual
-- trial start: the actual Auth account creation time, not the migration time.
update maat_private.premium_entitlements e
set trial_started_at=u.created_at,updated_at=now()
from auth.users u
where u.id=e.user_id and e.trial_started_at<>u.created_at;

commit;
