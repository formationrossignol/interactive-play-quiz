import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Lock, MessageCircleQuestion, ThumbsUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { ListSkeleton } from '@/components/ui/skeletons';
import {
  getLiveEventByCode,
  getOpenRun,
  listRunQuestions,
  type AudienceQuestion,
  type LiveEvent,
  type LiveRun,
} from '@/lib/lms/liveEngagement';

/** LIVE-015: a separate big-screen view, read-only — no join_live_run, no
 *  vote/submit actions. Only Q&A results are shown: poll/priority/matrix
 *  formats have no staff editor yet (RESTE-A-FAIRE §09), so there is
 *  nothing else real to project. RLS (`audience_questions_public_read`)
 *  allows this without authentication as long as the event is active —
 *  same gate LiveEventRoom relies on for anonymous participants. */

type Phase = 'loading' | 'not-found' | 'not-open' | 'live';

const VISIBLE_STATUSES = new Set(['approved', 'live', 'answered']);

function PresenterSkeleton() {
  return (
    <div className="product-entry-shell" style={{ maxWidth: 'none', alignItems: 'flex-start', padding: '4rem 3rem' }}>
      <Skeleton className="h-10 w-1/3 mb-6" />
      <ListSkeleton rows={5} withAvatar={false} />
    </div>
  );
}

export default function LivePresenterScreen() {
  const { code } = useParams<{ code: string }>();
  const [phase, setPhase] = useState<Phase>('loading');
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [run, setRun] = useState<LiveRun | null>(null);
  const [questions, setQuestions] = useState<AudienceQuestion[]>([]);

  useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      if (!code) return;
      try {
        const foundEvent = await getLiveEventByCode(code.toUpperCase());
        if (!foundEvent) { if (!cancelled) setPhase('not-found'); return; }
        const foundRun = await getOpenRun(foundEvent.id);
        if (!foundRun) { if (!cancelled) { setEvent(foundEvent); setPhase('not-open'); } return; }
        const initialQuestions = await listRunQuestions(foundRun.id);
        if (cancelled) return;
        setEvent(foundEvent);
        setRun(foundRun);
        setQuestions(initialQuestions.filter((q) => VISIBLE_STATUSES.has(q.status)));
        setPhase('live');
      } catch {
        if (!cancelled) setPhase('not-found');
      }
    };
    void setup();
    return () => { cancelled = true; };
  }, [code]);

  useEffect(() => {
    if (phase !== 'live' || !run) return;
    const channel = supabase
      .channel(`lms-present-run-${run.id}-questions`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'audience_questions', filter: `run_id=eq.${run.id}` },
        (payload) => {
          setQuestions((prev) => {
            const row = payload.new as AudienceQuestion | undefined;
            if (payload.eventType === 'DELETE' || !row) return prev;
            if (!VISIBLE_STATUSES.has(row.status)) return prev.filter((q) => q.id !== row.id);
            const withoutRow = prev.filter((q) => q.id !== row.id);
            return [...withoutRow, row].sort((a, b) => b.votes_count - a.votes_count);
          });
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_runs', filter: `id=eq.${run.id}` },
        (payload) => setRun(payload.new as LiveRun))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [phase, run]);

  if (phase === 'loading') return <PresenterSkeleton />;

  if (phase === 'not-found' || phase === 'not-open') {
    return (
      <div className="product-entry-shell">
        <div className="product-entry-card">
          <div className="product-entry-heading">
            <span className="product-entry-heading__icon"><AlertTriangle className="h-6 w-6" /></span>
            <h1>Écran projeté indisponible</h1>
          </div>
          <p style={{ fontSize: 14, color: 'var(--ap-muted)' }}>
            {phase === 'not-found' ? "Cet événement est introuvable ou a été clôturé." : "Aucune session en cours pour cet événement."}
          </p>
        </div>
      </div>
    );
  }

  const joinUrl = `${window.location.origin}/live/${event?.code}`;
  const top = questions.slice().sort((a, b) => b.votes_count - a.votes_count).slice(0, 8);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ap-bg, #0f0f14)', color: 'var(--ap-ink, #fff)', padding: '3rem 4rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0 }}>{event?.title ?? 'Session live'}</h1>
          <p style={{ fontSize: '1.1rem', opacity: 0.7, margin: '0.25rem 0 0' }}>Questions les plus votées, mises à jour en direct.</p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: '0.9rem', opacity: 0.7, margin: 0 }}>Rejoindre</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.08em', margin: '0.15rem 0' }}>{event?.code}</p>
          <p style={{ fontSize: '0.85rem', opacity: 0.6, margin: 0 }}>{joinUrl}</p>
          {run?.locked && (
            <p style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginTop: 8, color: 'var(--ap-danger, #f87171)' }}>
              <Lock size={16} /> Session verrouillée
            </p>
          )}
        </div>
      </header>

      {top.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, opacity: 0.6 }}>
          <MessageCircleQuestion size={48} />
          <p style={{ fontSize: '1.25rem' }}>En attente des premières questions…</p>
        </div>
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {top.map((q, index) => (
            <li
              key={q.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '1.5rem',
                background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: '1.1rem 1.5rem',
              }}
            >
              <span style={{ fontSize: '1.5rem', fontWeight: 800, opacity: 0.4, minWidth: '2ch' }}>{index + 1}</span>
              <span style={{ flex: 1, fontSize: '1.4rem', fontWeight: 600 }}>{q.body}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.3rem', fontWeight: 800, flexShrink: 0 }}>
                <ThumbsUp size={22} /> {q.votes_count}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
