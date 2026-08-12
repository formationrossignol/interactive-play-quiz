import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, BarChart3, CheckCircle2, MessageCircleQuestion, Send, ThumbsUp, UserX } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { ListSkeleton } from '@/components/ui/skeletons';
import {
  castVote,
  getLiveEventByCode,
  getMyLiveResponse,
  getOpenRun,
  joinLiveRun,
  listRunInteractions,
  listRunQuestions,
  submitAudienceQuestion,
  submitLiveResponse,
  type AudienceQuestion,
  type LiveEvent,
  type LiveInteraction,
  type LiveRun,
  type PollConfig,
} from '@/lib/lms/liveEngagement';
import { genLiveClientId, getLiveParticipantIdentity, getVotedQuestionIds, markQuestionVoted, setLiveParticipantIdentity } from '@/lib/lms/liveParticipant';

type Phase = 'loading' | 'not-found' | 'not-open' | 'locked' | 'kicked' | 'blocked' | 'live';

const VISIBLE_STATUSES = new Set(['approved', 'live', 'answered']);

function RoomSkeleton() {
  return (
    <div className="product-entry-shell">
      <div className="product-entry-card" style={{ maxWidth: 560 }}>
        <Skeleton className="h-6 w-2/3 mb-2" />
        <Skeleton className="h-4 w-1/2 mb-6" />
        <ListSkeleton rows={3} withAvatar={false} />
      </div>
    </div>
  );
}

