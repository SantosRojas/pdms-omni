import * as Dialog from "@radix-ui/react-dialog"
import { X, Play, RefreshCw } from "lucide-react"
import { Button } from "@/presentation/components/ui/button"
import { Card, CardContent } from "@/presentation/components/ui/card"
import type { Therapy } from "@/domain/entities/therapy"

interface StartSerialModalProps {
  open: boolean
  onClose: () => void
  onStart: (newTherapy: boolean) => void
  latestTherapy: Therapy | null
}

export function StartSerialModal({ open, onClose, onStart, latestTherapy }: StartSerialModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center p-4 focus:outline-none">
          <Card variant="glass" className="w-full max-w-md shadow-xl">
            <Dialog.Close className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </Dialog.Close>

            <CardContent className="space-y-4 pt-6">
              <div className="text-center">
                <Dialog.Title className="text-lg font-semibold">Iniciar lectura serial</Dialog.Title>
                <Dialog.Description className="text-sm text-muted-foreground">
                  Seleccione cómo desea iniciar la lectura del dispositivo
                </Dialog.Description>
              </div>

              {latestTherapy && (
                <div className="rounded-lg border border-glass-border bg-glass-bg p-3 text-sm">
                  <p className="text-xs text-muted-foreground">Terapia actual</p>
                  <p className="font-medium">#{latestTherapy.id}</p>
                  <p className="text-xs text-muted-foreground">{latestTherapy.serial_number} — {latestTherapy.started_at}</p>
                </div>
              )}

              <div className="space-y-2">
                <Button className="w-full justify-start gap-3" onClick={() => onStart(true)}>
                  <Play className="h-4 w-4" />
                  Crear nueva terapia
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3" onClick={() => onStart(false)}>
                  <RefreshCw className="h-4 w-4" />
                  Continuar terapia actual
                </Button>
              </div>

              <div className="flex justify-center">
                <Dialog.Close asChild>
                  <Button variant="ghost" size="sm">Cancelar</Button>
                </Dialog.Close>
              </div>
            </CardContent>
          </Card>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
