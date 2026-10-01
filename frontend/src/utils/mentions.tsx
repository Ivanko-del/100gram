import { Fragment, ReactNode } from "react";

const MENTION_RE = /@[a-zA-Z0-9_]{3,32}/g;

/** Splits message text on `@username`-looking tokens and wraps them in a
 * highlighted span - purely cosmetic (no lookup against real members), so
 * it needs no extra data on the message and works offline/retroactively on
 * old messages. */
export function renderWithMentions(text: string): ReactNode {
  const parts = text.split(MENTION_RE);
  const matches = text.match(MENTION_RE) ?? [];
  if (matches.length === 0) return text;

  const nodes: ReactNode[] = [];
  parts.forEach((part, i) => {
    if (part) nodes.push(<Fragment key={`t${i}`}>{part}</Fragment>);
    if (i < matches.length) {
      nodes.push(
        <span className="mention" key={`m${i}`}>
          {matches[i]}
        </span>
      );
    }
  });
  return nodes;
}
