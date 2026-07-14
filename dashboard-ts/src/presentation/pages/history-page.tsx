import { useState, useEffect, useMemo } from "react"
import { useParams } from "react-router-dom"
import { PageHeader } from "@/presentation/components/layout/page-header"
import { DataTable, type Column } from "@/presentation/components/shared/data-table"
import { Card, CardContent } from "@/presentation/components/ui/card"
import { Button } from "@/presentation/components/ui/button"
import { Input } from "@/presentation/components/ui/input"
import { ConfirmModal } from "@/presentation/components/shared/confirm-modal"
import { ScrollArea } from "@/presentation/components/ui/scroll-area"
import { EnhancedChart } from "@/presentation/components/shared/enhanced-chart"
import { History, Download, BarChart3, Table, MessageSquare, Trash2, Send } from "lucide-react"
import { therapyApi } from "@/infrastructure/api/therapy-api"
import { signalApi } from "@/infrastructure/api/signal-api"
import type { HistoryRow, TherapyComment } from "@/domain/entities/therapy"
import type { Signal } from "@/domain/entities/signal"
import { useAuthStore } from "@/application/stores/auth-store"
import { PRESSURE_SERIES, FLOW_SERIES } from "@/application/utils/signal-configs"

export function HistoryPage() {
  const { id } = useParams<{ id: string }>()
  const therapyId = Number(id)
  const user = useAuthStore((s) => s.user)

  const [rows, setRows] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [comments, setComments] = useState<TherapyComment[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const [commentText, setCommentText] = useState("")
  const [deleteCommentId, setDeleteCommentId] = useState<number | null>(null)
  const [showCharts, setShowCharts] = useState(true)
  const [showTable, setShowTable] = useState(true)
  const [showComments, setShowComments] = useState(true)

  const displayNameMap = useMemo(() =>
    Object.fromEntries(
      signals.map(s => [s.internal_name, s.display_name ?? s.internal_name])
    ),
    [signals]
  )

  const reverseDisplayNameMap = useMemo(() =>
    Object.fromEntries(
      signals.map(s => [(s.display_name ?? s.internal_name).toLowerCase(), s.internal_name])
    ),
    [signals]
  )

  useEffect(() => {
    if (!therapyId) return
      ; (async () => {
        try {
          const [h, c, sigs] = await Promise.all([
            therapyApi.getHistory(therapyId),
            therapyApi.getComments(therapyId),
            signalApi.list(),
          ])
          setRows(h)
          setComments(c)
          setSignals(sigs)
        } catch { /* ignore */ }
        setLoading(false)
      })()
  }, [therapyId])

  async function addComment() {
    if (!commentText.trim()) return
    try {
      const c = await therapyApi.createComment(therapyId, {
        author_name: user?.full_name || user?.username || "unknown",
        comment: commentText.trim(),
      })
      setComments((prev) => [...prev, c])
      setCommentText("")
    } catch { /* ignore */ }
  }

  async function removeComment() {
    if (!deleteCommentId) return
    try {
      await therapyApi.deleteComment(deleteCommentId, "Eliminado por admin")
      setComments((prev) => prev.filter((c) => c.id !== deleteCommentId))
      setDeleteCommentId(null)
    } catch { /* ignore */ }
  }

  async function downloadCSV() {
    try {
      const blob = await therapyApi.downloadTherapyReport(therapyId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `therapy-${therapyId}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* ignore */ }
  }

  function toLocalDatetime(utcStr: string): string {
    const d = new Date(utcStr + "Z")
    if (isNaN(d.getTime())) return utcStr
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    const hours = String(d.getHours()).padStart(2, "0")
    const mins = String(d.getMinutes()).padStart(2, "0")
    const secs = String(d.getSeconds()).padStart(2, "0")
    return `${year}-${month}-${day} ${hours}:${mins}:${secs}`
  }

  const columns: Column<HistoryRow>[] = [
    {
      key: "timestamp",
      header: "Timestamp",
      sortable: true,
      render: (r) => toLocalDatetime(r.timestamp),
    },
    { key: "internal_name", header: "Señal", sortable: true, className: "font-mono text-xs" },
    {
      key: "physical_value",
      header: "Valor",
      sortable: true,
      render: (r) => String(r.physical_value),
    },
    { key: "display_value", header: "Display", render: (r) => r.display_value || "—" },
    { key: "unit", header: "Unidad" },
  ]

  function toLocalTimeOnly(utcStr: string): string {
    const d = new Date(utcStr + "Z")
    if (isNaN(d.getTime())) return utcStr
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  }

  const chartData = rows.reduce<Record<string, unknown>[]>((acc, r) => {
    const minuteKey = r.timestamp.slice(0, 16)
    let point = acc.find((p) => p._time === minuteKey)
    if (!point) {
      point = { _time: minuteKey, timeOnly: toLocalTimeOnly(r.timestamp) }
      acc.push(point)
    }
    const signalKey = reverseDisplayNameMap[r.internal_name.toLowerCase()]
    if (signalKey) point[signalKey] = Number(r.physical_value) || 0
    return acc
  }, [])
  chartData.sort((a, b) => {
    const ta = String(a._time ?? ""), tb = String(b._time ?? "")
    return ta < tb ? -1 : ta > tb ? 1 : 0
  })

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Historial #${id}`}
        description="Datos históricos y gráficos acumulados"
        icon={<History className="h-6 w-6" />}
        backTo="/"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowComments((v) => !v)} className={showComments ? "" : "opacity-40"}>
              <MessageSquare className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowCharts((v) => !v)} className={showCharts ? "" : "opacity-40"}>
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowTable((v) => !v)} className={showTable ? "" : "opacity-40"}>
              <Table className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={downloadCSV}>
              <Download className="h-4 w-4" /> CSV
            </Button>
          </div>
        }
      />

      {/* Comments */}
      {
        showComments && (
          <Card variant="glass" dense>
            <CardContent className="p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
                <MessageSquare className="h-4 w-4" /> Comentarios ({comments.length})
              </h3>
              <ScrollArea className="mb-3 max-h-48">
                {comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin comentarios</p>
                ) : (
                  <div className="space-y-2">
                    {comments.map((c) => (
                      <div key={c.id} className="rounded-lg bg-muted/30 p-3 text-sm">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-medium">{c.author_name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{c.created_at}</span>
                            {user?.role === "admin" && (
                              <button onClick={() => setDeleteCommentId(c.id)} className="text-destructive hover:text-destructive/80">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-muted-foreground">{c.comment}</p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              {user?.role !== "viewer" && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Agregar comentario..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addComment()}
                  />
                  <Button size="icon" onClick={addComment} disabled={!commentText.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )
      }

      {/* Charts */}
      {showCharts && chartData.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <EnhancedChart
            title="Presiones"
            data={chartData}
            series={PRESSURE_SERIES}
            xAxisKey="timeOnly"
            displayNameMap={displayNameMap}
          />
          <EnhancedChart
            title="Caudales"
            data={chartData}
            series={FLOW_SERIES}
            xAxisKey="timeOnly"
            displayNameMap={displayNameMap}
          />
        </div>
      )}

      {/* Data Table */}
      {showTable && <div className="mb-6">
        <DataTable
          columns={columns}
          data={rows}
          keyExtractor={(r) => r.id}
          loading={loading}
          pageSize={20}
          filterableColumns={["internal_name"]}
        />
      </div>}



      <ConfirmModal
        open={deleteCommentId !== null}
        onClose={() => setDeleteCommentId(null)}
        onConfirm={removeComment}
        title="Eliminar Comentario"
        description="¿Eliminar este comentario?"
        confirmLabel="Eliminar"
        confirmVariant="destructive"
      />
    </div>
  )
}
