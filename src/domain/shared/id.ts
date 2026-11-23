/**
 * Branded identifier types.
 *
 * All ids are UUID v4 strings. The brand makes it a compile-time error to pass,
 * for example, a FamilyMemberId where a RelationshipId is expected.
 * Ids are generated through an `IdGenerator` port (see shared/), never inside
 * the domain, so the domain stays free of platform APIs.
 */
declare const brand: unique symbol;
 
export type Brand<T, B extends string> = T & { readonly [brand]: B };
 
export type UserId = Brand<string, 'UserId'>;
export type DeviceId = Brand<string, 'DeviceId'>;
export type FamilyTreeId = Brand<string, 'FamilyTreeId'>;
export type FamilyMemberId = Brand<string, 'FamilyMemberId'>;
export type RelationshipId = Brand<string, 'RelationshipId'>;
export type PhotoId = Brand<string, 'PhotoId'>;
export type OperationId = Brand<string, 'OperationId'>;
 
