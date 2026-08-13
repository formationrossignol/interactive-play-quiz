import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, BarChart3, CheckCircle2, MessageCircleQuestion, Send, ThumbsUp, UserX } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { ListSkeleton } from '@/components/ui/skeletons';
import {
  castVote,
  getLiveBrainstormIdeas,
  getLiveEventByCode,
  getMyLiveResponse,
  getOpenRun,
  joinLiveRun,
  listRunInteractions,
  listRunQuestions,
  submitAudienceQuestion,
  submitLiveResponse,
  type AudienceQuestion,
  type BrainstormConfig,
  type BrainstormIdea,
  type BrainstormPayload,
  type LiveBrainstormIdeaResult,
  type LiveEvent,
  type LiveInteraction,
  type LiveRun,
  type MatrixConfig,
  type MatrixPayload,
  type PollConfig,
  type PollResponsePayload,
  type PriorityConfig,
  type PriorityPayload,
  type RankingConfig,
  type RankingPayload,
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
        setSelected(new Set((payload as PollResponsePayload).optionIds));
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

/** LIVE-009: allocate a fixed points budget across options. */
function LivePriorityWidget({ interaction }: { interaction: LiveInteraction }) {
  const config = interaction.config as PriorityConfig;
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setAllocations({});
    setSubmitted(false);
    const identity = getLiveParticipantIdentity();
    if (!identity) return;
    let cancelled = false;
    getMyLiveResponse(interaction.id, identity.clientId)
      .then((payload) => {
        if (cancelled || !payload) return;
        setAllocations((payload as PriorityPayload).allocations ?? {});
        setSubmitted(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [interaction.id]);

  const spent = Object.values(allocations).reduce((sum, n) => sum + (n || 0), 0);
  const remaining = config.budget - spent;

  const handleSubmit = async () => {
    const identity = getLiveParticipantIdentity();
    if (!identity || remaining < 0) return;
    setSubmitting(true);
    try {
      await submitLiveResponse(interaction.id, identity.clientId, { allocations });
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
      <p className="text-xs" style={{ color: remaining < 0 ? 'var(--ap-danger)' : undefined }}>Restant : {remaining} / {config.budget} pts</p>
      <div className="space-y-1.5">
        {config.options.map((option) => (
          <div key={option.id} className="flex items-center justify-between gap-2 text-sm rounded-md border px-3 py-1.5">
            <span>{option.label}</span>
            <input
              type="number"
              min={0}
              max={config.budget}
              value={allocations[option.id] ?? 0}
              onChange={(e) => setAllocations((prev) => ({ ...prev, [option.id]: Number(e.target.value) || 0 }))}
              className="w-16 text-right"
              aria-label={`Points pour ${option.label}`}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        className="ap-btn ap-btn--pill"
        style={{ width: '100%' }}
        disabled={remaining < 0 || submitting}
        onClick={() => void handleSubmit()}
      >
        {submitted ? <><CheckCircle2 size={14} /> Réponse enregistrée — modifier</> : 'Répondre'}
      </button>
    </div>
  );
}

/** LIVE-010: numeric x/y placement per option — sliders with visible axis
 *  labels rather than a drag-and-drop canvas, so the format stays
 *  keyboard/screen-reader operable ("placement accessible" per spec). */
function LiveMatrixWidget({ interaction }: { interaction: LiveInteraction }) {
  const config = interaction.config as MatrixConfig;
  const [placements, setPlacements] = useState<Record<string, { x: number; y: number }>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPlacements({});
    setSubmitted(false);
    const identity = getLiveParticipantIdentity();
    if (!identity) return;
    let cancelled = false;
    getMyLiveResponse(interaction.id, identity.clientId)
      .then((payload) => {
        if (cancelled || !payload) return;
        setPlacements((payload as MatrixPayload).placements ?? {});
        setSubmitted(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [interaction.id]);

  const setAxis = (optionId: string, axis: 'x' | 'y', value: number) => {
    setPlacements((prev) => ({ ...prev, [optionId]: { x: 0, y: 0, ...prev[optionId], [axis]: value } }));
  };

  const handleSubmit = async () => {
    const identity = getLiveParticipantIdentity();
    if (!identity) return;
    setSubmitting(true);
    try {
      await submitLiveResponse(interaction.id, identity.clientId, { placements });
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
      <div className="space-y-3">
        {config.options.map((option) => {
          const point = placements[option.id] ?? { x: 0, y: 0 };
          return (
            <div key={option.id} className="rounded-md border p-2 space-y-1.5">
              <p className="text-sm font-medium">{option.label}</p>
              <label className="text-xs flex items-center gap-2">
                {config.xAxisLabel}
                <input type="range" min={-100} max={100} value={point.x} onChange={(e) => setAxis(option.id, 'x', Number(e.target.value))} className="flex-1" />
                <span className="w-8 text-right">{point.x}</span>
              </label>
              <label className="text-xs flex items-center gap-2">
                {config.yAxisLabel}
                <input type="range" min={-100} max={100} value={point.y} onChange={(e) => setAxis(option.id, 'y', Number(e.target.value))} className="flex-1" />
                <span className="w-8 text-right">{point.y}</span>
              </label>
            </div>
          );
        })}
      </div>
      <button type="button" className="ap-btn ap-btn--pill" style={{ width: '100%' }} disabled={submitting} onClick={() => void handleSubmit()}>
        {submitted ? <><CheckCircle2 size={14} /> Réponse enregistrée — modifier</> : 'Répondre'}
      </button>
    </div>
  );
}

/** LIVE-011/LIVE-013: free-text ideas (this participant's own, kept in
 *  their one response row) plus voting on the shared pool (read via
 *  get_live_brainstorm_ideas() — live_responses itself isn't participant-
 *  readable, same reason poll results go through an aggregate RPC too). */
function LiveBrainstormWidget({ interaction }: { interaction: LiveInteraction }) {
  const config = interaction.config as BrainstormConfig;
  const [myIdeas, setMyIdeas] = useState<BrainstormIdea[]>([]);
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState('');
  const [pool, setPool] = useState<LiveBrainstormIdeaResult[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const reloadPool = () => getLiveBrainstormIdeas(interaction.id).then(setPool).catch(() => {});

  useEffect(() => {
    setMyIdeas([]);
    setMyVotes(new Set());
    reloadPool();
    const identity = getLiveParticipantIdentity();
    if (!identity) return;
    let cancelled = false;
    getMyLiveResponse(interaction.id, identity.clientId)
      .then((payload) => {
        if (cancelled || !payload) return;
        const p = payload as BrainstormPayload;
        setMyIdeas(p.ideas ?? []);
        setMyVotes(new Set(p.votes ?? []));
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interaction.id]);

  const persist = async (ideas: BrainstormIdea[], votes: Set<string>) => {
    const identity = getLiveParticipantIdentity();
    if (!identity) return;
    setSubmitting(true);
    try {
      await submitLiveResponse(interaction.id, identity.clientId, { ideas, votes: [...votes] });
      await reloadPool();
    } catch {
      // Best-effort, same posture as vote/question submission in this room.
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddIdea = async () => {
    const text = draft.trim();
    if (!text) return;
    const nextIdeas = [...myIdeas, { id: crypto.randomUUID(), text }];
    setMyIdeas(nextIdeas);
    setDraft('');
    await persist(nextIdeas, myVotes);
  };

  const toggleVote = async (ideaId: string) => {
    const nextVotes = new Set(myVotes);
    if (nextVotes.has(ideaId)) nextVotes.delete(ideaId);
    else nextVotes.add(ideaId);
    setMyVotes(nextVotes);
    await persist(myIdeas, nextVotes);
  };

  return (
    <div className="rounded-md border p-3 mb-4 space-y-2">
      <p className="text-sm font-medium flex items-center gap-1.5"><BarChart3 size={15} /> {config.question}</p>
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAddIdea(); } }}
          placeholder="Proposer une idée…"
          className="flex-1 rounded-md border px-2 py-1.5 text-sm"
        />
        <button type="button" className="ap-btn ap-btn--sm" disabled={!draft.trim() || submitting} onClick={() => void handleAddIdea()}>Ajouter</button>
      </div>
      {pool.length > 0 && (
        <ul className="space-y-1">
          {pool.map((idea) => (
            <li key={idea.idea_id} className="flex items-center justify-between gap-2 text-sm rounded-md border px-2 py-1.5">
              <span>{idea.idea_text}</span>
              <button
                type="button"
                className="ap-btn ap-btn--ghost ap-btn--sm"
                disabled={submitting}
                onClick={() => void toggleVote(idea.idea_id)}
              >
                <ThumbsUp size={14} /> {idea.votes_count}{myVotes.has(idea.idea_id) ? ' ✓' : ''}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** LIVE-012: drag order via up/down buttons rather than a drag-and-drop
 *  list — same accessibility reasoning as the matrix widget. */
function LiveRankingWidget({ interaction }: { interaction: LiveInteraction }) {
  const config = interaction.config as RankingConfig;
  const [order, setOrder] = useState<string[]>(config.options.map((o) => o.id));
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setOrder(config.options.map((o) => o.id));
    setSubmitted(false);
    const identity = getLiveParticipantIdentity();
    if (!identity) return;
    let cancelled = false;
    getMyLiveResponse(interaction.id, identity.clientId)
      .then((payload) => {
        if (cancelled || !payload) return;
        const p = payload as RankingPayload;
        if (p.order?.length === config.options.length) setOrder(p.order);
        setSubmitted(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interaction.id]);

  const move = (index: number, delta: number) => {
    setOrder((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSubmit = async () => {
    const identity = getLiveParticipantIdentity();
    if (!identity) return;
    setSubmitting(true);
    try {
      await submitLiveResponse(interaction.id, identity.clientId, { order });
      setSubmitted(true);
    } catch {
      // Best-effort, same posture as vote/question submission in this room.
    } finally {
      setSubmitting(false);
    }
  };

  const labelById = new Map(config.options.map((o) => [o.id, o.label]));

  return (
    <div className="rounded-md border p-3 mb-4 space-y-2">
      <p className="text-sm font-medium flex items-center gap-1.5"><BarChart3 size={15} /> {config.question}</p>
      <ol className="space-y-1.5">
        {order.map((optionId, i) => (
          <li key={optionId} className="flex items-center justify-between gap-2 text-sm rounded-md border px-3 py-1.5">
            <span>{i + 1}. {labelById.get(optionId) ?? optionId}</span>
            <div className="flex items-center gap-1">
              <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn" aria-label="Monter" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn" aria-label="Descendre" disabled={i === order.length - 1} onClick={() => move(i, 1)}>↓</button>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" className="ap-btn ap-btn--pill" style={{ width: '100%' }} disabled={submitting} onClick={() => void handleSubmit()}>
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
  const [activeInteraction, setActiveInteraction] = useState<LiveInteraction | null>(null);

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
        setActiveInteraction(interactions.find((i) => i.status === 'live') ?? null);
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

  // A staff member opening/closing an interaction shows/hides it here
  // immediately — open_live_interaction() auto-closes any other
  // interaction on the run, so at most one 'live' row ever exists at a time.
  useEffect(() => {
    if (phase !== 'live' || !run) return;
    const channel = supabase
      .channel(`lms-live-run-${run.id}-interactions`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'live_interactions', filter: `run_id=eq.${run.id}` },
        (payload) => {
          const row = payload.new as LiveInteraction | undefined;
          if (!row) return;
          setActiveInteraction((prev) => {
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

        {activeInteraction?.kind === 'poll' && <LivePollWidget interaction={activeInteraction} />}
        {activeInteraction?.kind === 'priority' && <LivePriorityWidget interaction={activeInteraction} />}
        {activeInteraction?.kind === 'matrix' && <LiveMatrixWidget interaction={activeInteraction} />}
        {activeInteraction?.kind === 'brainstorm' && <LiveBrainstormWidget interaction={activeInteraction} />}
        {activeInteraction?.kind === 'ranking' && <LiveRankingWidget interaction={activeInteraction} />}

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
