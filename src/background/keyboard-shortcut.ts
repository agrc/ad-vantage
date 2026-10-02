import {
  ADD_DAILY_ACTIVITY_ROW_MESSAGE_TYPE,
  type AddDailyActivityRowRequest,
} from "../shared/messages";

export const ADD_DAILY_ACTIVITY_ROW_COMMAND = "add-daily-activity-row";

type SendTabMessage = (
  tabId: number,
  message: AddDailyActivityRowRequest,
) => Promise<unknown>;

export async function forwardAddDailyActivityRowCommand(
  command: string,
  tabId: number | undefined,
  sendMessage: SendTabMessage,
): Promise<void> {
  if (command !== ADD_DAILY_ACTIVITY_ROW_COMMAND || tabId === undefined) {
    return;
  }

  try {
    await sendMessage(tabId, {
      type: ADD_DAILY_ACTIVITY_ROW_MESSAGE_TYPE,
    });
  } catch {
    return;
  }
}