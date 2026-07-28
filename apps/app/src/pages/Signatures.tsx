import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  FileSignature,
  LockKeyhole,
  Plus,
  Send,
  UsersRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Breadcrumb } from "@/components/Breadcrumb";
import { SignaturePad } from "@/components/signatures/SignaturePad";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ListSkeleton } from "@/components/ui/skeletons";
import { getCurrentUser } from "@/lib/auth";
import { showError } from "@/lib/errorTaxonomy";
import { listGroups, type Group } from "@/lib/sharing/sharingRepo";
import {
  createSignatureRequest,
  isSignatureRequestActionable,
  listSignatureRecipients,
  listVisibleSignatureRequests,
  setSignatureRequestStatus,
  submitSignature,
  uniqueRecipientCount,
  type SignatureRecipient,
  type SignatureRequest,
} from "@/lib/signatures/signatureRepo";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function requestState(request: SignatureRequest) {
  if (request.status === "closed") return { label: "Clôturée", color: "var(--ap-muted)" };
  if (!isSignatureRequestActionable(request)) return { label: "Échéance dépassée", color: "var(--ap-quiz)" };
  return { label: "Ouverte", color: "var(--ap-pres)" };
}

function typedSignatureData(name: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 240;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#172033";
  context.font = "italic 64px cursive";
  context.textBaseline = "middle";
  context.fillText(name.trim(), 40, canvas.height / 2, canvas.width - 80);
  return canvas.toDataURL("image/png");
}

