import { TbTrash, TbRowInsertTop, TbRowInsertBottom } from "react-icons/tb";
import { EditorState } from "prosemirror-state";
import { MenuItem } from "../types";
import baseDictionary from "../../dictionary";

export default function tableRowMenuItems(
  state: EditorState,
  index: number,
  dictionary: typeof baseDictionary
): MenuItem[] {
  return [
    {
      name: "addRowAfter",
      tooltip: dictionary.addRowBefore,
      icon: TbRowInsertTop,
      attrs: { index: index - 1 },
      active: () => false,
      visible: index !== 0,
    },
    {
      name: "addRowAfter",
      tooltip: dictionary.addRowAfter,
      icon: TbRowInsertBottom,
      attrs: { index },
      active: () => false,
    },
    {
      name: "separator",
    },
    {
      name: "deleteRow",
      tooltip: dictionary.deleteRow,
      icon: TbTrash,
      active: () => false,
    },
  ];
}
