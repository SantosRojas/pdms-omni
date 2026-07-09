import { Search, X } from "lucide-react"
import { Input } from "@/presentation/components/ui/input"
import type { inputVariants } from "@/presentation/components/ui/input-variants"
import type { VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

interface SearchFieldProps extends VariantProps<typeof inputVariants> {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onClear?: () => void
  className?: string
}

export function SearchField({
  value,
  onChange,
  placeholder = "Buscar...",
  onClear,
  variant,
  className,
}: SearchFieldProps) {
  return (
    <div className={cn("relative max-w-sm", className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value}
        variant={variant}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 pr-8"
      />
      {value && (
        <button
          onClick={() => {
            onChange("")
            onClear?.()
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
