import clsx from "clsx";
import dynamic from "next/dynamic";
import { FC, useCallback } from "react";

const MsEditor = dynamic(() => import("./MsEditor"), {
  ssr: false,
  loading: () => 'Loading...',
});

const RawEditor = dynamic(() => import("./RawEditor"), {
  ssr: false,
  loading: () => 'Loading...',
});

interface DualProps {
  tab: string;
  value: string;
}

export const DualEditor: FC<DualProps> = ({ tab, value }) => {

  const onMilkdownChange = useCallback((markdown: string) => {
    console.log("milk Update: ", markdown.length);
  }, []);

  const onCodemirrorChange = useCallback((markdown: string) => {
    console.log("raw Update: ", markdown.length);
  }, []);

  return (
    <>
    {tab === 'dual' 
        ? (
          <div className='h-full flex justify-between'>
            <div
              className={clsx(
                "h-full",
                "",
              )}
            >
              <MsEditor value={value} onChange={onMilkdownChange} />
            </div>
            <div
              className={clsx(
                "h-full border-l border-base-300",
                "",
              )}
            >
              <RawEditor value={value} onChange={onCodemirrorChange} />
            </div>
          </div>

        )
        : tab === 'ms' 
          ? (<div
              className={clsx(
                "h-full",
                
                "expanded relative col-span-2 mx-auto mb-24 flex h-fit min-h-[80vh] w-screen max-w-5xl flex-col"
                  
              )}
            >
              <MsEditor key={'ms'} value={value} onChange={onMilkdownChange} />
            </div>)
          : (
              <div
                className={clsx(
                  "h-full",
                
                  "expanded relative col-span-2 mx-auto mb-24 flex h-fit min-h-[80vh] w-screen max-w-5xl flex-col"
                )}
              >
                <RawEditor value={value} onChange={onCodemirrorChange} />
              </div>
            )
      }
     
    </>
  );
};
