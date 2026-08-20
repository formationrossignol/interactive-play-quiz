import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

// LTI-002 — resource-link landing target. This is the URL
// lti-deep-linking-response puts in content_items[].url: when a platform
// later launches the resource link it created from a Deep Linking response,
// lti-launch's existing resource-link path (unchanged by LTI-002) redirects
// the browser to whatever target_link_uri the platform originally supplied
// — which, for a link this tool created, is exactly this route with
// content_id/content_type baked in. No new persistent state needed for that
// routing: the platform re-sends its own stored target_link_uri on every
// launch, this page just reads it.
//
// Only `course` is ever produced by the Deep Linking picker today (see
// LtiDeepLink.tsx's header for why) — the type check below is defensive,
// not dead code: a platform could in principle have stored an old link from
// before this app supported other types, or an admin could hand-craft one.
export default function LtiResourceLink() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const contentId = params.get('content_id');
  const contentType = params.get('content_type');

  useEffect(() => {
    if (contentType === 'course' && contentId) {
      navigate(`/course/${contentId}`, { replace: true });
    }
  }, [contentId, contentType, navigate]);

  if (contentType === 'course' && contentId) return null;

  return (
    <div className="product-entry-shell">
      <div className="product-entry-card">
        <div className="product-entry-heading">
          <span className="product-entry-heading__icon"><AlertTriangle className="h-6 w-6" /></span>
          <h1>Contenu non disponible</h1>
          <p>
            Ce type de contenu ({contentType ?? 'inconnu'}) ne peut pas encore être lancé directement depuis une
            plateforme externe.
          </p>
        </div>
      </div>
    </div>
  );
}
