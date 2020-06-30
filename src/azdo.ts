import * as vscode from "vscode";

import axios, { AxiosInstance } from "axios";

import { decorateGUIDS } from "./decoration";

export const AZDO_GUID_RE = /@<[a-zA-Z0-9]{8}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{12}>/g;

function getAxios(): null | AxiosInstance {
  const extensionSettings = vscode.workspace.getConfiguration("azdo-wiki-md");
  const accessToken = extensionSettings.get("token");
  const org = extensionSettings.get("organization");
  if (!accessToken || !org) {
    return null;
  }

  const token = Buffer.from(`:${accessToken}`, "utf8").toString("base64");
  return axios.create({
    baseURL: `https://vssps.dev.azure.com/${org}/_apis/`,
    headers: {
      Authorization: `Basic ${token}`,
    },
  });
}

export class AzDOGUIDInfo {
  constructor() {
    this.guidToName = {};
    this.currentUserGUID = null;
  }

  guidToName: Record<string, string>;
  currentUserGUID: string | null;
}

export function lookupGUIDs(
  activeEditor: vscode.TextEditor,
  info: AzDOGUIDInfo
) {
  const text = activeEditor.document.getText();
  const matches = text.match(AZDO_GUID_RE) || [];
  const guids = Array.from(
    new Set(
      matches
        .map((match) => match.slice(2, -1).toLowerCase())
        .filter((guid) => !(guid in info.guidToName))
        .map((guid) => guid.toUpperCase())
    )
  );

  if (guids.length > 0) {
    const axiosInstance = getAxios();
    if (axiosInstance !== null) {
      axiosInstance
        .post("identitybatch", {
          identityIds: guids.join(","),
        })
        .then((response) => {
          if (response.status == 203) {
            vscode.window.showErrorMessage(
              `AzDO request with PAT failed. Check permissions/expiration.`
            );
          } else {
            info.currentUserGUID = response.headers["x-vss-userdata"]
              .split(":")[0]
              .toLowerCase();
            response.data.forEach((identity: Record<string, string>) => {
              info.guidToName[identity.Id] = identity.DisplayName;
            });

            decorateGUIDS(activeEditor, info);
          }
        })
        .catch((error) => {
          vscode.window.showErrorMessage(
            `Error when making request for AzDO Identities: ${error.response.statusText}`
          );
        });
    }
  }
}

export function lookupNames(
  text: string,
  info: AzDOGUIDInfo,
  callback: (nameToID: Record<string, string>) => void
) {
  // @TODO: As far as I can tell, there's no specific permission to allow this.
  // That means the token requires full permissions :(
  const axiosInstance = getAxios();
  if (axiosInstance !== null) {
    return axiosInstance
      .post(
        "IdentityPicker/Identities",
        {
          query: text,
          identityTypes: ["user"],
          operationScopes: ["ims", "source"],
          properties: ["DisplayName", "localId"],
          filterByAncestorEntityIds: [],
          filterByEntityIds: [],
          options: {
            MinResults: 5,
            MaxResults: 10,
          },
        },
        {
          headers: { accept: "application/json; api-version=1.0" },
        }
      )
      .then((response) => {
        if (response.status == 203) {
          vscode.window.showErrorMessage(
            `AzDO request with PAT failed. Check permissions/expiration.`
          );
        } else {
          // Filter out the non-people identities
          const identities = response.data.results[0].identities.filter(
            (identity: Record<string, string>) => identity.localId !== null
          );
          if (identities.length > 0) {
            const nameToID: Record<string, string> = {};
            identities.forEach((identity: Record<string, string>) => {
              const guid = identity.localId.toLowerCase();
              nameToID[identity.displayName] = guid;
              info.guidToName[guid] = identity.displayName;
            });
            callback(nameToID);
          } else {
            vscode.window.showWarningMessage(
              `Wasn't able to find anyone with ${text}`
            );
          }
        }
      })
      .catch((error) => {
        vscode.window.showErrorMessage(
          `Error when making request for AzDO Identities: ${error.response.statusText}`
        );
      });
  }
}
