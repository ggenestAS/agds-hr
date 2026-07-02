// A small closed set of Error subclasses with structured public readonly
// fields and machine-parseable snake_case:-prefixed messages. Errors are
// thrown, not returned; the web error boundary parses the prefix into
// friendly copy — see docs/new-project-directives.md §7.

export class ForbiddenError extends Error {
  constructor(
    public readonly action: string,
    public readonly reason: string,
  ) {
    super(`forbidden: ${action} (${reason})`);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  constructor(
    public readonly resource: string,
    public readonly id: string,
  ) {
    super(`not_found: ${resource}#${id}`);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(public readonly reason: string) {
    super(`conflict: ${reason}`);
    this.name = "ConflictError";
  }
}

export class UniqueViolationError extends Error {
  constructor(
    public readonly constraint: string,
    public readonly value: string,
  ) {
    super(`unique_violation: ${constraint}(${value})`);
    this.name = "UniqueViolationError";
  }
}
