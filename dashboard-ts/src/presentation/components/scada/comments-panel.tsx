import { useState, useEffect, useMemo } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { Send, Trash2, X, Plus } from "lucide-react"
import { Card, CardContent } from "@/presentation/components/ui/card"
import { Button } from "@/presentation/components/ui/button"
import { Input } from "@/presentation/components/ui/input"
import { ScrollArea } from "@/presentation/components/ui/scroll-area"
import { ConfirmModal } from "@/presentation/components/shared/confirm-modal"
import { therapyApi } from "@/infrastructure/api/therapy-api"
import { useAuthStore } from "@/application/stores/auth-store"
import { toLocalDatetime, relativeTime } from "@/application/utils/time"
import type { TherapyComment } from "@/domain/entities/therapy"

interface CommentsPanelProps {
  therapyId: number
}

export function CommentsPanel({ therapyId }: CommentsPanelProps) {
  const user = useAuthStore((s) => s.user)
  const canComment = user?.role !== "viewer"
  const isAdmin = user?.role === "admin"

  const [comments, setComments] = useState<TherapyComment[]>([])
  const sortedComments = useMemo(() =>
    [...comments].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [comments]
  )
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [commentText, setCommentText] = useState("")
  const [sending, setSending] = useState(false)
  const [deleteCommentId, setDeleteCommentId] = useState<number | null>(null)

  useEffect(() => {
    if (!therapyId) return
    therapyApi.getComments(therapyId).then(setComments).catch(() => { }).finally(() => setLoading(false))
  }, [therapyId])

  async function addComment() {
    if (!commentText.trim()) return
    setSending(true)
    try {
      const c = await therapyApi.createComment(therapyId, {
        author_name: user?.full_name || user?.username || "unknown",
        comment: commentText.trim(),
      })
      setComments((prev) => [...prev, c])
      setCommentText("")
      setModalOpen(false)
    } catch { /* ignore */ }
    setSending(false)
  }

  async function removeComment() {
    if (!deleteCommentId) return
    try {
      await therapyApi.deleteComment(deleteCommentId, "Eliminado por admin")
      setComments((prev) => prev.filter((c) => c.id !== deleteCommentId))
    } catch { /* ignore */ }
    setDeleteCommentId(null)
  }

  return (
    <>
      <Card variant="glass" dense className="p-3">
        <h3 className="mb-2 flex items-center justify-between text-[12px] font-semibold uppercase tracking-wider text-scada-muted">
          <span className="flex items-center gap-1.5">
            Comentarios ({comments.length})
          </span>
        </h3>

        <ScrollArea className="mb-2 max-h-70">
          {loading ? (
            <p className="text-xs text-scada-muted">Cargando...</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-scada-muted">Sin comentarios</p>
          ) : (
            <div className="space-y-2">
              {sortedComments.map((c) => (
                <div key={c.id} className="rounded-md bg-scada-card/50 p-2 text-xs">
                  <div className="mb-0.5 flex items-center justify-between">
                    <span className="font-medium text-scada-text">{c.author_name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-scada-muted" title={toLocalDatetime(c.created_at)}>
                        {relativeTime(c.created_at)}
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => setDeleteCommentId(c.id)}
                          className="text-scada-muted hover:text-scada-danger transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-scada-muted leading-relaxed">{c.comment}</p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {canComment && (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 text-xs"
            onClick={() => setModalOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar comentario
          </Button>
        )}
      </Card>

      {/* Add comment modal */}
      <Dialog.Root open={modalOpen} onOpenChange={(o) => !o && setModalOpen(false)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
          <Dialog.Content
            onInteractOutside={(e) => e.preventDefault()}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 focus:outline-none">
            <Card variant="glass" className="w-full max-w-md shadow-xl">
              <Dialog.Close className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </Dialog.Close>

              <CardContent className="space-y-4 pt-6">
                <div className="text-center">
                  <Dialog.Title className="text-lg font-semibold">Agregar Comentario</Dialog.Title>
                  <Dialog.Description className="text-sm text-muted-foreground">
                    Escriba un comentario para la terapia #{therapyId}
                  </Dialog.Description>
                </div>

                <Input
                  placeholder="Escriba su comentario..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !sending && commentText.trim() && addComment()}
                  autoFocus
                />

                <div className="flex justify-end gap-3">
                  <Dialog.Close asChild>
                    <Button variant="outline">Cancelar</Button>
                  </Dialog.Close>
                  <Button onClick={addComment} disabled={!commentText.trim()} loading={sending}>
                    <Send className="mr-1.5 h-4 w-4" />
                    Enviar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete confirmation */}
      <ConfirmModal
        open={deleteCommentId !== null}
        onClose={() => setDeleteCommentId(null)}
        onConfirm={removeComment}
        title="Eliminar Comentario"
        description="¿Eliminar este comentario?"
        confirmLabel="Eliminar"
        confirmVariant="destructive"
      />
    </>
  )
}
