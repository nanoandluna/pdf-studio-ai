import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';

vi.mock('@engine/pdfjsEngine', () => ({
  PdfjsViewEngine: class {
    async open(data: ArrayBuffer, path: string, name: string) {
      const pdf = await PDFDocument.load(data);
      return { id: crypto.randomUUID(), path, name, pageCount: pdf.getPageCount(), meta: { fileSize: data.byteLength }, modified: false };
    }
    async dispose() {}
    async getRawPageSize() { return { width: 300, height: 400, rotate: 0 }; }
    async renderPageToDataUrl() { return ''; }
  },
}));
import { useDocumentStore, viewEngine } from '@stores/documentStore';

let input: ArrayBuffer;
let outputs: Uint8Array[];
let bridge: Record<string, any>;
beforeEach(async () => {
  const pdf = await PDFDocument.create();
  for (const width of [300, 400, 500]) pdf.addPage([width, 600]);
  input = (await pdf.save()).buffer as ArrayBuffer;
  outputs = [];
  bridge = {
    confirmDiscard: vi.fn(async () => true),
    saveFileDialog: vi.fn(async () => ({ cancelled: false, path: 'output.pdf' })),
    writeFile: vi.fn(async (_path, bytes) => { outputs.push(bytes); }),
    addRecentFile: vi.fn(async () => []),
  };
  vi.stubGlobal('window', { pdfStudio: bridge });
  useDocumentStore.setState({ dirty: false, loading: false, saving: false });
  await useDocumentStore.getState().closeDocument();
  await useDocumentStore.getState().openBytes(input, '', 'input.pdf');
});

async function outputPages() {
  const pdf = await PDFDocument.load(outputs.at(-1)!);
  return pdf.getPages().map(p => [p.getWidth(), p.getRotation().angle]);
}

describe('document save lifecycle', () => {
  it('delete, reorder, rotate and save twice preserve the same pages', async () => {
    const store = useDocumentStore.getState();
    await store.deletePages([1]);
    await store.reorderPages([2, 1, 0]);
    await store.rotatePages([2], 90);
    expect(await store.save()).toBe(true);
    expect(await outputPages()).toEqual([[500, 90], [300, 0]]);
    expect(await store.save()).toBe(true);
    expect(await outputPages()).toEqual([[500, 90], [300, 0]]);
  });

  it('undo after save restores original pages and redo returns to a clean saved state', async () => {
    const store = useDocumentStore.getState();
    await store.deletePages([1]);
    await store.save();
    await store.undo();
    expect(useDocumentStore.getState().dirty).toBe(true);
    await store.redo();
    expect(useDocumentStore.getState().dirty).toBe(false);
    await store.undo();
    await store.save();
    expect(await outputPages()).toEqual([[300, 0], [400, 0], [500, 0]]);
  });

  it('cancelled and failed saves retain dirty state and allow a retry', async () => {
    const store = useDocumentStore.getState();
    await store.rotatePages([0], 90);
    bridge.saveFileDialog.mockResolvedValueOnce({ cancelled: true });
    expect(await store.save()).toBe(false);
    bridge.writeFile.mockRejectedValueOnce(new Error('disk full'));
    expect(await store.save()).toBe(false);
    expect(useDocumentStore.getState()).toMatchObject({ dirty: true, saving: false });
    expect(await store.save()).toBe(true);
  });

  it('edits made while bytes are being written remain dirty', async () => {
    let finish!: () => void;
    bridge.writeFile.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const store = useDocumentStore.getState();
    const saving = store.save();
    await vi.waitFor(() => expect(finish).toBeDefined());
    await store.rotatePages([0], 90);
    finish();
    await saving;
    expect(useDocumentStore.getState().dirty).toBe(true);
  });

  it('opening a damaged PDF keeps the previous document and engine alive', async () => {
    const previous = useDocumentStore.getState().document;
    const dispose = vi.spyOn(viewEngine, 'dispose');
    await useDocumentStore.getState().openBytes(new ArrayBuffer(0), '', 'broken.pdf');
    expect(useDocumentStore.getState().document).toBe(previous);
    expect(dispose).not.toHaveBeenCalled();
    dispose.mockRestore();
  });

  it('canceling document replacement preserves edits', async () => {
    const store = useDocumentStore.getState();
    await store.rotatePages([0], 90);
    bridge.confirmDiscard.mockResolvedValue(false);
    const previous = useDocumentStore.getState().document;
    await store.openBytes(input, '', 'another.pdf');
    await store.closeDocument();
    expect(useDocumentStore.getState().document).toBe(previous);
    expect(useDocumentStore.getState().dirty).toBe(true);
  });

  it('dragged browser Files use Save As and do not grant a fake local path', async () => {
    const store = useDocumentStore.getState();
    await store.openDroppedFile(new File([input], 'drop.pdf'));
    await store.save();
    expect(bridge.saveFileDialog).toHaveBeenCalled();
    expect(bridge.writeFile.mock.calls[0][0]).toBe('output.pdf');
  });

  it('rejects all-page deletion, duplicate page order and invalid rotation', async () => {
    const store = useDocumentStore.getState();
    await expect(store.deletePages([0, 1, 2])).rejects.toThrow();
    await expect(store.reorderPages([0, 0, 2])).rejects.toThrow();
    await expect(store.rotatePages([0], 13)).rejects.toThrow();
    expect(useDocumentStore.getState().dirty).toBe(false);
  });

  it('extracted pages preserve the current rotation', async () => {
    const store = useDocumentStore.getState();
    await store.rotatePages([1], 90);
    await store.extractPages([1]);
    expect(await outputPages()).toEqual([[400, 90]]);
  });
});
