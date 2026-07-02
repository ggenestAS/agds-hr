import type { AuditEventId, RequestId, UserId } from "@agds-hr/shared";

// Every domain mutation takes AuditContext last (docs/new-project-directives.md
// §8.1). `subjectUserId` is the human the action is about; `actorUserId` is
// the person doing it — same on self-service, different on every cross-user
// privileged action. Event types are a deliberately open vocabulary
// (`domain.entity.verb` dotted strings), not a pg enum.
export type AuditContext = {
  readonly actorUserId: UserId;
  readonly subjectUserId: UserId;
  readonly requestId: RequestId;
  readonly ip?: string;
};

export type AuditEvent = {
  readonly id: AuditEventId;
  readonly actorUserId: UserId;
  readonly subjectUserId: UserId;
  readonly domain: string;
  readonly eventType: string;
  readonly resourceId: string | undefined;
  readonly payload: Record<string, unknown>;
  readonly requestId: RequestId;
  readonly ip: string | undefined;
  readonly createdAt: Date;
};
