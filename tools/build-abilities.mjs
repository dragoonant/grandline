#!/usr/bin/env node
// tools/build-abilities.mjs — compile Bandai's printed card text into the effect grammar.
//
// CLAUDE.md hard rule 8: an ability the grammar cannot express FAILS AUTHORING LOUDLY. A clause
// this compiler cannot read becomes {unimplemented: '<the clause>'}, validation rejects the card
// from any registered deck, and the deck picker hides anything that needs it. Nothing silently
// half-works.
//
// The printed text is highly templated, which is why a pattern compiler is the right tool here
// rather than 2,785 hand-authored abilities. Coverage is printed at the end and is the number to
// watch: it decides which cards a deck may contain.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const printedSrc = await readFile(join(ROOT, 'data', 'printed.js'), 'utf8');
const sandbox = { window: {} };
new Function('window', printedSrc)(sandbox.window);
const PRINTED = sandbox.window.OP.printed;

// ---------------------------------------------------------------------------------------
// Keyword effects that are whole abilities by themselves (CR 10-1).
// ---------------------------------------------------------------------------------------
const KEYWORDS = {
  '[Blocker]': 'blocker',
  '[Rush]': 'rush',
  '[Rush: Character]': 'rushCharacter',
  '[Double Attack]': 'doubleAttack',
  '[Banish]': 'banish',
  '[Unblockable]': 'unblockable'
};

const TIMING = {
  '[On Play]': 'onPlay',
  '[When Attacking]': 'whenAttacking',
  '[On Block]': 'onBlock',
  '[On K.O.]': 'onKO',
  '[End of Your Turn]': 'endOfYourTurn',
  "[End of Your Opponent's Turn]": 'endOfOpponentTurn',
  '[Activate: Main]': 'activateMain',
  '[Main]': 'main',
  '[Counter]': 'counter',
  '[Trigger]': 'trigger',
  "[On Your Opponent's Attack]": 'onOpponentAttack',
  '[When Attacked]': 'whenAttacked'
};

const norm = (s) => s
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/−/g, '-')          // the printed minus sign
  .replace(/・/g, '.')
  .replace(/\s+/g, ' ')
  .trim();

// CR 2-8-4-1 — explanatory notes in parentheses do not influence gameplay.
const stripNotes = (s) => s.replace(/\s*\((?:[^()]|\([^()]*\))*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

// =========================================================================================
// Selector parser — "up to 1 of your opponent's rested Characters with a cost of 3 or less"
// =========================================================================================
function parseSel(raw, { defaultSide = 'any' } = {}) {
  let t = ' ' + norm(raw) + ' ';
  // "this Leader" / "this Character" / "this card" is the source itself.
  if (/^\s*this (Leader|Character|card)\s*$/i.test(norm(raw))) {
    return { onlySelf: true, of: ['leader', 'character'], min: 1, max: 1 };
  }
  const sel = {};

  let m = t.match(/\bup to (\d+)\b/i);
  if (m) { sel.min = 0; sel.max = +m[1]; }
  else {
    m = t.match(/^\s*(\d+)\s+of\b/i);
    if (m) { sel.min = +m[1]; sel.max = +m[1]; } else { sel.min = 1; sel.max = 1; }
  }

  if (/your opponent's/i.test(t)) sel.side = 'opp';
  else if (/\byour\b/i.test(t)) sel.side = 'you';
  else sel.side = defaultSide;

  const of = [];
  if (/\bLeader\b/i.test(t)) of.push('leader');
  if (/\bCharacter/i.test(t)) of.push('character');
  if (/\bStage/i.test(t)) of.push('stage');
  if (!of.length) return null;
  sel.of = of;

  if (/\brested\b/i.test(t)) sel.state = 'rested';
  else if (/\bactive\b/i.test(t)) sel.state = 'active';

  m = t.match(/\{([^}]+)\}\s*(?:or\s*\{([^}]+)\}\s*)?type/i);
  if (m) { if (m[2]) sel.types = [m[1], m[2]]; else sel.type = m[1]; }

  // CR 2-4-3-1 — a type in quotation marks means "a type CONTAINING this text".
  m = t.match(/with a type including "([^"]+)"/i);
  if (m) sel.typeIncludes = m[1];

  // CR 2-1-2 — [Name] in brackets with no clarifying noun means cards with that card name.
  const nameTags = [...t.matchAll(/\[([A-Z][^\]]*)\]/g)].map((x) => x[1])
    .filter((n) => !/^(Blocker|Rush|Trigger|Counter|Banish|Double Attack|Unblockable|Main|On Play)$/i.test(n));
  if (nameTags.length) sel.names = nameTags;

  m = t.match(/with a cost of (\d+) or less/i);           if (m) sel.costMax = +m[1];
  m = t.match(/with a cost of (\d+) or more/i);           if (m) sel.costMin = +m[1];
  m = t.match(/with (\d+) power or less/i);               if (m) sel.powerMax = +m[1];
  m = t.match(/with (\d+) power or more/i);               if (m) sel.powerMin = +m[1];
  m = t.match(/with (\d+) base power or more/i);          if (m) sel.basePowerMin = +m[1];
  if (/other than this card/i.test(t)) sel.notSelf = true;
  m = t.match(/\[(Blocker)\]/i);                          if (m) sel.hasKw = 'blocker';

  // Anything we did not consume is an unmodelled filter, and an unmodelled filter is a refusal
  // (hard rule 8). Strip every phrase this parser actually understands, in longest-first order,
  // and whatever survives is the reason we cannot read the selector.
  const KNOWN = [
    /with a type including "[^"]+"/gi,
    /\[[A-Z][^\]]*\]/g,
    /with a cost of \d+ or (?:less|more)/gi,
    /with \d+ (?:base )?power or (?:less|more)/gi,
    /other than this card/gi,
    /in your Character area/gi,
    /on (?:your|the) field/gi,
    /\{[^}]*\}/g,
    /\[Blocker\]/gi,
    /\bup to\b|\bof\b|\byour opponent's\b|\byour\b|\bLeaders?\b|\bCharacters?\b|\bStages?\b/gi,
    /\bcards?\b|\brested\b|\bactive\b|\btype\b|\bor\b|\band\b|\bthe\b|\ba\b|\ban\b|\ball\b|\bof\b/gi,
    /\d+/g,
    /[.,;:]/g
  ];
  let rest = t;
  for (const re of KNOWN) rest = rest.replace(re, ' ');
  if (rest.replace(/\s+/g, ' ').trim()) return null;
  return sel;
}

