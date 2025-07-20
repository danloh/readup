A fork of [Readest](https://github.com/readest/readest), we add an atproto layer on the reader for social reading.


## Features

<div align="left">✅ Implemented</div>

| **Feature**                             | **Description**                                                                                | **Status** |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------- |
| **Multi-Format Support**                | Support EPUB, MOBI, KF8 (AZW3), FB2, CBZ, TXT, PDF (experimental)                              | ✅         |
| **Scroll/Page View Modes**              | Switch between scrolling or paginated reading modes.                                           | ✅         |
| **Full-Text Search**                    | Search across the entire book to find relevant sections.                                       | ✅         |
| **Annotations and Highlighting**        | Add highlights, bookmarks, and notes to enhance your reading experience.                       | ✅         |
| **Excerpt Text for Note-Taking**        | Easily excerpt text from books for detailed notes and analysis.                                | ✅         |
| **Dictionary/Wikipedia Lookup**         | Instantly look up words and terms when reading.                                                | ✅         |
| **[Parallel Read][link-parallel-read]** | Read two books or documents simultaneously in a split-screen view.                             | ✅         |
| **Customize Font and Layout**           | Adjust font, layout, theme mode, and theme colors for a personalized experience.               | ✅         |
| **File Association and Open With**      | Quickly open files in Readup in your file browser with one-click.                             | ✅         |
| **Sync across Platforms**               | Synchronize book files, reading progress, notes, and bookmarks across all supported platforms. | ✅         |
| **Translate with DeepL**                | From a single sentence to the entire book—translate instantly with DeepL.                      | ✅         |
| **Text-to-Speech (TTS) Support**        | Enjoy smooth, multilingual narration—even within a single book.                                | ✅         |
| **Library Management**                  | Organize, sort, and manage your entire ebook library.                                          | ✅         |
| **Code Syntax Highlighting**            | Read software manuals with rich coloring of code examples.                                     | ✅         |



## Screenshots

![Annotations](./data/screenshots/annotations.png)

![TTS](./data/screenshots/tts_speak_aloud.png)

![DeepL](./data/screenshots/deepl.png)

![Footnote](./data/screenshots/footnote_popover.png)

![Wikipedia](./data/screenshots/wikipedia_vertical.png)

![Theming Dark Mode](./data/screenshots/theming_dark_mode.png)

---


## Requirements

- **Node.js** and **pnpm** for Next.js development
- **Rust** and **Cargo** for Tauri development

For the best experience to build Readup for yourself, use a recent version of Node.js and Rust. Refer to the [Tauri documentation](https://v2.tauri.app/start/prerequisites/) for details on setting up the development environment prerequisites on different platforms.

```bash
nvm install v22
nvm use v22
npm install -g pnpm
rustup update
```

## Getting Started

### 1. Clone the Repository

```bash
git clone
cd
git submodule update --init --recursive
```

### 2. Install Dependencies

```bash
# might need to rerun this when code is updated
pnpm install
# copy pdfjs-dist to Next.js public directory
pnpm --filter @readup/readup-app setup-pdfjs
```

### 3. Verify Dependencies Installation

To confirm that all dependencies are correctly installed, run the following command:

```bash
pnpm tauri info
```

This command will display information about the installed Tauri dependencies and configuration on your platform. Note that the output may vary depending on the operating system and environment setup. Please review the output specific to your platform for any potential issues.

For Windows targets, “Build Tools for Visual Studio 2022” (or a higher edition of Visual Studio) and the “Desktop development with C++” workflow must be installed. For Windows ARM64 targets, the “VS 2022 C++ ARM64 build tools” and "C++ Clang Compiler for Windows" components must be installed. And make sure `clang` can be found in the path by adding `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\Llvm\x64\bin` for example in the environment variable `Path`.

### 4. Build for Development

```bash
# Start development for the Tauri app
pnpm tauri dev
# or start development for the Web app
pnpm dev-web
```

For Android:

```bash
# Initialize the Android environment (run once)
pnpm tauri android init

pnpm tauri android dev
# or if you want to dev on a real device
pnpm tauri android dev --host
```

For iOS:

```bash
# Set up the iOS environment (run once)
pnpm tauri ios init

pnpm tauri ios dev
# or if you want to dev on a real device
pnpm tauri ios dev --host
```

### 5. Build for Production

```bash
pnpm tauri build
pnpm tauri android build
pnpm tauri ios build
```

### 6. Setup dev environment with Nix

If you have Nix installed, you can leverage flake to enter a development shell
with all the necessary dependencies:

```bash
nix develop ./ops  # enter a dev shell for the web app
nix develop ./ops#ios # enter a dev shell for the ios app
nix develop ./ops#android # enter a dev shell for the android app
```

### 7. More information

Please check the [wiki][link-gh-wiki] of this project for more information on development.

## Troubleshooting

### 1. Won’t Launch on Windows (Missing Edge WebView2 Runtime)

**Symptom**

- When you double-click readup.exe, nothing happens. No window appears, and Task Manager does not show the process.
- This can affect both the standard installer and the portable version.

**Cause**

- Microsoft Edge WebView2 Runtime is either missing, outdated, or improperly installed on your system. Readup depends on WebView2 to render the interface on Windows.

**How to Fix**

1. Check if WebView2 is installed
   - Open “Add or Remove Programs” (a.k.a. Apps & features) on Windows. Look for “Microsoft Edge WebView2 Runtime.”
2. Install or Update WebView2
   - Download the WebView2 Runtime directly from Microsoft: [link](https://developer.microsoft.com/en-us/microsoft-edge/webview2?form=MA13LH).
   - If you prefer an offline installer, download the offline package and run it as an Administrator.
3. Re-run
   - After installing/updating WebView2, launch readup.exe again.
   - If you still encounter problems, reboot your PC and try again.

**Additional Tips**

- If reinstalling once doesn’t work, uninstall Edge WebView2 completely, then reinstall it with Administrator privileges.
- Verify your Windows installation has the latest updates from Microsoft.

**Still Stuck?**



## License

Readup is free software: you can redistribute it and/or modify it under the terms of the [GNU Affero General Public License](https://www.gnu.org/licenses/agpl-3.0.html) as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. See the [LICENSE](LICENSE) file for details.

The following libraries and frameworks are used in this software:

- [foliate-js](https://github.com/johnfactotum/foliate-js), which is MIT licensed.
- [zip.js](https://github.com/gildas-lormeau/zip.js), which is licensed under the BSD-3-Clause license.
- [fflate](https://github.com/101arrowz/fflate), which is MIT licensed.
- [PDF.js](https://github.com/mozilla/pdf.js), which is licensed under Apache License 2.0.
- [daisyUI](https://github.com/saadeghi/daisyui), which is MIT licensed.
- [marked](https://github.com/markedjs/marked), which is MIT licensed.
- [next.js](https://github.com/vercel/next.js), which is MIT licensed.
- [react-icons](https://github.com/react-icons/react-icons), which has various open-source licenses.
- [react](https://github.com/facebook/react), which is MIT licensed.
- [tauri](https://github.com/tauri-apps/tauri), which is MIT licensed.

The following fonts are utilized in this software, either bundled within the application or provided through web fonts:

[Bitter](https://fonts.google.com/?query=Bitter), [Fira Code](https://fonts.google.com/?query=Fira+Code), [Literata](https://fonts.google.com/?query=Literata), [Merriweather](https://fonts.google.com/?query=Merriweather), [Noto Sans](https://fonts.google.com/?query=Noto+Sans), [Roboto](https://fonts.google.com/?query=Roboto), [LXGW WenKai](https://github.com/lxgw/LxgwWenKai), [MiSans](https://hyperos.mi.com/font/en/), [Source Han](https://github.com/adobe-fonts/source-han-sans/), [WenQuanYi Micro Hei](http://wenq.org/wqy2/)
