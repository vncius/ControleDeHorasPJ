import fs from 'fs/promises'
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

  private async readAll(): Promise<T[]> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8')
      return JSON.parse(raw) as T[]
    } catch {
      return []
    }
  }

  // --- escrita ---

  private async writeAll(items: T[]): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(items, null, 2), 'utf-8')
  }

  // --- CRUD público ---

  async findAll(): Promise<T[]> {
    return this.readAll()
  }

  async findById(id: string): Promise<T | undefined> {
    const all = await this.readAll()
    return all.find((item) => item.id === id)
  }

  async findBy(predicate: (item: T) => boolean): Promise<T[]> {
    const all = await this.readAll()
    return all.filter(predicate)
  }

  async findOneBy(predicate: (item: T) => boolean): Promise<T | undefined> {
    const all = await this.readAll()
    return all.find(predicate)
  }

  async create(item: T): Promise<T> {
    const all = await this.readAll()
    all.push(item)
    await this.writeAll(all)
    return item
  }

  async update(id: string, partial: Partial<T>): Promise<T | null> {
    const all = await this.readAll()
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
    await this.writeAll(all)
    return all[index]
  }

  async delete(id: string): Promise<boolean> {
    const all = await this.readAll()
    const filtered = all.filter((item) => item.id !== id)
    if (filtered.length === all.length) return false
    await this.writeAll(filtered)
    return true
  }

  async exists(id: string): Promise<boolean> {
    return !!(await this.findById(id))
  }
}
