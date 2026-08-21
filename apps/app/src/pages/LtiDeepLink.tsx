import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { BookOpen, LinkIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { listContent } from '@/lib/content/contentRepo';
import type { ContentRow } from '@/lib/content/types';
import { Button } from '@/components/ui/button';
import { ListSkeleton } from '@/components/ui/skeletons/ListSkeleton';

// LTI-002 — Deep Linking picker. Landed here by lti-launch after a
// LtiDeepLinkingRequest launch resolves to an already-linked Brivia account
// (see lti-launch/index.ts's comment on why an unlinked subject never gets
// here — it goes to /lti/unlinked instead, same as a resource-link launch).
//
// Content-type reality check (20260821020000_lti_deep_linking.sql's header):
// only `course` content has a direct, session-less, id-addressable viewing
// route (/course/:courseId) in this app — quiz/poll/exam are entirely
// game-code/join-code/live-session based and have no "one learner, one
// piece of content, direct launch" destination yet. This picker only offers
// courses; extending it to other types needs that destination built first
// (a separate, un-guessed feature), not something to fake here with the
// wrong content type wired to a link that would just be broken.
export default function LtiDeepLink() {
  const [params] = useSearchParams();
  const sessionId = params.get('session');
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [courses, setCourses] = useState<ContentRow[]>([]);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const user = getCurrentUser();
    if (!sessionId || !user) {
      setInvalid(true);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_lti_deep_linking_session', { p_session_id: sessionId });
        if (error || !data || data.length === 0) {
          setInvalid(true);
          return;
        }
        setCourses(await listContent(user.id, 'course'));
      } catch {
        setInvalid(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  const handleSelect = async (contentId: string) => {
    if (!sessionId) return;
    setSubmittingId(contentId);
    try {
      const { data, error } = await supabase.functions.invoke('lti-deep-linking-response', {
        body: { session_id: sessionId, content_id: contentId },
      });
      if (error || !data?.jwt || !data?.actionUrl) {
        throw error ?? new Error('missing_response');
      }
      // The platform expects a real HTTP POST with the signed JWT in a
      // `JWT` form field (IMS form_post response mode) — not a fetch, an
      // actual top-level browser navigation the platform's own domain
      // receives as a POST. Building and submitting a real form is the only
      // way to do that from the client.
      const form = formRef.current;
      if (!form) throw new Error('form_not_ready');
      form.action = data.actionUrl;
      form.querySelector<HTMLInputElement>('input[name="JWT"]')!.value = data.jwt;
      form.submit();
    } catch {
      toast.error("Impossible d'envoyer la sélection à votre plateforme. Réessayez.");
      setSubmittingId(null);
    }
  };

  if (invalid) {
    return (
      <div className="product-entry-shell">
        <div className="product-entry-card">
          <div className="product-entry-heading">
            <span className="product-entry-heading__icon"><LinkIcon className="h-6 w-6" /></span>
            <h1>Session expirée</h1>
            <p>Cette sélection de contenu n’est plus valide. Relancez l’activité depuis votre plateforme.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="product-entry-shell">
      <div className="product-entry-card" style={{ maxWidth: 560 }}>
        <div className="product-entry-heading">
          <span className="product-entry-heading__icon"><BookOpen className="h-6 w-6" /></span>
          <h1>Choisir un contenu Brivia</h1>
          <p>Sélectionnez le cours à relier à cette activité de votre plateforme.</p>
        </div>

        {loading ? (
          <ListSkeleton rows={4} withAvatar={false} />
        ) : courses.length === 0 ? (
          <p className="text-sm text-muted-foreground" style={{ textAlign: 'center' }}>
            Aucun cours disponible. Créez-en un depuis Brivia, puis relancez cette activité depuis votre plateforme.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {courses.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <span className="truncate">{typeof c.data?.title === 'string' ? c.data.title : 'Sans titre'}</span>
                <Button size="sm" loading={submittingId === c.id} onClick={() => handleSelect(c.id)}>
                  Sélectionner
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Hidden auto-submit target for the platform's deep_link_return_url — see handleSelect. */}
        <form ref={formRef} method="POST" style={{ display: 'none' }}>
          <input type="hidden" name="JWT" />
        </form>
      </div>
    </div>
  );
}
