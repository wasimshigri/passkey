export function toBase64Url(bufferLike) {
  return Buffer.from(bufferLike).toString('base64url');
}

export function fromBase64Url(base64url) {
  return Buffer.from(base64url, 'base64url');
}
