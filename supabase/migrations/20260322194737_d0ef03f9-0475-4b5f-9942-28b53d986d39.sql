
CREATE TABLE public.ai_collab_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  initial_task TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  current_round INTEGER NOT NULL DEFAULT 0,
  max_rounds INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_collab_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.ai_collab_sessions(id) ON DELETE CASCADE NOT NULL,
  round_number INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL, -- 'user', 'gemini_pro', 'gpt5', 'gemini_flash', 'system'
  message_type TEXT NOT NULL DEFAULT 'idea', -- 'idea', 'review', 'comment', 'task', 'final'
  content TEXT NOT NULL,
  target_role TEXT, -- which AI's idea is being reviewed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_collab_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_collab_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to ai_collab_sessions" ON public.ai_collab_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to ai_collab_messages" ON public.ai_collab_messages FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_ai_collab_messages_session ON public.ai_collab_messages(session_id, round_number);
