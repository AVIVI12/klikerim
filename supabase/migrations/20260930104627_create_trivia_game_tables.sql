/*
# יצירת טבלאות למערכת משחק טריוויה עם IVR

1. טבלאות חדשות:
- `games` - משחקים: כל משחק מכיל שאלות, קוד כניסה, סטטוס
- `questions` - שאלות: טקסט שאלה, סוג (trivia/survey), תשואות אפשריות, תשובה נכונה, מספר ספרות IVR
- `players` - שחקנים: מזוהים לפי טלפון או שם, מחוברים למשחק
- `answers` - תשובות: תשובת שחקן לשאלה, זמן תגובה
- `ivr_settings` - הגדרות IVR: מספר מערכת ימות המשיח, סיסמה, קוד גישה, הודעות קוליות

2. אבטחה:
- RLS מופעל על כל הטבלאות
- מאחר ואין מסך התחברות, כל הטבלאות פתוחות ל-anon ו-authenticated (משחק ציבורי)
*/

-- טבלת משחקים
CREATE TABLE IF NOT EXISTS games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  join_code text NOT NULL,
  status text NOT NULL DEFAULT 'lobby',
  current_question_index int NOT NULL DEFAULT 0,
  question_time_seconds int NOT NULL DEFAULT 30,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_games" ON games;
CREATE POLICY "anon_select_games" ON games FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_games" ON games;
CREATE POLICY "anon_insert_games" ON games FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_games" ON games;
CREATE POLICY "anon_update_games" ON games FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_games" ON games;
CREATE POLICY "anon_delete_games" ON games FOR DELETE
  TO anon, authenticated USING (true);

-- טבלת שאלות
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'trivia',
  text text NOT NULL,
  answer_1 text,
  answer_2 text,
  answer_3 text,
  answer_4 text,
  correct_answer int,
  timer_seconds int NOT NULL DEFAULT 30,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_questions" ON questions;
CREATE POLICY "anon_select_questions" ON questions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_questions" ON questions;
CREATE POLICY "anon_insert_questions" ON questions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_questions" ON questions;
CREATE POLICY "anon_update_questions" ON questions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_questions" ON questions;
CREATE POLICY "anon_delete_questions" ON questions FOR DELETE
  TO anon, authenticated USING (true);

-- טבלת שחקנים
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  phone text,
  name text,
  score int NOT NULL DEFAULT 0,
  connected boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, phone)
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_players" ON players;
CREATE POLICY "anon_select_players" ON players FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_players" ON players;
CREATE POLICY "anon_insert_players" ON players FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_players" ON players;
CREATE POLICY "anon_update_players" ON players FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_players" ON players;
CREATE POLICY "anon_delete_players" ON players FOR DELETE
  TO anon, authenticated USING (true);

-- טבלת תשובות
CREATE TABLE IF NOT EXISTS answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  answer_value int NOT NULL,
  response_time_ms int,
  is_correct boolean,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_answers" ON answers;
CREATE POLICY "anon_select_answers" ON answers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_answers" ON answers;
CREATE POLICY "anon_insert_answers" ON answers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_answers" ON answers;
CREATE POLICY "anon_update_answers" ON answers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_answers" ON answers;
CREATE POLICY "anon_delete_answers" ON answers FOR DELETE
  TO anon, authenticated USING (true);

-- טבלת הגדרות IVR
CREATE TABLE IF NOT EXISTS ivr_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  yemot_username text,
  yemot_password text,
  yemot_phone text,
  access_code text,
  welcome_message text NOT NULL DEFAULT 'ברוכים הבאים למשחק הטריוויה. אנא הקישו את קוד המשחק וסולמית',
  question_intro_message text NOT NULL DEFAULT 'שאלה חדשה, אנא הקישו את התשובה הנכונה',
  correct_message text NOT NULL DEFAULT 'תשובה נכונה',
  wrong_message text NOT NULL DEFAULT 'תשובה שגויה',
  thank_you_message text NOT NULL DEFAULT 'תודה על השתתפותכם',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ivr_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ivr_settings" ON ivr_settings;
CREATE POLICY "anon_select_ivr_settings" ON ivr_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_ivr_settings" ON ivr_settings;
CREATE POLICY "anon_insert_ivr_settings" ON ivr_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_ivr_settings" ON ivr_settings;
CREATE POLICY "anon_update_ivr_settings" ON ivr_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_ivr_settings" ON ivr_settings;
CREATE POLICY "anon_delete_ivr_settings" ON ivr_settings FOR DELETE
  TO anon, authenticated USING (true);

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_questions_game_id ON questions(game_id);
CREATE INDEX IF NOT EXISTS idx_players_game_id ON players(game_id);
CREATE INDEX IF NOT EXISTS idx_answers_game_id ON answers(game_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_player_id ON answers(player_id);
CREATE INDEX IF NOT EXISTS idx_games_join_code ON games(join_code);
CREATE INDEX IF NOT EXISTS idx_ivr_settings_game_id ON ivr_settings(game_id);
