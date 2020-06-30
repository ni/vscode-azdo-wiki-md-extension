import * as vscode from "vscode";

import { AzDOGUIDInfo, lookupGUIDs } from "./azdo";

import { decorateGUIDS } from "./decoration";
import { getCompletionItemProvider } from "./completion";
import { getGUIDInserter } from "./commands";
import { getPreviewer } from "./previewer";

function handleDocumentGUIDs(
  context: vscode.ExtensionContext,
  azdoInfo: AzDOGUIDInfo
) {
  let activeEditor = vscode.window.activeTextEditor;

  if (activeEditor) {
    lookupGUIDs(activeEditor, azdoInfo);
    decorateGUIDS(activeEditor, azdoInfo);
  }

  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      activeEditor = editor;
      if (editor) {
        lookupGUIDs(editor, azdoInfo);
        decorateGUIDS(editor, azdoInfo);
      }
    },
    null,
    context.subscriptions
  );

  vscode.workspace.onDidChangeTextDocument(
    (event) => {
      if (activeEditor && event.document === activeEditor.document) {
        lookupGUIDs(activeEditor, azdoInfo);
        decorateGUIDS(activeEditor, azdoInfo);
      }
    },
    null,
    context.subscriptions
  );
}

export function activate(context: vscode.ExtensionContext) {
  const azdoInfo = new AzDOGUIDInfo();

  context.subscriptions.push(getCompletionItemProvider(azdoInfo));
  context.subscriptions.push(getGUIDInserter(azdoInfo));

  handleDocumentGUIDs(context, azdoInfo);

  return {
    extendMarkdownIt(md: any) {
      md.use(getPreviewer(azdoInfo));
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      md.use(require("markdown-it-emoji"));
      return md;
    },
  };
}
