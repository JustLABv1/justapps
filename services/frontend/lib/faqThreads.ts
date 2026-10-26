export interface ThreadAnswer {
  id: string;
  replyToAnswerId?: string;
  createdAt: string;
}

// Keep ranked root answers in server order. Conversations have one visual
// indentation level, even when participants reply to another reply.
export function groupFAQThreads<T extends ThreadAnswer>(answers: T[]) {
  const byId = new Map(answers.map((answer) => [answer.id, answer]));
  const rootFor = (answer: T): T => {
    const visited = new Set<string>();
    let root = answer;
    while (root.replyToAnswerId && byId.has(root.replyToAnswerId)) {
      if (visited.has(root.id)) return answer;
      visited.add(root.id);
      root = byId.get(root.replyToAnswerId)!;
    }
    return root;
  };
  const groups = new Map<string, { root: T; replies: T[] }>();
  for (const answer of answers) {
    const root = rootFor(answer);
    if (!groups.has(root.id)) groups.set(root.id, { root, replies: [] });
    if (root.id !== answer.id) groups.get(root.id)!.replies.push(answer);
  }
  return [...groups.values()]
    .sort((a, b) => answers.indexOf(a.root) - answers.indexOf(b.root))
    .map((thread) => ({
      ...thread,
      replies: thread.replies.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id)),
    }));
}
