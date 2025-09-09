'use client';

import clsx from "clsx";
import { useCallback, useRef, useState } from "react";
import MsEditor, { JSONContent, embeds } from "mdsmirror/src";
import { useThemeStore } from "@/store/themeStore";
import { Mindmap } from "./mindmap/mindmap";

export default function Note() {
  const { isDarkMode } = useThemeStore();
  const mdContent = defaultMD;
  const editorInstance = useRef<MsEditor>(null);

  const [darkMode, setDarkMode] = useState(false);
  const [readMode, setReadMode] = useState(false);
  const [isRTL, setIsRTL] = useState(false);
  
  const onContentChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (text: string, json: JSONContent) => {
      console.log("on content change: ", text, json);
    },
    []
  );

  const onSearchText = useCallback(
    async (text: string, ty?: string) => {
      console.log("on search text: ", text, ty);
    },
    []
  );

  // Search notes to select for being linked
  const onSearchNote = useCallback(
    async (text: string) => {
      console.log("on search note: ", text);
      return []
    },
    []
  );

  // Create new note to-be-linked
  const onCreateNote = useCallback(
    async (title: string) => {
      console.log("on create new note: ", title);
      return `creted note id: ${genHash()}`
    },
    []
  );

  // open link
  const onOpenLink = useCallback(
    async (href: string) => {
      console.log("on open link: ", href);
    },
    []
  );

  const onSaveDiagram = useCallback(async (svg: string, ty: string) => {
    console.log("on save diagram: ", svg, ty);
  }, []);

  // copy heading hash or hashtag hash
  const onCopyHash = useCallback(
    (hash: string) => { console.log("on copy hash: ", hash); }, []
  );
  
  return (
    <div className="flex flex-col overflow-auto">
      <div className="flex items-center">
        <button className="btn" onClick={() => setDarkMode(!darkMode)}>
          Dark
        </button>
        <button className="btn" onClick={() => setIsRTL(!isRTL)}>
          RTL
        </button>
        <button className="btn" onClick={() => setReadMode(!readMode)}>
          Read Only
        </button>
      </div>
      <div className={clsx(
        'flex flex-col w-full px-8',
        isDarkMode ? 'bg-black text-gray-200' : 'bg-white',
      )}>
        <div className="flex-1 p-2 pb-8" id="note-content">
          <MsEditor 
            key={`wys-1`}
            ref={editorInstance}
            value={mdContent}
            dark={isDarkMode}
            dir={isRTL ? 'rtl' : 'ltr'}
            onChange={onContentChange}
            onSearchLink={onSearchNote}
            onCreateLink={onCreateNote}
            onSearchSelectText={(txt: string) => onSearchText(txt)} 
            onClickHashtag={(txt: string) => onSearchText(txt, 'hashtag')}
            onOpenLink={onOpenLink} 
            onSaveDiagram={onSaveDiagram} 
            onCopyHash={onCopyHash}
            embeds={embeds}
            disables={['sub']}
          />
        </div>
        <Mindmap mdValue={mdContent} />
      </div>
    </div>
  );
}


export const defaultMD: string = `
# Welcome to mdsilo.  

A self-hosted online writing platform which comes as a single executable with [feed subscription](/app/reader), [publishing writing](/app/editor) and [live collaboration](/app/pad) and many other features. 

| Editor      | Rank | React | Collaborative |
|-------------|------|-------|--------------:|
| Prosemirror | A    |   No  |           Yes |
| Slate       | B    |  Yes  |            No |
| CKEdit      | C    |   No  |           Yes |

Focus on the Markdown content, be it a blog, a knowledge base, a forum or a combination of them. 

$$
\\mathcal{L}(V \\otimes W, Z) \\cong \\big\\{ \\substack{\\text{bilinear maps}\\\\{V \\times W \\rightarrow Z}} \\big\\}
$$

## Mermaid Chart

\`\`\`mermaid
flowchart TD
        A(["Start"])
        A --> B{"Decision"}
        B --> C["Option A"]
        B --> D["Option B"]
\`\`\`

## Features  
  - ➰ I/O: Feed reader & Podcast client and Personal Wiki; 
  - 🔀 Powerful Editor: Markdown, Mind Map...  
  - 📝 Markdown and extensions: Math Equation, Diagram, Hashtag... 
  - ✨ Collaborative writing, support Markdown, mermaid, music notation, mindmap and more.

## Image

![scense](https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Ecuador_cajas_national_park.jpg/500px-Ecuador_cajas_national_park.jpg)
`;


const chars = "-_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const idLen = 6;

function genHash() {
  let id = "";
  for (let i = 0; i < idLen; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  let hashid = `${Date.now()}-${id}`;
  return hashid;
}