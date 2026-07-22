// A group has no visual of its own — its children render themselves at
// their own absolute positions (see Task 4 model note: no nested coordinate
// space). This component exists only so CanvasElement's type router has a
// case for "group" without special-casing it at the call site.
export function GroupElementView() {
  return null;
}
