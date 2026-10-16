import { pickBackupZip, saveBackupZip } from "../src/services/backup-file.web";
import { MAX_BACKUP_BYTES } from "../src/domain/backup";

let originalDocument: PropertyDescriptor | undefined;
let originalWindow: PropertyDescriptor | undefined;
let input: any;
beforeEach(() => {
  originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  input = { style: {}, click: jest.fn(), remove: jest.fn(), files: [] };
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => input, body: { appendChild: jest.fn() } } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { addEventListener: jest.fn(), removeEventListener: jest.fn() } });
});
afterEach(() => {
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument); else Reflect.deleteProperty(globalThis, "document");
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow); else Reflect.deleteProperty(globalThis, "window");
  jest.restoreAllMocks(); jest.useRealTimers();
});

test("web picker cancels without leaking its hidden input", async () => {
  const result = pickBackupZip();
  input.oncancel();
  expect(await result).toBeNull();
  expect(input.remove).toHaveBeenCalledTimes(1);
});

test("web import reads local file bytes and rejects oversized files before reading", async () => {
  const result = pickBackupZip();
  input.files = [{ name: "backup.zip", size: 2, arrayBuffer: async () => new Uint8Array([80, 75]).buffer }];
  input.onchange();
  expect(await result).toEqual(new Uint8Array([80, 75]));
  const read = jest.fn();
  const rejected = pickBackupZip();
  input.files = [{ name: "backup.zip", size: MAX_BACKUP_BYTES + 1, arrayBuffer: read }];
  input.onchange();
  await expect(rejected).rejects.toThrow("below 2 MB");
  expect(read).not.toHaveBeenCalled();
});

test("web export downloads a ZIP blob and releases the object URL", async () => {
  jest.useFakeTimers();
  const create = jest.spyOn(URL, "createObjectURL").mockReturnValue("blob:backup");
  const revoke = jest.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  await saveBackupZip(new Uint8Array([80, 75]));
  expect(create.mock.calls[0][0]).toBeInstanceOf(Blob);
  expect((create.mock.calls[0][0] as Blob).type).toBe("application/zip");
  expect(input.download).toMatch(/^payqr-backup-.*\.zip$/);
  expect(input.click).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(60000);
  expect(revoke).toHaveBeenCalledWith("blob:backup");
});
