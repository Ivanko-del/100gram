interface AvatarProps {
  name: string;
  color: string;
  size?: number;
  isPremium?: boolean;
}

export default function Avatar({ name, color, size = 44, isPremium }: AvatarProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="avatar-wrap" style={{ width: size, height: size }}>
      <div className="avatar" style={{ backgroundColor: color, width: size, height: size, fontSize: size * 0.4 }}>
        {initials || "?"}
      </div>
      {isPremium && <span className="avatar-premium-badge">⭐</span>}
    </div>
  );
}
