import {Ident} from './Ident';

/**
 * Creates Idents using an algorithm that guarantees that the application of
 * operations will be associative, commutative, and idempotent.
 */
export interface IdentGenerator {

  /**
   * Creates a new Ident whose value lies somewhere between two other Idents.
   * @param name   The unique replica name that is generating the Ident.
   * @param time   The local logical time for the replica.
   * @param before The Ident that should come directly before the new Ident.
   * @param before The Ident that should come directly after the new Ident.
   * @returns The newly-generated Ident.
   */
  getIdent(name: string, time: number, before: Ident, after: Ident): Ident;

}
