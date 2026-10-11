import type { Role } from "@/lib/domain/types";
import { supabase } from "@/lib/supabase/client";
import { UserError } from "./context";

// Operațiile pe gospodărie și membri. Au nevoie de conexiune: autorizarea
// se face pe server (RLS și funcțiile din migrație).

/** Codurile cu care funcțiile noastre SQL ridică erori cu mesaje în română, pentru utilizator. */
const OUR_CODES = new Set(["22023", "42501", "54000"]);

function fail(error: { message: string; code?: string } | null, fallback: string): never {
  const msg = error?.message ?? "";
  if (error?.code && OUR_CODES.has(error.code) && !/row-level security|permission denied/i.test(msg)) throw new UserError(msg);
  if (/fetch|network/i.test(msg)) throw new UserError("Ai nevoie de internet pentru această acțiune.");
  throw new UserError(fallback);
}

export async function createHousehold(name: string): Promise<string> {
  if (!name.trim()) throw new UserError("Scrie numele gospodăriei.");
  const { data, error } = await supabase().rpc("create_household", { p_name: name.trim() });
  if (error) fail(error, "Nu am putut crea gospodăria.");
  return data as string;
}

export async function renameHousehold(id: string, name: string) {
  if (!name.trim() || name.trim().length > 80) throw new UserError("Numele gospodăriei are între 1 și 80 de caractere.");
  const { error, data } = await supabase().from("households").update({ name: name.trim() }).eq("id", id).select("id");
  if (error || !data?.length) fail(error, "Doar administratorii pot redenumi gospodăria.");
}

export async function deleteHousehold(id: string) {
  const { error, data } = await supabase().from("households").delete().eq("id", id).select("id");
  if (error || !data?.length) fail(error, "Doar proprietarul poate șterge gospodăria.");
}

export interface Member {
  user_id: string;
  display_name: string;
  role: Role;
  joined_at: string;
}

export async function listMembers(householdId: string): Promise<Member[]> {
  const { data, error } = await supabase().rpc("household_member_list", { p_household: householdId });
  if (error) fail(error, "Nu am putut încărca membrii.");
  return (data ?? []) as Member[];
}

export async function setMemberRole(householdId: string, userId: string, role: "admin" | "member") {
  const { error, data } = await supabase().from("household_members").update({ role }).eq("household_id", householdId).eq("user_id", userId).select("user_id");
  if (error || !data?.length) fail(error, "Doar proprietarul poate schimba rolurile.");
}

export async function removeMember(householdId: string, userId: string) {
  const { error, data } = await supabase().from("household_members").delete().eq("household_id", householdId).eq("user_id", userId).select("user_id");
  if (error || !data?.length) fail(error, "Nu ai dreptul să scoți această persoană.");
}

export async function transferOwnership(householdId: string, userId: string) {
  const { error } = await supabase().rpc("transfer_ownership", { p_household: householdId, p_new_owner: userId });
  if (error) fail(error, "Nu am putut transfera gospodăria.");
}

export interface Invitation {
  id: string;
  token: string;
  role: "admin" | "member";
  email: string | null;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export async function createInvitation(householdId: string, role: "admin" | "member", email: string | null): Promise<Invitation> {
  const { data, error } = await supabase()
    .from("household_invitations")
    .insert({ household_id: householdId, role, email: email?.trim() || null })
    .select("*")
    .single();
  if (error) fail(error, "Nu am putut crea invitația. Doar administratorii pot invita.");
  return data as Invitation;
}

export async function listInvitations(householdId: string): Promise<Invitation[]> {
  const { data, error } = await supabase()
    .from("household_invitations")
    .select("*")
    .eq("household_id", householdId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) fail(error, "Nu am putut încărca invitațiile.");
  return (data ?? []) as Invitation[];
}

export async function revokeInvitation(id: string) {
  const { error } = await supabase().from("household_invitations").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  if (error) fail(error, "Nu am putut anula invitația.");
}

export async function previewInvitation(token: string): Promise<{ household_name: string; invited_by: string; role: Role; expires_at: string } | null> {
  const { data, error } = await supabase().rpc("invitation_preview", { p_token: token });
  if (error) fail(error, "Nu am putut verifica invitația.");
  return ((data as unknown[]) ?? [])[0] as never;
}

export async function acceptInvitation(token: string): Promise<string> {
  const { data, error } = await supabase().rpc("accept_invitation", { p_token: token });
  if (error) fail(error, "Nu am putut accepta invitația.");
  return data as string;
}

export function invitationLink(token: string): string {
  return `${window.location.origin}/invitatie/?token=${encodeURIComponent(token)}`;
}

export async function updateDisplayName(userId: string, name: string) {
  if (!name.trim() || name.trim().length > 60) throw new UserError("Numele are între 1 și 60 de caractere.");
  const { error } = await supabase().from("profiles").update({ display_name: name.trim() }).eq("id", userId);
  if (error) fail(error, "Nu am putut salva numele.");
}
