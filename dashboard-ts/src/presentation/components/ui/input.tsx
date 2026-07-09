import { forwardRef, type InputHTMLAttributes } from "react"
import type { VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { inputVariants } from "./input-variants"

interface InputProps extends InputHTMLAttributes<HTMLInputElement>, VariantProps<typeof inputVariants> {}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant }), className)}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = "Input"

export { Input }
