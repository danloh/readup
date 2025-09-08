import { TbTrash, TbRowInsertTop, TbRowInsertBottom } from "react-icons/tb";
import { AiOutlineMergeCells, AiOutlineSplitCells } from "react-icons/ai";
import { FaTableColumns } from "react-icons/fa6";
import { EditorState } from "prosemirror-state";
import { CellSelection } from "prosemirror-tables";
import { isMergedCellSelection, isMultipleCellSelection } from "../../core/queries/table";
import { MenuItem } from "../types";
import baseDictionary from "../../dictionary";

export default function tableRowMenuItems(
  state: EditorState,
  index: number,
  dictionary: typeof baseDictionary
): MenuItem[] {
  const { selection } = state;
  if (!(selection instanceof CellSelection)) {
    return [];
  }
  
  return [
    {
      name: "toggleHeaderRow",
      tooltip: dictionary.toggleHeader,
      icon: FaTableColumns,
      visible: index === 0,
    },
    {
      name: "mergeCells",
      tooltip: dictionary.mergeCells,
      icon: AiOutlineMergeCells,
      visible: isMultipleCellSelection(state),
    },
    {
      name: "splitCell",
      tooltip: dictionary.splitCell,
      icon: AiOutlineSplitCells,
      visible: isMergedCellSelection(state),
    },
    {
      name: "addRowBefore",
      tooltip: dictionary.addRowBefore,
      icon: TbRowInsertTop,
      attrs: { index },
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
      name: "deleteRow",
      tooltip: dictionary.deleteRow,
      icon: TbTrash,
      active: () => false,
    },
  ];
}
