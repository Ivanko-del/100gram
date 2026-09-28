import { FormEvent, KeyboardEvent, useRef, useState } from "react";

interface Props {
  onSend: (content: string) => void;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
}

const MAX_TEXTAREA_HEIGHT = 140;

export default function MessageInput({ onSend, onTyping, disabled }: Props) {
  const [value, setValue] = useState("");
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT) + "px";
  }

  function handleChange(v: string) {
    setValue(v);
    onTyping(true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => onTyping(false), 1500);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
    onTyping(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  // Enter sends the message; Shift+Enter (or a pasted/typed newline) keeps
  // the line break, so multi-line posts actually stay multi-line.
  // `isComposing` guards mobile IME/autocomplete (Gboard etc.): the Enter
  // that confirms a predictive-text suggestion must not also submit the
  // message, or the text gets cut off mid-composition and comes out garbled.
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit(e);
    }
  }

  return (
    <form className="message-input-bar" onSubmit={submit}>
      <textarea
        ref={textareaRef}
        className="message-input"
        value={value}
        placeholder="Написати повідомлення…"
        rows={1}
        onChange={(e) => {
          handleChange(e.target.value);
          autoGrow(e.target);
        }}
        onKeyDown={onKeyDown}
        disabled={disabled}
      />
      <button className="send-btn" type="submit" disabled={disabled || !value.trim()}>
        ➤
      </button>
    </form>
  );
}
