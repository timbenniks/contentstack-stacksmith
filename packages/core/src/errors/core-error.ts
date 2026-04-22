export class CoreError extends Error {
  readonly code: string;

  constructor(message: string, code = "CORE_ERROR") {
    super(message);
    this.name = "CoreError";
    this.code = code;
  }
}

export class ValidationError extends CoreError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class DependencyCycleError extends CoreError {
  constructor(message: string) {
    super(message, "DEPENDENCY_CYCLE");
    this.name = "DependencyCycleError";
  }
}
