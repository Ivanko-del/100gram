import { Fragment, ReactNode } from "react";

const MENTION_SRC = "@[a-zA-Z0-9_]{3,32}";
const URL_SRC = "(?:https?://|www\\.)[^\\s<]+[^\\s<.,:;!?'\")\\]]";
const MENTION_RE = new RegExp(`^${MENTION_SRC}$`);
const URL_RE = new RegExp(`^${URL_SRC}$`);
const TOKEN_RE = new RegExp(`(${MENTION_SRC}|${URL_SRC})`, "g");

/** Splits message text on `@username`-looking tokens and bare URLs, wrapping
 * mentions in a highlighted span and URLs in a clickable link - purely
 * cosmetic/offline (no lookup against real members), so it works
 * retroactively on old messages without extra data on the message. */
export function renderWithMentions(text: string, renderMention?: (token: string, key: number) => ReactNode): ReactNode {
  const parts = text.split(TOKEN_RE);
  if (parts.length <= 1) return text;

  return parts.map((part, i) => {
    if (!part) return null;
    // "name@site.com" is an e-mail address, not a mention: a mention must not
    // directly follow a letter, digit or underscore
    if (MENTION_RE.test(part) && !/\w$/.test(parts[i - 1] ?? "")) {
      if (renderMention) return renderMention(part, i);
      return (
        <span className="mention" key={i}>
          {part}
        </span>
      );
    }
    if (URL_RE.test(part)) {
      const href = part.startsWith("www.") ? `https://${part}` : part;
      return (
        <a className="message-link" href={href} key={i} target="_blank" rel="noopener noreferrer">
          {part}
        </a>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
