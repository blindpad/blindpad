/**
 * A segment in an Ident's path.
 */
export interface Segment {

  /**
   * The numeric value for the Segment.
   */
  digit: number;

  /**
   * The replica identifier for the Segment.
   */
  replica: string;

}

/**
 * Creates a new path segment.
 * @param digit   The digit of the Segment.
 * @param replica The replica identifier for the Segment.
 * @returns The created Segment.
 */
export function Segment(digit: number, replica: string): Segment {
  return {digit, replica};
}
