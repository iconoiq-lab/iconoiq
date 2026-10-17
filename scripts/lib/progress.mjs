// Overall progress for PROGRESS.md: step lines start with "- ✅", "- ⏳" or "- ⛔".

/** Counts the step lines (a list item whose first character is one of the three marks). */
export function countSteps(markdown) {
  const counts = { done: 0, todo: 0, waiting: 0 };
  for (const line of markdown.split(/\r?\n/)) {
    const mark = line.match(/^\s*[-*]\s+(✅|⏳|⛔)/u)?.[1];
    if (mark === '✅') counts.done++;
    else if (mark === '⏳') counts.todo++;
    else if (mark === '⛔') counts.waiting++;
  }
  return counts;
}

/** The bold "Overall" line for the given counts. */
export function overallLine({ done, todo, waiting }) {
  const total = done + todo + waiting;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return `**Overall: ${pct}% (${done} of ${total} steps done, ${waiting} waiting)**`;
}

const OVERALL = /^\*\*Overall:.*\*\*$/m;

/** The markdown with its Overall line brought up to date. */
export function updateProgress(markdown) {
  if (!OVERALL.test(markdown)) throw new Error('PROGRESS.md has no "**Overall: ...**" line');
  return markdown.replace(OVERALL, overallLine(countSteps(markdown)));
}
