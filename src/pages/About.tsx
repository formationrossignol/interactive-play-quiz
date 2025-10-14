import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Users, Target, Heart } from "lucide-react";

const About = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold text-foreground mb-4">À propos de QuizMaster</h1>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              QuizMaster est né de la volonté de transformer l'apprentissage et l'engagement 
              en expériences interactives et mémorables.
            </p>
          </div>

          <div className="mb-16">
            <Card>
              <CardContent className="pt-6">
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Nous croyons que l'apprentissage et l'engagement doivent être dynamiques, 
                  collaboratifs et amusants. C'est pourquoi nous avons créé QuizMaster, 
                  une plateforme tout-en-un qui permet aux éducateurs, formateurs et animateurs 
                  de concevoir des expériences interactives captivantes.
                </p>
                <p className="text-lg text-muted-foreground leading-relaxed mt-4">
                  Que vous organisiez un quiz en classe, un sondage en entreprise ou des 
                  flashcards pour réviser, QuizMaster vous offre tous les outils nécessaires 
                  pour captiver votre audience et mesurer l'impact en temps réel.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mb-12">
            <h2 className="text-3xl font-bold text-foreground text-center mb-8">Nos valeurs</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Zap className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle>Innovation</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Nous innovons constamment pour offrir des expériences toujours plus 
                    engageantes et intuitives.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle>Collaboration</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Nous facilitons le travail d'équipe et encourageons le partage 
                    de connaissances.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Target className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle>Simplicité</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Des outils puissants mais simples d'utilisation, accessibles à tous.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Heart className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle>Passion</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Nous aimons ce que nous faisons et nous nous investissons pleinement 
                    pour votre succès.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="text-center">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Rejoignez la communauté QuizMaster</CardTitle>
                <CardDescription className="text-base">
                  Des milliers d'éducateurs, formateurs et animateurs utilisent déjà QuizMaster 
                  pour créer des expériences inoubliables. Et vous ?
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default About;
