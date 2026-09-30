import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Game, Question, IvrSettings, QuestionType } from '@/lib/types';
import { generateJoinCode, ANSWER_LABELS } from '@/lib/types';
import {
  ArrowRight, Plus, Trash2, Edit2, Save, X, Copy, Phone,
  Settings, ListChecks, Gamepad2, Monitor, Check, ChevronUp, ChevronDown
} from 'lucide-react';

interface Props {
  onOpenDisplay: (gameId: string) => void;
  onBack: () => void;
}

type Tab = 'games' | 'questions' | 'ivr';

export default function AdminPanel({ onOpenDisplay, onBack }: Props) {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('games');
  const [loading, setLoading] = useState(true);
  const [showNewGame, setShowNewGame] = useState(false);
  const [newGameTitle, setNewGameTitle] = useState('');

  const fetchGames = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('games')
      .select('*')
      .order('created_at', { ascending: false });
    setGames(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchGames(); }, [fetchGames]);

  async function createGame() {
    if (!newGameTitle.trim()) return;
    const joinCode = generateJoinCode();
    const { data, error } = await supabase
      .from('games')
      .insert({ title: newGameTitle, join_code: joinCode, status: 'lobby' })
      .select('*')
      .single();
    if (data && !error) {
      await supabase.from('ivr_settings').insert({ game_id: data.id });
      setNewGameTitle('');
      setShowNewGame(false);
      fetchGames();
      setSelectedGameId(data.id);
      setTab('questions');
    }
  }

  async function deleteGame(id: string) {
    await supabase.from('games').delete().eq('id', id);
    if (selectedGameId === id) setSelectedGameId(null);
    fetchGames();
  }

  async function updateGameStatus(id: string, status: string) {
    await supabase.from('games').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    fetchGames();
  }

  const selectedGame = games.find(g => g.id === selectedGameId);

  return (
    <div className="min-h-screen gradient-bg">
      <header className="glass border-b border-dark-700 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors">
              <ArrowRight className="w-5 h-5" />
              <span className="hidden sm:inline">חזרה</span>
            </button>
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-6 h-6 text-primary-400" />
              <h1 className="text-lg font-bold text-white">ניהול משחקים</h1>
            </div>
          </div>
          {selectedGame && (
            <button
              onClick={() => onOpenDisplay(selectedGame.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors"
            >
              <Monitor className="w-4 h-4" />
              <span className="hidden sm:inline">פתח מסך תצוגה</span>
            </button>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[280px_1fr] gap-6">
          {/* Sidebar - Games list */}
          <div className="space-y-3">
            <button
              onClick={() => setShowNewGame(!showNewGame)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors"
            >
              <Plus className="w-5 h-5" />
              משחק חדש
            </button>

            {showNewGame && (
              <div className="glass rounded-xl p-4 space-y-3 animate-slide-up">
                <input
                  type="text"
                  value={newGameTitle}
                  onChange={(e) => setNewGameTitle(e.target.value)}
                  placeholder="שם המשחק"
                  className="w-full px-3 py-2 rounded-lg bg-dark-800 border border-dark-600 text-white placeholder-dark-500 focus:outline-none focus:border-primary-500"
                  onKeyDown={(e) => e.key === 'Enter' && createGame()}
                />
                <button
                  onClick={createGame}
                  className="w-full px-4 py-2 rounded-lg bg-success-500 hover:bg-success-600 text-white font-medium transition-colors"
                >
                  צור משחק
                </button>
              </div>
            )}

            <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto">
              {loading && <p className="text-dark-500 text-center py-4">טוען...</p>}
              {games.map(game => (
                <button
                  key={game.id}
                  onClick={() => { setSelectedGameId(game.id); setTab('questions'); }}
                  className={`w-full text-right p-4 rounded-xl transition-all ${
                    selectedGameId === game.id
                      ? 'bg-primary-500/20 border border-primary-500'
                      : 'glass hover:bg-dark-700/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-white text-sm truncate">{game.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      game.status === 'lobby' ? 'bg-dark-600 text-dark-300' :
                      game.status === 'active' ? 'bg-success-500/20 text-success-400' :
                      'bg-dark-600 text-dark-400'
                    }`}>
                      {game.status === 'lobby' ? 'ממתין' : game.status === 'active' ? 'פעיל' : 'הסתיים'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-dark-400">קוד: {game.join_code}</span>
                    <span className="text-xs text-dark-500">{new Date(game.created_at).toLocaleDateString('he-IL')}</span>
                  </div>
                </button>
              ))}
              {!loading && games.length === 0 && (
                <p className="text-dark-500 text-center py-8 text-sm">אין משחקים עדיין</p>
              )}
            </div>
          </div>

          {/* Main content */}
          <div>
            {!selectedGame ? (
              <div className="glass rounded-2xl p-12 text-center">
                <Gamepad2 className="w-16 h-16 text-dark-600 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-dark-300 mb-2">בחרו משחק או צרו חדש</h2>
                <p className="text-dark-500">בחרו משחק מהרשימה מימין או לחצו "משחק חדש"</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Tabs */}
                <div className="flex gap-2 glass rounded-xl p-1.5">
                  {([
                    { id: 'questions' as Tab, label: 'שאלות', icon: ListChecks },
                    { id: 'ivr' as Tab, label: 'הגדרות IVR', icon: Phone },
                    { id: 'games' as Tab, label: 'פרטי משחק', icon: Settings },
                  ]).map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        tab === t.id ? 'bg-primary-500 text-white' : 'text-dark-400 hover:text-white'
                      }`}
                    >
                      <t.icon className="w-4 h-4" />
                      {t.label}
                    </button>
                  ))}
                </div>

                {tab === 'questions' && <QuestionsTab gameId={selectedGameId!} />}
                {tab === 'ivr' && <IvrTab gameId={selectedGameId!} />}
                {tab === 'games' && (
                  <GameDetailsTab
                    game={selectedGame}
                    onUpdateStatus={updateGameStatus}
                    onDelete={deleteGame}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuestionsTab({ gameId }: { gameId: string }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newQ, setNewQ] = useState<{ text: string; type: QuestionType; answers: string[]; correct: number; timer: number }>({
    text: '', type: 'trivia', answers: ['', '', '', ''], correct: 1, timer: 30,
  });

  const fetchQuestions = useCallback(async () => {
    const { data } = await supabase
      .from('questions')
      .select('*')
      .eq('game_id', gameId)
      .order('position', { ascending: true });
    setQuestions(data || []);
  }, [gameId]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  async function addQuestion() {
    if (!newQ.text.trim()) return;
    const { data } = await supabase
      .from('questions')
      .insert({
        game_id: gameId,
        position: questions.length,
        type: newQ.type,
        text: newQ.text,
        answer_1: newQ.answers[0] || null,
        answer_2: newQ.answers[1] || null,
        answer_3: newQ.answers[2] || null,
        answer_4: newQ.answers[3] || null,
        correct_answer: newQ.type === 'trivia' ? newQ.correct : null,
        timer_seconds: newQ.timer,
      })
      .select('*')
      .single();
    if (data) {
      setShowNew(false);
      setNewQ({ text: '', type: 'trivia', answers: ['', '', '', ''], correct: 1, timer: 30 });
      fetchQuestions();
    }
  }

  async function updateQuestion(q: Question) {
    await supabase.from('questions').update({
      text: q.text,
      type: q.type,
      answer_1: q.answer_1,
      answer_2: q.answer_2,
      answer_3: q.answer_3,
      answer_4: q.answer_4,
      correct_answer: q.correct_answer,
      timer_seconds: q.timer_seconds,
    }).eq('id', q.id);
    setEditingId(null);
    fetchQuestions();
  }

  async function deleteQuestion(id: string) {
    await supabase.from('questions').delete().eq('id', id);
    fetchQuestions();
  }

  async function moveQuestion(q: Question, direction: 'up' | 'down') {
    const idx = questions.findIndex(x => x.id === q.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= questions.length) return;
    const swapQ = questions[swapIdx];
    await supabase.from('questions').update({ position: swapIdx }).eq('id', q.id);
    await supabase.from('questions').update({ position: idx }).eq('id', swapQ.id);
    fetchQuestions();
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setShowNew(!showNew)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl glass hover:bg-dark-700/50 text-white font-medium transition-colors border border-dark-600"
      >
        <Plus className="w-5 h-5" />
        הוסף שאלה
      </button>

      {showNew && (
        <div className="glass rounded-xl p-5 space-y-4 animate-slide-up border border-primary-500/30">
          <h3 className="font-bold text-white">שאלה חדשה</h3>
          <input
            type="text"
            value={newQ.text}
            onChange={(e) => setNewQ({ ...newQ, text: e.target.value })}
            placeholder="טקסט השאלה"
            className="w-full px-3 py-2.5 rounded-lg bg-dark-800 border border-dark-600 text-white placeholder-dark-500 focus:outline-none focus:border-primary-500"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setNewQ({ ...newQ, type: 'trivia' })}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                newQ.type === 'trivia' ? 'bg-primary-500 text-white' : 'glass text-dark-400'
              }`}
            >
              טריוויה (תשובה נכונה)
            </button>
            <button
              onClick={() => setNewQ({ ...newQ, type: 'survey' })}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                newQ.type === 'survey' ? 'bg-primary-500 text-white' : 'glass text-dark-400'
              }`}
            >
              סקר (ללא תשובה נכונה)
            </button>
          </div>
          <div className="space-y-2">
            {newQ.answers.map((ans, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-dark-700 text-dark-300 text-sm font-bold flex-shrink-0">
                  {ANSWER_LABELS[i]}
                </span>
                <input
                  type="text"
                  value={ans}
                  onChange={(e) => {
                    const answers = [...newQ.answers];
                    answers[i] = e.target.value;
                    setNewQ({ ...newQ, answers });
                  }}
                  placeholder={`תשובה ${i + 1}`}
                  className="flex-1 px-3 py-2 rounded-lg bg-dark-800 border border-dark-600 text-white placeholder-dark-500 focus:outline-none focus:border-primary-500"
                />
                {newQ.type === 'trivia' && (
                  <button
                    onClick={() => setNewQ({ ...newQ, correct: i + 1 })}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 transition-colors ${
                      newQ.correct === i + 1 ? 'bg-success-500 text-white' : 'bg-dark-700 text-dark-500 hover:text-dark-300'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-dark-400 text-sm">זמן לתשובה (שניות):</label>
            <input
              type="number"
              value={newQ.timer}
              onChange={(e) => setNewQ({ ...newQ, timer: parseInt(e.target.value) || 30 })}
              className="w-20 px-3 py-2 rounded-lg bg-dark-800 border border-dark-600 text-white text-center focus:outline-none focus:border-primary-500"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={addQuestion} className="flex-1 px-4 py-2.5 rounded-lg bg-success-500 hover:bg-success-600 text-white font-medium transition-colors">
              <Save className="w-4 h-4 inline ml-2" />
              שמור שאלה
            </button>
            <button onClick={() => setShowNew(false)} className="px-4 py-2.5 rounded-lg glass text-dark-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {questions.length === 0 && !showNew && (
        <div className="glass rounded-xl p-8 text-center">
          <ListChecks className="w-12 h-12 text-dark-600 mx-auto mb-3" />
          <p className="text-dark-400">אין שאלות עדיין. לחצו "הוסף שאלה" כדי להתחיל.</p>
        </div>
      )}

      {questions.map((q, idx) => (
        <div key={q.id} className="glass rounded-xl p-4 space-y-3 animate-slide-up">
          {editingId === q.id ? (
            <QuestionEditor question={q} onSave={updateQuestion} onCancel={() => setEditingId(null)} />
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary-500/20 text-primary-400 text-sm font-bold flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        q.type === 'trivia' ? 'bg-primary-500/20 text-primary-400' : 'bg-accent-500/20 text-accent-400'
                      }`}>
                        {q.type === 'trivia' ? 'טריוויה' : 'סקר'}
                      </span>
                      <span className="text-xs text-dark-500">{q.timer_seconds} שניות</span>
                    </div>
                    <p className="text-white font-medium">{q.text}</p>
                    <div className="mt-2 space-y-1">
                      {[q.answer_1, q.answer_2, q.answer_3, q.answer_4].map((ans, i) => (
                        ans && (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <span className="w-6 h-6 flex items-center justify-center rounded bg-dark-700 text-dark-300 text-xs">
                              {ANSWER_LABELS[i]}
                            </span>
                            <span className={q.correct_answer === i + 1 ? 'text-success-400 font-medium' : 'text-dark-400'}>
                              {ans}
                            </span>
                            {q.correct_answer === i + 1 && <Check className="w-3.5 h-3.5 text-success-400" />}
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button onClick={() => moveQuestion(q, 'up')} className="p-1.5 rounded-lg glass hover:bg-dark-700 text-dark-400 hover:text-white transition-colors">
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button onClick={() => moveQuestion(q, 'down')} className="p-1.5 rounded-lg glass hover:bg-dark-700 text-dark-400 hover:text-white transition-colors">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex gap-2 pt-2 border-t border-dark-700">
                <button onClick={() => setEditingId(q.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass hover:bg-dark-700 text-dark-300 hover:text-white text-sm transition-colors">
                  <Edit2 className="w-3.5 h-3.5" /> עריכה
                </button>
                <button onClick={() => deleteQuestion(q.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass hover:bg-error-500/20 text-error-400 text-sm transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> מחיקה
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function QuestionEditor({ question, onSave, onCancel }: { question: Question; onSave: (q: Question) => void; onCancel: () => void }) {
  const [q, setQ] = useState<Question>(question);

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={q.text}
        onChange={(e) => setQ({ ...q, text: e.target.value })}
        className="w-full px-3 py-2 rounded-lg bg-dark-800 border border-dark-600 text-white focus:outline-none focus:border-primary-500"
      />
      <div className="flex gap-2">
        <button
          onClick={() => setQ({ ...q, type: 'trivia', correct_answer: q.correct_answer ?? 1 })}
          className={`flex-1 px-3 py-1.5 rounded-lg text-sm ${q.type === 'trivia' ? 'bg-primary-500 text-white' : 'glass text-dark-400'}`}
        >
          טריוויה
        </button>
        <button
          onClick={() => setQ({ ...q, type: 'survey', correct_answer: null })}
          className={`flex-1 px-3 py-1.5 rounded-lg text-sm ${q.type === 'survey' ? 'bg-primary-500 text-white' : 'glass text-dark-400'}`}
        >
          סקר
        </button>
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4].map(i => {
          const key = `answer_${i}` as keyof Question;
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-dark-700 text-dark-300 text-sm font-bold">
                {ANSWER_LABELS[i - 1]}
              </span>
              <input
                type="text"
                value={(q[key] as string) || ''}
                onChange={(e) => setQ({ ...q, [key]: e.target.value || null })}
                className="flex-1 px-3 py-2 rounded-lg bg-dark-800 border border-dark-600 text-white focus:outline-none focus:border-primary-500"
              />
              {q.type === 'trivia' && (
                <button
                  onClick={() => setQ({ ...q, correct_answer: i })}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg ${q.correct_answer === i ? 'bg-success-500 text-white' : 'bg-dark-700 text-dark-500'}`}
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <label className="text-dark-400 text-sm">זמן (שניות):</label>
        <input
          type="number"
          value={q.timer_seconds}
          onChange={(e) => setQ({ ...q, timer_seconds: parseInt(e.target.value) || 30 })}
          className="w-20 px-3 py-2 rounded-lg bg-dark-800 border border-dark-600 text-white text-center focus:outline-none focus:border-primary-500"
        />
      </div>
      <div className="flex gap-2">
        <button onClick={() => onSave(q)} className="flex-1 px-4 py-2 rounded-lg bg-success-500 hover:bg-success-600 text-white font-medium transition-colors">
          <Save className="w-4 h-4 inline ml-2" />שמור
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg glass text-dark-400 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function IvrTab({ gameId }: { gameId: string }) {
  const [settings, setSettings] = useState<IvrSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('ivr_settings').select('*').eq('game_id', gameId).maybeSingle()
      .then(({ data }) => setSettings(data));
  }, [gameId]);

  async function save() {
    if (!settings) return;
    setSaving(true);
    await supabase.from('ivr_settings').update({
      yemot_username: settings.yemot_username,
      yemot_password: settings.yemot_password,
      yemot_phone: settings.yemot_phone,
      access_code: settings.access_code,
      welcome_message: settings.welcome_message,
      question_intro_message: settings.question_intro_message,
      correct_message: settings.correct_message,
      wrong_message: settings.wrong_message,
      thank_you_message: settings.thank_you_message,
    }).eq('id', settings.id);
    setSaving(false);
  }

  if (!settings) return <div className="glass rounded-xl p-8 text-center text-dark-400">טוען...</div>;

  const fields: { key: keyof IvrSettings; label: string; type?: string; placeholder?: string }[] = [
    { key: 'yemot_username', label: 'מספר מערכת ימות המשיח', placeholder: '0773137770' },
    { key: 'yemot_password', label: 'סיסמת ניהול', type: 'password', placeholder: '1234' },
    { key: 'yemot_phone', label: 'מספר טלפון לחיוג', placeholder: '0773137770' },
    { key: 'access_code', label: 'קוד גישה למשחק', placeholder: '1234' },
  ];

  const messages: { key: keyof IvrSettings; label: string }[] = [
    { key: 'welcome_message', label: 'הודעת פתיחה' },
    { key: 'question_intro_message', label: 'הודעת מעבר לשאלה' },
    { key: 'correct_message', label: 'הודעת תשובה נכונה' },
    { key: 'wrong_message', label: 'הודעת תשובה שגויה' },
    { key: 'thank_you_message', label: 'הודעת סיום' },
  ];

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Phone className="w-5 h-5 text-primary-400" />
          <h3 className="font-bold text-white">פרטי מערכת ימות המשיח</h3>
        </div>
        {fields.map(f => (
          <div key={f.key}>
            <label className="block text-sm text-dark-400 mb-1">{f.label}</label>
            <input
              type={f.type || 'text'}
              value={(settings[f.key] as string) || ''}
              onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })}
              placeholder={f.placeholder}
              className="w-full px-3 py-2.5 rounded-lg bg-dark-800 border border-dark-600 text-white placeholder-dark-500 focus:outline-none focus:border-primary-500"
            />
          </div>
        ))}
      </div>

      <div className="glass rounded-xl p-5 space-y-4">
        <h3 className="font-bold text-white mb-2">הודעות קוליות (TTS)</h3>
        {messages.map(m => (
          <div key={m.key}>
            <label className="block text-sm text-dark-400 mb-1">{m.label}</label>
            <textarea
              value={(settings[m.key] as string) || ''}
              onChange={(e) => setSettings({ ...settings, [m.key]: e.target.value })}
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg bg-dark-800 border border-dark-600 text-white focus:outline-none focus:border-primary-500 resize-none"
            />
          </div>
        ))}
      </div>

      <div className="glass rounded-xl p-5 border border-primary-500/20">
        <h3 className="font-bold text-white mb-2">כתובת ה-URL להגדרה בימות המשיח</h3>
        <p className="text-dark-400 text-sm mb-2">הגדירו את הכתובת הבאה בשלוחת API במערכת ימות המשיח:</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 rounded-lg bg-dark-900 text-primary-400 text-sm overflow-x-auto" dir="ltr">
            {import.meta.env.VITE_SUPABASE_URL}/functions/v1/yemot-ivr
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yemot-ivr`);
            }}
            className="p-2 rounded-lg glass hover:bg-dark-700 text-dark-300 hover:text-white transition-colors"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full px-4 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors disabled:opacity-50"
      >
        {saving ? 'שומר...' : 'שמור הגדרות'}
      </button>
    </div>
  );
}

function GameDetailsTab({ game, onUpdateStatus, onDelete }: { game: Game; onUpdateStatus: (id: string, status: string) => void; onDelete: (id: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-5 space-y-4">
        <h3 className="font-bold text-white">פרטי המשחק</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-dark-400">שם המשחק:</span>
            <span className="text-white font-medium">{game.title}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-dark-400">קוד כניסה:</span>
            <span className="text-primary-400 font-bold font-mono text-lg">{game.join_code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-dark-400">סטטוס:</span>
            <span className="text-white">{game.status === 'lobby' ? 'ממתין' : game.status === 'active' ? 'פעיל' : 'הסתיים'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-dark-400">נוצר:</span>
            <span className="text-white">{new Date(game.created_at).toLocaleString('he-IL')}</span>
          </div>
        </div>
      </div>

      <div className="glass rounded-xl p-5 space-y-3">
        <h3 className="font-bold text-white">שליטה על המשחק</h3>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onUpdateStatus(game.id, 'lobby')}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${game.status === 'lobby' ? 'bg-dark-600 text-white' : 'glass text-dark-400 hover:text-white'}`}
          >
            ממתין
          </button>
          <button
            onClick={() => onUpdateStatus(game.id, 'active')}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${game.status === 'active' ? 'bg-success-500 text-white' : 'glass text-dark-400 hover:text-white'}`}
          >
            פעיל
          </button>
          <button
            onClick={() => onUpdateStatus(game.id, 'finished')}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${game.status === 'finished' ? 'bg-dark-600 text-white' : 'glass text-dark-400 hover:text-white'}`}
          >
            הסתיים
          </button>
        </div>
      </div>

      <button
        onClick={() => { if (confirm('האם למחוק את המשחק?')) onDelete(game.id); }}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl glass hover:bg-error-500/20 text-error-400 font-medium transition-colors"
      >
        <Trash2 className="w-5 h-5" />
        מחיקת משחק
      </button>
    </div>
  );
}
