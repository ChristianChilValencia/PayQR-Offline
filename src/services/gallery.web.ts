export async function savePNGToGallery(uri: string) {
  const response = await fetch(uri);
  if (!response.ok) throw new Error("Unable to download the PNG. Try again.");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = "payqr.png";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Keep the blob alive while the browser starts the download.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
