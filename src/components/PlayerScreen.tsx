import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Game, Question, Player, Answer } from '@/lib/types';
import { ANSWER_COLORS, ANSWER_LABELS, getAnswerText, getAnswerCount } from '@/lib/types';
import { ArrowRight, Smartphone, Check, X, Clock, Trophy, Users } from 'lucide-react';

interface Props {
  onBack: () => void;
}

type Phase = 'join' | 'waiting' | 'question' | 'answered' | 'results' | 'finished';

export default function PlayerScreen({ onBack }: Props) {
  const [phase, setPhase] = useState<Phase>('join');
  const [joinCode, setJoinCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [game, setGame] = useState<Game | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [myAnswer, setMyAnswer] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);

  const joinGame = async () => {
    setError('');
    if (joinCode.length < 4) {
      setError('הקישו קוד משחק תקין');
      return;
    }

    const { data: g } = await supabase
      .from('games')
      .select('*')
      .eq('join_code', joinCode)
      .maybeSingle();

    if (!g) {
      setError('קוד משחק לא נמצא');
      return;
    }

    if (g.status === 'finished') {
      setError('המשחק הסתיים');
      return;
    }

    const { data: existing } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', g.id)
      .eq('name', playerName || undefined)
      .maybeSingle();

    let p: Player;
    if (existing) {
      const { data: updated } = await supabase
        .from('players')
        .update({ connected: true })
        .eq('id', existing.id)
        .select('*')
        .single();
      p = updated!;
    } else {
      const { data: newPlayer, error: insertErr } = await supabase
        .from('players')
        .insert({
          game_id: g.id,
          name: playerName || 'שחקן',
          connected: true,
        })
        .select('*')
        .single();
      if (insertErr || !newPlayer) {
        setError('שגיאה בהצטרפות');
        return;
      }
      p = newPlayer;
    }

    setGame(g);
    setPlayer(p);
    setPhase('waiting');
  };

  const refreshGame = useCallback(async () => {
    if (!game) return;
    const { data: g } = await supabase.from('games').select('*').eq('id', game.id).maybeSingle();
    if (g) setGame(g);

    const { data: qs } = await supabase
      .from('questions')
      .select('*')
      .eq('game_id', game.id)
      .order('position', { ascending: true });
    setQuestions(qs || []);

    const { data: p } = await supabase.from('players').select('*').eq('id', player?.id).maybeSingle();
    if (p) setPlayer(p);

    const { data: ans } = await supabase.from('answers').select('*').eq('game_id', game.id);
    setAnswers(ans || []);
  }, [game, player]);

  useEffect(() => {
    if (!game || !player) return;

    const channel = supabase
      .channel(`player-${game.id}-${player.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${game.id}` }, async (payload) => {
        const g = payload.new as Game;
        setGame(g);
        if (g.status === 'finished') {
          setPhase('finished');
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'answers', filter: `game_id=eq.${game.id}` }, async () => {
        const { data: ans } = await supabase.from('answers').select('*').eq('game_id', game.id);
        setAnswers(ans || []);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `id=eq.${player.id}` }, async (payload) => {
        const p = payload.new as Player;
        setPlayer(p);
      })
      .subscribe();

    const interval = setInterval(refreshGame, 2000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [game, player, refreshGame]);

  useEffect(() => {
    if (!game || !questions.length) return;
    const q = questions[game.current_question_index];
    if (!q) {
      if (game.status === 'finished') setPhase('finished');
      return;
    }

    const myAns = answers.find(a => a.question_id === q.id && a.player_id === player?.id);

    if (myAns) {
      setMyAnswer(myAns.answer_value);
      setPhase('answered');
    } else if (game.status === 'active') {
      setMyAnswer(null);
      setCurrentQuestion(q);
      setPhase('question');
      setTimeLeft(q.timer_seconds);
    } else {
      setPhase('waiting');
    }
  }, [game, questions, answers, player]);

  useEffect(() => {
    if (phase !== 'question') return;
    if (timeLeft <= 0) {
      setPhase('answered');
      return;
    }
    const t = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft]);

  async function submitAnswer(answerValue: number) {
    if (!currentQuestion || !player || !game) return;
    setMyAnswer(answerValue);
    setPhase('answered');

    const isCorrect = currentQuestion.type === 'survey' ? null : currentQuestion.correct_answer === answerValue;

    await supabase.from('answers').insert({
      game_id: game.id,
      question_id: currentQuestion.id,
      player_id: player.id,
      answer_value: answerValue,
      is_correct: isCorrect,
    });

    if (isCorrect) {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/increment_player_score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ player_id: player.id, points: 10 }),
      });
      refreshGame();
    }
  }

  return (
    <div className="min-h-screen gradient-bg">
      <header className="glass border-b border-dark-700 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors">
            <ArrowRight className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary-400" />
            <h1 className="text-base font-bold text-white">מסך שחקן</h1>
          </div>
          {player && (
            <div className="flex items-center gap-2 glass-light px-3 py-1 rounded-lg">
              <Trophy className="w-3.5 h-3.5 text-accent-400" />
              <span className="text-white text-sm font-medium">{player.score}</span>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {phase === 'join' && (
          <div className="glass rounded-2xl p-8 card-shadow-lg animate-fade-in">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-500/20 mb-4">
                <Smartphone className="w-8 h-8 text-primary-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">הצטרף למשחק</h2>
              <p className="text-dark-400 text-sm">הקישו את קוד המשחק ואת שמכם</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-dark-400 mb-1.5">קוד משחק</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="123456"
                  maxLength={6}
                  className="w-full px-4 py-3 rounded-xl bg-dark-800 border border-dark-600 text-white text-2xl text-center font-mono tracking-widest placeholder-dark-600 focus:outline-none focus:border-primary-500"
                  onKeyDown={(e) => e.key === 'Enter' && joinGame()}
                />
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1.5">השם שלך</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="הקלד את שמך"
                  maxLength={20}
                  className="w-full px-4 py-3 rounded-xl bg-dark-800 border border-dark-600 text-white placeholder-dark-500 focus:outline-none focus:border-primary-500"
                  onKeyDown={(e) => e.key === 'Enter' && joinGame()}
                />
              </div>
              {error && (
                <p className="text-error-400 text-sm text-center animate-shake">{error}</p>
              )}
              <button
                onClick={joinGame}
                className="w-full px-4 py-3.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-bold text-lg transition-colors"
              >
                הצטרף
              </button>
            </div>
          </div>
        )}

        {phase === 'waiting' && game && (
          <div className="text-center py-12 animate-fade-in">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-primary-500/20 mb-6 animate-pulse-glow">
              <Clock className="w-12 h-12 text-primary-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">ממתין לשאלה...</h2>
            <p className="text-dark-400 mb-6">{game.title}</p>
            <div className="glass-light rounded-xl p-4 inline-block">
              <p className="text-dark-300 text-sm">השאלה הבאה תופיע בקרוב</p>
            </div>
            <div className="mt-6 flex items-center justify-center gap-2 text-dark-400 text-sm">
              <Users className="w-4 h-4" />
              <span>מחובר למשחק</span>
            </div>
          </div>
        )}

        {phase === 'question' && currentQuestion && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className={`text-xs px-3 py-1 rounded-full ${currentQuestion.type === 'trivia' ? 'bg-primary-500/20 text-primary-400' : 'bg-accent-500/20 text-accent-400'}`}>
                {currentQuestion.type === 'trivia' ? 'טריוויה' : 'סקר'}
              </span>
              <div className={`flex items-center gap-2 ${timeLeft <= 5 ? 'text-error-400' : 'text-white'}`}>
                <Clock className={`w-5 h-5 ${timeLeft <= 5 ? 'animate-shake' : ''}`} />
                <span className="text-2xl font-black tabular-nums">{timeLeft}</span>
              </div>
            </div>

            <div className="glass rounded-2xl p-6 card-shadow-lg">
              <h2 className="text-xl md:text-2xl font-bold text-white text-center mb-6">{currentQuestion.text}</h2>

              <div className="space-y-3">
                {Array.from({ length: getAnswerCount(currentQuestion) }, (_, i) => {
                  const color = ANSWER_COLORS[i];
                  return (
                    <button
                      key={i}
                      onClick={() => submitAnswer(i + 1)}
                      className={`w-full ${color.bg} rounded-xl p-4 flex items-center gap-3 hover:scale-[1.02] active:scale-95 transition-all card-shadow animate-slide-up`}
                      style={{ animationDelay: `${i * 80}ms` }}
                    >
                      <span className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/20 text-white text-xl font-black flex-shrink-0">
                        {ANSWER_LABELS[i]}
                      </span>
                      <span className="text-white text-base md:text-lg font-medium text-right flex-1">
                        {getAnswerText(currentQuestion, i + 1)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {phase === 'answered' && currentQuestion && myAnswer !== null && (
          <div className="text-center py-12 animate-bounce-in">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-success-500/20 mb-4">
              <Check className="w-10 h-10 text-success-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">תשובתך נרשמה!</h2>
            <p className="text-dark-400 mb-4">בחרת: {ANSWER_LABELS[myAnswer - 1]}. {getAnswerText(currentQuestion, myAnswer)}</p>
            <div className="glass-light rounded-xl p-4 inline-block">
              <p className="text-dark-300 text-sm">ממתין לתוצאות...</p>
            </div>
          </div>
        )}

        {phase === 'finished' && (
          <div className="text-center py-12 animate-fade-in">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-accent-500/20 mb-6 animate-bounce-in">
              <Trophy className="w-14 h-14 text-accent-400" />
            </div>
            <h2 className="text-3xl font-black text-white mb-2">המשחק הסתיים!</h2>
            {player && (
              <div className="glass rounded-2xl p-6 card-shadow-lg max-w-sm mx-auto mt-6">
                <p className="text-dark-400 mb-2">הניקוד הסופי שלך</p>
                <p className="text-5xl font-black text-accent-400 mb-4">{player.score}</p>
                <p className="text-white font-medium">{player.name}</p>
              </div>
            )}
            <button onClick={onBack} className="mt-8 px-8 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-bold transition-colors">
              חזרה לתפריט
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