function LivePollWidget({ interaction }: { interaction: LiveInteraction }) {
  const config = interaction.config as PollConfig;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setSelected(new Set());
    setSubmitted(false);
    const identity = getLiveParticipantIdentity();
    if (!identity) return;
    let cancelled = false;
    getMyLiveResponse(interaction.id, identity.clientId)
      .then((payload) => {
        if (cancelled || !payload) return;
        setSelected(new Set(payload.optionIds));
        setSubmitted(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [interaction.id]);

  const toggleOption = (optionId: string) => {
    setSelected((prev) => {
      const next = new Set(config.allowMultiple ? prev : []);
      if (prev.has(optionId) && config.allowMultiple) next.delete(optionId);
      else next.add(optionId);
      return next;
    });
  };

  const handleSubmit = async () => {
    const identity = getLiveParticipantIdentity();
    if (!identity || selected.size === 0) return;
    setSubmitting(true);
    try {
      await submitLiveResponse(interaction.id, identity.clientId, { optionIds: [...selected] });
      setSubmitted(true);
    } catch {
      // Best-effort, same posture as vote/question submission in this room.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-md border p-3 mb-4 space-y-2">
      <p className="text-sm font-medium flex items-center gap-1.5"><BarChart3 size={15} /> {config.question}</p>
      <div className="space-y-1.5">
        {config.options.map((option) => (
          <label key={option.id} className="flex items-center gap-2 text-sm rounded-md border px-3 py-1.5 cursor-pointer">
            <input
              type={config.allowMultiple ? 'checkbox' : 'radio'}
              name={`poll-${interaction.id}`}
              checked={selected.has(option.id)}
              onChange={() => toggleOption(option.id)}
            />
            {option.label}
          </label>
        ))}
      </div>
      <button
        type="button"
        className="ap-btn ap-btn--pill"
        style={{ width: '100%' }}
        disabled={selected.size === 0 || submitting}
        onClick={() => void handleSubmit()}
      >
        {submitted ? <><CheckCircle2 size={14} /> Réponse enregistrée — modifier</> : 'Répondre'}
      </button>
    </div>
  );
}

export default function LiveEventRoom() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const [phase, setPhase] = useState<Phase>('loading');
  const [blockedMsg, setBlockedMsg] = useState('');
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [run, setRun] = useState<LiveRun | null>(null);
  const [questions, setQuestions] = useState<AudienceQuestion[]>([]);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [questionBody, setQuestionBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [livePoll, setLivePoll] = useState<LiveInteraction | null>(null);

  useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      if (!code) return;
      try {
        const foundEvent = await getLiveEventByCode(code.toUpperCase());
        if (!foundEvent) { if (!cancelled) setPhase('not-found'); return; }

        const foundRun = await getOpenRun(foundEvent.id);
        if (!foundRun) { if (!cancelled) { setEvent(foundEvent); setPhase('not-open'); } return; }

        const identity = getLiveParticipantIdentity() ?? { clientId: genLiveClientId(), displayName: '' };
        setLiveParticipantIdentity(identity);

        await joinLiveRun(foundRun.id, identity.clientId, identity.displayName || null);

        const [initialQuestions, interactions] = await Promise.all([
          listRunQuestions(foundRun.id),
          listRunInteractions(foundRun.id),
        ]);
        if (cancelled) return;
        setEvent(foundEvent);
        setRun(foundRun);
        setQuestions(initialQuestions.filter((q) => VISIBLE_STATUSES.has(q.status)));
        setVotedIds(getVotedQuestionIds(foundRun.id));
        setLivePoll(interactions.find((i) => i.kind === 'poll' && i.status === 'live') ?? null);
        setPhase('live');
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Erreur inattendue.';
        if (msg === 'Run is locked') setPhase('locked');
        else if (msg === 'You have been removed from this run') setPhase('kicked');
        else { setBlockedMsg(msg); setPhase('blocked'); }
      }
    };
    void setup();
    return () => { cancelled = true; };
  }, [code]);

  // Live push: a moderator approving/featuring a question, or a new one
  // arriving, updates the room without a manual refetch.
  useEffect(() => {
    if (phase !== 'live' || !run) return;
    const channel = supabase
      .channel(`lms-live-run-${run.id}-questions`)
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
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [phase, run]);

  // A staff member opening/closing a poll shows/hides it here immediately —
  // open_live_interaction() auto-closes any other interaction on the run, so
  // at most one 'live' row ever exists at a time.
  useEffect(() => {
    if (phase !== 'live' || !run) return;
    const channel = supabase
      .channel(`lms-live-run-${run.id}-interactions`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'live_interactions', filter: `run_id=eq.${run.id}` },
        (payload) => {
          const row = payload.new as LiveInteraction | undefined;
          if (!row || row.kind !== 'poll') return;
          setLivePoll((prev) => {
            if (row.status === 'live') return row;
            return prev?.id === row.id ? null : prev;
          });
        })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [phase, run]);

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const identity = getLiveParticipantIdentity();
    if (!run || !identity || !questionBody.trim()) return;
    setSubmitting(true);
    try {
      await submitAudienceQuestion(run.id, identity.clientId, identity.displayName, questionBody.trim());
      setQuestionBody('');
    } catch {
      // Moderation-gated by default — the question was recorded even if it
      // won't be visible here until approved, nothing actionable to surface.
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (questionId: string) => {
    const identity = getLiveParticipantIdentity();
    if (!run || !identity || votedIds.has(questionId)) return;
    setVotedIds((prev) => new Set(prev).add(questionId));
    markQuestionVoted(run.id, questionId);
    try {
      const newCount = await castVote(questionId, identity.clientId);
      setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, votes_count: newCount } : q)));
    } catch {
      // Best-effort — the optimistic disabled state stays either way; a
      // failed vote is not worth interrupting the participant over.
    }
  };

  if (phase === 'loading') return <RoomSkeleton />;

  if (phase === 'not-found' || phase === 'not-open' || phase === 'locked' || phase === 'kicked' || phase === 'blocked') {
    const messages: Record<string, string> = {
      'not-found': 'Cet événement est introuvable ou a été clôturé.',
      'not-open': 'Aucune session en cours pour cet événement. Réessayez dans un instant.',
      locked: 'Cette session est verrouillée par l’animateur.',
      kicked: 'Vous avez été retiré de cette session.',
      blocked: blockedMsg || 'Impossible de rejoindre cette session.',
    };
    return (
      <div className="product-entry-shell">
        <div className="product-entry-card">
          <div className="product-entry-heading">
            <span className="product-entry-heading__icon">{phase === 'kicked' ? <UserX className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}</span>
            <h1>Session indisponible</h1>
          </div>
          <div className="product-entry-alert" role="alert">
            <AlertTriangle size={16} />
            <span style={{ fontSize: 14 }}>{messages[phase]}</span>
          </div>
          <button className="ap-btn ap-btn--ghost" style={{ width: '100%' }} onClick={() => navigate(`/live/${code ?? ''}`)}>
            Retour
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="product-entry-shell">
      <div className="product-entry-card" style={{ maxWidth: 560 }}>
        <div className="product-entry-heading">
          <span className="product-entry-heading__icon"><MessageCircleQuestion className="h-6 w-6" /></span>
          <h1>{event?.title ?? 'Session live'}</h1>
          <p>Posez une question ou votez pour celles déjà posées.</p>
        </div>

        {livePoll && <LivePollWidget interaction={livePoll} />}

        <form onSubmit={handleSubmitQuestion} className="flex gap-2 mb-4">
          <input
            className="ap-code"
            type="text"
            placeholder="Votre question..."
            maxLength={2000}
            value={questionBody}
            onChange={(e) => setQuestionBody(e.target.value)}
            style={{ flex: 1, textAlign: 'left', letterSpacing: 'normal' }}
            aria-label="Votre question"
          />
          <button className="ap-btn ap-btn--pill" type="submit" disabled={submitting || !questionBody.trim()}>
            <Send size={16} />
          </button>
        </form>

        {questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune question pour l’instant — soyez le premier.</p>
        ) : (
          <ul className="space-y-2" aria-label="Questions">
            {questions
              .slice()
              .sort((a, b) => b.votes_count - a.votes_count)
              .map((q) => (
                <li key={q.id} className="rounded-md border p-3 text-sm flex items-center justify-between gap-3">
                  <span>{q.body}</span>
                  <button
                    className="ap-btn ap-btn--ghost ap-btn--sm"
                    onClick={() => handleVote(q.id)}
                    disabled={votedIds.has(q.id)}
                    aria-pressed={votedIds.has(q.id)}
                    style={{ flexShrink: 0 }}
                  >
                    <ThumbsUp size={14} /> {q.votes_count}
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}
