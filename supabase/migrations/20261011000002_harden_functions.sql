-- Întărirea funcțiilor (avertismentele de securitate Supabase).
-- Supabase dă implicit EXECUTE pe funcțiile din public lui anon și
-- authenticated, deci oricine le-ar putea chema prin /rest/v1/rpc/….

-- search_path fix: funcțiile nu depind de schemele alese de apelant.
alter function public.touch_updated_at() set search_path = '';
alter function public.keep_household_id() set search_path = '';

-- Funcțiile de trigger: nimeni nu le cheamă direct. Triggerele rulează și
-- fără EXECUTE (dreptul se verifică doar când se creează triggerul).
revoke execute on function
  public.touch_updated_at(), public.keep_household_id(), public.check_household_refs(),
  public.handle_new_user(), public.limit_invitations()
  from public, anon, authenticated;

-- Funcțiile de ajutor pentru RLS: politicile le cheamă ca utilizatorul
-- conectat, deci rămân doar la authenticated.
revoke execute on function
  public.is_member(uuid), public.member_role(uuid), public.is_household_admin(uuid),
  public.is_app_admin(), public.can_write(uuid), public.can_read(uuid)
  from public, anon;
grant execute on function
  public.is_member(uuid), public.member_role(uuid), public.is_household_admin(uuid),
  public.is_app_admin(), public.can_write(uuid), public.can_read(uuid)
  to authenticated;

-- Funcțiile chemate de aplicație (RPC) erau deja doar la authenticated;
-- revocăm și de la anon, pentru că dreptul implicit al Supabase îl include.
revoke execute on function
  public.create_household(text), public.accept_invitation(text), public.transfer_ownership(uuid, uuid),
  public.household_member_list(uuid), public.invitation_preview(text)
  from anon;
