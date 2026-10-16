import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { File } from "expo-file-system";
import { pickBackupZip, saveBackupZip } from "../src/services/backup-file";
import { MAX_BACKUP_BYTES } from "../src/domain/backup";

jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock("expo-crypto", () => ({ randomUUID: () => "abc-def" }));
jest.mock("expo-file-system", () => {
  class MockFile {
    static instances: MockFile[] = [];
    static incomingSize = 2;
    uri: string; exists = true; size = MockFile.incomingSize;
    name: string;
    delete = jest.fn(() => { this.exists = false; });
    create = jest.fn(); write = jest.fn();
    bytes = jest.fn(async () => new Uint8Array([80, 75]));
    constructor(parent: string | { uri: string }, name?: string) {
      this.uri = (typeof parent === "string" ? parent : parent.uri) + (name ? "/" + name : "");
      this.name = this.uri.split("/").at(-1)!;
      MockFile.instances.push(this);
    }
  }
  return {
    File: MockFile,
    Paths: { cache: { uri: "file:///cache" } },
    Directory: class {
      uri = "file:///cache/payqr-backups";
      create() {} list() { return []; }
    },
  };
});
type MockFileType = { instances: { delete: jest.Mock; write: jest.Mock; bytes: jest.Mock; uri: string }[]; incomingSize: number };
const files = File as unknown as MockFileType;
beforeEach(() => {
  jest.clearAllMocks(); files.instances = []; files.incomingSize = 2;
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
  jest.mocked(Sharing.shareAsync).mockResolvedValue(undefined);
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({ canceled: false, assets: [{ name: "backup.zip", uri: "file:///cache/picked.zip", size: 2, lastModified: 0 }] });
});

test("picker cancellation creates no file", async () => {
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({ canceled: true, assets: null });
  expect(await pickBackupZip()).toBeNull();
  expect(files.instances).toHaveLength(0);
});

test("import deletes only the picker's cache copy after reading", async () => {
  expect(await pickBackupZip()).toEqual(new Uint8Array([80, 75]));
  expect(files.instances[0].delete).toHaveBeenCalled();
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({ canceled: false, assets: [{ name: "backup.zip", uri: "file:///documents/original.zip", lastModified: 0 }] });
  await pickBackupZip();
  expect(files.instances[1].delete).not.toHaveBeenCalled();
});

test("file size is checked before allocating archive bytes", async () => {
  files.incomingSize = MAX_BACKUP_BYTES + 1;
  await expect(pickBackupZip()).rejects.toThrow("below 2 MB");
  expect(files.instances[0].bytes).not.toHaveBeenCalled();
});

test("export leaves encrypted bytes available to the receiving app", async () => {
  const zip = new Uint8Array([80, 75]);
  await saveBackupZip(zip);
  expect(files.instances[0].write).toHaveBeenCalledWith(zip);
  expect(Sharing.shareAsync).toHaveBeenCalledWith(expect.stringContaining("payqr-backup-"), expect.objectContaining({ mimeType: "application/zip" }));
  expect(files.instances[0].delete).not.toHaveBeenCalled();
});

test("unavailable sharing creates no cache export", async () => {
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false);
  await expect(saveBackupZip(new Uint8Array([80, 75]))).rejects.toThrow("unavailable");
  expect(files.instances).toHaveLength(0);
});
