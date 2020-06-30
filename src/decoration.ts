import * as vscode from "vscode";

import { AZDO_GUID_RE, AzDOGUIDInfo } from "./azdo";

const guidDecorationType = vscode.window.createTextEditorDecorationType({
  color: "rgb(121,181,255)",
});
const myGuidDecorationType = vscode.window.createTextEditorDecorationType({
  color: "rgb(241,112,123)",
});

export function decorateGUIDS(
  activeEditor: vscode.TextEditor,
  azdoInfo: AzDOGUIDInfo
) {
  const text = activeEditor.document.getText();
  const regex = new RegExp(AZDO_GUID_RE);
  const decorations = [];
  const myDecorations = [];
  let match;
  while ((match = regex.exec(text))) {
    const guid = match[0].slice(2, -1).toLowerCase();
    if (guid in azdoInfo.guidToName) {
      const startPos = activeEditor.document.positionAt(match.index);
      const endPos = activeEditor.document.positionAt(
        match.index + match[0].length
      );
      const decoration = {
        range: new vscode.Range(startPos, endPos),
        hoverMessage: `**${azdoInfo.guidToName[guid]}**`,
      };

      if (guid == azdoInfo.currentUserGUID) {
        myDecorations.push(decoration);
      } else {
        decorations.push(decoration);
      }
    }
  }

  activeEditor.setDecorations(guidDecorationType, decorations);
  activeEditor.setDecorations(myGuidDecorationType, myDecorations);
}
