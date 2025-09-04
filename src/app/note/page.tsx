'use client';

import { useEffect, useState } from "react";
import { DualEditor } from "./editor";

export default function NotePage() {
  // const template = `# Hello World`;
  const [value, setValue] = useState('');
  const [tab, setTab] = useState('ms');
  
  useEffect(() => {
    const template = async () => {
      const value = await getTemplate();
      setValue(value);
    }
    
    template();
  }, []);

  return (  
    <div className="m-0 grid grid-rows-1 border-b border-gray-300 dark:border-gray-600">
      <div className="flex items-center">
        <button className="btn" onClick={() => setTab('dual')}>
          Dual
        </button>
        <button className="btn" onClick={() => setTab('ms')}>
          WYSIWYG
        </button>
        <button className="btn" onClick={() => setTab('cm')}>
          Raw
        </button>
      </div>
      <DualEditor key={tab} tab={tab} value={value} />
    </div>
  );
}

async function getTemplate() {
  return `# Markdown

👋 Welcome to Milkdown. We are so glad to see you here!

💭 You may wonder, what is Milkdown? Please write something here.`;
}
