import { Operations, Recipient, RecordV1 } from "./state";
/** Metadata commit is the cancellation boundary. Files are staged before it. */
export async function importRecipient(
  id: number,
  operations: Operations,
  pick: () => Promise<Recipient | null>,
  patch: (transform: (r: RecordV1) => RecordV1) => Promise<void>,
  remove: (uri: string) => Promise<void>,
  committing: () => void = () => {},
) {
  let staged: Recipient | null = null;
  try {
    staged = await pick();
    if (!staged || !operations.current(id)) return;
    const accepted = staged;
    let old: string | undefined;
    await patch((r) => {
      if (!operations.current(id)) throw new Error("Import cancelled");
      committing();
      old = r.recipient?.image;
      return { ...r, recipient: accepted };
    });
    staged = null;
    if (old) await remove(old);
  } finally {
    if (staged) await remove(staged.image);
  }
}
