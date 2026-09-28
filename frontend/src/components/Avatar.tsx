interface AvatarProps {
  name: string;
  color: string;
  photoUrl?: string | null;
  size?: number;
  isPremium?: boolean;
}

export default function Avatar({ name, color, photoUrl, size = 44, isPremium }: AvatarProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const ringPad = isPremium ? Math.max(2, Math.round(size * 0.06)) : 0;

  return (
    <div
      className={`avatar-wrap ${isPremium ? "avatar-wrap-premium" : ""}`}
      style={{ width: size + ringPad * 2, height: size + ringPad * 2, padding: ringPad }}
    >
      {photoUrl ? (
        <img className="avatar avatar-photo" src={photoUrl} alt={name} style={{ width: size, height: size }} />
      ) : (
        <div className="avatar" style={{ backgroundColor: color, width: size, height: size, fontSize: size * 0.4 }}>
          {initials || "?"}
        </div>
      )}
      {isPremium && <span className="avatar-premium-badge">⭐</span>}
    </div>
  );
}
