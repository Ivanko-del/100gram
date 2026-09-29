import { ChangeEvent, FormEvent, KeyboardEvent, useRef, useState } from "react";
import { DataError } from "../data/firestore-api";
import { compressImageToDataUrl } from "../utils/image";
import { isEnterSends } from "../utils/prefs";

interface Props {
  onSend: (content: string) => void;
  onSendImage: (url: string) => void;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
}

const MAX_TEXTAREA_HEIGHT = 140;

export default function MessageInput({ onSend, onSendImage, onTyping, disabled }: Props) {
  const [value, setValue] = useState("");
  const [showGifInput, setShowGifInput] = useState(false);
  const [gifUrl, setGifUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
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
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && isEnterSends()) {
      e.preventDefault();
      submit(e);
    }
  }

  async function onPickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMediaError(null);
    setUploadingPhoto(true);
    try {
      const dataUrl = await compressImageToDataUrl(file, 900, 0.75);
      onSendImage(dataUrl);
    } catch (err) {
      setMediaError(err instanceof DataError ? err.message : "Не вдалося надіслати фото");
    } finally {
      setUploadingPhoto(false);
    }
  }

  function onSubmitGif(e: FormEvent) {
    e.preventDefault();
    const url = gifUrl.trim();
    if (!/^https?:\/\/.+/i.test(url)) {
      setMediaError("Встав посилання на gif/картинку (має починатись з http)");
      return;
    }
    setMediaError(null);
    onSendImage(url);
    setGifUrl("");
    setShowGifInput(false);
  }

  return (
    <div>
      {mediaError && <div className="auth-error message-media-error">{mediaError}</div>}
      {showGifInput && (
        <form className="gif-url-bar" onSubmit={onSubmitGif}>
          <input
            value={gifUrl}
            onChange={(e) => setGifUrl(e.target.value)}
            placeholder="Посилання на GIF (https://...)"
            autoFocus
          />
          <button className="btn-primary" type="submit" disabled={!gifUrl.trim()}>
            Надіслати
          </button>
          <button type="button" className="btn-ghost" onClick={() => setShowGifInput(false)}>
            ✕
          </button>
        </form>
      )}
      <form className="message-input-bar" onSubmit={submit}>
        <label className="icon-btn message-media-btn" title="Надіслати фото">
          {uploadingPhoto ? "…" : "🖼️"}
          <input type="file" accept="image/*" hidden disabled={disabled || uploadingPhoto} onChange={onPickPhoto} />
        </label>
        <button
          type="button"
          className="icon-btn message-media-btn"
          title="Надіслати GIF за посиланням"
          disabled={disabled}
          onClick={() => setShowGifInput((v) => !v)}
        >
          GIF
        </button>
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
    </div>
  );
}
