// ============================================================
// Unit Test — CommandHistory（Undo/Redo）
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { CommandHistory, type PdfCommand } from '@commands/types';

function makeCommand(name: string, log: string[], apply: string): PdfCommand {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : name,
    name,
    description: apply,
    execute: async () => {
      log.push(`execute:${apply}`);
    },
    undo: async () => {
      log.push(`undo:${apply}`);
    },
  };
}

describe('CommandHistory', () => {
  let history: CommandHistory;
  let log: string[];

  beforeEach(() => {
    history = new CommandHistory();
    log = [];
  });

  it('初始状态不能撤销/重做', () => {
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
  });

  it('执行命令后可以撤销', async () => {
    await history.execute(makeCommand('c1', log, 'A'));
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
    expect(log).toEqual(['execute:A']);
  });

  it('undo 后可以 redo，redo 后可以再 undo', async () => {
    await history.execute(makeCommand('c1', log, 'A'));
    await history.execute(makeCommand('c2', log, 'B'));
    const undone = await history.undo();
    expect(undone?.name).toBe('c2');
    expect(log).toEqual(['execute:A', 'execute:B', 'undo:B']);

    const redone = await history.redo();
    expect(redone?.name).toBe('c2');
    expect(log).toEqual(['execute:A', 'execute:B', 'undo:B', 'execute:B']);
  });

  it('新命令会清空 redo 栈', async () => {
    await history.execute(makeCommand('c1', log, 'A'));
    await history.execute(makeCommand('c2', log, 'B'));
    await history.undo();
    await history.execute(makeCommand('c3', log, 'C'));
    expect(history.canRedo).toBe(false);
    expect(await history.redo()).toBeNull();
  });

  it('clear 清空全部', async () => {
    await history.execute(makeCommand('c1', log, 'A'));
    history.clear();
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
  });

  it('空栈 undo/redo 返回 null', async () => {
    expect(await history.undo()).toBeNull();
    expect(await history.redo()).toBeNull();
  });

  it('undo 失败时不进入 redo 栈', async () => {
    const failing: PdfCommand = {
      id: 'f',
      name: 'fail',
      description: 'fail',
      execute: async () => {
        log.push('execute');
      },
      undo: async () => {
        throw new Error('undo failed');
      },
    };
    await history.execute(failing);
    await history.undo();
    expect(history.canRedo).toBe(false);
    expect(history.canUndo).toBe(false);
  });
});
