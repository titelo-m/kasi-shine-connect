import { useEffect, useState, useCallback } from 'react';
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
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analysisMeta, setAnalysisMeta] = useState<Record<string, unknown> | null>(null);
  const [autoAnalyzed, setAutoAnalyzed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    score: '',
    attendance: '',
    notes: ''
  });

  const checkAuth = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) navigate('/auth');
  }, [navigate]);

  const fetchRecords = useCallback(async () => {
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
  }, [toast]);

  

  useEffect(() => {
    checkAuth();
    fetchRecords();
  }, [checkAuth, fetchRecords]);

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

  const analyzeMarks = useCallback(async () => {
    if (records.length === 0) {
      toast({
        title: 'No records',
        description: 'Add some performance records before analyzing',
        variant: 'destructive'
      });
      return;
    }

  console.log('[Performance] analyzeMarks: starting');
  setAnalyzing(true);
  setAnalysis(null);

    try {
      // Build a readable message for the backend from the student's records
      const lines = records.map(r =>
        `${r.subject}: ${r.score}%${r.attendance_percentage ? ` (attendance ${r.attendance_percentage}%)` : ''}`
      );

      const message = `The student got:\n${lines.join('\n')}\n\nPlease provide an encouraging analysis, highlight strengths, and suggest improvements.`;

      console.log('[Performance] analyzeMarks: payload', { message });

      const res = await fetch('https://tshify.onrender.com/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });

      console.log('[Performance] analyzeMarks: fetch completed, status=', res.status, res.statusText, res.type);

      const rawText = await res.text();
      console.log('[Performance] analyzeMarks: raw response text=', rawText);

      if (!res.ok) {
        // include raw text to help debugging
        throw new Error(`Server responded with ${res.status}: ${rawText}`);
      }

      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = JSON.parse(rawText);
      } catch (e) {
        console.warn('[Performance] analyzeMarks: response is not valid JSON, showing raw text');
        setAnalysis(rawText);
        setAnalysisMeta(null);
        parsed = null;
      }

      if (parsed) {
        // Prefer common fields: message, response
        const textField = (parsed['message'] ?? parsed['response']) as string | undefined;
        const text = typeof textField === 'string' ? textField : JSON.stringify(parsed);
        setAnalysis(text);
        // Keep the whole parsed object for structured display
        setAnalysisMeta(parsed);
        // Also persist this conversation into chat_messages so the ChatInterface can show it
        (async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const userId = (user.id || '').split(':')[0];
            // Insert the user message and assistant message into the chat_messages table
            await supabase.from('chat_messages').insert([
              { student_id: userId, role: 'user', content: message },
              { student_id: userId, role: 'assistant', content: text }
            ]);
          } catch (dbErr) {
            console.warn('[Performance] failed to persist chat messages:', dbErr);
          }
        })();
      }
    } catch (error) {
      console.error('[Performance] Analysis error:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Error',
        description: errMsg || 'Failed to analyze marks',
        variant: 'destructive'
      });
    } finally {
      setAnalyzing(false);
    }
  }, [records, toast]);

  // Auto-run analysis once records are loaded on page launch
  useEffect(() => {
    if (!loading && records.length > 0 && !autoAnalyzed) {
      console.log('[Performance] Auto-running analysis on page load: records found=', records.length);
      analyzeMarks();
      setAutoAnalyzed(true);
    }
  }, [loading, records, autoAnalyzed, analyzeMarks]);

  // Simple lightweight formatter for AI analysis text
  const renderFormattedAnalysis = (text: string) => {
    const lines = text.split(/\r?\n/);
    const elems: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trimEnd();
      // list item (markdown-like) - handles '* ', '- ', '+ '
      // detect markdown-like list items; also support unicode bullets • · and leading whitespace
      if (/^\s*([*+\-\u2022\u00B7])\s+/.test(lines[i])) {
        const items: string[] = [];
        while (i < lines.length && /^\s*([*+\-\u2022\u00B7])\s+/.test(lines[i])) {
          // remove the leading bullet marker and any surrounding whitespace
          items.push(lines[i].replace(/^\s*([*+\-\u2022\u00B7])\s+/, '').trim());
          i++;
        }
        elems.push(
          <ul className="list-disc ml-6" key={i}>
            {items.map((it, idx) => (
              <li key={idx} className="mb-1">{it}</li>
            ))}
          </ul>
        );
        continue;
      }

      // blank line -> paragraph separator
      if (line.trim() === '') {
        i++;
        continue;
      }

      // collect paragraph lines until blank or list
      const paraLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '' && !/^([*\-+])\s+/.test(lines[i].trim())) {
        paraLines.push(lines[i]);
        i++;
      }
      const paragraph = paraLines.join(' ').trim();
      elems.push(
        <p key={i} className="mb-2 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: escapeHtml(paragraph).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>') }} />
      );
    }

    return <div>{elems}</div>;
  };

  const escapeHtml = (unsafe: string) => {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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
            <div className="flex items-center gap-2">
              <Button onClick={analyzeMarks} disabled={analyzing || records.length === 0}>
                {analyzing ? 'Analyzing...' : 'Analyze Marks'}
              </Button>
              
            </div>
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

        {analysis && (
          <Card>
            <CardHeader>
              <CardTitle>AI Analysis</CardTitle>
            </CardHeader>
            <CardContent>
                      <div className="prose max-w-none">
                        {renderFormattedAnalysis(analysis)}
                      </div>
            </CardContent>
          </Card>
        )}
        
      </div>
      <div className="sticky bottom-0 z-50 bg-background/80 border-t border-border p-4">
        <div className="container mx-auto px-4">
          <div className="flex justify-end">
            <Button onClick={() => {
              // build marks message and navigate with state so chat can pick it up
              const lines = records.map(r => `${r.subject}: ${r.score}%${r.attendance_percentage ? ` (attendance ${r.attendance_percentage}%)` : ''}`);
              const marksMessage = `The student got:\n${lines.join('\n')}`;
              navigate('/dashboard', { state: { fromPerformance: true, marksMessage, analysis: analysis || null } });
            }} className="bg-primary hover:bg-primary/90">
              Go to Support Chat
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Performance;
