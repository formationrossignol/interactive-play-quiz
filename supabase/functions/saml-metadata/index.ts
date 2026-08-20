// SAML SP metadata (INT-001) — a static XML document an admin pastes into
// their IdP's configuration when setting up a SAML connection. Entity ID
// and ACS URL are global (one SP identity for this whole deployment, not
// per-connection — the IdP is told which specific connection a login
// belongs to via RelayState at the protocol level, not via a different SP
// entity per org). No signing key: this app doesn't sign AuthnRequests (see
// _shared/saml.ts's header for why), so the metadata declares no
// KeyDescriptor.
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

Deno.serve((req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const spEntityId = `${Deno.env.get("PUBLIC_APP_URL")}/sso/saml/metadata`;
  const spAcsUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/saml-acs`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${spEntityId}">
  <md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${spAcsUrl}" index="0" isDefault="true"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;

  return new Response(xml, { headers: { ...corsHeaders, "Content-Type": "application/samlmetadata+xml" } });
});