export default function Signatures() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<SignatureRequest[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [recipients, setRecipients] = useState<SignatureRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [signTarget, setSignTarget] = useState<SignatureRequest | null>(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [typedName, setTypedName] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);

  const ownedRequests = useMemo(
    () => requests.filter((request) => request.owner_id === user?.id),
    [requests, user?.id],
  );
  const assignedRequests = useMemo(
    () => requests.filter((request) => request.owner_id !== user?.id),
    [requests, user?.id],
  );
  const pendingRequests = assignedRequests.filter(
    (request) => !request.responses.some((response) => response.user_id === user?.id) && isSignatureRequestActionable(request),
  );

  const reload = async () => {
    if (!user) return;
    const [visibleRequests, ownedGroups] = await Promise.all([
      listVisibleSignatureRequests(),
      listGroups(user.id),
    ]);
    setRequests(visibleRequests);
    setGroups(ownedGroups);

    const ownedGroupIds = Array.from(new Set(
      visibleRequests
        .filter((request) => request.owner_id === user.id)
        .flatMap((request) => request.groupIds),
    ));
    setRecipients(await listSignatureRecipients(ownedGroupIds));
  };

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    reload()
      .catch((error) => showError(error, "Signatures.load", "Impossible de charger les signatures."))
      .finally(() => setLoading(false));
  }, [navigate, user?.id]);

  const resetCreateForm = () => {
    setTitle("");
    setMessage("");
    setDueDate("");
    setSelectedGroupIds([]);
  };

  const handleCreate = async () => {
    if (!title.trim() || selectedGroupIds.length === 0) return;
    setBusy(true);
    try {
      await createSignatureRequest({
        title: title.trim(),
        message: message.trim(),
        dueAt: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : null,
        groupIds: selectedGroupIds,
      });
      await reload();
      resetCreateForm();
      setCreateOpen(false);
      toast.success("Demande de signature envoyée aux groupes");
    } catch (error) {
      showError(error, "Signatures.create", "Impossible de créer cette demande.");
    } finally {
      setBusy(false);
    }
  };

  const openSignDialog = (request: SignatureRequest) => {
    setTypedName(user?.username ?? "");
    setSignatureData(null);
    setConsented(false);
    setSignTarget(request);
  };

  const handleSign = async () => {
    if (!user || !signTarget || !typedName.trim() || !consented) return;
    setBusy(true);
    try {
      await submitSignature({
        requestId: signTarget.id,
        userId: user.id,
        typedName,
        signatureData: signatureData ?? typedSignatureData(typedName),
      });
      await reload();
      setSignTarget(null);
      toast.success("Signature enregistrée");
    } catch (error) {
      showError(error, "Signatures.sign", "Impossible d’enregistrer votre signature.");
    } finally {
      setBusy(false);
    }
  };

  const handleStatus = async (request: SignatureRequest) => {
    setBusy(true);
    try {
      await setSignatureRequestStatus(request.id, request.status === "open" ? "closed" : "open");
      await reload();
      toast.success(request.status === "open" ? "Demande clôturée" : "Demande rouverte");
    } catch (error) {
      showError(error, "Signatures.status", "Impossible de modifier cette demande.");
    } finally {
      setBusy(false);
    }
  };

  const recipientCountFor = (request: SignatureRequest) => uniqueRecipientCount(
    recipients.filter((recipient) => request.groupIds.includes(recipient.group_id)),
  );

  if (!user) return null;

  return (
    <AppLayout subtitle="Signatures">
      <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Breadcrumb onHome={() => navigate("/dashboard")} items={[{ label: "Signatures" }]} />
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            Nouvelle demande
          </Button>
        </div>

        <header className="mb-7 mt-7">
          <p className="ap-muted text-xs font-extrabold uppercase tracking-[.08em]">Validation collective</p>
          <h1 className="ap-h1 mt-1 text-3xl md:text-4xl">Signatures de groupe</h1>
          <p className="ap-muted mt-2 max-w-2xl text-sm">
            Faites signer une charte, un règlement ou une validation à tous les membres d’un ou plusieurs groupes.
          </p>
        </header>

        <div className="mb-7 grid gap-3 sm:grid-cols-3">
          {[
            { label: "À signer", value: pendingRequests.length, icon: FileSignature },
            { label: "Demandes envoyées", value: ownedRequests.length, icon: Send },
            {
              label: "Signatures reçues",
              value: ownedRequests.reduce((sum, request) => sum + request.responses.length, 0),
              icon: CheckCircle2,
            },
          ].map((stat) => (
            <div key={stat.label} className="ap-card flex items-center gap-3 p-4">
              <span className="grid h-10 w-10 place-items-center rounded-lg" style={{ background: "var(--ap-brand-soft)", color: "var(--ap-brand)" }}>
                <stat.icon className="h-5 w-5" />
              </span>
              <div>
                <strong className="block text-xl">{stat.value}</strong>
                <span className="ap-muted text-xs">{stat.label}</span>
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <section className="ap-card p-5"><ListSkeleton rows={5} /></section>
        ) : (
          <div className="grid gap-7 xl:grid-cols-2">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="ap-h2 text-xl">À signer</h2>
                <span className="ap-pill text-xs">{assignedRequests.length}</span>
              </div>
              <div className="space-y-3">
                {assignedRequests.length === 0 ? (
                  <div className="ap-card border-dashed p-8 text-center">
                    <CheckCircle2 className="mx-auto mb-3 h-9 w-9" style={{ color: "var(--ap-pres)" }} />
                    <p className="font-bold">Rien à signer</p>
                    <p className="ap-muted mt-1 text-xs">Les demandes adressées à vos groupes apparaîtront ici.</p>
                  </div>
                ) : assignedRequests.map((request) => {
                  const response = request.responses.find((item) => item.user_id === user.id);
                  const state = requestState(request);
                  return (
                    <article key={request.id} className="ap-card p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="ap-h3 text-base">{request.title}</h3>
                          <p className="ap-muted mt-1 text-xs">
                            Reçue le {dateFormatter.format(new Date(request.created_at))} · {request.groupIds.length} groupe{request.groupIds.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <span className="ap-pill text-[11px]" style={{ color: response ? "var(--ap-pres)" : state.color }}>
                          {response ? "Signée" : state.label}
                        </span>
                      </div>
                      {request.message && <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{request.message}</p>}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: "var(--ap-line)" }}>
                        <span className="ap-muted flex items-center gap-2 text-xs">
                          <CalendarClock className="h-4 w-4" />
                          {request.due_at ? `Avant le ${dateFormatter.format(new Date(request.due_at))}` : "Sans échéance"}
                        </span>
                        {response ? (
                          <span className="flex items-center gap-2 text-xs font-bold" style={{ color: "var(--ap-pres)" }}>
                            <Check className="h-4 w-4" />
                            Signé le {dateFormatter.format(new Date(response.consented_at))}
                          </span>
                        ) : (
                          <Button size="sm" disabled={!isSignatureRequestActionable(request)} onClick={() => openSignDialog(request)}>
                            <FileSignature />
                            Signer
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="ap-h2 text-xl">Mes demandes</h2>
                <span className="ap-pill text-xs">{ownedRequests.length}</span>
              </div>
              <div className="space-y-3">
                {ownedRequests.length === 0 ? (
                  <div className="ap-card border-dashed p-8 text-center">
                    <FileSignature className="mx-auto mb-3 h-9 w-9" style={{ color: "var(--ap-brand)" }} />
                    <p className="font-bold">Aucune demande</p>
                    <p className="ap-muted mt-1 text-xs">Créez une demande et adressez-la à vos groupes.</p>
                  </div>
                ) : ownedRequests.map((request) => {
                  const total = recipientCountFor(request);
                  const signed = request.responses.length;
                  const progress = total > 0 ? Math.min(100, Math.round((signed / total) * 100)) : 0;
                  const state = requestState(request);
                  const groupNames = groups
                    .filter((group) => request.groupIds.includes(group.id))
                    .map((group) => group.name);
                  return (
                    <article key={request.id} className="ap-card p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="ap-h3 truncate text-base">{request.title}</h3>
                          <p className="ap-muted mt-1 flex items-center gap-1.5 text-xs">
                            <UsersRound className="h-3.5 w-3.5" />
                            {groupNames.join(", ") || `${request.groupIds.length} groupe(s)`}
                          </p>
                        </div>
                        <span className="ap-pill shrink-0 text-[11px]" style={{ color: state.color }}>{state.label}</span>
                      </div>

                      <div className="mt-5">
                        <div className="mb-2 flex items-center justify-between text-xs font-bold">
                          <span>{signed} signature{signed !== 1 ? "s" : ""} sur {total}</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--ap-line)" }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: "var(--ap-brand)" }} />
                        </div>
                        {total === 0 && (
                          <p className="ap-muted mt-2 text-[11px]">Ajoutez des membres aux groupes sélectionnés pour commencer le suivi.</p>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: "var(--ap-line)" }}>
                        <span className="ap-muted text-xs">
                          {request.due_at ? `Échéance : ${dateFormatter.format(new Date(request.due_at))}` : "Sans échéance"}
                        </span>
                        <button
                          type="button"
                          className="ap-btn ap-btn--ghost ap-btn--sm"
                          disabled={busy}
                          onClick={() => void handleStatus(request)}
                        >
                          {request.status === "open" ? <LockKeyhole className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                          {request.status === "open" ? "Clôturer" : "Rouvrir"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </main>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" style={{ background: "var(--ap-card)", color: "var(--ap-ink)", borderColor: "var(--ap-line)" }}>
          <DialogHeader>
            <DialogTitle>Nouvelle demande de signature</DialogTitle>
            <DialogDescription>
              Les membres actuels et futurs des groupes sélectionnés pourront signer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold">Titre *</span>
              <input
                className="h-10 w-full rounded-md border bg-transparent px-3 text-sm"
                style={{ borderColor: "var(--ap-line)" }}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex. Charte informatique 2026"
                maxLength={160}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold">Texte à accepter</span>
              <textarea
                className="min-h-28 w-full resize-y rounded-md border bg-transparent p-3 text-sm"
                style={{ borderColor: "var(--ap-line)" }}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Présentez l’engagement ou les conditions à valider…"
                maxLength={20000}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold">Date limite</span>
              <input
                type="date"
                className="h-10 w-full rounded-md border bg-transparent px-3 text-sm"
                style={{ borderColor: "var(--ap-line)" }}
                value={dueDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-bold">Groupes destinataires *</span>
                <button type="button" className="text-xs font-bold underline" style={{ color: "var(--ap-brand)" }} onClick={() => navigate("/groups")}>
                  Gérer les groupes
                </button>
              </div>
              {groups.length === 0 ? (
                <button
                  type="button"
                  className="w-full rounded-lg border border-dashed p-5 text-center"
                  style={{ borderColor: "var(--ap-line)" }}
                  onClick={() => navigate("/groups")}
                >
                  <UsersRound className="mx-auto mb-2 h-7 w-7" style={{ color: "var(--ap-brand)" }} />
                  <strong className="block text-sm">Créer d’abord un groupe</strong>
                  <span className="ap-muted text-xs">Puis ajoutez les personnes concernées.</span>
                </button>
              ) : (
                <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border p-3" style={{ borderColor: "var(--ap-line)" }}>
                  {groups.map((group) => {
                    const checked = selectedGroupIds.includes(group.id);
                    return (
                      <label key={group.id} className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-black/5">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => setSelectedGroupIds((current) => (
                            value ? [...current, group.id] : current.filter((id) => id !== group.id)
                          ))}
                        />
                        <UsersRound className="h-4 w-4" />
                        <span className="text-sm font-bold">{group.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button
              loading={busy}
              disabled={!title.trim() || selectedGroupIds.length === 0}
              onClick={() => void handleCreate()}
            >
              <Send />
              Envoyer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(signTarget)} onOpenChange={(open) => { if (!open) setSignTarget(null); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl" style={{ background: "var(--ap-card)", color: "var(--ap-ink)", borderColor: "var(--ap-line)" }}>
          <DialogHeader>
            <DialogTitle>{signTarget?.title}</DialogTitle>
            <DialogDescription>
              Votre nom, votre tracé et l’heure de validation seront enregistrés.
            </DialogDescription>
          </DialogHeader>

          {signTarget?.message && (
            <div className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-lg border p-4 text-sm leading-6" style={{ borderColor: "var(--ap-line)", background: "var(--ap-paper-2)" }}>
              {signTarget.message}
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">Nom complet *</span>
            <input
              className="h-10 w-full rounded-md border bg-transparent px-3 text-sm"
              style={{ borderColor: "var(--ap-line)" }}
              value={typedName}
              onChange={(event) => setTypedName(event.target.value)}
              autoComplete="name"
              maxLength={160}
            />
          </label>

          <div>
            <span className="mb-1.5 block text-sm font-bold">Signature manuscrite <span className="ap-muted font-normal">(facultative)</span></span>
            <SignaturePad onChange={setSignatureData} />
            <p className="ap-muted mt-1.5 text-[11px]">
              Sans tracé, votre nom complet sera utilisé comme représentation de la signature.
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3" style={{ borderColor: "var(--ap-line)" }}>
            <Checkbox checked={consented} onCheckedChange={(value) => setConsented(value === true)} />
            <span className="text-xs leading-5">
              Je confirme avoir lu le texte ci-dessus et souhaite y apposer ma signature électronique simple.
            </span>
          </label>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSignTarget(null)}>Annuler</Button>
            <Button
              loading={busy}
              disabled={!typedName.trim() || !consented}
              onClick={() => void handleSign()}
            >
              <FileSignature />
              Signer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
