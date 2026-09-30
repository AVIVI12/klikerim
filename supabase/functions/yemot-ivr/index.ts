import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

interface YemotRequest {
  ApiCallId: string;
  ApiDID?: string;
  ApiRealDID?: string;
  ApiPhone?: string;
  ApiExtension?: string;
  ApiEnterID?: string;
  ApiHangupExtension?: string;
  step?: string;
  join_code?: string;
  answer_value?: string;
  counter?: string;
  [key: string]: string | undefined;
}

async function handleIvr(req: Request): Promise<Response> {
  let params: YemotRequest;

  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    params = await req.json();
  } else {
    const formData = await req.formData();
    params = {} as YemotRequest;
    for (const [key, value] of formData.entries()) {
      (params as Record<string, string>)[key] = value.toString();
    }
  }

  const callId = params.ApiCallId || '';
  const phone = params.ApiPhone || '';
  const counter = parseInt(params.counter || '0', 10);

  // Look up or create the call record
  let { data: callRecord } = await supabase
    .from('ivr_calls')
    .select('*')
    .eq('call_id', callId)
    .maybeSingle();

  if (!callRecord) {
    const { data: newCall } = await supabase
      .from('ivr_calls')
      .insert({
        call_id: callId,
        state: 'new',
        counter: 0,
      })
      .select('*')
      .single();
    callRecord = newCall;
  }

  // === STEP 0: Welcome message + ask for join code ===
  if (counter === 0 || !params.join_code) {
    await supabase.from('ivr_calls').update({ state: 'awaiting_code', counter: 0 }).eq('id', callRecord.id);
    return new Response(
      `read=t-ברוכים הבאים למשחק הטריוויה. אנא הקישו את קוד המשחק וסולמית=join_code,,6,6,Digits,yes`,
      { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } }
    );
  }

  // === STEP 1: Validate join code and register player ===
  if (counter === 1 && params.join_code) {
    const { data: game } = await supabase
      .from('games')
      .select('id, title, status, current_question_index, question_active')
      .eq('join_code', params.join_code)
      .maybeSingle();

    if (!game) {
      return new Response(
        `id_list_message=t-קוד המשחק שהוקש אינו תקין&go_to_folder=/hangup`,
        { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } }
      );
    }

    if (game.status === 'finished') {
      return new Response(
        `id_list_message=t-המשחק הסתיים. תודה על השתתפותכם&go_to_folder=/hangup`,
        { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } }
      );
    }

    // Register or find player by phone + game
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('id')
      .eq('game_id', game.id)
      .eq('phone', phone)
      .maybeSingle();

    let playerId: string;

    if (existingPlayer) {
      playerId = existingPlayer.id;
      await supabase.from('players').update({ connected: true }).eq('id', playerId);
    } else {
      const { data: newPlayer } = await supabase
        .from('players')
        .insert({
          game_id: game.id,
          phone: phone || null,
          name: phone ? `שחקן ${phone.slice(-4)}` : 'שחקן',
          connected: true,
        })
        .select('id')
        .single();

      if (!newPlayer) {
        return new Response(
          `id_list_message=t-שגיאה בהרשמה&go_to_folder=/hangup`,
          { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } }
        );
      }
      playerId = newPlayer.id;
    }

    // Update call record with game and player
    await supabase.from('ivr_calls').update({
      game_id: game.id,
      player_id: playerId,
      state: 'waiting',
      counter: 1,
    }).eq('id', callRecord.id);

    // Confirm connection - then enter polling loop
    return new Response(
      `id_list_message=t-נרשמת בהצלחה למשחק. המתן לשאלה&read=t-=poll,,1,1,Digits,no,no,*/&`,
      { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } }
    );
  }

  // === STEP 2+: Polling loop - check if question is active ===
  // The 'poll' parameter comes from the read in step 1
  if (counter >= 2) {
    if (!callRecord.game_id || !callRecord.player_id) {
      return new Response(
        `id_list_message=t-שגיאה&go_to_folder=/hangup`,
        { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } }
      );
    }

    // Refresh game state
    const { data: game } = await supabase
      .from('games')
      .select('id, status, current_question_index, question_active')
      .eq('id', callRecord.game_id)
      .maybeSingle();

    if (!game || game.status === 'finished') {
      await supabase.from('ivr_calls').update({ state: 'finished' }).eq('id', callRecord.id);
      return new Response(
        `id_list_message=t-המשחק הסתיים. תודה על השתתפותכם&go_to_folder=/hangup`,
        { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } }
      );
    }

    // Get current question
    const { data: questions } = await supabase
      .from('questions')
      .select('id, type, correct_answer, position, answer_1, answer_2, answer_3, answer_4')
      .eq('game_id', game.id)
      .order('position', { ascending: true });

    const currentQuestion = questions?.[game.current_question_index];

    if (!currentQuestion) {
      // No question available, keep waiting
      return new Response(
        `read=t-=poll,,1,1,Digits,no,no,*/&`,
        { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } }
      );
    }

    // Check if question is active and player hasn't answered yet
    if (game.question_active) {
      // Check if player already answered this question
      const { data: existingAnswer } = await supabase
        .from('answers')
        .select('id')
        .eq('question_id', currentQuestion.id)
        .eq('player_id', callRecord.player_id)
        .maybeSingle();

      if (existingAnswer) {
        // Already answered, go back to waiting
        return new Response(
          `read=t-=poll,,1,1,Digits,no,no,*/&`,
          { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } }
        );
      }

      // Check if this call already received an answer for this question
      if (callRecord.answered_question_id === currentQuestion.id) {
        // Already processed answer for this question, go back to waiting
        return new Response(
          `read=t-=poll,,1,1,Digits,no,no,*/&`,
          { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } }
        );
      }

      // Check if the 'poll' parameter has a value (player pressed a digit)
      if (params.poll && params.poll !== '' && params.poll !== 'poll') {
        const answerValue = parseInt(params.poll, 10);

        if (answerValue >= 1 && answerValue <= 4) {
          // Record the answer
          const isCorrect = currentQuestion.type === 'survey'
            ? null
            : currentQuestion.correct_answer === answerValue;

          await supabase.from('answers').insert({
            game_id: game.id,
            question_id: currentQuestion.id,
            player_id: callRecord.player_id,
            answer_value: answerValue,
            is_correct: isCorrect,
          });

          if (isCorrect) {
            await supabase.from('players')
              .update({ score: (await supabase.from('players').select('score').eq('id', callRecord.player_id).single()).data?.score + 10 })
              .eq('id', callRecord.player_id);
          }

          // Mark this question as answered in the call record
          await supabase.from('ivr_calls').update({
            answered_question_id: currentQuestion.id,
            state: 'answered',
          }).eq('id', callRecord.id);

          // Brief confirmation, then back to polling
          return new Response(
            `id_list_message=t-תשובה נרשמה&read=t-=poll,,1,1,Digits,no,no,*/&`,
            { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } }
          );
        }
      }

      // Question is active but no answer yet - ask for input silently
      // Use read with a short message (just a beep) and wait for digit
      const answerCount = [currentQuestion.answer_1, currentQuestion.answer_2, currentQuestion.answer_3, currentQuestion.answer_4].filter(Boolean).length;

      return new Response(
        `read=d-${answerCount}=poll,,1,1,Digits,no,no,*/&`,
        { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } }
      );
    }

    // Question not active, keep polling
    return new Response(
      `read=t-=poll,,1,1,Digits,no,no,*/&`,
      { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } }
    );
  }

  return new Response(
    `id_list_message=t-שגיאה&go_to_folder=/hangup`,
    { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } }
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    return await handleIvr(req);
  } catch (err) {
    return new Response(
      `id_list_message=t-שגיאת מערכת&go_to_folder=/hangup`,
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } }
    );
  }
});
