import {
  isServiceNowSyncRequest,
  type ServiceNowSyncResponse,
} from "../shared/messages";
import { setLookupData } from "../shared/storage";
import { fetchTaskLookup } from "./servicenow";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isServiceNowSyncRequest(message)) return;

  void handleServiceNowSync()
    .then(sendResponse)
    .catch((error: unknown) => {
      const response: ServiceNowSyncResponse = {
        ok: false,
        error:
          error instanceof Error ? error.message : "ServiceNow request failed.",
      };
      sendResponse(response);
    });
  return true;
});

async function handleServiceNowSync(): Promise<ServiceNowSyncResponse> {
  const lookupData = await fetchTaskLookup();
  await setLookupData(lookupData);
  return { ok: true, entryCount: lookupData.entryCount };
}
