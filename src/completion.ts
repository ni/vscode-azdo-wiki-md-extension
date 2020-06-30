import * as vscode from "vscode";

import { AzDOGUIDInfo } from "./azdo";

export function getCompletionItemProvider(azdoInfo: AzDOGUIDInfo) {
  return vscode.languages.registerCompletionItemProvider(
    "markdown",
    {
      async provideCompletionItems() {
        const items = [];
        for (const k in azdoInfo.guidToName) {
          const item = new vscode.CompletionItem(
            azdoInfo.guidToName[k],
            vscode.CompletionItemKind.Text
          );
          item.insertText = `<${k.toUpperCase()}>`;
          items.push(item);
        }
        return items;
      },
    },
    "@"
  );
}
