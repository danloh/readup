import React from "react";
import type { Meta } from '@storybook/react-webpack5';
import DefaultEditor from "./index";

const meta: Meta<typeof DefaultEditor> = {
  title: '<editor>',
  component: DefaultEditor,
}

export default meta  

export const Example = () => {
  return (
    <div style={{ padding: "1em 2em" }}>
      <DefaultEditor
        defaultValue={defaultValue}
      />
    </div>
  );
}


const defaultValue = `# Welcome

Just an easy to use **Markdown** editor with \`slash commands\`. 

https://github.com/ 

## Math: 

Inline $\\frac{x^2}{2}$

**Math Block** 

$$
\\mathcal{L}(V \\otimes W, Z) \\cong \\big\\{ \\substack{\\text{bilinear maps}\\\\{V \\times W \\rightarrow Z}} \\big\\}
$$


## Mark   

**bold**
_italic_
~~strikethrough~~
__underline__
==highlighted==
\`inline code\`
!!placeholder!!
[a link](http://www.mdsilo.com) 

[dummy text](/doc/reference) 

[World](doc ny) 

[dummy text](#Tips) 

try ##hashtag1## double

try #hashtag2# single 

wikilink [[This is a wikilink]] 

#World 

[[another one wikilink | Title Text]] 

[#Hola](#Hola)

> Quoteblock

## Checklist

- [x] done
- [ ] todo

## Table

| Editor | Rank | React | Collaborative |
|----|----|----|---:|
| Prosemirror | A | No | Yes |
| Slate | B | Yes | No |
| CKEdit | C | No | Yes | 


## Image

![hello](https://images.unsplash.com/photo-1755529582689-7a158b8f9183)


## Code

\`\`\`rust
fn main() {
  println!("Hello, world!");
}
\`\`\`

highlight

\`\`\`javascript
function main() {
  console.log("Hello World");
}
\`\`\`

not in list

\`\`\`dart
int timesTwo(int x) {
  return x * 2;
}
\`\`\`

## Text 

Lorem Ipsum is simply [[dummy text of the printing and typesetting industry]]. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

`;


/*

export const TemplateDoc = Template.bind({});
TemplateDoc.args = {
  template: true,
  defaultValue: `# Template

This document acts as a "template document", it's possible to insert placeholder marks that can be filled in later by others in a non-template document.

\\
!!This is a template placeholder!!`,
};

export const Headings = Template.bind({});
Headings.args = {
  defaultValue: `# Heading 1

## Heading 2

### Heading 3

#### Heading 4`,
};

export const Lists = Template.bind({});
Lists.args = {
  defaultValue: `# Lists

- An
- Unordered
- List

\\
1. An
1. Ordered
1. List`,
};

export const Blockquotes = Template.bind({});
Blockquotes.args = {
  defaultValue: `# Block quotes

> Quotes are another way to callout text within a larger document
> They are often used to incorrectly attribute words to historical figures`,
};

export const Tables = Template.bind({});
Tables.args = {
  defaultValue: `# Tables

Simple tables with alignment and row/col editing are supported, they can be inserted from the slash menu

| Editor      | Rank | React | Collaborative |
|-------------|------|-------|--------------:|
| Prosemirror | A    |   No  |           Yes |
| Slate       | B    |  Yes  |            No |
| CKEdit      | C    |   No  |           Yes |
`,
};

export const Marks = Template.bind({});
Marks.args = {
  defaultValue: `This document shows the variety of marks available, most can be accessed through the formatting menu by selecting text or by typing out the Markdown manually.

\\
**bold**
_italic_
~~strikethrough~~
__underline__
==highlighted==
\`inline code\`
!!placeholder!!
[a link](http://www.mdsilo.com)
`,
};

export const Checkboxes = Template.bind({});
Checkboxes.args = {
  defaultValue: `
- [x] done
- [ ] todo`,
};

export const Code = Template.bind({});
Code.args = {
  defaultValue: `# Code

\`\`\`html
<html>
  <p class="content">Simple code blocks are supported</html>
</html>
\`\`\` 

!!Placeholder!!
`,
};

export const Notices = Template.bind({});
Notices.args = {
  defaultValue: `# Notices

There are three types of editable notice blocks that can be used to callout information:

\\
:::info
Informational
:::

:::tip
Tip
:::

:::warning
Warning
:::
`,
};

export const ReadOnly = Template.bind({});
ReadOnly.args = {
  readOnly: true,
  defaultValue: `# Read Only 

  [a link](http://www.mdsilo.com) 

[dummy text](/doc/reference) 
  
The content of this editor cannot be edited`,
};

export const ReadOnlyWriteCheckboxes = Template.bind({});
ReadOnlyWriteCheckboxes.args = {
  readOnly: true,
  readOnlyWriteCheckboxes: true,
  defaultValue: `A read-only editor with the exception that checkboxes remain toggleable, like GitHub

\\
- [x] done
- [ ] todo

`,
};

export const Persisted = Template.bind({});
Persisted.args = {
  defaultValue:
    localStorage.getItem("saved") ||
    `# Persisted
  
The contents of this editor are persisted to local storage on change (edit and reload)`,
  onChange: debounce(value => {
    const text = value();
    localStorage.setItem("saved", text);
  }, 250),
};

export const Placeholder = Template.bind({});
Placeholder.args = {
  defaultValue: "",
  placeholder: "This is a custom placeholder…",
};

export const Images = Template.bind({});
Images.args = {
  defaultValue: `# Images
![Cat and Butterfly](https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=987&q=80)`,
};

export const Focused = Template.bind({});
Focused.args = {
  autoFocus: true,
  defaultValue: `# Focused
  
  This editor starts in focus`,
};

export const Dark = Template.bind({});
Dark.args = {
  dark: true,
  defaultValue: `# Dark

There's a customizable dark theme too`,
};

export const RTL = Template.bind({});
RTL.args = {
  dir: "rtl",
  defaultValue: `# خوش آمدید

متن نمونه برای نمایش پشتیبانی از زبان‌های RTL نظیر فارسی، عربی، عبری و ...

\\
- [x] آیتم اول
- [ ] آیتم دوم`,
};

*/