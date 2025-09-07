import { Command, TextSelection, Transaction } from "prosemirror-state";

/**
 * Chain multiple commands into a single command and collects state as it goes.
 *
 * @param commands The commands to chain
 * @returns The chained command
 */
export function chainTransactions(
  ...commands: (Command | undefined)[]
): Command {
  return (state, dispatch): boolean => {
    const dispatcher = (tr: Transaction): void => {
      state = state.apply(tr);
      dispatch?.(tr);
    };
    const last = commands.pop();
    commands.map((command) => command?.(state, dispatcher));
    return last !== undefined && last(state, dispatch);
  };
}

/**
 * A prosemirror command to collapse the current selection to a cursor at the start of the selection.
 *
 * @returns A prosemirror command.
 */
export const collapseSelection = (): Command => (state, dispatch) => {
  dispatch?.(
    state.tr.setSelection(
      TextSelection.create(state.doc, state.tr.selection.from)
    )
  );
  return true;
};

export function combineClass(
  ...classNames: (string | number | Record<string, boolean> | undefined)[]
) {
  return classNames
    .filter(Boolean)
    .map((item) => {
      if (typeof item === "object") {
        return Object.entries(item)
          .filter(([, value]) => value)
          .map(([key]) => key)
          .join(" ");
      }
      return item;
    })
    .join(" ");
}
