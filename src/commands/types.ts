// ============================================================
// Command 模式 — 所有可撤销的 PDF 操作统一抽象
// ============================================================

export interface PdfCommand {
  id: string;
  name: string;
  /** 操作描述（用于 Undo/Redo 栈 UI 展示） */
  description: string;
  execute(): Promise<void>;
  undo(): Promise<void>;
}

export class CommandHistory {
  private undoStack: PdfCommand[] = [];
  private redoStack: PdfCommand[] = [];

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get undoCount(): number {
    return this.undoStack.length;
  }

  get redoCount(): number {
    return this.redoStack.length;
  }

  /** 清空（打开新文档时调用） */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  async execute(command: PdfCommand): Promise<void> {
    await command.execute();
    this.undoStack.push(command);
    this.redoStack = [];
  }

  async undo(): Promise<PdfCommand | null> {
    const cmd = this.undoStack.pop();
    if (!cmd) return null;
    try {
      await cmd.undo();
      this.redoStack.push(cmd);
      return cmd;
    } catch (e) {
      // undo 失败：不把命令推进 redo，避免死循环
      console.error('Undo 失败', e);
      return null;
    }
  }

  async redo(): Promise<PdfCommand | null> {
    const cmd = this.redoStack.pop();
    if (!cmd) return null;
    try {
      await cmd.execute();
      this.undoStack.push(cmd);
      return cmd;
    } catch (e) {
      console.error('Redo 失败', e);
      return null;
    }
  }
}
