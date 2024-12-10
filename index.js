#!/usr/bin/env node
"use strict";

const fs = require("fs").promises;
const path = require("path");
const yargs = require("yargs/yargs");
const {hideBin} = require("yargs/helpers");
const clipboardy = require("clipboardy");
const {minimatch} = require("minimatch");

// Built-in exclusions (directories/files to ignore).
// These are now interpreted as glob patterns. For example, to ensure
// any "node_modules" directory at any level is excluded, we can use "**/node_modules/**".
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
    "**/temp/**"
];

const argv = yargs(hideBin(process.argv))
    .usage("Usage: $0 --dir <directory> --ext <extension> [--ext <extension> ...]")
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
        demandOption: true
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
        // Validate extensions
        if (!Array.isArray(args.ext) || args.ext.length === 0) {
            throw new Error("You must provide at least one file extension.");
        }
        // Check that all provided extensions start with a dot, e.g. ".sh"
        const invalidExt = args.ext.find((e) => !e.startsWith("."));
        if (invalidExt) {
            throw new Error(`Invalid extension "${invalidExt}". Extensions should start with a '.'`);
        }
        return true;
    })
    .example('$0 --dir ./ --ext .sh --ext .go', 'Collect all .sh and .go files under the current directory.')
    .example('$0 --dir /path/to/project --ext .yaml --ext .yml', 'Collect all .yaml and .yml files in the given project directory.')
    .example("$0 --dir ./ --ext .js --exclude '**/dist/**' --exclude '*.test.js'", 'Exclude "dist" directories anywhere and any ".test.js" files.')
    .example('$0 --dir ./ --ext .js --include-prompt', 'Prepend the LLM prompt to the output.')
    .help()
    .argv;

const rootDir = path.resolve(argv.dir);
const extensions = argv.ext;
const userExclusions = argv.exclude || [];
const excludePatterns = [...builtInExclusions, ...userExclusions];
const includePrompt = argv["include-prompt"];

let collectedContent = "";

function matchesExclusion(relativePath) {
    // Check if the relative path matches any exclusion pattern.
    // The "dot: true" option ensures patterns match dotfiles and directories.
    return excludePatterns.some((pattern) => minimatch(relativePath, pattern, {dot: true}));
}

async function findAndPrintFiles(dir) {
    let entries;
    try {
        entries = await fs.readdir(dir, {withFileTypes: true});
    } catch (err) {
        console.error(`Error reading directory ${dir}: ${err.message}`);
        return;
    }

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(rootDir, fullPath);

        // Check exclusions using the relative path
        if (matchesExclusion(relativePath)) {
            continue;
        }

        if (entry.isDirectory()) {
            await findAndPrintFiles(fullPath);
        } else if (entry.isFile()) {
            if (extensions.some((ext) => entry.name.endsWith(ext))) {
                await appendFileContent(fullPath);
            }
        }
    }
}

async function appendFileContent(filePath) {
    try {
        const content = await fs.readFile(filePath, "utf8");
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
