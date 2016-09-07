import {Atom} from './Atom';
import {AtomList} from './AtomList';
import {Ident} from '../idents';

/**
 * An implementation of AtomList<T> that uses a binary insertion sort over
 * an array to track a sorted list of atoms.
 */
export class ArrayAtomList<T> implements AtomList<T> {

  private atoms: Atom<T>[];

  /**
   * Creates an instange of ArrayAtomList<T>.
   */
  constructor() {
    this.atoms = [];
  }

  /**
   * @inheritdoc
   */
  size(): number {
    return this.atoms.length;
  }

  /**
   * @inheritdoc
   */
  get(pos: number): Atom<T> {
    return this.atoms[pos];
  }

  /**
   * @inheritdoc
   */
  add(id: Ident, value: T): number {
    let pos = this.bisectRight(id);
    let existing = this.get(pos - 1);
    if (existing && id.compare(existing.id) === 0) {
      return -1;
    }
    let atom = Atom<T>(id, value);
    this.atoms.splice(pos, 0, atom);
    return pos;
  }

  /**
   * @inheritdoc
   */
  remove(id: Ident): number {
    let pos = this.indexOf(id);
    if (pos >= 0) {
      this.atoms.splice(pos, 1);
      return pos;
    }
    return -1;
  }

  /**
   * @inheritdoc
   */
  indexOf(id: Ident): number {
    let pos = this.bisectLeft(id);
    if (pos !== this.atoms.length && this.atoms[pos].id.compare(id) === 0) {
      return pos;
    } else {
      return -1;
    }
  }

  /**
   * @inheritdoc
   */
  forEach(func: { (atom: Atom<T>): void }): void {
    this.atoms.forEach(func);
  }

  /**
   * @inheritdoc
   */
  map<R>(func: { (atom: Atom<T>): R }): R[] {
    return this.atoms.map(func);
  }

  /**
   * @inheritdoc
   */
  toArray(): Atom<T>[] {
    return this.atoms.slice(0);
  }

  /**
   * A binary search that finds the leftmost position of the atom with the
   * specified identifier (if it exists), or the position at which the atom
   * would be (if it does not exist).
   * @param id The desired identifier.
   * @returns The correct position.
   */
  private bisectLeft(id: Ident): number {
    let min = 0;
    let max = this.atoms.length;

    while (min < max) {
      let curr = Math.floor((min + max) / 2);
      if (this.atoms[curr].id.compare(id) < 0) {
        min = curr + 1;
      } else {
        max = curr;
      }
    }

    return min;
  }

  /**
   * A binary search that finds the position at which an atom with the
   * specified identifier should be inserted.
   * @param id The desired identifier.
   * @returns The correct position.
   */
  private bisectRight(id: Ident): number {
    let min = 0;
    let max = this.atoms.length;

    while (min < max) {
      let curr = Math.floor((min + max) / 2);
      if (id.compare(this.atoms[curr].id) < 0) {
        max = curr;
      } else {
        min = curr + 1;
      }
    }

    return min;
  }

}
