import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-primary/15 text-primary border border-primary/25",
        secondary:
          "bg-secondary text-secondary-foreground border border-border",
        outline:
          "border border-border text-muted-foreground",
        success:
          "bg-success/15 text-success border border-success/25",
        warning:
          "bg-warning/15 text-warning border border-warning/25",
        destructive:
          "bg-destructive/15 text-destructive border border-destructive/25",
        critical:
          "bg-destructive text-destructive-foreground border border-destructive/50 shadow-[0_0_8px_hsl(var(--destructive)/0.4)]",
        ghost:
          "bg-muted text-muted-foreground border border-border",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
