export enum ProgressStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  MIGRATED = 'migrated',
  ARCHIVED = 'archived',
  PAUSED = 'paused',
  ON_HOLD = 'on_hold',
  CANCELLED = 'cancelled',
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum AnchorType {
  before = 'before',
  after = 'after',
  any_before = 'any_before',
  any_after = 'any_after',
}
