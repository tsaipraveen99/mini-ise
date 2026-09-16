// Values an access request can take. Mirrors the Literal types in backend/src/mini_ise/rules.py.
export const ROLES = ['employee', 'contractor', 'guest', 'admin'] as const
export const RESOURCES = ['email', 'wiki', 'engineering', 'finance', 'hr'] as const
export const LOCATIONS = ['office', 'remote'] as const
export const EFFECTS = ['allow', 'deny', 'quarantine'] as const
export const ATTRIBUTES = [
  'role',
  'resource',
  'location',
  'device_managed',
  'device_encrypted',
  'device_patched',
  'hour',
] as const
export const OPS = ['eq', 'neq', 'in', 'not_in', 'gte', 'lt'] as const

export type Role = (typeof ROLES)[number]
export type Resource = (typeof RESOURCES)[number]
export type Location = (typeof LOCATIONS)[number]
export type Effect = (typeof EFFECTS)[number]
export type Attribute = (typeof ATTRIBUTES)[number]
export type Op = (typeof OPS)[number]
