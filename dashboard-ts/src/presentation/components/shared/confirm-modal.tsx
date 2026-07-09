import { type ReactNode } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { Button } from "@/presentation/components/ui/button"
import { Card, CardContent } from "@/presentation/components/ui/card"

interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  icon?: ReactNode
  confirmLabel?: string
  confirmVariant?: "default" | "destructive" | "success"
  loading?: boolean
  children?: ReactNode
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  icon,
  confirmLabel = "Confirmar",
  confirmVariant = "default",
  loading = false,
  children,
}: ConfirmModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center p-4 focus:outline-none">
          <Card variant="glass" className="w-full max-w-md shadow-xl">
            <Dialog.Close className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </Dialog.Close>

            <CardContent className="pt-6">
              <div className="space-y-4">
                {icon && <div className="flex justify-center">{icon}</div>}
                <div className="text-center">
                  <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
                  {description && (
                    <Dialog.Description className="text-sm text-muted-foreground">
                      {description}
                    </Dialog.Description>
                  )}
                </div>

                {children}

                <div className="flex justify-end gap-3 pt-2">
                  <Dialog.Close asChild>
                    <Button variant="outline">Cancelar</Button>
                  </Dialog.Close>
                  <Button variant={confirmVariant} onClick={onConfirm} loading={loading}>
                    {confirmLabel}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
