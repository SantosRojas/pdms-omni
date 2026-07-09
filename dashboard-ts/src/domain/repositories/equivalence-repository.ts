import type {
  Equivalence,
  CreateEquivalenceRequest,
  UpdateEquivalenceRequest,
  DeleteEquivalenceRequest,
} from "../entities/equivalence"

export interface EquivalenceRepository {
  list(): Promise<Equivalence[]>
  create(data: CreateEquivalenceRequest): Promise<Equivalence>
  update(data: UpdateEquivalenceRequest): Promise<void>
  remove(data: DeleteEquivalenceRequest): Promise<void>
}
