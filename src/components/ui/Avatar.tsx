interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  src?: string;
  className?: string;
}

const BRAND_COLORS = [
  { bg: "bg-primary-100", text: "text-primary-700" },
  { bg: "bg-brand-blue-soft", text: "text-primary-800" },
  { bg: "bg-brand-lavender", text: "text-primary-700" },
  { bg: "bg-brand-yellow", text: "text-primary-800" },
  { bg: "bg-primary-200", text: "text-primary-800" },
];

const SIZES = {
  sm: "w-7 h-7 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-12 h-12 text-base",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getColorIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % BRAND_COLORS.length;
}

export default function Avatar({ name, size = "md", src, className = "" }: AvatarProps) {
  const initials = getInitials(name);
  const color = BRAND_COLORS[getColorIndex(name)];

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${SIZES[size]} rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`${SIZES[size]} ${color.bg} ${color.text} rounded-full flex items-center justify-center font-semibold select-none ${className}`}
      title={name}
    >
      {initials}
    </div>
  );
}
