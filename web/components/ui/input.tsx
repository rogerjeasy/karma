import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-9 w-full rounded-lg border border-border bg-input px-3.5 py-2",
      "text-sm text-foreground placeholder:text-muted-foreground/55",
      "transition-all duration-200",
      "focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "file:border-0 file:bg-transparent file:text-sm file:font-medium",
      className
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
