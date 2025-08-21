export async function sha256Bytes32(file) {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(digest);

  // Convert to 0x + hex
  let hex = "0x";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");

  // Solidity expects bytes32 (32 bytes). SHA-256 is 32 bytes.
  return hex;
}
