export type GameStatus = 'lobby' | 'active' | 'finished';
export type QuestionType = 'trivia' | 'survey';

export interface Game {
  id: string;
  title: string;
  join_code: string;
  status: GameStatus;
  current_question_index: number;
  question_time_seconds: number;
  question_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  game_id: string;
  position: number;
  type: QuestionType;
  text: string;
  answer_1: string | null;
  answer_2: string | null;
  answer_3: string | null;
  answer_4: string | null;
  correct_answer: number | null;
  timer_seconds: number;
  created_at: string;
}

export interface Player {
  id: string;
  game_id: string;
  phone: string | null;
  name: string | null;
  score: number;
  connected: boolean;
  created_at: string;
}

export interface Answer {
  id: string;
  game_id: string;
  question_id: string;
  player_id: string;
  answer_value: number;
  response_time_ms: number | null;
  is_correct: boolean | null;
  created_at: string;
}

export interface IvrSettings {
  id: string;
  game_id: string;
  yemot_username: string | null;
  yemot_password: string | null;
  yemot_phone: string | null;
  access_code: string | null;
  welcome_message: string;
  question_intro_message: string;
  correct_message: string;
  wrong_message: string;
  thank_you_message: string;
  created_at: string;
}

export interface QuestionResult {
  answer_value: number;
  count: number;
  percentage: number;
}

export const ANSWER_COLORS = [
  { bg: 'bg-primary-500', text: 'text-white', light: 'bg-primary-100', border: 'border-primary-500' },
  { bg: 'bg-success-500', text: 'text-white', light: 'bg-success-100', border: 'border-success-500' },
  { bg: 'bg-accent-500', text: 'text-white', light: 'bg-accent-100', border: 'border-accent-500' },
  { bg: 'bg-error-500', text: 'text-white', light: 'bg-error-100', border: 'border-error-500' },
];

export const ANSWER_LABELS = ['א', 'ב', 'ג', 'ד'];

export function generateJoinCode(): string {
  const chars = '0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function getAnswerText(question: Question, index: number): string {
  switch (index) {
    case 1: return question.answer_1 ?? '';
    case 2: return question.answer_2 ?? '';
    case 3: return question.answer_3 ?? '';
    case 4: return question.answer_4 ?? '';
    default: return '';
  }
}

export function getAnswerCount(question: Question): number {
  let count = 0;
  if (question.answer_1) count++;
  if (question.answer_2) count++;
  if (question.answer_3) count++;
  if (question.answer_4) count++;
  return count;
}
