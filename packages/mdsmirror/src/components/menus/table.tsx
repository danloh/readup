import { TbColumnInsertLeft, TbColumnInsertRight, TbTrash } from "react-icons/tb";
import { MenuItem } from "../types";
import baseDictionary from "../../dictionary";

export default function tableMenuItems(
  dictionary: typeof baseDictionary
): MenuItem[] {
  return [
    {
      name: "deleteTable",
      tooltip: dictionary.deleteTable,
      icon: TbTrash,
      active: () => false,
    },
    {
      name: "addColumnBefore",
      tooltip: dictionary.addColumnBefore,
      icon: TbColumnInsertLeft,
      active: () => false,
    },
    {
      name: "addColumnAfter",
      tooltip: dictionary.addColumnAfter,
      icon: TbColumnInsertRight,
      active: () => false,
    },
  ];
}
