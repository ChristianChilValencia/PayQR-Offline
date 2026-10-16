import { MAX_BACKUP_BYTES } from "../domain/backup";

export async function pickBackupZip(): Promise<Uint8Array | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".zip,application/zip"; input.style.display = "none";
    let settled = false, reading = false;
    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    function finish(value: Uint8Array | null, error?: unknown) {
      if (settled) return;
      settled = true;
      if (focusTimer) clearTimeout(focusTimer);
      window.removeEventListener("focus", refocused);
      input.remove();
      if (error) reject(error); else resolve(value);
    }
    function refocused() {
      focusTimer = setTimeout(() => { if (!reading && !input.files?.length) finish(null); }, 1000);
    }
    input.oncancel = () => finish(null);
    input.onchange = () => {
      reading = true;
      const file = input.files?.[0];
      if (!file) { finish(null); return; }
      if (!file.name.toLowerCase().endsWith(".zip") || file.size > MAX_BACKUP_BYTES) {
        finish(null, new Error("Choose a PayQR ZIP backup below 2 MB.")); return;
      }
      void file.arrayBuffer().then((buffer) => {
        if (buffer.byteLength > MAX_BACKUP_BYTES) throw new Error("Backup exceeds the 2 MB limit.");
        finish(new Uint8Array(buffer));
      }).catch((error) => finish(null, error));
    };
    window.addEventListener("focus", refocused);
    document.body.appendChild(input);
    try { input.click(); } catch (error) { finish(null, error); }
  });
}

export async function saveBackupZip(bytes: Uint8Array): Promise<void> {
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = `payqr-backup-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(link);
  try { link.click(); }
  finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000); }
}
