import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { lookupUserByUsername } from "../data/user-lookup";
import { User } from "../types";
import Avatar from "./Avatar";
import UserName from "./UserName";

interface Props {
  /** the token as typed, "@username" */
  token: string;
  /** called with the found user's id when the mention is clicked */
  onOpen?: (uid: string) => void;
  /** called when nobody has this username */
  onMissing?: (username: string) => void;
}

const HOVER_DELAY_MS = 280;
const CARD_WIDTH = 260;

type Preview = { status: "loading" } | { status: "missing" } | { status: "found"; user: User };

/** A clickable @username inside a message: click opens the person's profile,
 * hovering (or keyboard focus) shows a small card with their name and bio. */
export default function MentionLink({ token, onOpen, onMissing }: Props) {
  const username = token.slice(1);
  const ref = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean } | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  function show() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const below = rect.top < 170;
      setPos({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - CARD_WIDTH - 8)),
        top: below ? rect.bottom + 8 : rect.top - 8,
        below,
      });
      setPreview({ status: "loading" });
      try {
        const user = await lookupUserByUsername(username);
        setPreview(user ? { status: "found", user } : { status: "missing" });
      } catch {
        setPreview(null);
      }
    }, HOVER_DELAY_MS);
  }

  function hide() {
    if (timer.current) window.clearTimeout(timer.current);
    setPreview(null);
  }

  async function open() {
    hide();
    try {
      const user = await lookupUserByUsername(username);
      if (user) onOpen?.(user.id);
      else onMissing?.(username);
    } catch {
      onMissing?.(username);
    }
  }

  return (
    <>
      <button
        type="button"
        ref={ref}
        className="mention mention-link"
        onClick={open}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {token}
      </button>
      {preview &&
        pos &&
        createPortal(
          <div
            className="mention-card"
            style={{ left: pos.left, top: pos.top, width: CARD_WIDTH, transform: pos.below ? "none" : "translateY(-100%)" }}
            role="tooltip"
          >
            {preview.status === "loading" && <span className="settings-hint">Шукаємо @{username}…</span>}
            {preview.status === "missing" && <span className="settings-hint">Користувача @{username} не знайдено</span>}
            {preview.status === "found" && (
              <>
                <Avatar
                  name={preview.user.displayName}
                  color={preview.user.avatarColor}
                  photoUrl={preview.user.avatarUrl}
                  size={40}
                  isPremium={preview.user.isPremium}
                />
                <div className="mention-card-body">
                  <div className="mention-card-name">
                    <UserName
                      name={preview.user.displayName}
                      emoji={preview.user.isPremium ? preview.user.emojiStatus : null}
                      color={preview.user.isPremium ? preview.user.nameColor : null}
                    />
                  </div>
                  <div className="settings-hint">@{preview.user.username}</div>
                  {preview.user.bio && <div className="mention-card-bio">{preview.user.bio}</div>}
                </div>
              </>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
