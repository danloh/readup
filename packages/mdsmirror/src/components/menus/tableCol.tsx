import {
  TbTrash,
  TbAlignLeft,
  TbAlignRight,
  TbAlignCenter,
  TbColumnInsertLeft,
  TbColumnInsertRight,
} from "react-icons/tb";
import { EditorState } from "prosemirror-state";
import isNodeActive from "../../core/queries/isNodeActive";
import { MenuItem } from "../types";
import baseDictionary from "../../dictionary";

export default function tableColMenuItems(
  state: EditorState,
  index: number,
  rtl: boolean,
  dictionary: typeof baseDictionary
): MenuItem[] {
  const { schema } = state;

  return [
    {
      name: "setColumnAttr",
      tooltip: dictionary.alignLeft,
      icon: TbAlignLeft,
      attrs: { index, alignment: "left" },
      active: isNodeActive(schema.nodes.th, {
        colspan: 1,
        rowspan: 1,
        alignment: "left",
      }),
    },
    {
      name: "setColumnAttr",
      tooltip: dictionary.alignCenter,
      icon: TbAlignCenter,
      attrs: { index, alignment: "center" },
      active: isNodeActive(schema.nodes.th, {
        colspan: 1,
        rowspan: 1,
        alignment: "center",
      }),
    },
    {
      name: "setColumnAttr",
      tooltip: dictionary.alignRight,
      icon: TbAlignRight,
      attrs: { index, alignment: "right" },
      active: isNodeActive(schema.nodes.th, {
        colspan: 1,
        rowspan: 1,
        alignment: "right",
      }),
    },
    {
      name: "separator",
    },
    {
      name: rtl ? "addColumnAfter" : "addColumnBefore",
      tooltip: rtl ? dictionary.addColumnAfter : dictionary.addColumnBefore,
      icon: TbColumnInsertLeft,
      active: () => false,
    },
    {
      name: rtl ? "addColumnBefore" : "addColumnAfter",
      tooltip: rtl ? dictionary.addColumnBefore : dictionary.addColumnAfter,
      icon: TbColumnInsertRight,
      active: () => false,
    },
    {
      name: "separator",
    },
    {
      name: "deleteColumn",
      tooltip: dictionary.deleteColumn,
      icon: TbTrash,
      active: () => false,
    },
  ];
}
