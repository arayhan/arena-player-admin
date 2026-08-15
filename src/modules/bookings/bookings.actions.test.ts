import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";

import { confirmBookingAction, rejectBookingAction } from "./bookings.actions";
import { confirmBooking, getBookingById, rejectBooking } from "@/server/queries";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/server/queries", () => ({
  confirmBooking: vi.fn(),
  rejectBooking: vi.fn(),
  getBookingById: vi.fn(),
}));

describe("bookings.actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("confirmBookingAction", () => {
    it("redirects to /bookings if ID is not a valid UUID", async () => {
      const formData = new FormData();
      formData.set("id", "invalid-id");

      await confirmBookingAction(formData);
      expect(redirect).toHaveBeenCalledWith("/bookings");
      expect(confirmBooking).not.toHaveBeenCalled();
    });

    it("confirms pending booking and redirects with success", async () => {
      const validId = "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d";
      vi.mocked(confirmBooking).mockResolvedValue({ success: true });

      const formData = new FormData();
      formData.set("id", validId);

      await confirmBookingAction(formData);
      expect(confirmBooking).toHaveBeenCalledWith(validId);
      expect(redirect).toHaveBeenCalledWith(`/bookings/${validId}?success=confirmed`);
    });

    it("handles 409 conflict when booking was already confirmed", async () => {
      const validId = "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d";
      vi.mocked(confirmBooking).mockResolvedValue({ success: false, error: "409" });
      vi.mocked(getBookingById).mockResolvedValue({
        id: validId,
        booking_date: "2026-08-16",
        time_slot: "19.00 - 20.00",
        team_name: "Tim Garuda",
        phone: "6281234567890",
        proof_key: null,
        status: "confirmed",
        created_at: "2026-08-16T10:00:00.000Z",
      });

      const formData = new FormData();
      formData.set("id", validId);

      await confirmBookingAction(formData);
      expect(confirmBooking).toHaveBeenCalledWith(validId);
      expect(getBookingById).toHaveBeenCalledWith(validId);
      expect(redirect).toHaveBeenCalledWith(
        expect.stringContaining(`/bookings/${validId}?conflict=`),
      );
    });
  });

  describe("rejectBookingAction", () => {
    it("rejects booking and redirects with success", async () => {
      const validId = "b2c3d4e5-f6a1-4b2c-8d3e-4f5a6b7c8d9e";
      vi.mocked(rejectBooking).mockResolvedValue({ success: true });

      const formData = new FormData();
      formData.set("id", validId);

      await rejectBookingAction(formData);
      expect(rejectBooking).toHaveBeenCalledWith(validId);
      expect(redirect).toHaveBeenCalledWith(`/bookings/${validId}?success=rejected`);
    });
  });
});
