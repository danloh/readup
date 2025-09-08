import { EditorState } from "prosemirror-state";
import { TbColumnInsertLeft, TbColumnInsertRight, TbTrash } from "react-icons/tb";
import { MenuItem } from "../types";
import baseDictionary from "../../dictionary";
import isNodeActive from "../../core/queries/isNodeActive";
import { TableLayout } from "../../core/rules/tables";
import { AiOutlineColumnWidth } from "react-icons/ai";

export default function tableMenuItems(
  state: EditorState,
  dictionary: typeof baseDictionary
): MenuItem[] {
  const { schema } = state;
  const isFullWidth = isNodeActive(schema.nodes.table, {
    layout: TableLayout.fullWidth,
  })(state);

  return [
    {
      name: "setTableAttr",
      tooltip: isFullWidth
        ? dictionary.defaultWidth
        : dictionary.fullWidth,
      icon: AiOutlineColumnWidth,
      attrs: isFullWidth ? { layout: null } : { layout: TableLayout.fullWidth },
      active: () => isFullWidth,
    },
    {
      name: "addColumnAfter",
      tooltip: dictionary.addColumnAfter,
      icon: TbColumnInsertRight,
      active: () => false,
    },
    {
      name: "deleteTable",
      tooltip: dictionary.deleteTable,
      icon: TbTrash,
      active: () => false,
    },
  ];
}
