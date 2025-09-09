import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { json } from "@codemirror/lang-json";
import { languages } from "@codemirror/language-data";
import CodeMirror from "./codemirror/ReactCodeMirror";

type Props = {
  value: string;
  onChange: (value: string) => void;
  dark?: boolean;
  lang?: string;
  onFocus?: () => void;
  readMode?: boolean;
  className?: string;
};

export default function RawEditor(props: Props) {
  const { 
    value, 
    onChange, 
    dark = false,
    lang = "markdown",
    onFocus,
    readMode = false,
    className = '',
  } = props;

  //const readMode = useStore((state) => state.readMode); 

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const onValueChange = (value: string, _viewUpdate: unknown) => {
    // console.log('md Changed, value:', value, _viewUpdate);
    onChange(value);
  };

  return (
    <CodeMirror
      value={value}
      onChange={onValueChange}
      onFocus={onFocus}
      extensions={lang === "markdown" 
        ? [markdown({ base: markdownLanguage, codeLanguages: languages })]
        : [json()]
      }
      className={`border-none focus:outline-none p-0 break-words ${className}`}
      theme={dark ? 'dark' : 'light'}
      editable={!readMode}
    />
  );
}
