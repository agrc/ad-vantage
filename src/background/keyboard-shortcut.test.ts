import { describe, expect, it, vi } from "vitest";
import { ADD_DAILY_ACTIVITY_ROW_MESSAGE_TYPE } from "../shared/messages";
import {
  ADD_DAILY_ACTIVITY_ROW_COMMAND,
  forwardAddDailyActivityRowCommand,
} from "./keyboard-shortcut";

describe("forwardAddDailyActivityRowCommand", () => {
  it("forwards the matching command to its active tab", async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);

    await forwardAddDailyActivityRowCommand(
      ADD_DAILY_ACTIVITY_ROW_COMMAND,
      17,
      sendMessage,
    );

    expect(sendMessage).toHaveBeenCalledWith(17, {
      type: ADD_DAILY_ACTIVITY_ROW_MESSAGE_TYPE,
    });
  });

  it("ignores other commands and commands without a tab", async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);

    await forwardAddDailyActivityRowCommand("other-command", 17, sendMessage);
    await forwardAddDailyActivityRowCommand(
      ADD_DAILY_ACTIVITY_ROW_COMMAND,
      undefined,
      sendMessage,
    );

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("ignores tabs without the content script", async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error("No receiver"));

    await expect(
      forwardAddDailyActivityRowCommand(
        ADD_DAILY_ACTIVITY_ROW_COMMAND,
        17,
        sendMessage,
      ),
    ).resolves.toBeUndefined();
  });
});