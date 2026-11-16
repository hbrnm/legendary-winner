import { afterAll, describe, expect, it } from "vitest";
import { asUser, closeDb, createHousehold, createUser } from "./helpers";

afterAll(closeDb);

describe("acceptarea invitației prin funcția autorizată", () => {
  it("marchează invitația acceptată și adaugă membrul fără a relaxa UPDATE-ul direct", async () => {
    const owner = await createUser("AcceptOwner"), invited = await createUser("AcceptInvited");
    const h = await createHousehold(owner);
    const invitation = (await asUser(owner, (q) => q("insert into household_invitations(household_id) values($1) returning id, token", [h]))).rows[0];
    // accepted_by cu accepted_at null ar satisface politica de revocare:
    // triggerul trebuie să împiedice o astfel de falsificare directă.
    await expect(asUser(owner, (q) => q("update household_invitations set accepted_by=$1, revoked_at=now() where id=$2", [invited.id, invitation.id]))).rejects.toThrow(/interzisă/);
    await expect(asUser(owner, (q) => q("update household_invitations set role='admin' where id=$1", [invitation.id]))).rejects.toThrow(/interzisă/);
    await expect(asUser(owner, (q) => q("update household_invitations set expires_at=expires_at+interval '1 day' where id=$1", [invitation.id]))).rejects.toThrow(/interzisă/);
    const accepted = await asUser(invited, (q) => q("select accept_invitation($1) as household", [invitation.token]));
    expect(accepted.rows[0].household).toBe(h);
    const row = (await asUser(owner, (q) => q("select accepted_by, accepted_at, revoked_at from household_invitations where id=$1", [invitation.id]))).rows[0];
    expect(row.accepted_by).toBe(invited.id);
    expect(row.accepted_at).toBeTruthy();
    expect(row.revoked_at).toBeNull();
    await expect(asUser(invited, (q) => q("select accept_invitation($1)", [invitation.token]))).rejects.toThrow(/nu mai este valabilă/);
  });
});
