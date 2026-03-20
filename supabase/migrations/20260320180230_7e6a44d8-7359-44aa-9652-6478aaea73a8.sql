
CREATE TABLE public.x_bot_settings (
  id text PRIMARY KEY DEFAULT 'global',
  is_paused boolean NOT NULL DEFAULT false,
  paused_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.x_bot_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.x_bot_settings (id, is_paused) VALUES ('global', false);
