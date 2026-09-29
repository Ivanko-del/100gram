interface Props {
  name: string;
  /** premium emoji status shown after the name */
  emoji?: string | null;
  /** premium name color */
  color?: string | null;
  className?: string;
}

/** A display name with its optional premium cosmetics (color + emoji). */
export default function UserName({ name, emoji, color, className }: Props) {
  return (
    <span className={className} style={color ? { color } : undefined}>
      {name}
      {emoji && <span className="status-emoji">{emoji}</span>}
    </span>
  );
}
