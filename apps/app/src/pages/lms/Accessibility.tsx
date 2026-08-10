import { useEffect, useState } from "react";
import { Accessibility as AccessibilityIcon, Plus, ShieldCheck } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PageSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { useActiveOrgId } from "@/components/org/OrgSwitcher";
import { getCurrentUser } from "@/lib/auth";
import { showError } from "@/lib/errorTaxonomy";
import { useSEO } from "@/hooks/useSEO";
import { myOrgMemberships, type OrgMembership } from "@/lib/org/orgRepo";
import {
  createAccommodationProfile,
  getEffectiveAccommodations,
  listOrgAccommodationProfiles,
  myAccessibilityPreferences,
  setAccommodationRule,
  upsertMyAccessibilityPreferences,
  type AccessibilityPreferences,
  type AccommodationProfile,
  type EffectiveAccommodation,
} from "@/lib/lms/accessibility";

const STAFF_ROLES = new Set(["registrar", "pedago", "admin"]);

function PreferencesPanel({ userId }: { userId: string }) {
  const [prefs, setPrefs] = useState<AccessibilityPreferences | null>(null);
  const [effective, setEffective] = useState<EffectiveAccommodation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([myAccessibilityPreferences(), getEffectiveAccommodations(userId)])
      .then(([p, e]) => { setPrefs(p); setEffective(e); })
      .catch(showError)
      .finally(() => setLoading(false));
  }, [userId]);

  const toggle = async (key: keyof AccessibilityPreferences, value: boolean) => {
    try {
      const updated = await upsertMyAccessibilityPreferences(userId, { [key]: value });
      setPrefs(updated);
    } catch (err) {
      showError(err);
    }
  };

  if (loading) return <TableSkeleton rows={3} cols={2} />;

  return (
    <>
      <section className="product-list-panel p-5">
        <div className="product-panel-heading -mx-5 -mt-5 mb-4">
          <div><h2>Préférences d'affichage</h2><p>Réglages personnels, non certifiés — ils ne remplacent pas un aménagement institutionnel.</p></div>
        </div>
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm">Contraste élevé</span>
            <Switch checked={prefs?.high_contrast ?? false} onCheckedChange={(v) => toggle("high_contrast", v)} />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm">Réduire les animations</span>
            <Switch checked={prefs?.reduce_motion ?? false} onCheckedChange={(v) => toggle("reduce_motion", v)} />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm">Lecture à voix haute</span>
            <Switch checked={prefs?.text_to_speech ?? false} onCheckedChange={(v) => toggle("text_to_speech", v)} />
          </label>
        </div>
      </section>

      <section className="product-list-panel p-5 mt-4">
        <div className="product-panel-heading -mx-5 -mt-5 mb-4">
          <div><h2>Mes aménagements actifs</h2><p>Appliqués automatiquement à vos activités ; les autres participants ne les voient jamais.</p></div>
        </div>
        {effective.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun aménagement institutionnel actif.</p>
        ) : (
          <ul className="space-y-2">
            {effective.map((e) => (
              <li key={e.rule_type} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span>{e.rule_type}</span>
                <span className="text-muted-foreground">{JSON.stringify(e.value)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function StaffAccommodations({ orgId }: { orgId: string }) {
  const [profiles, setProfiles] = useState<AccommodationProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [learnerId, setLearnerId] = useState("");
  const [creating, setCreating] = useState(false);
  const [rulePercent, setRulePercent] = useState<Record<string, string>>({});

  useEffect(() => {
    listOrgAccommodationProfiles(orgId).then(setProfiles).catch(showError).finally(() => setLoading(false));
  }, [orgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!learnerId.trim()) return;
    setCreating(true);
    try {
      const profile = await createAccommodationProfile(orgId, learnerId.trim());
      setProfiles((prev) => [profile, ...prev]);
      setLearnerId("");
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  };

  const handleSetExtraTime = async (profileId: string) => {
    const percent = Number(rulePercent[profileId]);
    if (!percent) return;
    try {
      await setAccommodationRule(profileId, "extra_time", { percent });
    } catch (err) {
      showError(err);
    }
  };

  if (loading) return <TableSkeleton rows={3} cols={2} />;

  return (
    <section className="product-list-panel p-5">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Aménagements institutionnels</h2><p>Profils par apprenant, séparés du profil public. Aucun motif médical n'est stocké.</p></div>
      </div>
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 mb-4">
        <div className="min-w-[280px] space-y-1">
          <label className="text-sm font-medium" htmlFor="learner-id">Identifiant apprenant (UUID)</label>
          <Input id="learner-id" value={learnerId} onChange={(e) => setLearnerId(e.target.value)} required />
        </div>
        <Button type="submit" size="sm" loading={creating}><Plus /> Créer un profil</Button>
      </form>
      {profiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun profil d'aménagement créé.</p>
      ) : (
        <ul className="space-y-2">
          {profiles.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
              <span>Apprenant {p.learner_id.slice(0, 8)} · {p.status}</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={200}
                  className="w-20"
                  placeholder="% temps"
                  value={rulePercent[p.id] ?? ""}
                  onChange={(e) => setRulePercent((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  aria-label="Temps supplémentaire en %"
                />
                <Button variant="ghost" size="sm" onClick={() => handleSetExtraTime(p.id)}>Appliquer</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function LmsAccessibility() {
  const user = getCurrentUser();
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrgId] = useActiveOrgId(memberships);
  useSEO({ title: "Accessibilité & aménagements", description: "Préférences d'affichage et aménagements individuels." });

  useEffect(() => {
    myOrgMemberships().then(setMemberships).catch(() => setMemberships([])).finally(() => setLoading(false));
  }, []);

  const isStaff = memberships.some((m) => m.org_id === activeOrgId && STAFF_ROLES.has(m.role));

  if (loading || !user) {
    return (
      <AppLayout subtitle="Accessibilité">
        <PageSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout subtitle="Accessibilité">
      <div className="product-page product-page--medium">
        <PageHeader
          title="Accessibilité et aménagements"
          description="Expérience inclusive et aménagements individuels confidentiels."
        />
        {isStaff && activeOrgId ? (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <ShieldCheck size={16} /> Gestion réservée au personnel autorisé (registrar/pedago/admin).
            </div>
            <StaffAccommodations orgId={activeOrgId} />
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <AccessibilityIcon size={16} /> Vos réglages restent privés.
            </div>
            <PreferencesPanel userId={user.id} />
          </>
        )}
      </div>
    </AppLayout>
  );
}
