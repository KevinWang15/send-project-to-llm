# send-my-project-to-llm

**send-my-project-to-llm** is a Node.js command-line tool that makes it easy to share your project's code with Large
Language Models (LLMs). It recursively scans your project directory, collects files with specified extensions, and
formats them in a way that's optimal for LLM understanding. The tool automatically copies the formatted output to your
clipboard, streamlining the process of getting help from AI assistants.

## Features

- Recursively collect files from specified directories
- Filter by multiple file extensions
- Automatically prepend an initial prompt for LLMs (optional)
- Exclude files/directories using glob patterns (optional), with built-in exclusions
- Automatic clipboard copying
- Clear file structure preservation with path information
- Easy-to-use command-line interface
- Handles large projects efficiently

## Installation

```bash
# Install from GitHub
git clone https://github.com/KevinWang15/send-my-project-to-llm.git
cd send-my-project-to-llm
npm install
npm install -g .
```

This will make the `send-my-project-to-llm` command available globally on your system.

## Usage

Basic syntax:

```bash
send-my-project-to-llm --dir <directory> --ext <extension> [--ext <extension> ...]
```

### Command-line Options

- `--dir, -d`: Root directory to search in (required)
- `--ext, -e`: File extensions to include (required, can specify multiple)
- `--exclude, -x`: Glob patterns to exclude (directories or files). Supports multiple values.
   - By default, the tool excludes directories like `node_modules`, `__pycache__`, `.git`, `.idea`, `.vscode`, etc.
   - You can add your own exclusions using glob patterns. Examples:
      - `**/dist/**` would exclude any `dist` directory at any level.
      - `*.test.js` would exclude any `.test.js` files anywhere.
- `--include-prompt`: Prepend an initial LLM prompt to the output (optional)
- `--help`: Show help information

### Examples

Collect all JavaScript and TypeScript files from current directory:

```bash
send-my-project-to-llm --dir ./ --ext .js --ext .ts
```

Exclude files or directories matching glob patterns (e.g. `**/dist/**`, `*.test.js`):

```bash
send-my-project-to-llm --dir ./ --ext .js --exclude '**/dist/**' --exclude '*.test.js'
```

Include the initial LLM prompt:

```bash
send-my-project-to-llm --dir ./ --ext .js --include-prompt
```

## Exclusion Patterns

Exclusion patterns are interpreted using glob syntax via the `minimatch` library:

- `**/node_modules/**` excludes any `node_modules` directory at any depth.
- `*.test.js` excludes all files ending with `.test.js`.
- `**/.git/**` excludes any `.git` directory at any level.

You can combine multiple `--exclude` flags to refine what gets included.

## Output Format

The tool generates output in the following format:

```
=== path/to/file1.js ===
[file1 contents]

=== path/to/file2.js ===
[file2 contents]
```

If `--include-prompt` is used, the output will start with:

```
This is my project, just reply ack when you receive this project, I will give you further instructions soon.

=== path/to/file1.js ===
[file1 contents]

=== path/to/file2.js ===
[file2 contents]
```

## Recommended LLM Usage

1. Run the tool to collect your files.
2. Start your LLM conversation with:
   ```
   This is my project, just reply ack when you receive this project, I will give you further instructions soon.

   [paste your clipboard content here]
   ```
3. After the LLM acknowledges (`ack`), you can follow up with the next instructions as needed (like asking it to fix
   issues or generate code/tests/docs).

## License

This project is licensed under the MIT License - see the LICENSE file for details.