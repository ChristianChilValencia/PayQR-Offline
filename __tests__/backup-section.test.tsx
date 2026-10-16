import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";
import { BackupSection } from "../src/screens/BackupSection";
import { Action } from "../src/screens/common";
import { useApp } from "../App";
import { createBackupZip, openBackupZip } from "../src/services/backup-codec";
import { pickBackupZip, saveBackupZip } from "../src/services/backup-file";
import { initial, migrate, saveNumber, RecordV1 } from "../src/domain/state";

jest.mock("../App", () => ({ useApp: jest.fn() }));
jest.mock("expo-router", () => ({
  useFocusEffect: (callback: () => void) => jest.requireActual("react").useEffect(callback, [callback]),
}));
jest.mock("../src/services/backup-codec", () => ({
  createBackupZip: jest.fn(), openBackupZip: jest.fn(),
}));
jest.mock("../src/services/backup-file", () => ({ pickBackupZip: jest.fn(), saveBackupZip: jest.fn() }));

let tree: ReactTestRenderer;
let record: RecordV1;
let patch: jest.Mock;
let report: jest.Mock;
const button = (title: string) => tree.root.findAllByType(Action).find((node) => node.props.title === title)!;
beforeEach(() => {
  jest.clearAllMocks();
  record = saveNumber({ ...migrate(initial), cents: 45600 }, "09171234567", "manual", "Current");
  report = jest.fn();
  patch = jest.fn(async (transform) => { record = transform(record); });
  jest.mocked(useApp).mockImplementation(() => ({ record, patch, report } as never));
  jest.mocked(saveBackupZip).mockResolvedValue(undefined);
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

test("export immediately shares ZIP without opening an app modal", async () => {
  const zip = new Uint8Array([80, 75]);
  jest.mocked(createBackupZip).mockResolvedValue(zip);
  await act(async () => { tree = create(<BackupSection />); });
  await act(async () => button("Export ZIP").props.onPress());
  expect(createBackupZip).toHaveBeenCalledWith(record);
  expect(saveBackupZip).toHaveBeenCalledWith(zip);
  expect(patch).not.toHaveBeenCalled();
  expect(button("Create ZIP")).toBeUndefined();
});

test("import immediately merges into the latest history without an app modal", async () => {
  jest.mocked(pickBackupZip).mockResolvedValue(new Uint8Array([80, 75]));
  const incoming = saveNumber(migrate(initial), "09181234567", "scanned", "Imported");
  jest.mocked(openBackupZip).mockImplementationOnce(async () => {
    record = saveNumber(record, "09191234567", "manual", "Added meanwhile");
    return incoming;
  });
  await act(async () => { tree = create(<BackupSection />); });
  await act(async () => button("Import ZIP").props.onPress());
  expect(patch).toHaveBeenCalledTimes(1);
  expect(record.numbers).toHaveLength(3);
  expect(record.cents).toBe(45600);
  expect(button("Merge backup")).toBeUndefined();
});

test("cancelled picking and invalid ZIPs never modify history", async () => {
  jest.mocked(pickBackupZip).mockResolvedValueOnce(null).mockResolvedValueOnce(new Uint8Array([80, 75]));
  jest.mocked(openBackupZip).mockRejectedValueOnce(new Error("Invalid ZIP"));
  await act(async () => { tree = create(<BackupSection />); });
  await act(async () => button("Import ZIP").props.onPress());
  expect(button("Unlock ZIP")).toBeUndefined();
  await act(async () => button("Import ZIP").props.onPress());
  expect(patch).not.toHaveBeenCalled();
  expect(report).toHaveBeenCalledWith("Invalid ZIP");
  expect(button("Merge backup")).toBeUndefined();
});

test("failed import save retains history and allows picking again to retry", async () => {
  jest.mocked(pickBackupZip).mockImplementation(async () => new Uint8Array([80, 75]));
  jest.mocked(openBackupZip).mockResolvedValue(saveNumber(migrate(initial), "09181234567", "manual"));
  const original = record;
  patch.mockRejectedValueOnce(new Error("Disk full"));
  await act(async () => { tree = create(<BackupSection />); });
  await act(async () => button("Import ZIP").props.onPress());
  expect(record).toBe(original);
  expect(report).toHaveBeenCalledWith("Disk full");
  expect(button("Import ZIP").props.disabled).toBe(false);
  await act(async () => button("Import ZIP").props.onPress());
  expect(record.numbers).toHaveLength(2);
});

test("export failure reports an error, preserves history, and allows retry", async () => {
  jest.mocked(createBackupZip).mockResolvedValue(new Uint8Array([80, 75]));
  jest.mocked(saveBackupZip).mockRejectedValueOnce(new Error("Sharing unavailable"));
  await act(async () => { tree = create(<BackupSection />); });
  await act(async () => button("Export ZIP").props.onPress());
  expect(report).toHaveBeenCalledWith("Sharing unavailable");
  expect(patch).not.toHaveBeenCalled();
  expect(button("Export ZIP").props.disabled).toBe(false);
  await act(async () => button("Export ZIP").props.onPress());
  expect(saveBackupZip).toHaveBeenCalledTimes(2);
});

test("rapid export presses share only once while a share is pending", async () => {
  let finish!: () => void;
  jest.mocked(createBackupZip).mockResolvedValue(new Uint8Array([80, 75]));
  jest.mocked(saveBackupZip).mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  await act(async () => { tree = create(<BackupSection />); });
  await act(async () => { button("Export ZIP").props.onPress(); button("Export ZIP").props.onPress(); });
  expect(saveBackupZip).toHaveBeenCalledTimes(1);
  expect(button("Export ZIP").props.disabled).toBe(true);
  await act(async () => finish());
  expect(button("Export ZIP").props.disabled).toBe(false);
});


test("export checkmark resets after two seconds with no status description", async () => {
  jest.useFakeTimers();
  try {
    jest.mocked(createBackupZip).mockResolvedValue(new Uint8Array([80, 75]));
    await act(async () => { tree = create(<BackupSection />); });
    expect(button("Export ZIP").props.icon).toBe("download");
    await act(async () => button("Export ZIP").props.onPress());
    expect(button("Export ZIP").props.icon).toBe("check");
    expect(JSON.stringify(tree.toJSON())).not.toContain("ZIP prepared");
    act(() => jest.advanceTimersByTime(2000));
    expect(button("Export ZIP").props.icon).toBe("download");
  } finally { jest.useRealTimers(); }
});
