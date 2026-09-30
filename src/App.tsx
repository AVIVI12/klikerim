import { useState } from 'react';
import AdminPanel from '@/components/AdminPanel';
import DisplayScreen from '@/components/DisplayScreen';
import PlayerScreen from '@/components/PlayerScreen';
import { Gamepad2, Monitor, Smartphone, Home } from 'lucide-react';

type View = 'home' | 'admin' | 'display' | 'player';

function App() {
  const [view, setView] = useState<View>('home');
  const [displayGameId, setDisplayGameId] = useState<string | null>(null);

  const navItems: { id: View; label: string; icon: typeof Home; desc: string }[] = [
    { id: 'admin', label: 'ניהול משחק', icon: Gamepad2, desc: 'צרו משחקים, ערכו שאלות, הגדירו IVR' },
    { id: 'display', label: 'מסך תצוגה', icon: Monitor, desc: 'מקרן להצגת שאלות ותוצאות' },
    { id: 'player', label: 'מסך שחקן', icon: Smartphone, desc: 'הצטרפו למשחק מהנייד' },
  ];

  if (view === 'admin') return <AdminPanel onOpenDisplay={(gameId) => { setDisplayGameId(gameId); setView('display'); }} onBack={() => setView('home')} />;
  if (view === 'display') return <DisplayScreen gameId={displayGameId} onBack={() => setView('home')} />;
  if (view === 'player') return <PlayerScreen onBack={() => setView('home')} />;

  return (
    <div className="min-h-screen gradient-bg flex flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary-500/20 mb-6 animate-pulse-glow">
            <Gamepad2 className="w-10 h-10 text-primary-400" />
          </div>
          <h1 className="text-5xl font-black mb-4 gradient-text">טריוויה לייב</h1>
          <p className="text-xl text-dark-400">מערכת משחקי טריוויה וסקרים עם חיבור IVR לימות המשיח</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {navItems.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className="glass card-shadow rounded-2xl p-8 text-right hover:scale-105 transition-all duration-300 hover:card-shadow-lg group animate-slide-up"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary-500/20 mb-4 group-hover:bg-primary-500/30 transition-colors">
                <item.icon className="w-7 h-7 text-primary-400" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-white">{item.label}</h3>
              <p className="text-dark-400 text-sm">{item.desc}</p>
            </button>
          ))}
        </div>

        <div className="mt-12 glass-light rounded-xl p-6 text-center">
          <p className="text-dark-400 text-sm">
            המערכת מחוברת לימות המשיח. השחקנים מתקשרים לטלפון, מקישים קוד משחק, ועונים דרך הטלפון או דרך הנייד.
          </p>
        </div>

        <button
          onClick={() => setView('home')}
          className="hidden"
          aria-hidden
        >
          <Home className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export default App;