// STRICT. The tail group must BE a duration phrase, not merely contain one.
//
// This was not strict, and it cost a silent drop of exactly the kind hard rule 8 exists to
// prevent. On OP02-013 the clause
//   "Give up to 2 of your opponent's Characters -3000 power during this turn. Then, if your
//    Leader's type includes ..., this Character gains [Rush] during this turn."
// matched as one "Give ... power <tail>" because the tail merely CONTAINED "during this turn".
// The second sentence was swallowed, the card compiled clean, and only tools/audit-cards.mjs
// could see it — a test cannot, because both sides of a test come from the same ability data.
const DUR = (t) => {
  const x = norm(t).replace(/\.$/, '').trim();
  if (/^during this battle$/i.test(x)) return 'battle';
  if (/^during this turn$/i.test(x)) return 'turn';
  if (/^until the end of (?:this|the) turn$/i.test(x)) return 'turn';
  if (/^until the end of your opponent's next End Phase$/i.test(x)) return 'oppEnd';
  if (/^until the end of your next turn$/i.test(x)) return 'oppEnd';
  return null;
};

// =========================================================================================
// Body parser — one clause to a list of ops, or null if we cannot read it.
// =========================================================================================
function parseClause(raw) {
  const t = norm(raw).replace(/\.$/, '');
  let m;

  if ((m = t.match(/^Draw (\d+) cards?$/i)))
    return [{ k: 'draw', n: +m[1] }];

  if ((m = t.match(/^K\.?O\.? (.+)$/i))) {
    const sel = parseSel(m[1], { defaultSide: 'opp' });
    return sel ? [{ k: 'ko', sel }] : null;
  }

  // "Give <sel> +/-N power <duration>", and the no-duration form, which is a permanent effect
  // (CR 8-1-3-3) and is marked so by parseLine when it sees no timing tag.
  if ((m = t.match(/^Give (.+?) ([+-])(\d+) power(?: (.+))?$/i))) {
    const sel = parseSel(m[1]);
    const until = m[4] ? DUR(m[4]) : 'turn';
    if (!sel || !until) return null;
    return [{ k: 'power', sel, n: (m[2] === '-' ? -1 : 1) * +m[3], until }];
  }

  // "Up to 1 of your [Name] Characters or up to 1 of your Characters with a type including
  //  "X", with N power or more, gains [Rush] during this turn." Two alternative selectors and
  //  one shared filter; the union is the same set of legal targets either way.
  if ((m = t.match(/^Up to (\d+) of your (.+?) or up to \d+ of your (.+?), with (\d+) power or more, gains? (\[[^\]]+\]) (.+)$/i))) {
    const kw = KEYWORDS[m[5]];
    const until = DUR(m[6]);
    const a = parseSel('your ' + m[2], { defaultSide: 'you' });
    const b = parseSel('your ' + m[3], { defaultSide: 'you' });
    if (!kw || !until || !a || !b) return null;
    const sel = { side: 'you', of: ['character'], min: 0, max: +m[1], powerMin: +m[4],
                  anyOf: [{ names: a.names, typeIncludes: a.typeIncludes },
                          { names: b.names, typeIncludes: b.typeIncludes }] };
    return [{ k: 'gainKw', kw, sel, until }];
  }

  // "All of your Characters with a cost of N or more gain [Blocker]" — the plural keyword grant.
  if ((m = t.match(/^All of your (.+?) gains? (\[[^\]]+\])$/i))) {
    const kw = KEYWORDS[m[2]];
    const sel = parseSel('your ' + m[1], { defaultSide: 'you' });
    if (kw && sel) { sel.min = 0; sel.max = 99; return [{ k: 'gainKw', kw, sel }]; }
    return null;
  }

  // "All of your [Name] and [Name] cards gain +N power" — a selector by CARD NAME (CR 2-1-2).
  if ((m = t.match(/^All of your ((?:\[[^\]]+\](?:\s+and\s+)?)+) cards? gains? ([+-])(\d+) power(?: (.+))?$/i))) {
    const names = [...m[1].matchAll(/\[([^\]]+)\]/g)].map((x) => x[1]);
    const until = m[4] ? DUR(m[4]) : 'turn';
    if (!until) return null;
    return [{ k: 'power', n: (m[2] === '-' ? -1 : 1) * +m[3], until,
              sel: { side: 'you', of: ['leader', 'character'], names, min: 0, max: 99 } }];
  }

  // "your Leader and all of your Characters gain +N power"
  if ((m = t.match(/^your Leader and all of your Characters gains? ([+-])(\d+) power(?: (.+))?$/i))) {
    const until = m[3] ? DUR(m[3]) : 'turn';
    if (!until) return null;
    return [{ k: 'power', n: (m[1] === '-' ? -1 : 1) * +m[2], until,
              sel: { side: 'you', of: ['leader', 'character'], min: 0, max: 99 } }];
  }

  // "Reveal 1 card from the top of your deck. If the revealed card's type includes "X", draw N."
  // One op, two sentences, so it is matched before the sentence splitter (CR 11-2).
  if ((m = t.match(/^Reveal (\d+) cards? from the top of your deck\. If the revealed card's type includes "([^"]+)", draw (\d+) cards?$/i)))
    return [{ k: 'revealTop', n: +m[1], typeIncludes: m[2], thenDraw: +m[3] }];

  // "Under the rules of this game, your DON!! deck consists of N cards." CR 8-1-3-3-3 — a
  // permanent effect that is valid even while the card is in a secret area.
  if ((m = t.match(/^Under the rules of this game, your DON!! deck consists of (\d+) cards?$/i)))
    return [{ k: 'donDeckSize', n: +m[1] }];

  // "Add 1 card from the top of your Life cards to your hand." CR 3-10-2.
  if ((m = t.match(/^Add (\d+) cards? from the top of your Life cards? to your hand$/i)))
    return [{ k: 'lifeToHand', n: +m[1] }];

  // "Add up to N DON!! card from your DON!! deck and rest it."
  if ((m = t.match(/^Add up to (\d+) DON!! cards? from your DON!! deck and rest (?:it|them)$/i)))
    return [{ k: 'addDon', n: +m[1], rested: true }];

  // "you cannot play Character cards during this turn"
  if (/^you cannot play Character cards during this turn$/i.test(t))
    return [{ k: 'lockPlay', what: 'CHARACTER' }];

  // "your {A} or {B} type Leaders and Characters gain +N power" — the plural form.
  if ((m = t.match(/^(.+?) gain ([+-])(\d+) power(?: (.+))?$/i))) {
    const n2 = (m[2] === '-' ? -1 : 1) * +m[3];
    const until2 = m[4] ? DUR(m[4]) : 'turn';
    const sel2 = parseSel(m[1].replace(/\bLeaders\b/gi, 'Leader').replace(/\bCharacters\b/gi, 'Character'),
                          { defaultSide: 'you' });
    if (sel2 && until2) { sel2.min = 0; sel2.max = 99; return [{ k: 'power', sel: sel2, n: n2, until: until2 }]; }
    return null;
  }

  // "<sel> gains +N power <duration>"  /  "This Character gains +N power"
  if ((m = t.match(/^(.+?) gains? ([+-])(\d+) power(?: (.+))?$/i))) {
    const n = (m[2] === '-' ? -1 : 1) * +m[3];
    const until = m[4] ? DUR(m[4]) : 'turn';
    if (!until) return null;
    if (/^this (card|character|leader)$/i.test(m[1].trim()))
      return [{ k: 'power', sel: { onlySelf: true, of: ['leader', 'character'], min: 1, max: 1 }, n, until }];
    const sel = parseSel(m[1], { defaultSide: 'you' });
    return sel ? [{ k: 'power', sel, n, until }] : null;
  }

  // "This Character gains [Rush]"
  if ((m = t.match(/^This (?:Character|card) gains? (\[[^\]]+\])$/i))) {
    const kw = KEYWORDS[m[1]];
    return kw ? [{ k: 'gainKw', kw, sel: { onlySelf: true, of: ['character'], min: 1, max: 1 } }] : null;
  }

  if ((m = t.match(/^Rest (?:up to )?(\d+) of your opponent's DON!! cards?$/i)))
    return [{ k: 'restOppDon', n: +m[1] }];

  if ((m = t.match(/^Set (?:up to )?(\d+) of your DON!! cards? as active$/i)))
    return [{ k: 'setDonActive', n: +m[1] }];

  if ((m = t.match(/^Rest (.+)$/i))) {
    const sel = parseSel(m[1], { defaultSide: 'opp' });
    return sel ? [{ k: 'rest', sel }] : null;
  }

  if ((m = t.match(/^Set (?:this (?:Leader|Character|card)) as active$/i)))
    return [{ k: 'setActive', sel: { onlySelf: true, of: ['leader', 'character'], min: 1, max: 1 } }];

  if ((m = t.match(/^Set (.+?) as active$/i))) {
    const sel = parseSel(m[1], { defaultSide: 'you' });
    return sel ? [{ k: 'setActive', sel }] : null;
  }

  // "Give this Leader or 1 of your Characters up to N rested DON!! card(s)"
  if ((m = t.match(/^Give (?:this Leader or (?:up to )?\d+ of your Characters|your Leader or (?:up to )?\d+ of your Characters) up to (\d+) (rested )?DON!! cards?$/i)))
    return [{ k: 'giveDon', n: +m[1], from: m[2] ? 'rested' : 'active',
              sel: { side: 'you', of: ['leader', 'character'], min: 0, max: 1 } }];

  // "Give up to N (rested) DON!! card(s) to <target>" — the target is parsed as a selector, so
  // "1 of your Characters", "your Leader or 1 of your Characters" and "up to 1 of your {T} type
  // Characters" all read, instead of one hardcoded phrasing per printing.
  if ((m = t.match(/^Give up to (\d+) (rested )?DON!! cards? to (.+)$/i))) {
    const sel = parseSel(m[3], { defaultSide: 'you' });
    if (sel) return [{ k: 'giveDon', n: +m[1], from: m[2] ? 'rested' : 'active', sel }];
    return null;
  }

  if (/^Your opponent cannot activate \[Blocker\] during this battle$/i.test(t))
    return [{ k: 'noBlocker', scope: 'battle' }];

  if ((m = t.match(/^Your opponent cannot activate an? \[Blocker\] Character that has (\d+) or more power during this battle$/i)))
    return [{ k: 'noBlocker', scope: 'battle', powerMin: +m[1] }];

  if (/^Play this card$/i.test(t)) return [{ k: 'playSelf' }];

  if ((m = t.match(/^Trash (\d+) cards? from your hand$/i)))
    return [{ k: 'trashHand', n: +m[1] }];

  // "Look at N cards from the top of your deck; reveal up to 1 {T} type card and add it to your
  //  hand. Then, place the rest at the bottom of your deck in any order"
  if ((m = t.match(/^Look at (\d+) cards? from the top of your deck; reveal up to (\d+) (?:\{([^}]+)\} type )?card(?: other than \[([^\]]+)\])? and add it to your hand$/i)))
    return [{ k: 'lookAdd', n: +m[1], add: +m[2], type: m[3] || undefined,
              excludeName: m[4] || undefined }];

  if ((m = t.match(/^Play up to (\d+) (?:\{([^}]+)\} type )?card(?: with a cost of (\d+) or less)? from your hand$/i)))
    return [{ k: 'playFromHand', n: +m[1], type: m[2] || undefined,
              costMax: m[3] === undefined ? undefined : +m[3] }];

  // lookAdd's second sentence. "Then, place the rest at the bottom of your deck in any order"
  // describes what lookAdd already does (CR 11-3-3), so it contributes no ops of its own.
  if (/^place the rest at the (?:bottom|top) of your deck in any order$/i.test(t)) return [];

  // "Look at N cards from the top of your deck and place them at the top or bottom of your deck
  //  in any order." — a pure look with no take.
  if ((m = t.match(/^Look at (\d+) cards? from the top of your deck and place them at the (?:top or bottom|bottom or top|top|bottom) of your deck in any order$/i)))
    return [{ k: 'lookAdd', n: +m[1], add: 0 }];

  // "Reveal 1 card from the top of your deck. If the revealed card's type includes "X", draw N
  //  cards." CR 11-2 — one op written as two sentences, so it is matched whole.
  if ((m = t.match(/^Reveal (\d+) cards? from the top of your deck\. If the revealed card's type includes "([^"]+)", draw (\d+) cards?$/i)))
    return [{ k: 'revealTop', n: +m[1], typeIncludes: m[2], thenDraw: +m[3] }];

  // "add up to N DON!! cards from your DON!! deck and set it as active, and add up to M
  //  additional DON!! cards and rest them" — two additions, one active and one rested.
  if ((m = t.match(/^[Aa]dd up to (\d+) DON!! cards? from your DON!! deck and set (?:it|them) as active, and add up to (\d+) additional DON!! cards? and rest (?:it|them)$/i)))
    return [{ k: 'addDon', n: +m[1] }, { k: 'addDon', n: +m[2], rested: true }];

  // "Add up to N DON!! card(s) from your DON!! deck and set it as active." CR 3-3.
  if ((m = t.match(/^Add up to (\d+) DON!! cards? from your DON!! deck and set (?:it|them) as active$/i)))
    return [{ k: 'addDon', n: +m[1] }];

  // "Return up to N Character with a cost of N or less to the owner's hand." CR 4-11.
  if ((m = t.match(/^Return (.+?) to (?:the )?owner's hand$/i))) {
    const sel = parseSel(m[1], { defaultSide: 'any' });
    return sel ? [{ k: 'bounce', sel, to: 'hand' }] : null;
  }
  if ((m = t.match(/^Return (.+?) to the (?:top|bottom) of (?:the |its |their )?owner's deck$/i))) {
    const sel = parseSel(m[1], { defaultSide: 'any' });
    const where = /top of/i.test(t) ? 'top' : 'bottom';
    return sel ? [{ k: 'bounce', sel, to: where }] : null;
  }

  if ((m = t.match(/^Place (.+?) at the (top|bottom) of (?:the |its |their )?owner's deck$/i))) {
    const sel = parseSel(m[1], { defaultSide: 'any' });
    return sel ? [{ k: 'bounce', sel, to: m[2].toLowerCase() }] : null;
  }

  // "Select up to 1 of your {T} type Leader or Character cards. Your opponent cannot activate
  //  [Blocker] if that Leader or Character attacks during this turn." — one op, two sentences,
  //  so it is matched whole before the sentence splitter ever sees it.
  if ((m = t.match(/^Select (.+?)\. Your opponent cannot activate \[Blocker\] if that (?:Leader or Character|Character|Leader) attacks during this turn$/i))) {
    const sel = parseSel(m[1], { defaultSide: 'you' });
    return sel ? [{ k: 'markNoBlocker', sel }] : null;
  }

  return null;
}

// "Then, X" and "Then X" chain onto the previous ops (CR 4-10-2).
function parseBody(body) {
  const cleaned = stripNotes(norm(body));
  if (!cleaned) return { ops: [], bad: null };
  // Split on sentence boundaries that are not inside {} or [].
  // Some printed effects are one op written as two sentences ("Select ... . Your opponent
  // cannot activate [Blocker] if that ... attacks during this turn."), so the whole body gets a
  // look before it is cut up.
  // The whole-body attempt is restricted to the handful of printed effects that are genuinely
  // ONE op written as two sentences. Letting every pattern see the whole body is how a greedy
  // tail group swallows the sentence after it — see the note on DUR.
  const MULTI_SENTENCE = /^Select .+\. Your opponent cannot activate \[Blocker\]|^Reveal \d+ card .+\. If the revealed card/i;
  if (MULTI_SENTENCE.test(cleaned)) {
    const whole = parseClause(cleaned);
    if (whole) return { ops: whole, bad: null };
  } else if (!/\.\s+[A-Z[]/.test(cleaned)) {
    const whole = parseClause(cleaned);
    if (whole) return { ops: whole, bad: null };
  }
  const parts = cleaned.split(/(?<=\.)\s+(?=[A-Z[])/).map((x) => x.trim()).filter(Boolean);
  const ops = [];
  for (const part of parts) {
    const clause = part.replace(/^Then,?\s*/i, '').replace(/^Also,?\s*/i, '');
    let got = parseClause(clause);
    if (!got && / and /i.test(clause)) {
      // "Draw 2 cards and trash 1 card from your hand." — two ops in one sentence. Only split
      // when the whole clause failed, so an " and " inside a selector is never cut in half.
      const halves = clause.split(/\s+and\s+/i);
      const each = halves.map((h) => parseClause(h.replace(/\.$/, '')));
      if (each.every(Boolean)) got = each.flat();
    }
    if (!got) return { ops: null, bad: clause };
    ops.push(...got);
  }
  return { ops, bad: null };
}

// =========================================================================================
// Line parser — tags, conditions, cost, body.
// =========================================================================================
function parseLine(line) {
  let t = norm(line);
  if (!t || t === '-') return null;

  // Bare keyword lines: "[Blocker]" (its explanatory note already stripped later).
  const bare = stripNotes(t);
  if (KEYWORDS[bare]) return { keyword: KEYWORDS[bare] };

  const conds = [];
  let when = null, alsoWhen = null, once = false;

  // Consume leading bracket tags.
  let guard = 0;
  for (;;) {
    if (++guard > 12) break;
    // "[When Attacking]/[On Your Opponent's Attack]" — one ability with two activation
    // timings (CR 10-2-5 / 10-2-16). Compiled as the first; the second is recorded so the
    // engine can fire it from either window.
    const dual = t.match(/^(\[[^\]]+\])\/(\[[^\]]+\])\s*/);
    if (dual && TIMING[dual[1]] && TIMING[dual[2]]) {
      when = TIMING[dual[1]];
      alsoWhen = TIMING[dual[2]];
      t = t.slice(dual[0].length);
      continue;
    }
    const m = t.match(/^(\[[^\]]+\])\s*/);
    if (!m) break;
    const tag = m[1];
    if (TIMING[tag]) { when = TIMING[tag]; t = t.slice(m[0].length); continue; }
    if (tag === '[Once Per Turn]') { once = true; t = t.slice(m[0].length); continue; }
    if (tag === '[Your Turn]') { conds.push({ k: 'yourTurn' }); t = t.slice(m[0].length); continue; }
    if (tag === "[Opponent's Turn]") { conds.push({ k: 'opponentTurn' }); t = t.slice(m[0].length); continue; }
    const dm = tag.match(/^\[DON!! ?x(\d+)\]$/i);
    if (dm) { conds.push({ k: 'donAtLeast', n: +dm[1] }); t = t.slice(m[0].length); continue; }
    if (KEYWORDS[tag]) { return { keyword: KEYWORDS[tag], rest: t.slice(m[0].length).trim() }; }
    break;
  }

  t = stripNotes(t);
  if (!t) return when || conds.length ? { unreadable: line } : null;

  // Activation cost: everything before a top-level ":" (CR 8-3-1).
  let cost = [], optional = false;
  const ci = t.indexOf(':');
  if (ci > 0 && !/^\s*\[/.test(t)) {
    const costText = t.slice(0, ci).trim();
    const parsed = parseCost(costText);
    if (parsed) { cost = parsed.cost; optional = parsed.optional; t = t.slice(ci + 1).trim(); }
    else return { unreadable: line };
  }

  // CR 8-3-1-6 — "DON!! -N" written inline is an activation cost, not a sentence.
  let dmm = t.match(/^DON!! ?-(\d+)\s*/i);
  if (dmm) { cost.push({ k: 'donMinus', n: +dmm[1] }); t = t.slice(dmm[0].length).trim(); }

  // Inline "If ..." conditions we understand.
  let cm;
  if ((cm = t.match(/^If you have (\d+) or more Characters,\s*/i))) {
    conds.push({ k: 'charCountAtLeast', n: +cm[1] }); t = t.slice(cm[0].length);
  } else if ((cm = t.match(/^If you have (\d+) or less Life cards?,\s*/i))) {
    conds.push({ k: 'lifeAtMost', n: +cm[1] }); t = t.slice(cm[0].length);
  } else if ((cm = t.match(/^If you have (\d+) or more Life cards?,\s*/i))) {
    conds.push({ k: 'lifeAtLeast', n: +cm[1] }); t = t.slice(cm[0].length);
  } else if ((cm = t.match(/^If (?:you have|there is) an? Character with a cost of (\d+) or more,\s*/i))) {
    conds.push({ k: 'haveCharCostAtLeast', n: +cm[1] }); t = t.slice(cm[0].length);
  } else if ((cm = t.match(/^If (?:you have|there is) an? Character with (\d+) base power or more,\s*/i))) {
    conds.push({ k: 'haveCharBasePowerAtLeast', n: +cm[1] }); t = t.slice(cm[0].length);
  } else if ((cm = t.match(/^If it is your second turn or later,\s*/i))) {
    conds.push({ k: 'turnAtLeast', n: 2 }); t = t.slice(cm[0].length);
  } else if ((cm = t.match(/^If this Character battles your opponent's (Character|Leader),\s*/i))) {
    // CR 7-1-5-2 — "if this ... battles" activates at the End of the Battle.
    when = 'endOfBattle';
    conds.push({ k: 'battled', what: cm[1].toLowerCase() });
    t = t.slice(cm[0].length);
  } else if ((cm = t.match(/^If this Character is rested,\s*/i))) {
    conds.push({ k: 'selfRested' }); t = t.slice(cm[0].length);
  } else if ((cm = t.match(/^If your opponent's Leader has the <([^>]+)> attribute,\s*/i))) {
    conds.push({ k: 'oppAttrIs', attr: cm[1] }); t = t.slice(cm[0].length);
  } else if ((cm = t.match(/^If your Leader has the \{([^}]+)\} type,\s*/i))) {
    conds.push({ k: 'leaderType', type: cm[1] }); t = t.slice(cm[0].length);
  } else if ((cm = t.match(/^If your opponent has (\d+) or less Life cards?,\s*/i))) {
    conds.push({ k: 'oppLifeAtMost', n: +cm[1] }); t = t.slice(cm[0].length);
  } else if ((cm = t.match(/^If you have (\d+) or more DON!! cards? on your field,\s*/i))) {
    conds.push({ k: 'donOnFieldAtLeast', n: +cm[1] }); t = t.slice(cm[0].length);
  } else if ((cm = t.match(/^If your opponent has (\d+) or more Characters?,\s*/i))) {
    conds.push({ k: 'oppCharCountAtLeast', n: +cm[1] }); t = t.slice(cm[0].length);
  } else if (/^If /i.test(t)) {
    return { unreadable: line };
  }

  const { ops, bad } = parseBody(t);
  if (!ops) return { unreadable: line, why: bad };

  // CR 8-1-3-3 — a clause with no timing tag that cannot be an auto, activate or replacement
  // effect IS a permanent effect. Only power changes and keyword grants are modelled as
  // permanent; anything else with no timing tag is still refused.
  if (!when) {
    const permanent = ops.length > 0 && ops.every(function (o) {
      if (o.k === 'gainKw' || o.k === 'donDeckSize') return true;
      // A permanent power change must have no duration clause — "during this turn" would make
      // it a one-shot continuous effect with nothing to trigger it.
      return o.k === 'power' && !/during this (?:turn|battle)|until the end of/i.test(t);
    });
    if (!permanent) return { unreadable: line, why: 'no timing tag (permanent effect)' };
    return { ability: { when: 'static', alsoWhen: null, conds, once, cost, optional, ops, text: norm(line) } };
  }

  return { ability: { when, alsoWhen, conds, once, cost, optional, ops, text: norm(line) } };
}

function parseCost(text) {
  const cost = [];
  let optional = false;
  let t = norm(text);
  if (/^You may /i.test(t)) { optional = true; t = t.replace(/^You may /i, ''); }
  const parts = t.split(/\s+and\s+/i);
  for (let part of parts) {
    part = part.trim().replace(/^You may /i, '');
    let m;
    if ((m = part.match(/^rest (\d+) (?:of your )?DON!! cards?$/i))) { cost.push({ k: 'restDon', n: +m[1] }); continue; }
    if ((m = part.match(/^trash (\d+) cards? from your hand$/i))) { cost.push({ k: 'trashHand', n: +m[1] }); continue; }
    if ((m = part.match(/^trash (\d+) cards? with an? \[Trigger\] from your hand$/i))) {
      cost.push({ k: 'trashHand', n: +m[1], withTrigger: true }); continue;
    }
    if (/^rest this (Character|card|Stage|Leader)$/i.test(part)) { cost.push({ k: 'restSelf' }); continue; }
    if ((m = part.match(/^DON!! ?-(\d+)$/i))) { cost.push({ k: 'donMinus', n: +m[1] }); continue; }
    if ((m = part.match(/^rest (\d+) of your cards?$/i))) { cost.push({ k: 'restOwn', n: +m[1] }); continue; }
    return null;
  }
  return { cost, optional };
}

// The circled-digit cost symbols (CR 8-3-1-5) appear on some English cards.
const CIRCLED = { '➀': 1, '➁': 2, '➂': 3, '➃': 4, '➄': 5, '➅': 6,
                  '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5, '⑥': 6,
                  '❶': 1, '❷': 2, '❸': 3, '❹': 4, '❺': 5 };
function expandCircled(s) {
  return s.replace(/[①-⑥❶-❺➀-➅]/g, (ch) =>
    CIRCLED[ch] ? `rest ${CIRCLED[ch]} DON!! cards and ` : ch);
}

// =========================================================================================
// Compile
// =========================================================================================
const out = [];
let full = 0, partial = 0, vanilla = 0;
const badClauses = new Map();

for (const c of PRINTED) {
  const rec = { id: c.id, keywords: [], abilities: [] };
  const bad = [];
  const lines = [];
  if (c.text && c.text !== '-') lines.push(...c.text.split('\n'));
  if (c.trigger && c.trigger !== '-') lines.push(...c.trigger.split('\n'));

  for (let line of lines) {
    line = expandCircled(line);
    // "Activate this card's [Main] effect." on a [Trigger] — resolved after the fact below.
    if (/\[Trigger\]\s*Activate this card's \[Main\] effect/i.test(norm(line))) {
      rec._triggerIsMain = true; continue;
    }
    let r;
    try { r = parseLine(line); } catch (e) { r = { unreadable: line, why: e.message }; }
    if (!r) continue;
    if (r.keyword) {
      if (rec.keywords.indexOf(r.keyword) < 0) rec.keywords.push(r.keyword);
      if (r.rest) {
        const r2 = parseLine(r.rest);
        if (r2 && r2.ability) rec.abilities.push(r2.ability);
        else if (r2) bad.push(r.rest);
      }
      continue;
    }
    if (r.ability) {
      rec.abilities.push(r.ability);
      // CR 10-2-5 / 10-2-16 — "[When Attacking]/[On Your Opponent's Attack]" prints ONE effect
      // under two timings. Emit one ability per timing; dropping the second is a silent loss of
      // half the card, and the auditor is what caught it on OP17-058 Kaido.
      if (r.ability.alsoWhen) {
        rec.abilities.push(Object.assign({}, r.ability, { when: r.ability.alsoWhen, alsoWhen: null }));
        r.ability.alsoWhen = null;          // the second timing is its own ability now
      }
      continue;
    }
    bad.push(r.why ? `${norm(line)}   [${r.why}]` : norm(line));
  }

  if (rec._triggerIsMain) {
    const main = rec.abilities.find((a) => a.when === 'main');
    if (main) rec.abilities.push({ ...main, when: 'trigger', text: "[Trigger] Activate this card's [Main] effect." });
    else bad.push("[Trigger] Activate this card's [Main] effect. (no [Main] to copy)");
    delete rec._triggerIsMain;
  }

  if (bad.length) {
    rec.unimplemented = bad.join(' | ');
    partial++;
    for (const b of bad) {
      const key = b.replace(/\d+/g, 'N').replace(/\{[^}]*\}/g, '{T}').slice(0, 90);
      badClauses.set(key, (badClauses.get(key) || 0) + 1);
    }
  } else if (!lines.length) { vanilla++; full++; }
  else full++;

  out.push(rec);
}

const header = `// data/abilities.js — GENERATED by tools/build-abilities.mjs. Do not edit by hand.
//
// The effect grammar compiled from the printed text in data/printed.js. A card whose text this
// compiler cannot read carries \`unimplemented\` with the exact clause that defeated it;
// validation refuses it from any registered deck and the deck picker hides anything needing it
// (CLAUDE.md hard rule 8).
//
//   ${out.length} cards · ${full} fully compiled (${vanilla} with no text at all) · ${partial} with an unreadable clause
`;
await writeFile(join(ROOT, 'data', 'abilities.js'),
`${header}
(function (NS) {
  'use strict';
  NS.abilities = {
${out.map((r) => `    ${JSON.stringify(r.id)}: ${JSON.stringify({ keywords: r.keywords, abilities: r.abilities, unimplemented: r.unimplemented })}`).join(',\n')}
  };
}(window.OP = window.OP || {}));
`);

console.log(`${out.length} cards · ${full} compiled (${(100 * full / out.length).toFixed(1)}%) · ${partial} with an unreadable clause`);
console.log('\nTop unreadable clause shapes:');
[...badClauses.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
  .forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}  ${k}`));
