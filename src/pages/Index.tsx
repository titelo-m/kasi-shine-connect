import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import kasiHero from '@/assets/kasi-hero.jpg';
import { ArrowRight, Brain, Users, TrendingUp } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/dashboard');
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${kasiHero})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'brightness(0.4)',
          }}
        />
        
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background z-0" />

        <div className="container mx-auto px-4 z-10 text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent animate-in fade-in slide-in-from-bottom-4 duration-1000">
            MindYaMsanzi
          </h1>
          <p className="text-xl md:text-2xl text-foreground/90 mb-4 font-medium animate-in fade-in slide-in-from-bottom-5 duration-1000 delay-200">
            Your mind, your hustle, your future.
          </p>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-300">
            AI-powered early intervention for township students. Get matched with local mentors, 
            access support resources, and build your path to success.
          </p>
          <div className="flex gap-4 justify-center animate-in fade-in slide-in-from-bottom-7 duration-1000 delay-500">
            <Button
              onClick={() => navigate('/auth')}
              size="lg"
              className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 font-bold text-lg gap-2 shadow-lg"
            >
              Get Started <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gradient-to-b from-background to-card/20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            How We Support You
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card/80 backdrop-blur-sm p-6 rounded-lg border border-primary/20 hover:border-primary/40 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center mb-4">
                <Brain className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-3">AI-Powered Insights</h3>
              <p className="text-muted-foreground">
                Our AI analyzes your performance patterns and connects you with the right support before challenges become crises.
              </p>
            </div>

            <div className="bg-card/80 backdrop-blur-sm p-6 rounded-lg border border-secondary/20 hover:border-secondary/40 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-3">Local Mentors</h3>
              <p className="text-muted-foreground">
                Get matched with mentors from your own community who understand kasi life and have walked your path.
              </p>
            </div>

            <div className="bg-card/80 backdrop-blur-sm p-6 rounded-lg border border-accent/20 hover:border-accent/40 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-accent to-accent/50 flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-3">Track Progress</h3>
              <p className="text-muted-foreground">
                Monitor your academic journey and access tutoring, counseling, and career guidance resources nearby.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-b from-card/20 to-background">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to take control of your future?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join students across Mpumalanga who are using MindYaMsanzi to overcome challenges and achieve their dreams.
          </p>
          <Button
            onClick={() => navigate('/auth')}
            size="lg"
            className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 font-bold text-lg gap-2"
          >
            Start Your Journey <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Index;
