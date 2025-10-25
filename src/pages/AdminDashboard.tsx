import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption } from '@/components/ui/table';
import { Download, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type RecordRow = {
  id: string;
  student_id: string;
  subject: string;
  score: number;
  attendance_percentage: number | null;
  notes: string | null;
  recorded_at: string;
  student_name?: string | null;
  student_grade?: number | null;
};

const AdminDashboard = () => {
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const { toast } = useToast();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: recErr } = await supabase
        .from('performance_records')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(1000);
      if (recErr) throw recErr;
      const records = (data || []) as Array<Record<string, unknown>>;
      if (records.length === 0) {
        setRows([]);
        return;
      }

      // collect unique student ids
      const studentIds = Array.from(new Set(records.map((r) => String(r['student_id'] || '')))).filter(Boolean);

      // fetch profiles for these students
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, grade')
        .in('id', studentIds);

      const profiles = (profilesData || []) as Array<Record<string, unknown>>;

      const profileMap = profiles.reduce<Record<string, { full_name: string; grade: number | null }>>((acc, p) => {
        const id = String(p['id'] || '');
        acc[id] = { full_name: String(p['full_name'] || ''), grade: p['grade'] == null ? null : Number(p['grade']) };
        return acc;
      }, {});

      const mapped: RecordRow[] = records.map((r) => ({
        id: String(r['id'] || ''),
        student_id: String(r['student_id'] || ''),
        subject: String(r['subject'] || ''),
        score: Number(r['score'] || 0),
        attendance_percentage: r['attendance_percentage'] == null ? null : Number(r['attendance_percentage']),
        notes: r['notes'] == null ? null : String(r['notes']),
        recorded_at: String(r['recorded_at'] || new Date().toISOString()),
        student_name: profileMap[String(r['student_id'] || '')]?.full_name ?? null,
        student_grade: profileMap[String(r['student_id'] || '')]?.grade ?? null,
      }));

      setRows(mapped);
    } catch (error) {
      console.error('Failed to load performance records for admin:', error);
      toast({ title: 'Error', description: 'Failed to load records', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      (r.student_name || r.student_id || '').toLowerCase().includes(q) ||
      (r.subject || '').toLowerCase().includes(q) ||
      (r.notes || '').toLowerCase().includes(q)
    );
  }, [rows, query]);

  const exportCsv = () => {
    if (rows.length === 0) {
      toast({ title: 'No data', description: 'Nothing to export' });
      return;
    }

    const header = ['student_id', 'student_name', 'grade', 'subject', 'score', 'attendance', 'recorded_at', 'notes'];
    const lines = [header.join(',')];
    for (const r of rows) {
      const vals = [
        `"${r.student_id}"`,
        `"${(r.student_name || '').replace(/"/g, '""')}"`,
        r.student_grade ?? '',
        `"${r.subject.replace(/"/g, '""')}"`,
        r.score,
        r.attendance_percentage ?? '',
        `"${r.recorded_at}"`,
        `"${(r.notes || '').replace(/"/g, '""')}"`,
      ];
      lines.push(vals.join(','));
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance_export_${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Admin — Student Performance</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search by student, subject or notes" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                <Button onClick={exportCsv} className="ml-2">
                  <Download className="w-4 h-4 mr-2" /> Export CSV
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Attendance</TableHead>
                    <TableHead>Recorded</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6}>Loading...</TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>No records found.</TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="text-sm font-medium">{r.student_name ?? r.student_id}</div>
                          {r.student_grade != null && <div className="text-xs text-muted-foreground">Grade {r.student_grade}</div>}
                        </TableCell>
                        <TableCell>{r.subject}</TableCell>
                        <TableCell>{r.score}%</TableCell>
                        <TableCell>{r.attendance_percentage != null ? `${r.attendance_percentage}%` : '—'}</TableCell>
                        <TableCell>{new Date(r.recorded_at).toLocaleString()}</TableCell>
                        <TableCell className="max-w-md whitespace-pre-wrap">{r.notes || '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
