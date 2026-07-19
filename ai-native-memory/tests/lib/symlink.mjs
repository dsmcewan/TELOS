import { symlinkSync } from "node:fs";

export function symlinkOrSkip(target, link, { type, label } = {}) {
  const effectiveType = process.platform === "win32" && type === "dir"
    ? "junction"
    : type;
  try {
    symlinkSync(target, link, effectiveType);
    return true;
  } catch (error) {
    const unavailableOnNativeWindows = process.platform === "win32"
      && error?.code === "EPERM"
      && /operation not permitted/i.test(error.message || "");
    if (!unavailableOnNativeWindows) throw error;
    console.warn(
      `SKIP symlink assertion (${label || link}):`
      + " native Windows symlink privilege is unavailable"
      + " (EPERM: operation not permitted)"
    );
    return false;
  }
}
