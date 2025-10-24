import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, Mail, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Mentor {
  id: string;
  name: string;
  expertise: string;
  bio: string | null;
  location: string;
  municipality: string | null;
  contact_info: string | null;
  available: boolean;
}

const Mentors = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState('');

  useEffect(() => {
    checkAuth();
    fetchMentors();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('location, municipality')
      .eq('id', user.id)
      .single();

    if (profile) {
      setUserLocation(profile.municipality || profile.location);
    }
  };

  const fetchMentors = async () => {
    try {
      const { data, error } = await supabase
        .from('mentors')
        .select('*')
        .eq('available', true)
        .order('name');

      if (error) throw error;
      setMentors(data || []);
    } catch (error) {
      console.error('Error fetching mentors:', error);
      toast({
        title: 'Error',
        description: 'Failed to load mentors',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const mentorsByLocation = mentors.filter(m => 
    userLocation && (m.municipality === userLocation || m.location.includes(userLocation))
  );
  const otherMentors = mentors.filter(m => 
    !userLocation || (m.municipality !== userLocation && !m.location.includes(userLocation))
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Find Mentors
              </h1>
              <p className="text-sm text-muted-foreground">Connect with experienced mentors in your area</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {loading ? (
          <p className="text-muted-foreground">Loading mentors...</p>
        ) : (
          <>
            {mentorsByLocation.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Mentors Near You</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mentorsByLocation.map((mentor) => (
                    <Card key={mentor.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2">
                              <User className="w-5 h-5" />
                              {mentor.name}
                            </CardTitle>
                            <Badge variant="secondary">{mentor.expertise}</Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {mentor.bio && (
                          <p className="text-sm text-muted-foreground">{mentor.bio}</p>
                        )}
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="w-4 h-4" />
                            <span>{mentor.municipality || mentor.location}</span>
                          </div>
                          {mentor.contact_info && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Mail className="w-4 h-4" />
                              <span>{mentor.contact_info}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {otherMentors.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Other Mentors</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {otherMentors.map((mentor) => (
                    <Card key={mentor.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2">
                              <User className="w-5 h-5" />
                              {mentor.name}
                            </CardTitle>
                            <Badge variant="secondary">{mentor.expertise}</Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {mentor.bio && (
                          <p className="text-sm text-muted-foreground">{mentor.bio}</p>
                        )}
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="w-4 h-4" />
                            <span>{mentor.municipality || mentor.location}</span>
                          </div>
                          {mentor.contact_info && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Mail className="w-4 h-4" />
                              <span>{mentor.contact_info}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {mentors.length === 0 && (
              <Card>
                <CardContent className="py-8">
                  <p className="text-center text-muted-foreground">No mentors available at the moment.</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Mentors;
