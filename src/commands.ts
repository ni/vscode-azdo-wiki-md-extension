import * as vscode from "vscode";

import { AzDOGUIDInfo, lookupNames } from "./azdo";

export function getGUIDInserter(azdoInfo: AzDOGUIDInfo) {
  return vscode.commands.registerCommand(
    "extension.insertAzDOUserGUID",
    async function () {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        vscode.window.showInputBox().then((queryValue) => {
          if (queryValue) {
            lookupNames(queryValue, azdoInfo, (nameToID) => {
              vscode.window
                .showQuickPick(Object.keys(nameToID), {
                  canPickMany: false,
                })
                .then((value) => {
                  const activeEditor = vscode.window.activeTextEditor;
                  if (value && activeEditor) {
                    editor.edit((editBuilder) => {
                      editBuilder.insert(
                        activeEditor.selection.active,
                        `@<${nameToID[value]}>`.toUpperCase()
                      );
                    });
                  }
                });
            });
          }
        });
      }
    }
  );
}
