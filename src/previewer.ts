"use strict";

import * as MarkdownIt from "markdown-it";

import { AZDO_GUID_RE, AzDOGUIDInfo } from "./azdo";

import StateCore = require("markdown-it/lib/rules_core/state_core");

function slugify(s: string) {
  return encodeURIComponent(
    String(s).trim().toLowerCase().replace(/\s+/g, "-")
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
    md.renderer.rules.azdoTOC = () => {
      const tokens = globalState.tokens;
      let tocBody = "";
      let currentLevel = 0;
      for (let i = 1; i < tokens.length; ++i) {
        const token = tokens[i];
        if (token.type === "heading_open") {
          const level = parseInt(token.tag.substr(1, 1));
          if (level > currentLevel) {
            tocBody += "<ul>";
          } else if (level == currentLevel) {
            tocBody += "</li>";
          } else {
            tocBody += "</li></ul>";
          }
          tocBody += "<li>";
          currentLevel = level;
        } else if (
          token.type === "inline" &&
          tokens[i - 1].type === "heading_open"
        ) {
          tocBody += `<a href="#${slugify(token.content)}">${
            token.content
          }</a>`;
        }
      }
      for (; currentLevel > 0; --currentLevel) {
        tocBody += "</li></ul>";
      }
      return (
        '<div style="border: 1px solid;border-color: rgb(234, 234, 234);border-radius: 4px;display: inline-block;padding: 10px 16px 0px 0px;min-width: 250px;">' +
        '<div style="font-weight: 600;margin: 0 16px 0px 16px;">Contents</div>' +
        tocBody +
        "</div>"
      );
    };

    md.core.ruler.push("azdoTOC", (state) => {
      const blockTokens = state.tokens;
      for (let j = 0, l = blockTokens.length; j < l; j++) {
        const blockToken = blockTokens[j];
        if (
          blockToken.type !== "inline" ||
          // Only works if the entire block is _exactly_ "[[_TOC_]]"
          blockToken.content !== "[[_TOC_]]"
        ) {
          continue;
        }
        blockToken.children = [new state.Token("azdoTOC", "", 0)];
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
