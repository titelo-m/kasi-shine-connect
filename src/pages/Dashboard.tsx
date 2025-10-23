import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ChatInterface from '@/components/ChatInterface';
import { LogOut, User, MapPin, GraduationCap, BookOpen, Users, Heart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Dashboard = () => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate('/auth');
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
    } else {
      setProfile(data);
    }
    
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged out",
      description: "See you soon!",
    });
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                MindYaMsanzi
              </h1>
              <p className="text-sm text-muted-foreground">Your mind, your hustle, your future</p>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="gap-2 border-primary/30 hover:bg-primary/10"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Profile Section */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-gradient-to-br from-card to-card/80 border-primary/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <User className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle>{profile?.full_name}</CardTitle>
                    <CardDescription>Student Profile</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">{profile?.location}</p>
                    <p className="text-muted-foreground">{profile?.municipality}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <GraduationCap className="w-5 h-5 text-secondary" />
                  <div>
                    <p className="font-medium">Grade {profile?.grade}</p>
                    <p className="text-muted-foreground">{profile?.school_name}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-gradient-to-br from-card to-card/80 border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-3 hover:bg-primary/10 border-primary/30"
                  onClick={() => toast({ title: "Coming soon!", description: "Performance tracking feature" })}
                >
                  <BookOpen className="w-5 h-5 text-primary" />
                  Track Performance
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-3 hover:bg-secondary/10 border-secondary/30"
                  onClick={() => toast({ title: "Coming soon!", description: "Find mentors feature" })}
                >
                  <Users className="w-5 h-5 text-secondary" />
                  Find Mentors
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-3 hover:bg-accent/10 border-accent/30"
                  onClick={() => toast({ title: "Coming soon!", description: "Get support feature" })}
                >
                  <Heart className="w-5 h-5 text-accent" />
                  Get Support
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Chat Section */}
          <div className="lg:col-span-2">
            <ChatInterface />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
