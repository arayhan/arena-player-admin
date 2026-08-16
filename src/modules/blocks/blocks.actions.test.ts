import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";

import { blockSlotAction, unblockSlotAction } from "./blocks.actions";
import { createSlotBlock, deleteSlotBlock } from "@/server/queries";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/server/queries", () => ({
  createSlotBlock: vi.fn(),
  deleteSlotBlock: vi.fn(),
}));

describe("blocks.actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("blockSlotAction", () => {
    it("creates a slot block and redirects with success", async () => {
      vi.mocked(createSlotBlock).mockResolvedValue({ success: true });

      const formData = new FormData();
      formData.set("block_date", "2026-08-25");
      formData.set("time_slot", "19.00 - 20.00");
      formData.set("reason", "Perawatan rumput");

      await blockSlotAction(formData);
      expect(createSlotBlock).toHaveBeenCalledWith({
        block_date: "2026-08-25",
        time_slot: "19.00 - 20.00",
        reason: "Perawatan rumput",
      });
      expect(redirect).toHaveBeenCalledWith("/blocks?success=blocked");
    });

    it("redirects with error parameter on invalid input", async () => {
      const formData = new FormData();
      formData.set("block_date", "invalid-date");
      formData.set("time_slot", "invalid-slot");

      await blockSlotAction(formData);
      expect(redirect).toHaveBeenCalledWith(expect.stringContaining("/blocks?error="));
    });
  });

  describe("unblockSlotAction", () => {
    it("unblocks slot and redirects with success", async () => {
      vi.mocked(deleteSlotBlock).mockResolvedValue({ success: true });

      const formData = new FormData();
      formData.set("id", "block-uuid-123");

      await unblockSlotAction(formData);
      expect(deleteSlotBlock).toHaveBeenCalledWith("block-uuid-123");
      expect(redirect).toHaveBeenCalledWith("/blocks?success=unblocked");
    });
  });
});
