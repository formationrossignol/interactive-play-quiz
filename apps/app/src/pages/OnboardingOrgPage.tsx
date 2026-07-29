import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showError } from "@/lib/errorTaxonomy";
import { createOrganization, slugify } from "@/lib/org/orgRepo";

export default function OnboardingOrgPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setBusy(true);
    try {
      await createOrganization(name.trim(), slug.trim());
      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof Error && err.message.includes("slug_taken")) {
        toast.error("Cet identifiant est déjà utilisé, essayez-en un autre.");
      } else {
        showError(err);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-semibold">Créez votre établissement</h1>
        <p className="text-sm text-muted-foreground">
          Vous deviendrez administrateur de cet espace.
        </p>
        <div className="space-y-2">
          <Label htmlFor="org-name">Nom de l'établissement</Label>
          <Input
            id="org-name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Lycée Victor Hugo"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-slug">Identifiant</Label>
          <Input
            id="org-slug"
            value={slug}
            onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
            required
          />
        </div>
        <Button type="submit" loading={busy} className="w-full">
          Créer l'établissement
        </Button>
      </form>
    </div>
  );
}
