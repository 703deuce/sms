import { cn } from "@/lib/utils";
import {
  ButtonHTMLAttributes,
  cloneElement,
  forwardRef,
  isValidElement,
  type ReactElement,
} from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "default" | "destructive";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover active:shadow-none",
  default:
    "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover active:shadow-none",
  secondary:
    "bg-muted text-foreground hover:bg-border/70",
  ghost: "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
  danger: "bg-danger text-danger-foreground shadow-sm hover:opacity-90",
  destructive: "bg-danger text-danger-foreground shadow-sm hover:opacity-90",
  outline:
    "border border-border bg-card text-foreground shadow-sm hover:bg-muted/60 hover:border-border",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-4 text-sm",
  lg: "h-10 px-5 text-sm",
  icon: "h-9 w-9",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", asChild, children, ...props }, ref) => {
    const classes = cn(
      "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
      variants[variant],
      sizes[size],
      className,
    );

    if (asChild && isValidElement(children)) {
      const child = children as ReactElement<{ className?: string; ref?: React.Ref<HTMLElement> }>;
      return cloneElement(child, {
        ...props,
        className: cn(classes, child.props.className),
        ref,
      });
    }

    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
