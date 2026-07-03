import { createServerFn } from "@tanstack/react-start";

import {
  advanceReviewSchema,
  assessmentSaveSchema,
  compReadSchema,
  fileAppealSchema,
  openReviewSchema,
  peerDeclineSchema,
  peerRequestCreateSchema,
  peerSubmitSchema,
  resolveAppealSchema,
  selfReviewPayloadSchema,
  setCompSchema,
  setEmployeeAttrsSchema,
  setRatingSchema,
  signDecisionSchema,
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

export const signDecisionFn = createServerFn({ method: "POST" })
  .validator(signDecisionSchema)
  .handler(async ({ data }) => {
    const { signDecisionHandler } = await import("./people.impl.server.ts");
    return signDecisionHandler(data);
  });

export const calibrationFn = createServerFn({ method: "GET" }).handler(async () => {
  const { calibrationHandler } = await import("./people.impl.server.ts");
  return calibrationHandler();
});

export const compFn = createServerFn({ method: "GET" })
  .validator(compReadSchema)
  .handler(async ({ data }) => {
    const { compHandler } = await import("./people.impl.server.ts");
    return compHandler(data);
  });

export const setCompFn = createServerFn({ method: "POST" })
  .validator(setCompSchema)
  .handler(async ({ data }) => {
    const { setCompHandler } = await import("./people.impl.server.ts");
    return setCompHandler(data);
  });

export const fileAppealFn = createServerFn({ method: "POST" })
  .validator(fileAppealSchema)
  .handler(async ({ data }) => {
    const { fileAppealHandler } = await import("./people.impl.server.ts");
    return fileAppealHandler(data);
  });

export const appealsListFn = createServerFn({ method: "GET" }).handler(async () => {
  const { appealsListHandler } = await import("./people.impl.server.ts");
  return appealsListHandler();
});

export const resolveAppealFn = createServerFn({ method: "POST" })
  .validator(resolveAppealSchema)
  .handler(async ({ data }) => {
    const { resolveAppealHandler } = await import("./people.impl.server.ts");
    return resolveAppealHandler(data);
  });

export const overviewFn = createServerFn({ method: "GET" }).handler(async () => {
  const { overviewHandler } = await import("./people.impl.server.ts");
  return overviewHandler();
});

export const bandsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { bandsHandler } = await import("./people.impl.server.ts");
  return bandsHandler();
});

export const auditLogFn = createServerFn({ method: "GET" }).handler(async () => {
  const { auditLogHandler } = await import("./people.impl.server.ts");
  return auditLogHandler();
});

export const decisionsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { decisionsHandler } = await import("./people.impl.server.ts");
  return decisionsHandler();
});

export const selfReviewGetFn = createServerFn({ method: "GET" }).handler(async () => {
  const { selfReviewGetHandler } = await import("./people.impl.server.ts");
  return selfReviewGetHandler();
});

export const selfReviewSaveFn = createServerFn({ method: "POST" })
  .validator(selfReviewPayloadSchema)
  .handler(async ({ data }) => {
    const { selfReviewSaveHandler } = await import("./people.impl.server.ts");
    return selfReviewSaveHandler(data);
  });

export const selfReviewSubmitFn = createServerFn({ method: "POST" })
  .validator(selfReviewPayloadSchema)
  .handler(async ({ data }) => {
    const { selfReviewSubmitHandler } = await import("./people.impl.server.ts");
    return selfReviewSubmitHandler(data);
  });

export const selfReviewReopenFn = createServerFn({ method: "POST" }).handler(async () => {
  const { selfReviewReopenHandler } = await import("./people.impl.server.ts");
  return selfReviewReopenHandler();
});

export const peerPageFn = createServerFn({ method: "GET" }).handler(async () => {
  const { peerPageHandler } = await import("./people.impl.server.ts");
  return peerPageHandler();
});

export const peerRequestCreateFn = createServerFn({ method: "POST" })
  .validator(peerRequestCreateSchema)
  .handler(async ({ data }) => {
    const { peerRequestCreateHandler } = await import("./people.impl.server.ts");
    return peerRequestCreateHandler(data);
  });

export const peerSubmitFn = createServerFn({ method: "POST" })
  .validator(peerSubmitSchema)
  .handler(async ({ data }) => {
    const { peerSubmitHandler } = await import("./people.impl.server.ts");
    return peerSubmitHandler(data);
  });

export const peerDeclineFn = createServerFn({ method: "POST" })
  .validator(peerDeclineSchema)
  .handler(async ({ data }) => {
    const { peerDeclineHandler } = await import("./people.impl.server.ts");
    return peerDeclineHandler(data);
  });

export const assessListFn = createServerFn({ method: "GET" }).handler(async () => {
  const { assessListHandler } = await import("./people.impl.server.ts");
  return assessListHandler();
});

export const assessDetailFn = createServerFn({ method: "GET" })
  .validator((caseId: string) => caseId)
  .handler(async ({ data }) => {
    const { assessDetailHandler } = await import("./people.impl.server.ts");
    return assessDetailHandler(data);
  });

export const assessSaveFn = createServerFn({ method: "POST" })
  .validator(assessmentSaveSchema)
  .handler(async ({ data }) => {
    const { assessSaveHandler } = await import("./people.impl.server.ts");
    return assessSaveHandler(data);
  });

export const assessSubmitFn = createServerFn({ method: "POST" })
  .validator(assessmentSaveSchema)
  .handler(async ({ data }) => {
    const { assessSubmitHandler } = await import("./people.impl.server.ts");
    return assessSubmitHandler(data);
  });
