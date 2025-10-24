import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Plus, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PerformanceRecord {
  id: string;
  subject: string;
  score: number;
  attendance_percentage: number | null;
  notes: string | null;
  recorded_at: string;
}

const Performance = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [records, setRecords] = useState<PerformanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    score: '',
    attendance: '',
    notes: ''
  });

  useEffect(() => {
    checkAuth();
    fetchRecords();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) navigate('/auth');
  };

  const fetchRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('performance_records')
        .select('*')
        .order('recorded_at', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching records:', error);
      toast({
        title: 'Error',
        description: 'Failed to load performance records',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { error } = await supabase
        .from('performance_records')
        .insert({
          student_id: user.id,
          subject: formData.subject,
          score: parseFloat(formData.score),
          attendance_percentage: formData.attendance ? parseFloat(formData.attendance) : null,
          notes: formData.notes || null
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Performance record added successfully'
      });

      setFormData({ subject: '', score: '', attendance: '', notes: '' });
      setShowForm(false);
      fetchRecords();
    } catch (error) {
      console.error('Error adding record:', error);
      toast({
        title: 'Error',
        description: 'Failed to add performance record',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Track Performance
                </h1>
                <p className="text-sm text-muted-foreground">Monitor your academic progress</p>
              </div>
            </div>
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Record
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-6">
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Add Performance Record</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      placeholder="e.g., Mathematics"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="score">Score (%)</Label>
                    <Input
                      id="score"
                      type="number"
                      required
                      min="0"
                      max="100"
                      value={formData.score}
                      onChange={(e) => setFormData({ ...formData, score: e.target.value })}
                      placeholder="85"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="attendance">Attendance (%)</Label>
                    <Input
                      id="attendance"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.attendance}
                      onChange={(e) => setFormData({ ...formData, attendance: e.target.value })}
                      placeholder="95 (optional)"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes about this test or performance..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit">Save Record</Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Performance History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading records...</p>
            ) : records.length === 0 ? (
              <p className="text-muted-foreground">No performance records yet. Add your first test score above!</p>
            ) : (
              <div className="space-y-4">
                {records.map((record) => (
                  <div key={record.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <h3 className="font-semibold text-lg">{record.subject}</h3>
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          <span>Score: <span className="font-medium text-foreground">{record.score}%</span></span>
                          {record.attendance_percentage && (
                            <span>Attendance: <span className="font-medium text-foreground">{record.attendance_percentage}%</span></span>
                          )}
                        </div>
                        {record.notes && (
                          <p className="text-sm text-muted-foreground mt-2">{record.notes}</p>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(record.recorded_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Performance;
