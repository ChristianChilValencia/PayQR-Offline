import { removeImage } from "../src/services/qr-image";
import * as FS from "expo-file-system/legacy";
jest.mock("expo-camera", () => ({ Camera: { scanFromURLAsync: jest.fn() } }));
jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///private/",
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));
test("migration removes only app-owned QR copies, never original photos or traversed paths", async () => {
  for (const uri of [
    "file:///photos/user.png",
    "file:///private/user.png",
    "file:///private/payqr-../../photo.img",
    "file:///private/payqr-folder/file.img",
  ])
    await removeImage(uri);
  expect(FS.deleteAsync).not.toHaveBeenCalled();
  await removeImage("file:///private/payqr-123-abc.img");
  expect(FS.deleteAsync).toHaveBeenCalledWith(
    "file:///private/payqr-123-abc.img",
    { idempotent: true },
  );
});
