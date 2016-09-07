import {Ident} from './Ident';

/**
 * A set of Idents.
 */
export class IdentSet {

  private entries: { [ident: string]: boolean };

  /**
   * Creates a new instance of IdentSet.
   * @params idents An array of (possibly serialized) Idents to add.
   * @returns An instance of IdentSet.
   */
  constructor(idents?: Array<Ident|string>) {
    this.entries = {};
    if (idents) {
      idents.forEach((ident) => this.add(ident));
    }
  }

  /**
   * Gets the cardinality of the set.
   * @returns The number of idents in the set.
   */
  size(): number {
    return Object.keys(this.entries).length;
  }

  /**
   * Adds the specified Ident to the set.
   * @param ident The (possibly serialized) Ident to add.
   */
  add(ident: Ident|string) {
    this.entries[ident.toString()] = true;
  }

  /**
   * Determines whether the specified Ident is in the set.
   * @param ident The (possibly serialized) Ident in question.
   * @returns True if the ident is in the set, otherwise false.
   */
  has(ident: Ident|string) {
    return !!this.entries[ident.toString()];
  }

  /**
   * Removes the specified Ident from the set.
   * @param ident The (possibly serialized) Ident to remove.
   */
  remove(ident: Ident|string) {
    delete this.entries[ident.toString()];
  }

  /**
   * Converts the IdentSet to a lightweight representation suitable
   * for serialization.
   * @returns An array of serialized idents contained in the set. 
   */
  toJSON() {
    return Object.keys(this.entries);
  }

}
