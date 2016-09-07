import {Atom} from './Atom';
import {Ident} from '../idents';

/**
 * A sorted list of Atom<T>s, used as backing storage by KSeq<T>.
 */
export interface AtomList<T> {

  /**
   * Returns the number of atoms currently stored.
   * @returns The number of atoms. 
   */
  size(): number;

  /**
   * Gets the atom at the specified position in the sorted list.
   * @param pos The desired position.
   * @returns The atom at the specified position.
   */
  get(pos: number): Atom<T>;

  /**
   * Adds the specified value with the specified Ident to the list
   * at the correct position.
   * @param id    The identifier for the value.
   * @param value The value to add.
   * @returns The position at which the value was inserted,
   *          or -1 if an atom with the specified ident already exists.
   */
  add(id: Ident, value: T): number;

  /**
   * Removes the atom with the specified Ident from the list.
   * @param id The identifier of the atom to remove.
   * @returns The position of the removed atom,
   *          or -1 if no atom with the specified identifier exists.
   */
  remove(id: Ident): number;

  /**
   * Gets the index of the atom with the specified identifier.
   * @param id The desired identifier.
   * @returns The position of the atom with the specified identifer,
   *          or -1 if no atom with the identifier exists.
   */
  indexOf(id: Ident): number;

  /**
   * Applies a function to each of the atoms in the list.
   * @param func The function to apply.
   */
  forEach(func: { (atom: Atom<T>): void }): void;

  /**
   * Applies a transformation function to each of the atoms in the list.
   * @param func The transformation function to apply.
   * @returns An array containing the results of the function calls.
   */
  map<R>(func: { (atom: Atom<T>): R }): R[];

  /**
   * Converts the Storage<T> to an array.
   * @returns An array representation of the atoms in the list.
   */
  toArray(): Atom<T>[];

}
