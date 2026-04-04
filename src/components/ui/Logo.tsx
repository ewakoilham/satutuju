import Image from "next/image";

interface LogoProps {
  variant?: "main" | "circle";
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  xs: { main: { w: 60, h: 40 }, circle: { w: 28, h: 28 } },
  sm: { main: { w: 56, h: 38 }, circle: { w: 36, h: 36 } },
  md: { main: { w: 120, h: 81 }, circle: { w: 48, h: 48 } },
  lg: { main: { w: 180, h: 121 }, circle: { w: 72, h: 72 } },
};

export default function Logo({ variant = "main", size = "md", className = "" }: LogoProps) {
  const dims = SIZES[size][variant];
  const src = variant === "main" ? "/logo-main.png" : "/logo-circle.png";

  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ width: dims.w, height: dims.h }}>
      <Image
        src={src}
        alt="Satu Tuju"
        fill
        className="object-contain"
        priority
      />
    </div>
  );
}
