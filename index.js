#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const yargs = require("yargs/yargs");
const {hideBin} = require("yargs/helpers");
const clipboardy = require("clipboardy");
const {minimatch} = require("minimatch");
const ignore = require("ignore");

// Built-in exclusions (glob patterns).
const builtInExclusions = [
    "**/node_modules/**",
    "**/__pycache__/**",
    "**/.git/**",
    "**/.idea/**",
    "**/.vscode/**",
    "**/.github/**",
    "**/.gitlab/**",
    "**/dist/**",
    "**/build/**",
    "**/out/**",
    "**/target/**",
    "**/bin/**",
    "**/obj/**",
    "**/tmp/**",
    "**/temp/**",
    "**/package-lock.json",
    "**/yarn.lock",
    "**/pnpm-lock.yaml",
    "**/.env",
    "**/.env.*",
    "**/.DS_Store",
    "**/coverage/**",
    "**/.next/**",
    "**/.nuxt/**",
    "**/vendor/**",
    "**/*.min.js",
    "**/*.min.css",
    "**/Thumbs.db",
    "**/.sass-cache/**",
    "**/bower_components/**",
    "**/.cache/**",
    "**/logs/**",
    "**/*.log",
    "**/zz_*.go"
];

const argv = yargs(hideBin(process.argv))
    .usage("Usage: $0 --dir <directory> [--ext <extension> ...] [--include <filename> ...]")
    .option("dir", {
        alias: "d",
        type: "string",
        describe: "Root directory to search in",
        demandOption: true
    })
    .option("ext", {
        alias: "e",
        type: "array",
        describe: "File extensions to include (e.g. .sh, .go, .yaml, .yml)",
    })
    .option("include", {
        alias: "i",
        type: "array",
        describe: "Specific filenames to include (e.g., Dockerfile, Makefile)",
    })
    .option("exclude", {
        alias: "x",
        type: "array",
        describe: "Glob patterns to exclude (directories or files). Supports multiple values."
    })
    .option("include-prompt", {
        type: "boolean",
        describe: "Prepend an initial LLM prompt to the output",
        default: false
    })
    .check((args) => {
        // Validate directory
        if (typeof args.dir !== "string" || args.dir.trim().length === 0) {
            throw new Error("You must provide a valid directory path.");
        }
        // Validate that at least one of --ext or --include is provided
        if ((!args.ext || args.ext.length === 0) && (!args.include || args.include.length === 0)) {
            throw new Error("You must provide at least one extension (--ext) or filename (--include).");
        }
        // Check that all provided extensions start with a dot, e.g. ".sh"
        if (args.ext) {
            const invalidExt = args.ext.find((e) => !e.startsWith("."));
            if (invalidExt) {
                throw new Error(`Invalid extension "${invalidExt}". Extensions should start with a '.'`);
            }
        }
        return true;
    })
    .example('$0 --dir ./ --ext .sh --ext .go', 'Collect all .sh and .go files under the current directory.')
    .example('$0 --dir ./ --include Dockerfile --include Makefile', 'Collect all Dockerfile and Makefile files.')
    .example('$0 --dir ./ --ext .yaml --include Dockerfile', 'Collect all .yaml files and Dockerfiles.')
    .example("$0 --dir ./ --ext .js --exclude '**/dist/**' --include Makefile", 'Collect .js files and Makefiles, excluding "dist" directories.')
    .help()
    .argv;

const rootDir = path.resolve(argv.dir);
const extensions = argv.ext || [];
const includeFiles = argv.include || [];
const userExclusions = argv.exclude || [];
const includePrompt = argv["include-prompt"];

// 1) Combine built-in exclusions with userExclusions:
const excludePatterns = [...builtInExclusions, ...userExclusions];

// 2) Read .gitignore and initialize ignore instance:
let gitignoreInstance = ignore();
try {
    const gitignorePath = path.join(rootDir, ".gitignore");
    const gitignoreContent = fs.readFileSync(gitignorePath, "utf8");
    gitignoreInstance = ignore().add(gitignoreContent);
} catch (err) {
    if (err.code !== "ENOENT") {
        console.warn(`Error reading .gitignore: ${err.message}`);
    }
    // If there's no .gitignore, or can't read it, we simply ignore the error
    // and proceed with no .gitignore-based exclusion.
}

let collectedContent = "";

// This function checks if a file should be excluded by either:
// - builtInExclusions + userExclusions (via minimatch)
// - .gitignore patterns (via ignore library)
function matchesExclusion(relativePath) {
    // 1) Check custom + built-in patterns via minimatch
    const matchedByCustomPattern = excludePatterns.some((pattern) =>
        minimatch(relativePath, pattern, {dot: true})
    );

    // 2) Check .gitignore patterns
    //    The ignore library expects a path relative to the root
    //    If matched, it means .gitignore says "ignore" this path
    const matchedByGitignore = gitignoreInstance.ignores(relativePath);

    return matchedByCustomPattern || matchedByGitignore;
}

async function findAndPrintFiles(dir) {
    let entries;
    try {
        entries = await fs.promises.readdir(dir, {withFileTypes: true});
    } catch (err) {
        console.error(`Error reading directory ${dir}: ${err.message}`);
        return;
    }

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(rootDir, fullPath);

        // Exclude if it matches any exclusion pattern
        if (matchesExclusion(relativePath)) {
            continue;
        }

        if (entry.isDirectory()) {
            await findAndPrintFiles(fullPath);
        } else if (entry.isFile()) {
            const matchesExtension = extensions.some((ext) => entry.name.endsWith(ext));
            const matchesInclude = includeFiles.some((pattern) => {
                return path.resolve(path.join(entry.path, entry.name)) === path.resolve(pattern) || minimatch(path.join(entry.path, entry.name), pattern, {dot: true});
            });

            if (matchesExtension || matchesInclude) {
                await appendFileContent(fullPath);
            }
        }
    }
}

async function appendFileContent(filePath) {
    try {
        const content = await fs.promises.readFile(filePath, "utf8");
        const relativePath = path.relative(rootDir, filePath);
        const fileOutput = `\n=== ${relativePath} ===\n\n${content}\n`;
        collectedContent += fileOutput;
    } catch (err) {
        console.error(`Error reading file ${filePath}: ${err.message}`);
    }
}

findAndPrintFiles(rootDir)
    .then(() => {
        if (includePrompt) {
            collectedContent = `This is my project, just reply ack when you receive this project, I will give you further instructions soon.\n\n${collectedContent}`;
        }
        clipboardy.writeSync(collectedContent);
        console.log("All collected content has been copied to your clipboard!");
    })
    .catch((err) => {
        console.error(`Unexpected error: ${err.message}`);
        process.exit(1);
    });
