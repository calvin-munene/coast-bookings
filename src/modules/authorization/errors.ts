export class UnauthenticatedError extends Error {
  readonly status = 401;
  constructor() { super("Authentication required"); this.name = "UnauthenticatedError"; }
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "You do not have permission to perform this action") { super(message); this.name = "ForbiddenError"; }
}

export class AccountRestrictedError extends Error {
  readonly status = 403;
  constructor() { super("This account is not active"); this.name = "AccountRestrictedError"; }
}

export class ResourceNotFoundError extends Error {
  readonly status = 404;
  constructor() { super("The requested resource was not found"); this.name = "ResourceNotFoundError"; }
}

export class OrganizationContextRequiredError extends Error {
  readonly status = 403;
  constructor() { super("An active organization context is required"); this.name = "OrganizationContextRequiredError"; }
}
