import type { AuditEvent, Page, Permission, Role, UserSummary } from './admin-api';
import type { components } from './generated/api-types';

/**
 * Compile-time guard between the two halves of the contract.
 *
 * `AdminApi`'s hand-written types stay the source of truth for the logic: they say what the panel
 * does with a user, a role or an audit event. `generated/api-types.ts` describes the wire, and is
 * regenerated from `contract/openapi.yaml` by `scripts/generate-api-client.sh`.
 *
 * Nothing forces the two to agree, so this file does: each hand-written wire type must stay
 * assignable to the generated schema of the same name. When the snapshot moves and the types fall
 * behind, or someone edits a hand-written type into a shape the API does not send, this file stops
 * compiling — which is the only moment the mismatch is cheap to fix.
 *
 * This is a type-only module: it emits nothing and is never imported at runtime.
 */
type Wire<HandWritten extends Generated, Generated> = HandWritten;

export type UserSummaryMatchesTheWire = Wire<UserSummary, components['schemas']['UserSummary']>;
export type RoleMatchesTheWire = Wire<Role, components['schemas']['Role']>;
export type PermissionMatchesTheWire = Wire<Permission, components['schemas']['Permission']>;
/**
 * `metadata` is exempt on purpose, and it is an upstream defect, not a preference: the contract
 * declares it as a bare `type: object`, which openapi-typescript reads as `Record<string, never>`,
 * while `AdminApi` reads it as the free-form JSON the API actually stores. The guard covers every
 * other field until `api/openapi.yaml` says `additionalProperties: true` there; the exemption goes
 * away with that contract change.
 */
export type AuditEventMatchesTheWire = Wire<
  Omit<AuditEvent, 'metadata'>,
  Omit<components['schemas']['AuditEvent'], 'metadata'>
>;

/**
 * The list envelope is `Page<T>` here and `Page` in the contract, which carries only the counters;
 * the entries come from each endpoint's own schema. Comparing the counters is what catches a
 * renamed or dropped field.
 */
export type PageCountersMatchTheWire = Wire<
  Pick<Page<unknown>, 'page' | 'limit' | 'total'>,
  components['schemas']['Page']
>;
