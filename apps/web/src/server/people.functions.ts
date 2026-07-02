import { createServerFn } from "@tanstack/react-start";

// Thin transport (§9.3); the impl (policy gate + admin-connection DAL) stays
// behind the lazy-import seam. GET — a read used by the directory loader.
export const listDirectoryFn = createServerFn({ method: "GET" }).handler(async () => {
  const { listDirectoryHandler } = await import("./people.impl.server.ts");
  return listDirectoryHandler();
});
