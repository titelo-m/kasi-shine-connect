import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const processIncomingState = useCallback(async () => {
    try {
      const state = (location && (location.state as Record<string, unknown>)) || {};
      const marksMessage = state?.marksMessage as string | undefined;
      const analysisText = state?.analysis as string | null | undefined;
      const fromPerformance = Boolean(state?.fromPerformance);

      if (!fromPerformance || !marksMessage) return;

      // Append to UI and persist to DB
      const userMessage: Message = { role: 'user', content: marksMessage };
      const assistantMessage: Message = { role: 'assistant', content: analysisText || 'Analysis available.' };

      // Do NOT show the student's marks message in the UI (they shouldn't see their own raw marks dump).
      // Only show the assistant reply. Avoid duplicating the assistant message if it's already present.
      setMessages(prev => {
        const hasAssistant = prev.some(m => m.role === 'assistant' && m.content === assistantMessage.content);
        return hasAssistant ? prev : [...prev, assistantMessage];
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const userId = (user.id || '').split(':')[0];

      // Insert messages if they don't already exist to make this idempotent.
      try {
          // Fetch recent messages for the user and do a client-side substring check to avoid SQL wildcard issues
          const { data: recentUserMsgs, error: recentErr } = await supabase
            .from('chat_messages')
            .select('id, role, content')
            .eq('student_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);

          if (recentErr) {
            console.warn('Could not fetch recent messages for idempotency check:', recentErr);
          }

          const recent = Array.isArray(recentUserMsgs) ? (recentUserMsgs as Array<{ id?: string; role?: string; content?: string }>) : [];
          const hasSimilarUser = recent.some(r => r.role === 'user' && typeof r.content === 'string' && r.content.includes(userMessage.content));
          if (!hasSimilarUser) {
            await supabase.from('chat_messages').insert([
              { student_id: userId, role: 'user', content: userMessage.content }
            ]);
          }
          const hasSimilarAssistant = recent.some(r => r.role === 'assistant' && typeof r.content === 'string' && r.content === assistantMessage.content);
          if (!hasSimilarAssistant) {
            await supabase.from('chat_messages').insert([
              { student_id: userId, role: 'assistant', content: assistantMessage.content }
            ]);
          }
      } catch (dbErr) {
        console.error('Error inserting performance messages:', dbErr);
      }

      // clear navigation state so we don't re-run
      try {
        navigate(location.pathname, { replace: true, state: {} });
      } catch (e) {
        // ignore
      }
    } catch (err) {
      console.error('processIncomingState error:', err);
    }
  }, [location, navigate]);

  const loadChatHistory = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Sanitize user id (some auth tokens include suffix like ':1')
    const userId = (user?.id || '').split(':')[0];

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('student_id', userId)
      .order('created_at', { ascending: true })
      .limit(20);

    if (error) {
      console.error('Error loading chat history:', error);
      return;
    }

    let mapped = data.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));

    // If we were navigated from Performance with a marksMessage, hide that user message from the student's view.
    const navMarks = (location && (location.state as Record<string, unknown>)?.marksMessage) as string | undefined;
    if (navMarks) {
      mapped = mapped.filter(m => !(m.role === 'user' && m.content === navMarks));
    }

    setMessages(mapped);

    // after loading history, process any incoming navigation state from Performance
    processIncomingState();
  }, [processIncomingState, location]);

  // run loadChatHistory on mount
  useEffect(() => {
    loadChatHistory();
  }, [loadChatHistory]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const payload = { messages: [...messages, userMessage] };
      console.log('[ChatInterface] invoking ai-chat function with payload:', payload);

      try {
        const { data, error } = await supabase.functions.invoke('ai-chat', {
          body: payload,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        console.log('[ChatInterface] functions.invoke response:', { data, error });

        if (error) throw error;

        const assistantMessage: Message = {
          role: 'assistant',
          content: data?.message ?? data?.response ?? JSON.stringify(data)
        };

        setMessages(prev => [...prev, assistantMessage]);
      } catch (fnErr) {
        // Functions call failed — log details and attempt local fallback to HTTP /chat
        console.warn('[ChatInterface] Functions call failed (will try fallback):', fnErr);

        // Fallback: try local backend at 127.0.0.1:5000/chat (dev convenience)
        try {
          console.log('[ChatInterface] attempting fallback to /chat with message:', userMessage.content);
          const fallbackRes = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userMessage.content }),
          });

          const text = await fallbackRes.text();
          console.log('[ChatInterface] fallback raw response:', fallbackRes.status, text);

          if (!fallbackRes.ok) throw new Error(`Fallback server responded ${fallbackRes.status}: ${text}`);

          let parsed: Record<string, unknown> | null = null;
          try { parsed = JSON.parse(text); } catch (e) { parsed = null; }

          const assistantContent = parsed && (parsed['response'] ?? parsed['message']) ? (parsed['response'] ?? parsed['message']) : text;
          const assistantMessage: Message = { role: 'assistant', content: assistantContent };
          setMessages(prev => [...prev, assistantMessage]);
        } catch (fbErr) {
          console.error('[ChatInterface] fallback error:', fbErr);
          const fbErrMsg = fbErr instanceof Error ? fbErr.message : String(fbErr);
          toast({ title: 'Fallback error', description: fbErrMsg, variant: 'destructive' });
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      const msg = error instanceof Error ? error.message : String(error);
      toast({ title: "Error", description: msg || "Failed to send message", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Card className="flex flex-col h-[600px] bg-gradient-to-br from-card to-card/80 border-primary/20">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <Bot className="w-6 h-6 text-primary" />
        <h3 className="font-bold text-lg">AI Support Chat</h3>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <Bot className="w-12 h-12 mx-auto mb-4 text-primary/50" />
              <p className="text-sm">
                Hey! I'm here to help you with your studies, connect you with mentors, and support you.
                How are you doing today?
              </p>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
              )}
              
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-secondary" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Bot className="w-5 h-5 text-primary animate-pulse" />
              </div>
              <div className="bg-muted p-3 rounded-lg">
                  <div className="flex gap-1">
                  <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce dot-delay-0" />
                  <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce dot-delay-150" />
                  <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce dot-delay-300" />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={loading}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-primary hover:bg-primary/90"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default ChatInterface;
