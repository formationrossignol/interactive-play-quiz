import { useNavigate, useSearchParams } from 'react-router-dom';
import { LinkIcon } from 'lucide-react';

// Landed here by supabase/functions/lti-launch when a valid, signed LTI
// launch carries a `sub` that has no row in external_mappings yet — the
// launch itself was legitimate (LTI-006 already journaled it as
// status='success', user_id=null), there's just no Brivia account to sign
// into. See lti-launch/index.ts's top comment for why this doesn't
// auto-provision one.
export default function LtiUnlinked() {
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
            Ce lancement provient bien de votre plateforme, mais aucun compte Brivia n’est encore associé à votre
            identité. Un administrateur de votre organisation doit relier votre compte avant que vous puissiez
            accéder à cette activité.
          </p>
        </div>
        <button className="ap-btn ap-btn--pill" style={{ width: '100%' }} onClick={() => navigate('/auth')}>
          Se connecter avec un compte existant
        </button>
        {target && (
          <p className="text-sm text-muted-foreground" style={{ marginTop: 16, textAlign: 'center' }}>
            Une fois votre compte relié, relancez l’activité depuis votre plateforme.
          </p>
        )}
      </div>
    </div>
  );
}
