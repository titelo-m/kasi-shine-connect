import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, Phone, Heart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SupportResource {
  id: string;
  name: string;
  resource_type: string;
  description: string | null;
  location: string | null;
  municipality: string | null;
  contact_info: string | null;
  available: boolean;
}

const Support = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [resources, setResources] = useState<SupportResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState('');

  useEffect(() => {
    checkAuth();
    fetchResources();
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

  const fetchResources = async () => {
    try {
      const { data, error } = await supabase
        .from('support_resources')
        .select('*')
        .eq('available', true)
        .order('name');

      if (error) throw error;
      setResources(data || []);
    } catch (error) {
      console.error('Error fetching resources:', error);
      toast({
        title: 'Error',
        description: 'Failed to load support resources',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const resourcesByLocation = resources.filter(r => 
    userLocation && r.location && (r.municipality === userLocation || r.location.includes(userLocation))
  );
  const otherResources = resources.filter(r => 
    !userLocation || !r.location || (r.municipality !== userLocation && !r.location?.includes(userLocation))
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
                Get Support
              </h1>
              <p className="text-sm text-muted-foreground">Access mental health and wellness resources</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {loading ? (
          <p className="text-muted-foreground">Loading support resources...</p>
        ) : (
          <>
            {resourcesByLocation.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Resources Near You</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {resourcesByLocation.map((resource) => (
                    <Card key={resource.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2">
                              <Heart className="w-5 h-5" />
                              {resource.name}
                            </CardTitle>
                            <Badge variant="secondary">{resource.resource_type}</Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {resource.description && (
                          <p className="text-sm text-muted-foreground">{resource.description}</p>
                        )}
                        <div className="space-y-2 text-sm">
                          {resource.location && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <MapPin className="w-4 h-4" />
                              <span>{resource.municipality || resource.location}</span>
                            </div>
                          )}
                          {resource.contact_info && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Phone className="w-4 h-4" />
                              <span>{resource.contact_info}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {otherResources.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Other Resources</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {otherResources.map((resource) => (
                    <Card key={resource.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2">
                              <Heart className="w-5 h-5" />
                              {resource.name}
                            </CardTitle>
                            <Badge variant="secondary">{resource.resource_type}</Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {resource.description && (
                          <p className="text-sm text-muted-foreground">{resource.description}</p>
                        )}
                        <div className="space-y-2 text-sm">
                          {resource.location && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <MapPin className="w-4 h-4" />
                              <span>{resource.municipality || resource.location}</span>
                            </div>
                          )}
                          {resource.contact_info && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Phone className="w-4 h-4" />
                              <span>{resource.contact_info}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {resources.length === 0 && (
              <Card>
                <CardContent className="py-8">
                  <p className="text-center text-muted-foreground">No support resources available at the moment.</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Support;
