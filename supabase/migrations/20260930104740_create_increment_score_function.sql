/*
# יצירת פונקציית RPC לעדכון ניקוד שחקן

1. פונקציות חדשות:
- `increment_player_score` - מוסיף נקודות לשחקן ומחזיר את הניקוד החדש
2. אבטחה:
- פונקציה זמינה ל-anon ו-authenticated (המערכת פתוחה ללא התחברות)
*/

CREATE OR REPLACE FUNCTION increment_player_score(player_id uuid, points int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_score int;
BEGIN
  UPDATE players SET score = score + points WHERE id = player_id RETURNING score INTO new_score;
  RETURN new_score;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_player_score TO anon, authenticated;
