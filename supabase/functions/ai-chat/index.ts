import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatMessage {
  role: string;
  content: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Fetch student profile and recent performance
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const { data: recentPerformance } = await supabase
      .from('performance_records')
      .select('*')
      .eq('student_id', user.id)
      .order('recorded_at', { ascending: false })
      .limit(5);

    // Fetch available mentors in student's municipality
    const { data: mentors } = await supabase
      .from('mentors')
      .select('*')
      .eq('municipality', profile?.municipality || 'Nkangala')
      .eq('available', true)
      .limit(3);

    // Fetch support resources
    const { data: resources } = await supabase
      .from('support_resources')
      .select('*')
      .eq('municipality', profile?.municipality || 'Nkangala')
      .eq('available', true);

    // Build context for AI
    const studentContext = `
Student Profile:
- Name: ${profile?.full_name}
- Location: ${profile?.location}, ${profile?.municipality}
- Grade: ${profile?.grade}
- School: ${profile?.school_name}

Recent Performance:
${recentPerformance?.map(r => `- ${r.subject}: ${r.score}% (Attendance: ${r.attendance_percentage || 'N/A'}%)`).join('\n') || 'No recent records'}

Available Local Mentors:
${mentors?.map(m => `- ${m.name} (${m.expertise}) - ${m.location}`).join('\n') || 'No mentors available'}

Support Resources:
${resources?.map(r => `- ${r.name} (${r.resource_type}): ${r.description}`).join('\n') || 'No resources available'}
`;

    const systemPrompt = `You are an AI counselor for MindYaMsanzi, a support platform for township students in Mpumalanga, South Africa. Your role is to:

1. Listen to students' concerns with empathy and cultural awareness
2. Analyze performance patterns and identify early warning signs
3. Connect students to relevant local support (mentors, tutoring, counseling)
4. Provide practical, context-aware guidance that respects kasi reality
5. Be encouraging but honest about challenges

Current Student Context:
${studentContext}

Key Guidelines:
- Use language that resonates with township youth (respectful but relatable)
- Reference specific local resources when recommending help
- If you notice performance drops, ask about home situation, safety, mental health
- Suggest specific mentors by name when relevant
- Be hopeful but practical about solutions
- Never be generic - use the student's actual data and location

Respond conversationally and supportively.`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;

    // Store messages in database
    await supabase.from('chat_messages').insert([
      { student_id: user.id, role: 'user', content: messages[messages.length - 1].content },
      { student_id: user.id, role: 'assistant', content: assistantMessage }
    ]);

    return new Response(
      JSON.stringify({ message: assistantMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in ai-chat function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
