import { cva } from "class-variance-authority"

export const inputVariants = cva(
  "flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-input bg-transparent",
        glass: "glass",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)
