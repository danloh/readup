import { defaultValueCtx, Editor, rootCtx } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { Crepe } from "@milkdown/crepe";
import { eclipse } from "@uiw/codemirror-theme-eclipse";

interface MsProps {
  value: string;
  onChange: (markdown: string) => void;
}

const MilkdownEditor: React.FC<MsProps> = ({ value, onChange }) => {
  useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, value);
        // Add markdown listener for auto-save
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          // Save content to your backend or storage
          onChange(markdown);
        });
      })
      .use(commonmark)
      .use(listener),
  );

  return <Milkdown />;
};

export const MsEditor: React.FC<MsProps> = ({ value, onChange }) => {
  return (
    <MilkdownProvider>
      <MilkdownEditor value={value} onChange={onChange} />
    </MilkdownProvider>
  );
};
