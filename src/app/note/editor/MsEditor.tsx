import { Crepe } from "@milkdown/crepe";
import { editorViewCtx, parserCtx } from "@milkdown/kit/core";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { Slice } from "@milkdown/kit/prose/model";
import { Selection } from "@milkdown/kit/prose/state";
import { eclipse } from "@uiw/codemirror-theme-eclipse";
import { FC, RefObject, useLayoutEffect, useRef } from "react";

interface MsProps {
  value: string;
  onChange: (markdown: string) => void;
}

const MsEditor: FC<MsProps> = ({ value, onChange }) => {
  const crepeRef = useRef<Crepe>(null);
  const darkMode = true; //useDarkMode();
  const divRef = useRef<HTMLDivElement>(null);
  const loading = useRef(false);

  useLayoutEffect(() => {
    if (!divRef.current || loading.current) return;

    loading.current = true;
    const crepe = new Crepe({
      root: divRef.current,
      defaultValue: value,
      featureConfigs: {
        [Crepe.Feature.CodeMirror]: {
          theme: darkMode ? undefined : eclipse,
        },
        [Crepe.Feature.LinkTooltip]: {
          onCopyLink: () => {
            //toast("Link copied", "success");
          },
        },
      },
    });

    crepe.editor
      .config((ctx) => {
        ctx.get(listenerCtx).markdownUpdated(
          (_, markdown) => {
            onChange(markdown);
          },
        );
      })
      .use(listener);

    crepe.create().then(() => {
      (crepeRef as RefObject<Crepe>).current = crepe;
      loading.current = false;
    });
  }, [value, darkMode, onChange]);

  return <div className="crepe flex h-full flex-1 flex-col" ref={divRef} />;
};

export default MsEditor;
