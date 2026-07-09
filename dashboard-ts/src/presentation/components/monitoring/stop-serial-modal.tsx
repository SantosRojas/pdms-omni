import * as Dialog from "@radix-ui/react-dialog"
import { X, Square, Pause } from "lucide-react"
import { Button } from "@/presentation/components/ui/button"
import { Card, CardContent } from "@/presentation/components/ui/card"

interface StopSerialModalProps {
  open: boolean
  onClose: () => void
  onStop: (closeTherapy: boolean) => void
}

export function StopSerialModal({ open, onClose, onStop }: StopSerialModalProps) {
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
                <Dialog.Title className="text-lg font-semibold">Detener lectura serial</Dialog.Title>
                <Dialog.Description className="text-sm text-muted-foreground">
                  Seleccione qué acción realizar al detener la lectura
                </Dialog.Description>
              </div>

              <div className="space-y-2">
                <Button variant="destructive" className="w-full justify-start gap-3" onClick={() => onStop(true)}>
                  <Square className="h-4 w-4" />
                  Finalizar terapia y detener lectura
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3" onClick={() => onStop(false)}>
                  <Pause className="h-4 w-4" />
                  Solo detener lectura (terapia queda abierta)
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
