import { setLookupData } from "../shared/storage";
import { fetchTaskLookup } from "./servicenow";

const SYNC = "adv:servicenow-sync";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message?.type) return;

  void handleMessage(message.type)
    .then(sendResponse)
    .catch((error: unknown) => {
      sendResponse({
        ok: false,
        error:
          error instanceof Error ? error.message : "ServiceNow request failed.",
      });
    });
  return true;
});

async function handleMessage(type: string) {
  switch (type) {
    case SYNC: {
      const lookupData = await fetchTaskLookup();
      await setLookupData(lookupData);
      return { ok: true, entryCount: lookupData.entryCount };
    }
    default:
      return undefined;
  }
}
