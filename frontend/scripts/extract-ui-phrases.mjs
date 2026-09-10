import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const sourceRoot = path.resolve("src");
const outputPath = path.resolve("src/localization/generated/source-phrases.json");
const phraseProperties = new Set([
  "label", "title", "subtitle", "description", "category", "eyebrow", "helper",
  "message", "text", "emptyMessage", "successMessage", "errorMessage",
]);
const translatedAttributes = new Set(["placeholder", "title", "aria-label", "alt"]);
const phrases = new Set();

function add(value) {
  const phrase = value.replace(/\s+/g, " ").trim();
  if (phrase.length < 2 || phrase.length > 500 || !/[A-Za-z]/.test(phrase)) return;
  if (/^(https?:|[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$)/.test(phrase)) return;
  phrases.add(phrase);
}

function visitFile(filePath) {
  const source = ts.createSourceFile(filePath, fs.readFileSync(filePath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isJsxText(node)) add(node.getText(source));
    if (ts.isJsxAttribute(node) && translatedAttributes.has(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer)) {
      add(node.initializer.text);
    }
    if (ts.isPropertyAssignment(node)) {
      const property = node.name.getText(source).replace(/["']/g, "");
      if ((phraseProperties.has(property) || filePath.endsWith("resources.ts")) && ts.isStringLiteralLike(node.initializer)) add(node.initializer.text);
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      if (["prompt", "confirm", "alert"].includes(method) && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) add(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")) visitFile(fullPath);
  }
}

walk(sourceRoot);
visitFile(path.join(sourceRoot, "localization", "resources.ts"));
const sorted = [...phrases].sort((a, b) => a.localeCompare(b));
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
console.log(`Extracted ${sorted.length} UI phrases to ${outputPath}`);
