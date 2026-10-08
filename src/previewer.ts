"use strict";

import * as MarkdownIt from "markdown-it";
import * as fs from "fs";
import * as path from "path";

import { AZDO_GUID_RE, AzDOGUIDInfo } from "./azdo";

import StateCore = require("markdown-it/lib/rules_core/state_core");

function slugify(s: string) {
  return encodeURIComponent(
    String(s).trim().toLowerCase().replace(/\s+/g, "-")
  );
}

/**
 * Renders the wiki sub pages found in `dir` as nested lists, following AzDO wiki conventions:
 * `Page.md` children live in a `Page/` folder, ordered by its `.order` file.
 * A folder without a matching `.md` file is still a page, just without content.
 */
function renderSubPages(
  md: MarkdownIt,
  dir: string,
  hrefPrefix: string
): string {
  let files: string[];
  let folders: string[];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    files = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => entry.name.slice(0, -3));
    folders = entries
      // Skip hidden folders such as ".attachments"
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name);
  } catch {
    return "";
  }
  let pages = files.concat(folders.filter((page) => !files.includes(page)));
  let order: string[] = [];
  try {
    order = fs
      .readFileSync(path.join(dir, ".order"), "utf8")
      .split("\n")
      .map((line) => line.trim());
  } catch {
    // No .order file, fall back to alphabetical order
  }
  pages = pages
    .filter((page) => order.includes(page))
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .concat(pages.filter((page) => !order.includes(page)).sort());
  if (pages.length === 0) {
    return "";
  }

  let body = "<ul>";
  for (const page of pages) {
    const href = hrefPrefix + encodeURIComponent(page);
    // AzDO encodes spaces as "-" and literal dashes as "%2D"
    const title = decodeURIComponent(page.replace(/-/g, " "));
    const label = md.utils.escapeHtml(title);
    body +=
      "<li>" +
      (files.includes(page) ? `<a href="${href}.md">${label}</a>` : label) +
      renderSubPages(md, path.join(dir, page), `${href}/`) +
      "</li>";
  }
  return body + "</ul>";
}

function renderTOCBox(label: string, body: string) {
  return (
    '<div style="border: 1px solid;border-color: rgb(234, 234, 234);border-radius: 4px;display: inline-block;padding: 10px 16px 0px 0px;min-width: 250px;">' +
    `<div style="font-weight: 600;margin: 0 16px 0px 16px;">${label}</div>` +
    body +
    "</div>"
  );
}

export function getPreviewer(azdoInfo: AzDOGUIDInfo) {
  return function azdo_md_plugin(md: MarkdownIt) {
    let globalState: StateCore;
    md.core.ruler.push("azdoStateGrab", (state) => {
      globalState = state;
      return true; // @TODO: Figure out what to return
    });

    // Table of Contents Support
    md.renderer.rules.azdoTOC = (_1, _2, options, env, renderer) => {
      const tokens = globalState.tokens;
      let tocBody = "";
      let currentLevel = 0;
      for (let i = 0; i < tokens.length; ++i) {
        const token = tokens[i];
        if (token.type === "heading_open") {
          const level = parseInt(token.tag.substr(1, 1));
          if (level > currentLevel) {
            tocBody += "<ul>".repeat(level - currentLevel);
          } else if (level == currentLevel) {
            tocBody += "</li>";
          } else {
            tocBody += "</li>" + "</ul>".repeat(currentLevel - level);
          }
          tocBody += "<li>";
          currentLevel = level;
        } else if (
          token.type === "inline" &&
          tokens[i - 1].type === "heading_open"
        ) {
          tocBody += `<a href="#${slugify(
            token.content
          )}">${renderer.renderInline(token.children!, options, env)}</a>`;
        }
      }
      for (; currentLevel > 0; --currentLevel) {
        tocBody += "</li></ul>";
      }
      return renderTOCBox("Contents", tocBody);
    };

    // Table of Sub Pages Support
    md.renderer.rules.azdoTOSP = (_1, _2, _3, env) => {
      // VS Code's markdown preview provides the rendered document's Uri
      const documentPath: string | undefined = env?.currentDocument?.fsPath;
      if (!documentPath) {
        return renderTOCBox("Child Pages", "");
      }
      const pageName = path.basename(documentPath, ".md");
      const subPagesDir = path.join(path.dirname(documentPath), pageName);
      return renderTOCBox(
        "Child Pages",
        renderSubPages(md, subPagesDir, `${encodeURIComponent(pageName)}/`)
      );
    };

    md.core.ruler.push("azdoTOC", (state) => {
      const blockTokens = state.tokens;
      for (let j = 0, l = blockTokens.length; j < l; j++) {
        const blockToken = blockTokens[j];
        if (blockToken.type !== "inline") {
          continue;
        }
        // Only works if the entire block is _exactly_ "[[_TOC_]]" or "[[_TOSP_]]"
        if (blockToken.content === "[[_TOC_]]") {
          blockToken.children = [new state.Token("azdoTOC", "", 0)];
        } else if (blockToken.content === "[[_TOSP_]]") {
          blockToken.children = [new state.Token("azdoTOSP", "", 0)];
        }
      }
      return true; // @TODO: Figure out what to return
    });

    // GUID Support
    md.core.ruler.before("inline", "azdoGUID", (state) => {
      const blockTokens = state.tokens;
      for (let j = 0, l = blockTokens.length; j < l; j++) {
        if (blockTokens[j].type !== "inline") {
          continue;
        }

        // Ideally, we'd just turn this into the azdoGUID token and handle rendering with
        // a renderer rule. Unfortunately, I haven't been able to do that while handling
        // GUIDs that start with a letter (markdown-it really wants to parse them as HTML
        // elements). So instead, we do the rendering by replacing the text with inline
        // HTML.
        blockTokens[j].content = blockTokens[j].content.replace(
          AZDO_GUID_RE,
          (match: string) => {
            const guid = match.slice(2, -1).toLowerCase();
            const color =
              guid == azdoInfo.currentUserGUID
                ? "rgb(241,112,123)"
                : "rgb(121,181,255)";
            const content =
              guid in azdoInfo.guidToName
                ? `@${azdoInfo.guidToName[guid]}`
                : match.replace("<", "\\<");
            return `<span style="color:${color};font-weight: bold;background-color:rgb(41,40,39)">${content}</span>`;
          }
        );
      }

      return true; // @TODO: Figure out what to return
    });
  };
}
