import type { EquivalenceRepository } from "@/domain/repositories/equivalence-repository"
import type {
  Equivalence,
  CreateEquivalenceRequest,
  UpdateEquivalenceRequest,
  DeleteEquivalenceRequest,
} from "@/domain/entities/equivalence"
import { apiClient } from "./client"

export const equivalenceApi: EquivalenceRepository = {
  async list(): Promise<Equivalence[]> {
    const { data } = await apiClient.get<Equivalence[]>("/api/equivalences")
    return data
  },

  async create(req: CreateEquivalenceRequest): Promise<Equivalence> {
    const { data } = await apiClient.post<Equivalence>("/api/equivalences", req)
    return data
  },

  async update(req: UpdateEquivalenceRequest): Promise<void> {
    await apiClient.put("/api/equivalences", req)
  },

  async remove(req: DeleteEquivalenceRequest): Promise<void> {
    await apiClient.delete("/api/equivalences", {
      params: { signal_id: req.signal_id, numeric_value: req.numeric_value },
      data: { deleted_by: req.deleted_by, deletion_reason: req.deletion_reason },
    })
  },
}
