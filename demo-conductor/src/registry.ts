import { DemoController } from './controller.js'

export class DemoControllerRegistry {
  private readonly controllers = new Map<string, DemoController>()
  private readonly pending = new Map<string, Promise<DemoController>>()

  constructor(
    private readonly repoRoot: string,
    private readonly port: number
  ) {}

  async forUser(userId: string) {
    const existing = this.controllers.get(userId)
    if (existing) return existing

    const inflight = this.pending.get(userId)
    if (inflight) return inflight

    const created = this.createController(userId)
    this.pending.set(userId, created)
    return created
  }

  async shutdown() {
    const first = this.controllers.values().next().value as DemoController | undefined
    if (first) {
      await first.shutdown()
    }
  }

  private async createController(userId: string) {
    try {
      const controller = new DemoController({
        repoRoot: this.repoRoot,
        port: this.port,
        ownerKey: userId
      })
      await controller.init()
      this.controllers.set(userId, controller)
      return controller
    } finally {
      this.pending.delete(userId)
    }
  }
}
