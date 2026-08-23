-- Spec 10 — Gouvernance, versionnement, localisation et diffusion du contenu
-- (docs/product-specs/2026-08-10-lms-program/10-content-governance.md).
-- PUB-004: "Preview link expirant, mot de passe facultatif, filigrane et
-- analytics minimales." Absent from the shipped model entirely.
--
-- The real security property this needs: an external reviewer with no
-- Brivia account has to be able to open the link. That means the
-- resolution path has to work for `anon`, which means preview_links itself
-- can carry no anon-readable policy at all (a direct select would let
-- anyone enumerate every link's token, password hash and expiry) — the
-- token is checked exclusively inside resolve_preview_link(), a security
-- definer function granted to anon, same posture as the SCIM/OneRoster
-- bearer-token verification in spec 04 (_verify_api_token(), never a
-- direct table read).
--
-- Password hashing uses pgcrypto's crypt()/gen_salt('bf') (real bcrypt),
-- not the bare sha256() this codebase uses elsewhere for high-entropy API
-- tokens — a share-link password is operator-chosen and can be low-entropy,
-- the two aren't the same threat model and shouldn't share a hash function.
create table public.preview_links (
  id             uuid primary key default gen_random_uuid(),
  content_id     uuid not null references public.content(id) on delete cascade,
  version        integer,  -- null = always the latest published version at resolve time
  token          text not null unique,
  password_hash  text,
  watermark      boolean not null default true,
  expires_at     timestamptz not null,
  revoked_at     timestamptz,
  view_count     integer not null default 0,
  last_viewed_at timestamptz,
  created_by     uuid not null references auth.users(id) default auth.uid(),
  created_at     timestamptz not null default now()
);
create index preview_links_content_idx on public.preview_links(content_id);
create index preview_links_token_idx on public.preview_links(token);

alter table public.preview_links enable row level security;
-- Owner/pedago/admin can see and manage their own links. No anon policy —
-- see file header.
create policy preview_links_manage on public.preview_links
  for all using (
    exists (select 1 from public.content c where c.id = content_id and (c.user_id = auth.uid() or public.has_org_role(c.org_id, array['pedago','admin'])))
  )
  with check (
    exists (select 1 from public.content c where c.id = content_id and (c.user_id = auth.uid() or public.has_org_role(c.org_id, array['pedago','admin'])))
  );

create or replace function public.create_preview_link(
  p_content_id uuid,
  p_version integer default null,
  p_expires_in_hours integer default 168,
  p_password text default null,
  p_watermark boolean default true
)
returns public.preview_links
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_content public.content;
  v_token text;
  v_result public.preview_links;
begin
  select * into v_content from public.content where id = p_content_id;
  if v_content.id is null then
    raise exception 'Content not found';
  end if;
  if v_content.user_id <> auth.uid() and not public.has_org_role(v_content.org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;
  if p_expires_in_hours <= 0 or p_expires_in_hours > 24 * 90 then
    raise exception 'expires_in_hours must be between 1 and 2160 (90 days)';
  end if;

  -- URL-safe, high-entropy (18 random bytes -> 24 base64 chars).
  v_token := translate(encode(gen_random_bytes(18), 'base64'), '+/=', '-_');

  insert into public.preview_links (content_id, version, token, password_hash, watermark, expires_at)
  values (
    p_content_id, p_version, v_token,
    case when p_password is not null and length(p_password) > 0 then crypt(p_password, gen_salt('bf')) else null end,
    p_watermark, now() + make_interval(hours => p_expires_in_hours)
  )
  returning * into v_result;

  return v_result;
end;
$$;
revoke all on function public.create_preview_link(uuid, integer, integer, text, boolean) from public;
grant execute on function public.create_preview_link(uuid, integer, integer, text, boolean) to authenticated;

create or replace function public.revoke_preview_link(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_owner uuid;
begin
  select c.org_id, c.user_id into v_org_id, v_owner
  from public.preview_links pl join public.content c on c.id = pl.content_id
  where pl.id = p_id;
  if v_org_id is null then
    raise exception 'Preview link not found';
  end if;
  if v_owner <> auth.uid() and not public.has_org_role(v_org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  update public.preview_links set revoked_at = now() where id = p_id;
end;
$$;
revoke all on function public.revoke_preview_link(uuid) from public;
grant execute on function public.revoke_preview_link(uuid) to authenticated;

-- ── resolve_preview_link() : the one anon-callable path ────────────────────
-- Distinct, stable error reasons ('not_found'/'revoked'/'expired'/
-- 'wrong_password'/'no_published_version') rather than a single generic
-- failure — same discipline as _shared/saml.ts's SamlRejectReason, so the
-- UI can show the reviewer something more useful than "error."
create or replace function public.resolve_preview_link(p_token text, p_password text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_link public.preview_links;
  v_content public.content;
  v_version public.content_versions;
begin
  select * into v_link from public.preview_links where token = p_token for update;
  if v_link.id is null then
    raise exception 'not_found';
  end if;
  if v_link.revoked_at is not null then
    raise exception 'revoked';
  end if;
  if v_link.expires_at < now() then
    raise exception 'expired';
  end if;
  if v_link.password_hash is not null then
    if p_password is null or crypt(p_password, v_link.password_hash) <> v_link.password_hash then
      raise exception 'wrong_password';
    end if;
  end if;

  select * into v_content from public.content where id = v_link.content_id;

  if v_link.version is not null then
    select * into v_version from public.content_versions where content_id = v_link.content_id and version = v_link.version;
  else
    select * into v_version from public.content_versions
    where content_id = v_link.content_id and status = 'published'
    order by version desc limit 1;
  end if;
  if v_version.id is null then
    raise exception 'no_published_version';
  end if;

  update public.preview_links set view_count = view_count + 1, last_viewed_at = now() where id = v_link.id;

  return jsonb_build_object(
    'type', v_content.type,
    'version', v_version.version,
    'snapshot', v_version.snapshot,
    'watermark', v_link.watermark
  );
end;
$$;
revoke all on function public.resolve_preview_link(text, text) from public;
grant execute on function public.resolve_preview_link(text, text) to authenticated, anon;
