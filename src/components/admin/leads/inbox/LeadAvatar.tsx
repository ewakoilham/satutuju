/**
 * Deterministic-color circular avatar with initials. Picks one of 8
 * fixed pastel pairs by hashing the name, so the same person always
 * gets the same color across renders.
 */

const AVATAR_COLORS: Array<[string, string]> = [
  ["#dbeafe", "#1e40af"], ["#fef3c7", "#92400e"], ["#dcfce7", "#166534"],
  ["#fce7f3", "#9d174d"], ["#ede9fe", "#5b21b6"], ["#fee2e2", "#991b1b"],
  ["#cffafe", "#155e75"], ["#ffedd5", "#9a3412"],
];

function colorFor(name: string): [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0] ?? "")
    .join("")
    .toUpperCase();
}

interface Props {
  name: string;
  size?: number;
  initials?: string;
}

export default function LeadAvatar({ name, size = 32, initials }: Props) {
  const [bg, fg] = colorFor(name);
  const text = initials ?? initialsOf(name);
  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: "50%",
        background: bg,
        color: fg,
        fontSize: Math.round(size * 0.38),
        fontWeight: 600,
        letterSpacing: "-0.02em",
        flexShrink: 0,
      }}
      className="inline-flex items-center justify-center"
      aria-hidden
    >
      {text}
    </div>
  );
}
