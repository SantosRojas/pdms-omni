import { cva } from "class-variance-authority"

export const cardVariants = cva(
  "rounded-xl border shadow-sm",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        surface: "bg-surface/50 text-card-foreground",
        ghost: "bg-transparent text-card-foreground shadow-none",
        glass: "glass text-card-foreground",
      },
      dense: {
        true: "p-4",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      dense: false,
    },
  },
)
