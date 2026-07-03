import { z } from "zod";

// Impersonation transport shapes (§9.3). The target is named by email — most
// of the roster has no auth.user row until first touch, so the handler
// resolves (or provisions) the row before the policy check.
export const impersonateStartSchema = z.object({
  email: z.string().email(),
  reason: z.string().max(500).optional(),
});
export type ImpersonateStartInput = z.infer<typeof impersonateStartSchema>;
