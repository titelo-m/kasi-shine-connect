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
    // Parse body. Allow unauthenticated callers by accepting an optional student_id in the request body.
    const body = await req.json().catch(() => ({}));
    const messages = Array.isArray(body?.messages) ? body.messages : null;
    const providedStudentId = body?.student_id ?? null;

    if (!messages) {
      return new Response(JSON.stringify({ error: 'Missing messages array in body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Initialize Supabase client if environment variables are present.
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    let supabase: any = null;
    if (supabaseUrl && supabaseKey) {
      supabase = createClient(supabaseUrl, supabaseKey);
    } else {
      console.warn('Supabase env vars not set; DB inserts will be skipped.');
    }

    // Note: authentication requirement has been disabled. If a student id is provided in the request body
    // it will be used for storing chat messages; otherwise messages will be stored with a null student_id.

    // Simple system prompt for regular chat
    const systemPrompt = `You are an AI counselor for MindYaMsanzi, a support platform for South African township students. 
Be empathetic, encouraging, and provide practical advice. Focus on academic support, emotional well-being, and connecting students to resources.`;

    // Get OpenRouter API key
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    
    if (!OPENROUTER_API_KEY) {
      throw new Error('Missing OpenRouter API key');
    }

    // Call OpenRouter API with timeout and correct host
    const controller = new AbortController();
    const timeoutMs = 15000; // 15s
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch('https://api.openrouter.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "tngtech/deepseek-r1t2-chimera:free",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
        console.error('OpenRouter request timed out after', timeoutMs, 'ms');
        return new Response(JSON.stringify({ error: 'AI provider timeout' }), { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      console.error('OpenRouter fetch failed', fetchErr);
      return new Response(JSON.stringify({ error: 'AI provider fetch failed' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('OpenRouter API error', response.status, text);
      return new Response(JSON.stringify({ error: `AI provider error ${response.status}` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json().catch(() => null);
    const aiMessage = data?.choices?.[0]?.message?.content ?? data?.message ?? JSON.stringify(data).slice(0,2000);

  // Generate chat ID (use provided student id when available)
  const chatId = `chat_${Date.now()}_${providedStudentId ?? 'anon'}`;

    // Store messages in database if supabase client is available
    if (supabase) {
      try {
        await supabase
          .from('chat_messages')
          .insert([
            {
              student_id: providedStudentId,
              role: 'user',
              content: messages[messages.length - 1].content,
            },
            {
              student_id: providedStudentId,
              role: 'assistant',
              content: aiMessage,
            }
          ]);
      } catch (dbErr) {
        console.error('Failed to insert chat messages:', dbErr);
        // don't fail the whole request; just log the failure
      }
    } else {
      console.info('Skipping DB insert because Supabase env vars are not configured');
    }

    return new Response(
      JSON.stringify({ 
        message: aiMessage,
        chat_id: chatId
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in ai-chat function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Sorry, I encountered an error. Please try again in a moment.',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});