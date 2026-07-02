import { createServerFn } from "@tanstack/react-start";

import {
  advanceReviewSchema,
  openReviewSchema,
  setEmployeeAttrsSchema,
  setRatingSchema,
} from "./people.shared.ts";

// Thin transports (§9.3); each impl stays behind the lazy-import seam.
export const listDirectoryFn = createServerFn({ method: "GET" }).handler(async () => {
  const { listDirectoryHandler } = await import("./people.impl.server.ts");
  return listDirectoryHandler();
});

export const personDetailFn = createServerFn({ method: "GET" })
  .validator((userId: string) => userId)
  .handler(async ({ data }) => {
    const { personDetailHandler } = await import("./people.impl.server.ts");
    return personDetailHandler(data);
  });

export const setEmployeeAttrsFn = createServerFn({ method: "POST" })
  .validator(setEmployeeAttrsSchema)
  .handler(async ({ data }) => {
    const { setEmployeeAttrsHandler } = await import("./people.impl.server.ts");
    return setEmployeeAttrsHandler(data);
  });

export const openReviewFn = createServerFn({ method: "POST" })
  .validator(openReviewSchema)
  .handler(async ({ data }) => {
    const { openReviewHandler } = await import("./people.impl.server.ts");
    return openReviewHandler(data);
  });

export const advanceReviewFn = createServerFn({ method: "POST" })
  .validator(advanceReviewSchema)
  .handler(async ({ data }) => {
    const { advanceReviewHandler } = await import("./people.impl.server.ts");
    return advanceReviewHandler(data);
  });

export const setRatingFn = createServerFn({ method: "POST" })
  .validator(setRatingSchema)
  .handler(async ({ data }) => {
    const { setRatingHandler } = await import("./people.impl.server.ts");
    return setRatingHandler(data);
  });
