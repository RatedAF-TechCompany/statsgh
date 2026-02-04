import Image from "next/image";
import statsghLogo from "@/assets/statsgh-logo.png";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-12 w-12",
  lg: "h-16 w-16",
};

const imageSizes = {
  sm: { width: 20, height: 20 },
  md: { width: 28, height: 28 },
  lg: { width: 40, height: 40 },
};

const LoadingSpinner = ({ size = "md", text }: LoadingSpinnerProps) => {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="relative">
        <div
          className={`${sizeClasses[size]} rounded-full border-2 border-ft-maroon/20 border-t-ft-maroon animate-spin`}
        />
        <Image
          src={statsghLogo}
          alt="Loading..."
          width={imageSizes[size].width}
          height={imageSizes[size].height}
          className="absolute inset-0 m-auto object-contain"
        />
      </div>
      {text && (
        <p className="text-sm text-muted-foreground animate-pulse">{text}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;
