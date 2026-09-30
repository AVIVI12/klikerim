import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Game, Question, Player, Answer } from '@/lib/types';
import { ANSWER_COLORS, ANSWER_LABELS, getAnswerText, getAnswerCount } from '@/lib/types';
import {
  ArrowRight, Monitor, Users, Clock, Trophy, BarChart3,
  Check, X, ChevronLeft, ChevronRight, Play, Pause, Award
} from 'lucide-react';

interface Props {
  gameId: string | null;
  onBack: () => void;
}

type DisplayPhase = 'lobby' | 'question' | 'results' | 'final';

export default function DisplayScreen({ gameId, onBack }: Props) {
  const [game, setGame] = useState<Game | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [phase, setPhase] = useState<DisplayPhase>('lobby');
  const [timeLeft, setTimeLeft] = useState(0);
  const [showCorrect, setShowCorrect] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    if (!gameId) return;
    const [{ data: g }, { data: qs }, { data: ps }] = await Promise.all([
      supabase.from('games').select('*').eq('id', gameId).maybeSingle(),
      supabase.from('questions').select('*').eq('game_id', gameId).order('position', { ascending: true }),
      supabase.from('players').select('*').eq('game_id', gameId).order('score', { ascending: false }),
    ]);
    setGame(g);
    setQuestions(qs || []);
    setPlayers(ps || []);
  }, [gameId]);

  useEffect(() => {
    fetchAll();
    if (!gameId) return;

    const channel = supabase
      .channel(`display-${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions', filter: `game_id=eq.${gameId}` }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'answers', filter: `game_id=eq.${gameId}` }, async (payload) => {
        const { data } = await supabase.from('answers').select('*').eq('game_id', gameId);
        setAnswers(data || []);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [gameId, fetchAll]);

  useEffect(() => {
    if (!gameId) return;
    supabase.from('answers').select('*').eq('game_id', gameId).then(({ data }) => setAnswers(data || []));
  }, [gameId]);

  const currentQuestion = game ? questions[game.current_question_index] : null;

  useEffect(() => {
    if (phase !== 'question' || !currentQuestion) return;
    setTimeLeft(currentQuestion.timer_seconds);
    setShowCorrect(false);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setPhase('results');
          if (game) supabase.from('games').update({ question_active: false, updated_at: new Date().toISOString() }).eq('id', game.id).then(() => {});
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, currentQuestion]);

  async function startQuestion() {
    if (!game || !currentQuestion) return;
    setPhase('question');
    await supabase.from('answers').delete().eq('question_id', currentQuestion.id);
    await supabase.from('games').update({ question_active: true, updated_at: new Date().toISOString() }).eq('id', game.id);
    await supabase.from('ivr_calls').update({ answered_question_id: null }).eq('game_id', game.id);
  }

  async function nextQuestion() {
    if (!game) return;
    const nextIdx = game.current_question_index + 1;
    if (nextIdx >= questions.length) {
      await supabase.from('games').update({ status: 'finished', question_active: false, updated_at: new Date().toISOString() }).eq('id', game.id);
      setPhase('final');
    } else {
      await supabase.from('games').update({ current_question_index: nextIdx, question_active: false, updated_at: new Date().toISOString() }).eq('id', game.id);
      setPhase('lobby');
    }
  }

  async function prevQuestion() {
    if (!game || game.current_question_index === 0) return;
    const prevIdx = game.current_question_index - 1;
    await supabase.from('games').update({ current_question_index: prevIdx, question_active: false, updated_at: new Date().toISOString() }).eq('id', game.id);
    setPhase('lobby');
  }

  async function showResults() {
    setPhase('results');
    if (timerRef.current) clearInterval(timerRef.current);
    if (game) await supabase.from('games').update({ question_active: false, updated_at: new Date().toISOString() }).eq('id', game.id);
  }

  if (!gameId || !game) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center">
          <Monitor className="w-16 h-16 text-dark-600 mx-auto mb-4" />
          <p className="text-dark-400">טוען...</p>
          <button onClick={onBack} className="mt-4 text-primary-400 hover:text-primary-300">חזרה</button>
        </div>
      </div>
    );
  }

  const currentAnswers = currentQuestion ? answers.filter(a => a.question_id === currentQuestion.id) : [];
  const answerCounts = currentQuestion
    ? Array.from({ length: getAnswerCount(currentQuestion) }, (_, i) => {
        const count = currentAnswers.filter(a => a.answer_value === i + 1).length;
        const pct = currentAnswers.length > 0 ? (count / currentAnswers.length) * 100 : 0;
        return { value: i + 1, count, percentage: pct };
      })
    : [];

  const topPlayers = [...players].sort((a, b) => b.score - a.score).slice(0, 5);

  return (
    <div className="min-h-screen gradient-bg">
      <header className="glass border-b border-dark-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors">
              <ArrowRight className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Monitor className="w-6 h-6 text-primary-400" />
              <h1 className="text-lg font-bold text-white">{game.title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 glass-light px-3 py-1.5 rounded-lg">
              <Users className="w-4 h-4 text-primary-400" />
              <span className="text-white text-sm font-medium">{players.length}</span>
            </div>
            <div className="flex items-center gap-2 glass-light px-3 py-1.5 rounded-lg">
              <span className="text-dark-400 text-sm">קוד:</span>
              <span className="text-primary-400 font-bold font-mono">{game.join_code}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {phase === 'lobby' && (
          <LobbyView game={game} players={players} questions={questions} onStart={startQuestion} onPrev={prevQuestion} />
        )}

        {phase === 'question' && currentQuestion && (
          <QuestionView
            question={currentQuestion}
            questionNumber={game.current_question_index + 1}
            totalQuestions={questions.length}
            timeLeft={timeLeft}
            answerCount={currentAnswers.length}
            onShowResults={showResults}
          />
        )}

        {phase === 'results' && currentQuestion && (
          <ResultsView
            question={currentQuestion}
            answerCounts={answerCounts}
            totalAnswers={currentAnswers.length}
            questionNumber={game.current_question_index + 1}
            totalQuestions={questions.length}
            onNext={nextQuestion}
            onPrev={prevQuestion}
            topPlayers={topPlayers}
          />
        )}

        {phase === 'final' && (
          <FinalView players={players} onBack={onBack} />
        )}
      </div>
    </div>
  );
}

function LobbyView({ game, players, questions, onStart, onPrev }: { game: Game; players: Player[]; questions: Question[]; onStart: () => void; onPrev: () => void }) {
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="glass rounded-2xl p-8 text-center card-shadow-lg animate-fade-in">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-primary-500/20 mb-6 animate-pulse-glow">
          <Users className="w-12 h-12 text-primary-400" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">{game.title}</h2>
        <p className="text-dark-400 mb-6">קוד כניסה למשחק</p>
        <div className="text-6xl font-black text-primary-400 font-mono mb-6 tracking-widest">{game.join_code}</div>
        <div className="glass-light rounded-xl p-4 mb-6">
          <p className="text-dark-300 text-sm">הצטרפו דרך הנייד או התקשרו לטלפון והקישו את הקוד</p>
        </div>
        <div className="flex gap-3 justify-center">
          {game.current_question_index > 0 && (
            <button onClick={onPrev} className="flex items-center gap-2 px-5 py-3 rounded-xl glass text-dark-300 hover:text-white transition-colors">
              <ChevronRight className="w-5 h-5" />
              שאלה קודמת
            </button>
          )}
          <button onClick={onStart} className="flex items-center gap-2 px-8 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-bold transition-colors animate-pulse-glow">
            <Play className="w-5 h-5" />
            התחל שאלה {game.current_question_index + 1}
          </button>
        </div>
      </div>

      <div className="glass rounded-2xl p-6 card-shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-400" />
            שחקנים ({players.length})
          </h3>
          <span className="text-sm text-dark-400">{questions.length} שאלות</span>
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {players.length === 0 && (
            <p className="text-dark-500 text-center py-8">ממתין לשחקנים...</p>
          )}
          {players.map((p, idx) => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg glass-light animate-slide-in-right">
              <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-dark-700 text-dark-300 text-sm font-bold">
                {idx + 1}
              </span>
              <span className="text-white text-sm flex-1">{p.name || p.phone || 'שחקן'}</span>
              {p.score > 0 && (
                <span className="flex items-center gap-1 text-accent-400 text-sm font-medium">
                  <Trophy className="w-3.5 h-3.5" />
                  {p.score}
                </span>
              )}
              <span className={`w-2.5 h-2.5 rounded-full ${p.connected ? 'bg-success-500' : 'bg-dark-600'}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuestionView({ question, questionNumber, totalQuestions, timeLeft, answerCount, onShowResults }: {
  question: Question; questionNumber: number; totalQuestions: number; timeLeft: number; answerCount: number; onShowResults: () => void;
}) {
  const count = getAnswerCount(question);
  const timePct = (timeLeft / question.timer_seconds) * 100;
  const isUrgent = timeLeft <= 5;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-dark-400 text-sm">שאלה {questionNumber} מתוך {totalQuestions}</span>
        <span className={`text-xs px-3 py-1 rounded-full ${question.type === 'trivia' ? 'bg-primary-500/20 text-primary-400' : 'bg-accent-500/20 text-accent-400'}`}>
          {question.type === 'trivia' ? 'טריוויה' : 'סקר'}
        </span>
      </div>

      <div className="glass rounded-2xl p-8 card-shadow-lg animate-bounce-in">
        <div className="text-center mb-6">
          <h2 className="text-2xl md:text-4xl font-bold text-white leading-relaxed">{question.text}</h2>
        </div>

        <div className="flex items-center justify-center gap-4 mb-6">
          <div className={`flex items-center gap-2 ${isUrgent ? 'text-error-400' : 'text-white'}`}>
            <Clock className={`w-6 h-6 ${isUrgent ? 'animate-shake' : ''}`} />
            <span className="text-3xl font-black tabular-nums">{timeLeft}</span>
          </div>
          <button onClick={onShowResults} className="flex items-center gap-2 px-4 py-2 rounded-lg glass hover:bg-dark-700 text-dark-300 hover:text-white text-sm transition-colors">
            <BarChart3 className="w-4 h-4" />
            הצג תוצאות
          </button>
        </div>

        <div className="w-full h-2 rounded-full bg-dark-700 mb-8 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-linear ${isUrgent ? 'bg-error-500' : 'bg-primary-500'}`}
            style={{ width: `${timePct}%` }}
          />
        </div>

        <div className={`grid gap-3 ${count <= 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2'}`}>
          {Array.from({ length: count }, (_, i) => {
            const color = ANSWER_COLORS[i];
            return (
              <div
                key={i}
                className={`${color.bg} rounded-2xl p-6 flex items-center gap-4 card-shadow animate-slide-up`}
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <span className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/20 text-white text-2xl font-black flex-shrink-0">
                  {ANSWER_LABELS[i]}
                </span>
                <span className="text-white text-lg md:text-xl font-medium">{getAnswerText(question, i + 1)}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-6 text-center">
          <span className="text-dark-400 text-sm">{answerCount} תשובות נרשמו</span>
        </div>
      </div>
    </div>
  );
}

function ResultsView({ question, answerCounts, totalAnswers, questionNumber, totalQuestions, onNext, onPrev, topPlayers }: {
  question: Question; answerCounts: { value: number; count: number; percentage: number }[]; totalAnswers: number; questionNumber: number; totalQuestions: number; onNext: () => void; onPrev: () => void; topPlayers: Player[];
}) {
  const count = getAnswerCount(question);
  const maxCount = Math.max(...answerCounts.map(a => a.count), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-dark-400 text-sm">תוצאות שאלה {questionNumber} מתוך {totalQuestions}</span>
        <span className="text-dark-400 text-sm">{totalAnswers} תשובות</span>
      </div>

      <div className="glass rounded-2xl p-6 card-shadow-lg animate-fade-in">
        <h2 className="text-xl md:text-2xl font-bold text-white text-center mb-6">{question.text}</h2>

        <div className="space-y-3">
          {answerCounts.map((a, i) => {
            const color = ANSWER_COLORS[i];
            const isCorrect = question.correct_answer === a.value;
            const barWidth = (a.count / maxCount) * 100;
            return (
              <div key={a.value} className="animate-slide-up" style={{ animationDelay: `${i * 150}ms` }}>
                <div className="flex items-center gap-3 mb-1">
                  <span className={`w-8 h-8 flex items-center justify-center rounded-lg ${color.bg} text-white text-sm font-bold flex-shrink-0`}>
                    {ANSWER_LABELS[i]}
                  </span>
                  <span className="text-white text-sm md:text-base flex-1">{getAnswerText(question, a.value)}</span>
                  {question.type === 'trivia' && isCorrect && (
                    <span className="flex items-center gap-1 text-success-400 text-sm font-medium">
                      <Check className="w-4 h-4" />
                      נכון
                    </span>
                  )}
                  <span className="text-dark-400 text-sm">{a.count} ({a.percentage.toFixed(0)}%)</span>
                </div>
                <div className="w-full h-8 rounded-lg bg-dark-800 overflow-hidden">
                  <div
                    className={`h-full rounded-lg ${color.bg} transition-all duration-700 ease-out flex items-center justify-end px-2`}
                    style={{ width: `${Math.max(barWidth, 2)}%` }}
                  >
                    {a.percentage > 10 && <span className="text-white text-xs font-bold">{a.percentage.toFixed(0)}%</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {question.type === 'trivia' && question.correct_answer && (
          <div className="mt-6 glass-light rounded-xl p-4 text-center animate-bounce-in">
            <p className="text-white">
              <span className="text-success-400 font-bold">התשובה הנכונה: </span>
              <span>{ANSWER_LABELS[question.correct_answer - 1]}. {getAnswerText(question, question.correct_answer)}</span>
            </p>
          </div>
        )}
      </div>

      {topPlayers.length > 0 && (
        <div className="glass rounded-2xl p-5 card-shadow">
          <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-accent-400" />
            לוח תוצאות
          </h3>
          <div className="space-y-2">
            {topPlayers.map((p, idx) => (
              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg glass-light">
                <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold ${
                  idx === 0 ? 'bg-accent-500 text-white' : idx === 1 ? 'bg-dark-400 text-dark-900' : idx === 2 ? 'bg-orange-600 text-white' : 'bg-dark-700 text-dark-300'
                }`}>
                  {idx + 1}
                </span>
                <span className="text-white text-sm flex-1">{p.name || p.phone || 'שחקן'}</span>
                <span className="flex items-center gap-1 text-accent-400 font-bold">
                  <Trophy className="w-3.5 h-3.5" />
                  {p.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 justify-center">
        {questionNumber > 1 && (
          <button onClick={onPrev} className="flex items-center gap-2 px-5 py-3 rounded-xl glass text-dark-300 hover:text-white transition-colors">
            <ChevronRight className="w-5 h-5" />
            שאלה קודמת
          </button>
        )}
        <button onClick={onNext} className="flex items-center gap-2 px-8 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-bold transition-colors">
          {questionNumber >= totalQuestions ? (
            <>סיום משחק <Award className="w-5 h-5" /></>
          ) : (
            <>שאלה הבאה <ChevronLeft className="w-5 h-5" /></>
          )}
        </button>
      </div>
    </div>
  );
}

function FinalView({ players, onBack }: { players: Player[]; onBack: () => void }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <div className="max-w-2xl mx-auto text-center py-12">
      <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-accent-500/20 mb-6 animate-bounce-in">
        <Trophy className="w-14 h-14 text-accent-400" />
      </div>
      <h2 className="text-4xl font-black text-white mb-2">המשחק הסתיים!</h2>
      <p className="text-dark-400 mb-8">תודה לכל המשתתפים</p>

      <div className="glass rounded-2xl p-6 card-shadow-lg space-y-3">
        <h3 className="text-lg font-bold text-white mb-4">דירוג סופי</h3>
        {sorted.length === 0 && <p className="text-dark-500 py-4">אין תוצאות</p>}
        {sorted.map((p, idx) => (
          <div key={p.id} className={`flex items-center gap-4 p-4 rounded-xl animate-slide-up ${idx === 0 ? 'bg-accent-500/20' : 'glass-light'}`} style={{ animationDelay: `${idx * 100}ms` }}>
            <span className={`w-10 h-10 flex items-center justify-center rounded-xl text-lg font-black ${
              idx === 0 ? 'bg-accent-500 text-white' : idx === 1 ? 'bg-dark-400 text-dark-900' : idx === 2 ? 'bg-orange-600 text-white' : 'bg-dark-700 text-dark-300'
            }`}>
              {idx + 1}
            </span>
            <span className="text-white text-lg font-medium flex-1 text-right">{p.name || p.phone || 'שחקן'}</span>
            <span className="flex items-center gap-1.5 text-accent-400 text-xl font-bold">
              <Trophy className="w-5 h-5" />
              {p.score}
            </span>
          </div>
        ))}
      </div>

      <button onClick={onBack} className="mt-8 px-8 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-bold transition-colors">
        חזרה לתפריט
      </button>
    </div>
  );
}
