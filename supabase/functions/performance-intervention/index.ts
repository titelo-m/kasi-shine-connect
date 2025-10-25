import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { student_id, subject, new_grade, previous_grade } = await req.json();
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch student profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', student_id)
      .single();

    // Fetch study materials for this subject
    const { data: studyMaterials } = await supabase
      .from('support_resources')
      .select('*')
      .eq('resource_type', 'tutoring')
      .limit(3);

    // Fetch mentors for this subject
    const { data: mentors } = await supabase
      .from('mentors')
      .select('*')
      .eq('available', true)
      .limit(3);

    // Determine if intervention is needed
    const isLowGrade = new_grade < 50;
    const gradeDropped = previous_grade && new_grade < previous_grade - 10;
    const isFirstAssessment = !previous_grade;

    if (!isLowGrade && !gradeDropped) {
      return new Response(
        JSON.stringify({ 
          intervention_triggered: false,
          reason: 'Grades satisfactory'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build context for AI
    const performanceContext = `
STUDENT PERFORMANCE UPDATE:
- Student: ${profile?.full_name}
- Grade Level: ${profile?.grade}
- Subject: ${subject}
- New Grade: ${new_grade}%
- Previous Grade: ${previous_grade || 'First assessment'}
- Status: ${isFirstAssessment ? 'First Low Grade' : isLowGrade ? 'Low Grade' : 'Grade Drop'}

AVAILABLE HELP:
TUTORS:
${mentors?.map((mentor: any) => 
  `- ${mentor.name} (${mentor.expertise}): ${mentor.contact_info}`
).join('\n') || 'No tutors available'}

RESOURCES:
${studyMaterials?.map((resource: any) => 
  `- ${resource.name}: ${resource.description} - ${resource.contact_info}`
).join('\n') || 'No resources available'}
`;

    // AI system prompt
    const systemPrompt = `You are an AI academic counselor for MindYaMsanzi. A student's performance needs intervention.

STUDENT SITUATION:
${performanceContext}

RESPONSE STRUCTURE:
1. Start with empathetic concern about the ${subject} grade
2. Ask what challenges they're facing with ${subject}
3. Recommend specific study resources mentioned above
4. Suggest contacting the available tutors
5. End with encouragement

Be warm, understanding, and focus on practical help.`;

    // Get OpenRouter API key
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    
    if (!OPENROUTER_API_KEY) {
      throw new Error('Missing OpenRouter API key');
    }

    // Call OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "tngtech/deepseek-r1t2-chimera:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Student got ${new_grade}% in ${subject}. ${isFirstAssessment ? 'This is their first assessment.' : `Previous was ${previous_grade}%.`}` }
        ],
        max_tokens: 600,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const aiMessage = data.choices[0].message.content;

    // Store the intervention message
    const chatId = `intervention_${Date.now()}_${student_id}`;
    
    await supabase
      .from('chat_messages')
      .insert([
        {
          student_id: student_id,
          role: 'assistant',
          content: aiMessage,
          metadata: {
            trigger: 'performance_intervention',
            subject: subject,
            grade: new_grade,
            previous_grade: previous_grade
          }
        }
      ]);

    return new Response(
      JSON.stringify({ 
        intervention_triggered: true,
        message: aiMessage,
        subject: subject,
        chat_id: chatId
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in performance-intervention:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        intervention_triggered: false
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});