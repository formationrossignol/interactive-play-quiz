import { supabase } from "@/lib/supabase";

export type SignatureRequestStatus = "open" | "closed";

export interface SignatureResponse {
  id: string;
  request_id: string;
  user_id: string;
  typed_name: string;
  consented_at: string;
}

export interface SignatureRequest {
  id: string;
  owner_id: string;
  title: string;
  message: string;
  status: SignatureRequestStatus;
  due_at: string | null;
  created_at: string;
  updated_at: string;
  groupIds: string[];
  responses: SignatureResponse[];
}

export interface SignatureRecipient {
  group_id: string;
  user_id: string | null;
  pending_email: string | null;
}

export interface CreateSignatureRequestInput {
  title: string;
  message: string;
  dueAt: string | null;
  groupIds: string[];
}

interface SignatureRequestRow {
  id: string;
  owner_id: string;
  title: string;
  message: string;
  status: SignatureRequestStatus;
  due_at: string | null;
  created_at: string;
  updated_at: string;
  signature_request_groups?: { group_id: string }[] | null;
  signature_responses?: SignatureResponse[] | null;
}

export function mapSignatureRequest(row: SignatureRequestRow): SignatureRequest {
  return {
    id: row.id,
    owner_id: row.owner_id,
    title: row.title,
    message: row.message,
    status: row.status,
    due_at: row.due_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    groupIds: (row.signature_request_groups ?? []).map(({ group_id }) => group_id),
    responses: row.signature_responses ?? [],
  };
}

export function uniqueRecipientCount(recipients: SignatureRecipient[]): number {
  const identities = new Set<string>();
  recipients.forEach((recipient) => {
    if (recipient.user_id) identities.add(`user:${recipient.user_id}`);
    else if (recipient.pending_email) identities.add(`email:${recipient.pending_email.trim().toLowerCase()}`);
  });
  return identities.size;
}

export function isSignatureRequestActionable(
  request: Pick<SignatureRequest, "status" | "due_at">,
  now = new Date(),
): boolean {
  return request.status === "open" && (!request.due_at || new Date(request.due_at).getTime() >= now.getTime());
}

export async function listVisibleSignatureRequests(): Promise<SignatureRequest[]> {
  const { data, error } = await supabase
    .from("signature_requests")
    .select(`
      id,
      owner_id,
      title,
      message,
      status,
      due_at,
      created_at,
      updated_at,
      signature_request_groups(group_id),
      signature_responses(id, request_id, user_id, typed_name, consented_at)
    `)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as SignatureRequestRow[]).map(mapSignatureRequest);
}

export async function listSignatureRecipients(groupIds: string[]): Promise<SignatureRecipient[]> {
  if (groupIds.length === 0) return [];
  const { data, error } = await supabase
    .from("share_group_members")
    .select("group_id, user_id, pending_email")
    .in("group_id", groupIds);
  if (error) throw error;
  return data ?? [];
}

export async function createSignatureRequest(input: CreateSignatureRequestInput): Promise<string> {
  const { data, error } = await supabase.rpc("create_group_signature_request", {
    p_title: input.title,
    p_message: input.message,
    p_due_at: input.dueAt,
    p_group_ids: input.groupIds,
  });
  if (error) throw error;
  return data as string;
}

export async function submitSignature(input: {
  requestId: string;
  userId: string;
  typedName: string;
  signatureData: string;
}): Promise<void> {
  const { error } = await supabase.from("signature_responses").insert({
    request_id: input.requestId,
    user_id: input.userId,
    typed_name: input.typedName.trim(),
    signature_data: input.signatureData,
    user_agent: navigator.userAgent.slice(0, 500),
  });
  if (error) throw error;
}
export async function setSignatureRequestStatus(
  requestId: string,
  status: SignatureRequestStatus,
): Promise<void> {
  const { error } = await supabase
    .from("signature_requests")
    .update({ status })
    .eq("id", requestId);
  if (error) throw error;
}
