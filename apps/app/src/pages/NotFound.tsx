import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { marketingUrl } from "@/lib/marketingOrigin";

const NotFound = () => (
  <AppLayout>
    <section className="mx-auto grid min-h-[65dvh] w-full max-w-2xl place-items-center px-6 py-20 text-center">
      <div>
        <p className="mb-5 font-mono text-sm font-semibold tabular-nums text-muted-foreground">
          Erreur 404
        </p>
        <h1 className="text-balance font-display text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          Cette page n’existe pas
        </h1>
        <p className="mx-auto mt-4 max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
          Le lien est peut-être obsolète. Revenez à l’accueil pour poursuivre votre navigation.
        </p>
        <Button asChild className="mt-8">
          <a href={marketingUrl("/")}>Retour à l’accueil</a>
        </Button>
      </div>
    </section>
  </AppLayout>
);

export default NotFound;
