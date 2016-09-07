import {Ident} from '../idents';

/**
 * A value stored in the KSeq, with its unique identifier.
 */
export interface Atom<T> {

  /**
   * The atom's unique identifier.
   */
  id: Ident;

  /**
   * The atom's value.
   */
  value: T;

}

/**
 * Creates a new Atom<T>.
 * @param id    The atom's unique identifier.
 * @param value The atom's value.
 * @returns An instance of Atom<T>. 
 */
export function Atom<T>(id: Ident, value: T): Atom<T> {
  return {id, value};
}
