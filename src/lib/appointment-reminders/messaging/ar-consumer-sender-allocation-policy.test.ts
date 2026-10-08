import { describe, expect, it } from "vitest";
import {
  occupiedPlatformSendersForWorkspace,
  shouldRetryPlatformSenderAllocation,
} from "./ar-consumer-sender-allocation-policy";

describe("AR consumer sender allocation policy", () => {
  it("marks senders owned by other workspaces as occupied", () => {
    const occupied = occupiedPlatformSendersForWorkspace({
      requestingWorkspaceId: "ws_salon",
      pairs: [
        { platformPhoneNumberId: "pn_a", workspaceId: "ws_trainer" },
        { platformPhoneNumberId: "pn_b", workspaceId: "ws_salon" },
      ],
    });
    expect(occupied.has("pn_a")).toBe(true);
    expect(occupied.has("pn_b")).toBe(false);
  });

  it("retries next sender after P2002 when candidates remain", () => {
    expect(
      shouldRetryPlatformSenderAllocation({
        candidateIndex: 0,
        candidateCount: 2,
        errorCode: "P2002",
        transactionReturnedNull: false,
      }),
    ).toBe(true);
    expect(
      shouldRetryPlatformSenderAllocation({
        candidateIndex: 1,
        candidateCount: 2,
        errorCode: "P2002",
        transactionReturnedNull: false,
      }),
    ).toBe(false);
  });

  it("retries when transaction detects an existing pair owner", () => {
    expect(
      shouldRetryPlatformSenderAllocation({
        candidateIndex: 0,
        candidateCount: 3,
        transactionReturnedNull: true,
      }),
    ).toBe(true);
  });
});
