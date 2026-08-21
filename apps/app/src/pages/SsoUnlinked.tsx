import { useNavigate, useSearchParams } from 'react-router-dom';
import { LinkIcon } from 'lucide-react';

// Landed here by sso-callback (OIDC) or saml-acs (SAML) when a validly-
// verified login carries a subject (id_token `sub` / SAML `NameID`) that has
// no row in external_identities yet — the login itself was legitimate
// (already journaled as status='success', user_id=null in sso_logins),
// there's just no Brivia account linked to this identity yet. Mirrors
// LtiUnlinked.tsx exactly — see _shared/sso-session.ts's top comment for why
// this doesn't auto-provision one.
export default function SsoUnlinked() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const target = params.get('target');

  return (
    <div className="product-entry-shell">
      <div className="product-entry-card">
        <div className="product-entry-heading">
          <span className="product-entry-heading__icon"><LinkIcon className="h-6 w-6" /></span>
          <h1>Compte non relié</h1>
          <p>
            Votre connexion via votre fournisseur d'identité a réussi, mais aucun compte Brivia n'est encore associé
            à votre identité. Un administrateur de votre organisation doit relier votre compte avant que vous
            puissiez accéder à l'application par ce biais.
          </p>
        </div>
        <button className="ap-btn ap-btn--pill" style={{ width: '100%' }} onClick={() => navigate('/auth')}>
          Se connecter avec un compte existant
        </button>
        {target && (
          <p className="text-sm text-muted-foreground" style={{ marginTop: 16, textAlign: 'center' }}>
            Une fois votre compte relié, reconnectez-vous via votre fournisseur d'identité.
          </p>
        )}
      </div>
    </div>
  );
}
