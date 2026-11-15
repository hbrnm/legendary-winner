import { afterAll, expect, it } from "vitest";
import { addMember, asUser, closeDb, createHousehold, createUser, db } from "./helpers";

afterAll(closeDb);
it("RPC-ul acceptă o invitație legitimă, dar clientul nu poate ocoli protecția UPDATE", async () => {
  const owner = await createUser("Owner"), admin = await createUser("Admin"), member = await createUser("Member");
  const hid = await createHousehold(owner);
  await addMember(owner, hid, admin, "admin");
  const invitation = await asUser(admin, async (q) => (await q("insert into household_invitations(household_id, role) values($1, 'member') returning id, token", [hid])).rows[0]);
  for (const change of ["role='admin'", "email='another@example.test'", "expires_at=now()+interval '100 years'", "accepted_at=now()", "accepted_by=auth.uid()", "token='replacement'"]) {
    await expect(asUser(admin, (q) => q(`update household_invitations set ${change} where id=$1`, [invitation.id]))).rejects.toThrow(/interzisă/);
  }
  await asUser(member, (q) => q("select public.accept_invitation($1)", [invitation.token]));
  const accepted = await db().query("select accepted_at, accepted_by from household_invitations where id=$1", [invitation.id]);
  expect(accepted.rows[0].accepted_at).not.toBeNull();
  expect(accepted.rows[0].accepted_by).toBe(member.id);
  const membership = await asUser(member, (q) => q("select role from household_members where household_id=$1 and user_id=$2", [hid, member.id]));
  expect(membership.rows).toEqual([{ role: "member" }]);
  const revocable = await asUser(admin, async (q) => (await q("insert into household_invitations(household_id) values($1) returning id", [hid])).rows[0]);
  await asUser(admin, (q) => q("update household_invitations set revoked_at=now() where id=$1", [revocable.id]));
  await expect(asUser(admin, (q) => q("update household_invitations set revoked_at=null where id=$1", [revocable.id]))).rejects.toThrow();
});
