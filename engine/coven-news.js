// What the coven did while the hero was elsewhere, told at the start of the next chapter.
// No DOM. Reads the circle, returns paragraphs ({ text, kind: 'coven' }) and marks what it told,
// so each piece of news is heard once. Nothing here shows a number: loyalty and strength stay in the story's voice.

import { CONTENT_FNS } from './content.js';
import { income } from './systems/collis.js';
import { businessHands } from './systems/circle.js';

const MISSION = {
  scout: {
    success: '{n} came back from the streets with what you asked for, and a little more besides.',
    partial: '{n} came back from the streets with part of what you asked for.',
    injured: '{n} came back from the streets hurt, and with little to show for it.',
  },
  protect: {
    success: '{n} kept watch where you asked, and nothing was lost.',
    partial: '{n} kept watch where you asked, but not everything was kept safe.',
    injured: '{n} kept watch where you asked, and paid for it in blood.',
  },
  negotiate: {
    success: '{n} spoke for you, and the other side gave way.',
    partial: '{n} spoke for you, and the other side gave a little.',
    injured: '{n} spoke for you, and the talk went badly. There was a fight at the end of it.',
  },
  hunt: {
    success: '{n} went hunting for you and found the quarry.',
    partial: '{n} went hunting for you and found only the trail.',
    injured: '{n} went hunting for you, and the quarry bit back.',
  },
  retrieve: {
    success: '{n} brought back what you sent for.',
    partial: '{n} brought back some of what you sent for.',
    injured: '{n} came back hurt, and empty handed.',
  },
};

const TASK = {
  guard: {
    success: '{n} kept the door while you rested, and nothing found its way to you.',
    partial: '{n} kept the door while you rested, but not every hour was quiet.',
    failed: '{n} let the watch lapse while you rested. You have reason to wonder who came near.',
  },
  business: {
    success: '{n} worked your interests while you rested, and the books are the better for it.',
    partial: '{n} worked your interests while you rested, and the books are a little better for it.',
    failed: '{n} worked your interests while you rested, and the books are no better for it.',
  },
  watch: {
    success: '{n} listened to the city while you rested, and has a good deal to tell you.',
    partial: '{n} listened to the city while you rested, and has some of it to tell you.',
    failed: '{n} listened to the city while you rested, and heard nothing you can trust.',
  },
};

const para = (text) => ({ text, kind: 'coven' });

/** The news for a chapter's opening. Marks it told; returns [] when there is nothing to say. */
export function covenNews(state, content) {
  const s = state?.sys;
  if (!s) return [];
  const ctx = { state, vars: state.vars, content };
  const out = [];
  const book = state.book;
  for (const m of Object.values(s.circle ?? {})) {
    if (!Object.hasOwn(content.people ?? {}, m.id)) continue;
    const n = CONTENT_FNS.name(ctx, m.id);
    const tell = (t) => out.push(para(t.replace('{n}', n)));
    m.noted ??= {};
    // A mission that has finished.
    if (m.mission?.outcome) {
      if (m.mission.outcome === 'missing') {
        tell(m.status === 'dead'
          ? '{n} did not come back from the errand you sent for. You have found no trace and no body.'
          : '{n} did not come back from the errand you sent for. You have heard that someone is held, and that is all you know.');
      } else {
        tell(MISSION[m.mission.kind]?.[m.mission.outcome] ?? '{n} has come back from the errand you sent for.');
      }
      m.mission = null;
    }
    if (m.status !== 'active') continue;
    // How a standing task went through the long sleep.
    if (m.taskResult && m.taskReported === false) {
      tell(TASK[m.task]?.[m.taskResult] ?? '');
      m.taskReported = true;
    }
    // Working the business while awake: told once a book.
    if (m.task === 'business' && m.noted.business !== book && businessHands(ctx) > 0 && income(ctx) > 0) {
      tell('{n} has taken a hand in your ventures, and the takings have risen with it.');
      m.noted.business = book;
    }
    // Someone no longer answering: told once a book.
    const loyalty = Number(state.vars[`loyalty.${m.id}`] ?? 50);
    const alone = loyalty < (content.systems?.rules?.coven?.actsAloneBelow ?? 30);
    if (alone && m.noted.alone !== book) {
      tell('{n} has stopped answering as once they did, and you have begun to hear of things done without your leave.');
      m.noted.alone = book;
    }
  }
  return out.filter((p) => p.text);
}
