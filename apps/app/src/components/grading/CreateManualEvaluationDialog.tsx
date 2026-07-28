import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Plus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { PersonPicker } from "@/components/sharing/PersonPicker";
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
import { getCurrentUser } from "@/lib/auth";
import { showError } from "@/lib/errorTaxonomy";
import {
  createManualEvaluation,
  listOwnedGradeableContent,
} from "@/lib/grading/gradingRepo";
import type {
  GradeableContent,
  GradingType,
  RoundingRule,
} from "@/lib/grading/types";
import {
  addGroupMemberByUserId,
  createGroup,
  listGroupMembers,
  resolveGroupMemberByEmail,
  usernamesByIds,
  type Group,
  type GroupMember,
  type UsernameMatch,
} from "@/lib/sharing/sharingRepo";

interface CreateManualEvaluationDialogProps {
  open: boolean;
  groups: Group[];
  onOpenChange: (open: boolean) => void;
  onGroupsChanged: (preferredId?: string) => Promise<void>;
  onCreated: (evaluationId: string) => Promise<void> | void;
}

const fieldClass = "h-10 w-full rounded-md border bg-transparent px-3 text-sm";
const fieldStyle = { borderColor: "var(--ap-line)", color: "var(--ap-ink)" };

export function CreateManualEvaluationDialog({
  open,
  groups,
  onOpenChange,
  onGroupsChanged,
  onCreated,
}: CreateManualEvaluationDialogProps) {
  const user = getCurrentUser();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contextLabel, setContextLabel] = useState("");
  const [contentId, setContentId] = useState("");
  const [contents, setContents] = useState<GradeableContent[]>([]);
  const [gradingType, setGradingType] = useState<GradingType>("numeric");
  const [minimumScore, setMinimumScore] = useState("0");
  const [maximumScore, setMaximumScore] = useState("20");
  const [decimalPlaces, setDecimalPlaces] = useState("1");
  const [passThreshold, setPassThreshold] = useState("10");
  const [coefficient, setCoefficient] = useState("1");
  const [roundingRule, setRoundingRule] = useState<RoundingRule>("tenth");
  const [evaluationDate, setEvaluationDate] = useState(new Date().toISOString().slice(0, 10));
  const [entryDeadline, setEntryDeadline] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, GroupMember[]>>({});
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    listOwnedGradeableContent(user.id)
      .then(setContents)
      .catch((error) => showError(error, "ManualGrading.contexts", "Impossible de charger vos contenus."));
  }, [open, user?.id]);

  const reset = () => {
    setName("");
    setDescription("");
    setContextLabel("");
    setContentId("");
    setGradingType("numeric");
    setMinimumScore("0");
    setMaximumScore("20");
    setDecimalPlaces("1");
    setPassThreshold("10");
    setCoefficient("1");
    setRoundingRule("tenth");
    setEvaluationDate(new Date().toISOString().slice(0, 10));
    setEntryDeadline("");
    setSelectedGroupIds([]);
    setExpandedGroupId(null);
  };

  const loadMembers = async (groupId: string) => {
    try {
      const rows = await listGroupMembers(groupId);
      setMembers((current) => ({ ...current, [groupId]: rows }));
      const ids = rows.map((member) => member.user_id).filter((id): id is string => Boolean(id));
      const matches = await usernamesByIds(ids);
      setUsernames((current) => ({
        ...current,
        ...Object.fromEntries(matches.map((match) => [match.id, match.username])),
      }));
    } catch (error) {
      showError(error, "ManualGrading.members", "Impossible de charger les membres.");
    }
  };

  const toggleMembers = (groupId: string) => {
    const next = expandedGroupId === groupId ? null : groupId;
    setExpandedGroupId(next);
    if (next) void loadMembers(next);
  };

  const handleCreateGroup = async () => {
    if (!user || !newGroupName.trim()) return;
    setBusy(true);
    try {
      const group = await createGroup(user.id, newGroupName.trim());
      setNewGroupName("");
      setSelectedGroupIds((current) => [...current, group.id]);
      setExpandedGroupId(group.id);
      await onGroupsChanged(group.id);
      await loadMembers(group.id);
      toast.success("Groupe créé");
    } catch (error) {
      showError(error, "ManualGrading.createGroup", "Impossible de créer le groupe.");
    } finally {
      setBusy(false);
    }
  };

  const addMember = async (groupId: string, match: UsernameMatch) => {
    try {
      await addGroupMemberByUserId(groupId, match.id);
      await loadMembers(groupId);
      toast.success(`@${match.username} ajouté`);
    } catch (error) {
      showError(error, "ManualGrading.addMember", "Impossible d’ajouter cette personne.");
    }
  };

  const inviteMember = async (groupId: string, email: string) => {
    try {
      await resolveGroupMemberByEmail(groupId, email);
      await loadMembers(groupId);
      toast.success("Invitation ajoutée");
    } catch (error) {
      showError(error, "ManualGrading.inviteMember", "Impossible d’ajouter cette invitation.");
    }
  };

  const handleCreate = async () => {
    const min = Number(minimumScore.replace(",", "."));
    const max = Number(maximumScore.replace(",", "."));
    const threshold = passThreshold.trim() ? Number(passThreshold.replace(",", ".")) : null;
    const coefficientValue = Number(coefficient.replace(",", "."));
    if (!name.trim() || selectedGroupIds.length === 0) return;
    if (
      !Number.isFinite(min)
      || !Number.isFinite(max)
      || max <= min
      || !Number.isFinite(coefficientValue)
      || coefficientValue <= 0
      || (threshold !== null && (!Number.isFinite(threshold) || threshold < min || threshold > max))
    ) {
      toast.error("Vérifiez le barème, le seuil et le coefficient.");
      return;
    }

    setBusy(true);
    try {
      const id = await createManualEvaluation({
        name: name.trim(),
        description: description.trim(),
        contextLabel: contextLabel.trim(),
        contentId: contentId || null,
        gradingType,
        minimumScore: min,
        maximumScore: max,
        decimalPlaces: Number(decimalPlaces),
        passThreshold: gradingType === "numeric" ? threshold : null,
        coefficient: coefficientValue,
        roundingRule,
        evaluationDate,
        entryDeadline: entryDeadline ? new Date(`${entryDeadline}T23:59:59`).toISOString() : null,
        groupIds: selectedGroupIds,
      });
      reset();
      await onCreated(id);
      onOpenChange(false);
      toast.success("Évaluation créée");
    } catch (error) {
      showError(error, "ManualGrading.create", "Impossible de créer cette évaluation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"
        style={{ background: "var(--ap-card)", color: "var(--ap-ink)", borderColor: "var(--ap-line)" }}
      >
        <DialogHeader>
          <DialogTitle>Nouvelle évaluation manuelle</DialogTitle>
          <DialogDescription>
            Configurez le barème puis choisissez les groupes à évaluer.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-sm font-bold">Nom de l’évaluation *</span>
            <input
              className={fieldClass}
              style={fieldStyle}
              value={name}
              maxLength={160}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex. Soutenance finale"
            />
          </label>

          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-sm font-bold">Description</span>
            <textarea
              className="min-h-24 w-full rounded-md border bg-transparent p-3 text-sm"
              style={fieldStyle}
              value={description}
              maxLength={10000}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Consignes ou contexte de l’évaluation…"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-sm font-bold">Contenu Brivia associé</span>
            <select className={fieldClass} style={fieldStyle} value={contentId} onChange={(event) => setContentId(event.target.value)}>
              <option value="">Aucun contenu lié</option>
              {contents.map((content) => (
                <option key={content.id} value={content.id}>{content.title} · {content.type}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-bold">Cours, module ou parcours</span>
            <input className={fieldClass} style={fieldStyle} value={contextLabel} maxLength={160} onChange={(event) => setContextLabel(event.target.value)} placeholder="Ex. Module DevOps" />
          </label>

          <label>
            <span className="mb-1.5 block text-sm font-bold">Type de notation *</span>
            <select className={fieldClass} style={fieldStyle} value={gradingType} onChange={(event) => setGradingType(event.target.value as GradingType)}>
              <option value="numeric">Note numérique</option>
              <option value="validation">Validation simple</option>
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-bold">Coefficient *</span>
            <input className={fieldClass} style={fieldStyle} inputMode="decimal" value={coefficient} onChange={(event) => setCoefficient(event.target.value)} />
          </label>

          {gradingType === "numeric" && (
            <>
              <label>
                <span className="mb-1.5 block text-sm font-bold">Note minimale</span>
                <input className={fieldClass} style={fieldStyle} inputMode="decimal" value={minimumScore} onChange={(event) => setMinimumScore(event.target.value)} />
              </label>
              <label>
                <span className="mb-1.5 block text-sm font-bold">Note maximale</span>
                <input className={fieldClass} style={fieldStyle} inputMode="decimal" value={maximumScore} onChange={(event) => setMaximumScore(event.target.value)} />
              </label>
              <label>
                <span className="mb-1.5 block text-sm font-bold">Décimales autorisées</span>
                <select className={fieldClass} style={fieldStyle} value={decimalPlaces} onChange={(event) => setDecimalPlaces(event.target.value)}>
                  <option value="0">Aucune</option>
                  <option value="1">1 décimale</option>
                  <option value="2">2 décimales</option>
                </select>
              </label>
              <label>
                <span className="mb-1.5 block text-sm font-bold">Seuil de réussite</span>
                <input className={fieldClass} style={fieldStyle} inputMode="decimal" value={passThreshold} onChange={(event) => setPassThreshold(event.target.value)} />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1.5 block text-sm font-bold">Arrondi des moyennes</span>
                <select className={fieldClass} style={fieldStyle} value={roundingRule} onChange={(event) => setRoundingRule(event.target.value as RoundingRule)}>
                  <option value="none">Aucun</option>
                  <option value="tenth">Au dixième</option>
                  <option value="half">Au demi-point</option>
                  <option value="integer">À l’entier</option>
                </select>
              </label>
            </>
          )}

          <label>
            <span className="mb-1.5 block text-sm font-bold">Date de l’évaluation</span>
            <input type="date" className={fieldClass} style={fieldStyle} value={evaluationDate} onChange={(event) => setEvaluationDate(event.target.value)} />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-bold">Date limite de saisie</span>
            <input type="date" className={fieldClass} style={fieldStyle} value={entryDeadline} min={evaluationDate} onChange={(event) => setEntryDeadline(event.target.value)} />
          </label>
        </div>

        <div className="mt-2">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">Groupes concernés *</h3>
              <p className="ap-muted text-xs">Les doublons entre groupes seront fusionnés.</p>
            </div>
            <span className="ap-pill text-xs">{selectedGroupIds.length} sélectionné{selectedGroupIds.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="mb-3 flex gap-2">
            <input
              className={fieldClass}
              style={fieldStyle}
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") void handleCreateGroup(); }}
              placeholder="Créer un nouveau groupe"
            />
            <Button type="button" variant="outline" loading={busy} disabled={!newGroupName.trim()} onClick={() => void handleCreateGroup()}>
              <Plus />
              Créer
            </Button>
          </div>

          {groups.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center" style={{ borderColor: "var(--ap-line)" }}>
              <UsersRound className="mx-auto mb-2 h-7 w-7" style={{ color: "var(--ap-brand)" }} />
              <p className="text-sm font-bold">Créez un groupe pour continuer</p>
            </div>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border p-2" style={{ borderColor: "var(--ap-line)" }}>
              {groups.map((group) => {
                const selected = selectedGroupIds.includes(group.id);
                const groupMembers = members[group.id] ?? [];
                return (
                  <div key={group.id} className="rounded-md border" style={{ borderColor: "var(--ap-line)" }}>
                    <div className="flex items-center gap-3 p-3">
                      <Checkbox
                        checked={selected}
                        onCheckedChange={(checked) => setSelectedGroupIds((current) => (
                          checked
                            ? Array.from(new Set([...current, group.id]))
                            : current.filter((id) => id !== group.id)
                        ))}
                      />
                      <UsersRound className="h-4 w-4" />
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">{group.name}</span>
                      <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm" onClick={() => toggleMembers(group.id)}>
                        Membres
                        {expandedGroupId === group.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                    {expandedGroupId === group.id && (
                      <div className="border-t p-3" style={{ borderColor: "var(--ap-line)" }}>
                        <PersonPicker
                          onPickUsername={(match) => void addMember(group.id, match)}
                          onInviteEmail={(email) => void inviteMember(group.id, email)}
                        />
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {groupMembers.length === 0 ? (
                            <span className="ap-muted text-xs">Aucun membre pour le moment.</span>
                          ) : groupMembers.map((member) => (
                            <span key={member.id} className="ap-pill text-xs">
                              {member.user_id ? `@${usernames[member.user_id] ?? "membre"}` : member.pending_email}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="button" loading={busy} disabled={!name.trim() || selectedGroupIds.length === 0} onClick={() => void handleCreate()}>
            Créer l’évaluation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
