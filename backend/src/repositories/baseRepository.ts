import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(__dirname, '..', 'data')

// ============================================================
// BaseRepository — camada de persistência JSON genérica
// Troque apenas esta camada quando migrar para MongoDB.
// ============================================================

export class BaseRepository<T extends { id: string }> {
  private filePath: string

  constructor(fileName: string) {
    this.filePath = path.join(DATA_DIR, fileName)
  }

  // --- leitura ---

  private readAll(): T[] {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8')
      return JSON.parse(raw) as T[]
    } catch {
      return []
    }
  }

  // --- escrita ---

  private writeAll(items: T[]): void {
    fs.writeFileSync(this.filePath, JSON.stringify(items, null, 2), 'utf-8')
  }

  // --- CRUD público ---

  findAll(): T[] {
    return this.readAll()
  }

  findById(id: string): T | undefined {
    return this.readAll().find((item) => item.id === id)
  }

  findBy(predicate: (item: T) => boolean): T[] {
    return this.readAll().filter(predicate)
  }

  findOneBy(predicate: (item: T) => boolean): T | undefined {
    return this.readAll().find(predicate)
  }

  create(item: T): T {
    const all = this.readAll()
    all.push(item)
    this.writeAll(all)
    return item
  }

  update(id: string, partial: Partial<T>): T | null {
    const all = this.readAll()
    const index = all.findIndex((item) => item.id === id)
    if (index === -1) return null

    // merge normal
    const merged = { ...all[index], ...partial }

    // remover explicitamente chaves que vieram como undefined no partial
    // (necessário para apagar campos opcionais, ex: horasContratadas)
    for (const key of Object.keys(partial) as (keyof T)[]) {
      if (partial[key] === undefined) {
        delete merged[key]
      }
    }

    all[index] = merged
    this.writeAll(all)
    return all[index]
  }

  delete(id: string): boolean {
    const all = this.readAll()
    const filtered = all.filter((item) => item.id !== id)
    if (filtered.length === all.length) return false
    this.writeAll(filtered)
    return true
  }

  exists(id: string): boolean {
    return !!this.findById(id)
  }
}
