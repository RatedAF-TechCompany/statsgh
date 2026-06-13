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

const LoadingSpinner = ({ size = "md", text }: LoadingSpinnerProps) => {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="relative">
        <div
          className={`${sizeClasses[size]} rounded-full border-2 border-ft-maroon/20 border-t-ft-maroon animate-spin`}
        />
        <img
          src={statsghLogo.src}
          alt="Loading..."
          className={`absolute inset-0 m-auto ${size === "sm" ? "h-5 w-5" : size === "md" ? "h-7 w-7" : "h-10 w-10"} object-contain`}
        />
      </div>
      {text && (
        <p className="text-sm text-muted-foreground animate-pulse">{text}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;
