const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
if (typeof WebSocket === 'undefined') {
  try { globalThis.WebSocket = require('ws'); } catch (e) {}
}
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const [, , titleArg, studentArg] = process.argv;

const PAGE = 1000;

const fetchAllScoreRows = async (eventId, { studentsOnly = false } = {}) => {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase
      .from('scoring_scores')
      .select('*')
      .eq('event_id', eventId)
      .order('id')
      .range(from, from + PAGE - 1);
    if (studentsOnly) query = query.not('registration_id', 'is', null);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
};

const buildRoundRows = (orderedSubs, ownScores) => {
  const bySub = new Map();
  (ownScores || []).forEach(s => {
    const prev = bySub.get(s.subround_id);
    if (!prev) { bySub.set(s.subround_id, s); return; }
    const sHasScore = s.score != null && s.score !== '';
    const prevHasScore = prev.score != null && prev.score !== '';
    if (sHasScore && !prevHasScore) bySub.set(s.subround_id, s);
    else if (sHasScore === prevHasScore && String(s.updated_at || '') >= String(prev.updated_at || '')) bySub.set(s.subround_id, s);
  });
  const rounds = new Map();
  const order = [];
  orderedSubs.forEach(sub => {
    const row = bySub.get(sub.id);
    const hasScore = Boolean(row && row.score != null && row.score !== '');
    let score = hasScore ? Number(row.score) : 0;
    if (!Number.isFinite(score)) score = 0;
    let max = Number(sub.max);
    if (!Number.isFinite(max) || max < 0) max = 0;
    const key = sub.roundId != null ? sub.roundId : sub.roundName;
    if (!rounds.has(key)) {
      rounds.set(key, { roundName: sub.roundName, score: 0, max: 0, evaluated: false });
      order.push(key);
    }
    const r = rounds.get(key);
    if (hasScore) { r.score += score; r.evaluated = true; }
    r.max += max;
  });
  return order.map(key => {
    const r = rounds.get(key);
    return { roundName: r.roundName, score: r.evaluated ? r.score : null, max: r.max };
  });
};

(async () => {
  console.log('AVENTO scoring data check');
  console.log('Supabase project:', process.env.SUPABASE_URL || '(NOT SET)');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('FAIL: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in server/.env');
    process.exit(1);
  }

  let events;
  if (titleArg) {
    const { data, error } = await supabase.from('events').select('id,title').ilike('title', `*${titleArg}*`);
    if (error) throw error;
    events = data || [];
    if (events.length === 0) {
      console.log(`FAIL: no event matches "${titleArg}"`);
      process.exit(1);
    }
  } else {
    const { data, error } = await supabase.from('scoring_rounds').select('event_id');
    if (error) throw error;
    const ids = [...new Set((data || []).map(r => r.event_id))];
    const { data: evs } = await supabase.from('events').select('id,title').in('id', ids);
    events = evs || [];
    console.log(`\nEvents with scoring configured: ${events.length}`);
    events.forEach(e => console.log(`  ${e.id}  ${e.title}`));
    console.log('\nRun again with a title to check one event:');
    console.log('  node verify-score-rows.js "Coding Excellence" [rollNumberOrName]');
    return;
  }

  for (const event of events) {
    console.log(`\n=== ${event.title} (${event.id}) ===`);

    const { data: plain } = await supabase
      .from('scoring_scores')
      .select('id')
      .eq('event_id', event.id)
      .not('registration_id', 'is', null);
    const all = await fetchAllScoreRows(event.id, { studentsOnly: true });
    console.log(`score rows: ${all.length} (single unpaginated query sees only: ${(plain || []).length})`);
    if ((plain || []).length === PAGE && all.length > PAGE) {
      console.log(`PASS: pagination active - the old code would have silently dropped ${all.length - PAGE} rows`);
    } else if (all.length <= PAGE) {
      console.log('OK: event has fewer than 1000 rows, truncation never affected it');
    }

    const seen = new Map();
    let dups = 0;
    all.forEach(r => {
      const k = `${r.registration_id}:${r.subround_id}`;
      if (seen.has(k)) dups++; else seen.set(k, r);
    });
    console.log(`duplicate (student, criterion) rows: ${dups} ${dups === 0 ? 'PASS' : 'FAIL - fix before trusting reports'}`);

    const { data: rounds } = await supabase
      .from('scoring_rounds')
      .select('*, subrounds:scoring_subrounds(*)')
      .eq('event_id', event.id)
      .order('display_order');
    const subs = [];
    (rounds || []).forEach(r =>
      [...(r.subrounds || [])]
        .sort((a, b) => (Number(a.display_order) || 0) - (Number(b.display_order) || 0))
        .forEach(sr => subs.push({ id: sr.id, roundId: r.id, roundName: r.name, name: sr.name, max: Number(sr.max_score) }))
    );
    console.log(`rubric: ${subs.length} criteria across ${new Set(subs.map(s => s.roundId)).size} rounds`);

    const perStudent = new Map();
    all.forEach(r => {
      if (!perStudent.has(r.registration_id)) perStudent.set(r.registration_id, []);
      perStudent.get(r.registration_id).push(r);
    });
    console.log(`students with scores: ${perStudent.size}`);
    const partial = [...perStudent.entries()].filter(([, rows]) => rows.length < subs.length);
    if (partial.length) {
      console.log(`WARN: ${partial.length} student(s) have fewer than ${subs.length} scored criteria`);
      partial.slice(0, 5).forEach(([id, rows]) => console.log(`  ${id}: ${rows.length}/${subs.length}`));
    } else {
      console.log('PASS: every scored student has all criteria rows');
    }

    if (studentArg) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id,name,roll_number')
        .or(`name.ilike.*${studentArg}*,roll_number.ilike.*${studentArg}*`);
      const userIds = new Set((profs || []).map(p => p.id));
      const { data: regs } = await supabase
        .from('event_registrations')
        .select('id,user_id')
        .eq('event_id', event.id)
        .in('user_id', [...userIds]);
      const hit = (regs || []).find(r => perStudent.has(r.id));
      if (!hit) {
        console.log(`FAIL: no scored rows found for "${studentArg}" in this event`);
        continue;
      }
      const prof = (profs || []).find(p => p.id === hit.user_id) || {};
      console.log(`\n--- ${prof.name || '?'} (${prof.roll_number || '?'}) ---`);
      const own = perStudent.get(hit.id);
      const bySub = new Map(own.map(s => [s.subround_id, s]));
      subs.forEach(sub => {
        const row = bySub.get(sub.id);
        const score = row && row.score != null && row.score !== '' ? row.score : '(not scored)';
        console.log(`  ${sub.roundName} | ${sub.name}: ${score} / ${sub.max}${row && row.comment ? `  [comment: ${String(row.comment).trim()}]` : ''}`);
      });
      const rows = buildRoundRows(subs, own);
      console.log('  round totals (what the PDF will print):');
      let total = 0;
      rows.forEach(r => {
        total += r.score || 0;
        console.log(`    ${r.roundName}: ${r.score} / ${r.max}`);
      });
      console.log(`    TOTAL: ${total} / ${subs.reduce((s, x) => s + x.max, 0)}`);
      const missing = subs.filter(s => {
        const row = bySub.get(s.id);
        return !(row && row.score != null && row.score !== '');
      });
      console.log(missing.length === 0
        ? 'PASS: all entered marks are stored - the PDF will match the scorecard'
        : `WARN: ${missing.length} criterion mark(s) not in DB: ${missing.map(m => m.name).join(', ')}`);
    }
  }
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
