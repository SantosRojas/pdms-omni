import { forwardRef } from "react"
import * as RadixSelect from "@radix-ui/react-select"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
  children: React.ReactNode
  disabled?: boolean
}

const Select = forwardRef<HTMLButtonElement, SelectProps>(
  ({ value, onValueChange, placeholder, className, children, disabled }, ref) => {
    return (
      <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <RadixSelect.Trigger
          ref={ref}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content className="z-50 overflow-hidden rounded-md border bg-card text-card-foreground shadow-md">
            <RadixSelect.Viewport className="p-1">
              {children}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
    )
  },
)
Select.displayName = "Select"

const SelectItem = forwardRef<HTMLDivElement, { value: string; children: React.ReactNode; className?: string }>(
  ({ value, children, className }, ref) => {
    return (
      <RadixSelect.Item
        ref={ref}
        value={value}
        className={cn(
          "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          className,
        )}
      >
        <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
      </RadixSelect.Item>
    )
  },
)
SelectItem.displayName = "SelectItem"

export { Select, SelectItem }
