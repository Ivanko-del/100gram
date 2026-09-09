import { FormEvent, useRef, useState } from "react";

interface Props {
  onSend: (content: string) => void;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
}

export default function MessageInput({ onSend, onTyping, disabled }: Props) {
  const [value, setValue] = useState("");
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  }

  return (
    <form className="message-input-bar" onSubmit={submit}>
      <input
        className="message-input"
        value={value}
        placeholder="Написати повідомлення…"
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
      />
      <button className="send-btn" type="submit" disabled={disabled || !value.trim()}>
        ➤
      </button>
    </form>
  );
}
