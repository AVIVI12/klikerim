/*
# עדכון מערכת IVR - שלט אילם וניהול שיחות

1. שינויים בטבלאות קיימות:
- `games` - הוספת עמודה `question_active` (boolean) שמציינת אם יש שאלה פעילה כעת
2. טבלאות חדשות:
- `ivr_calls` - מעקב אחר שיחות IVR פעילות: call_id, game_id, player_id, state, counter
3. אבטחה:
- RLS על ivr_calls עם גישה ל-anon ו-authenticated
*/

-- הוספת עמודת question_active לטבלת games
ALTER TABLE games ADD COLUMN IF NOT EXISTS question_active boolean NOT NULL DEFAULT false;

-- טבלת מעקב שיחות IVR
CREATE TABLE IF NOT EXISTS ivr_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id text NOT NULL,
  game_id uuid REFERENCES games(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'new',
  counter int NOT NULL DEFAULT 0,
  answered_question_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(call_id)
);

ALTER TABLE ivr_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ivr_calls" ON ivr_calls;
CREATE POLICY "anon_select_ivr_calls" ON ivr_calls FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_ivr_calls" ON ivr_calls;
CREATE POLICY "anon_insert_ivr_calls" ON ivr_calls FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_ivr_calls" ON ivr_calls;
CREATE POLICY "anon_update_ivr_calls" ON ivr_calls FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_ivr_calls" ON ivr_calls;
CREATE POLICY "anon_delete_ivr_calls" ON ivr_calls FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_ivr_calls_call_id ON ivr_calls(call_id);
CREATE INDEX IF NOT EXISTS idx_ivr_calls_game_id ON ivr_calls(game_id);
