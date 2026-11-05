import type {
  AdminInvitation,
  AdminPlace,
  AdminPlan,
  AdminReview,
  AuditEvent,
  Page,
  Permission,
  PlaceAttribute,
  PlaceCategory,
  PlaceMenu,
  PlacePhoto,
  PlaceSchedule,
  Role,
  UserSummary,
} from './admin-api';
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
export type AuditEventMatchesTheWire = Wire<AuditEvent, components['schemas']['AuditEvent']>;
export type AdminReviewMatchesTheWire = Wire<AdminReview, components['schemas']['Review']>;
export type AdminPlaceMatchesTheWire = Wire<AdminPlace, components['schemas']['AdminPlace']>;
export type AdminPlanMatchesTheWire = Wire<AdminPlan, components['schemas']['Plan']>;
export type AdminInvitationMatchesTheWire = Wire<AdminInvitation, components['schemas']['Invitation']>;
export type PlaceCategoryMatchesTheWire = Wire<PlaceCategory, components['schemas']['PlaceCategory']>;
export type PlaceAttributeMatchesTheWire = Wire<
  PlaceAttribute,
  components['schemas']['PlaceAttribute']
>;
export type PlaceMenuMatchesTheWire = Wire<PlaceMenu, components['schemas']['PlaceMenu']>;
export type PlacePhotoMatchesTheWire = Wire<PlacePhoto, components['schemas']['PlacePhoto']>;
export type PlaceScheduleMatchesTheWire = Wire<
  PlaceSchedule,
  components['schemas']['PlaceSchedule']
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
