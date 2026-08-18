import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";

import {
  confirmBookingAction,
  createBookingAction,
  rejectBookingAction,
  updateBookingAction,
} from "./bookings.actions";
import {
  confirmBooking,
  createBooking,
  getBookingById,
  rejectBooking,
  updateBooking,
} from "@/server/queries";

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
  createBooking: vi.fn(),
  updateBooking: vi.fn(),
  expireOldPendingBookings: vi.fn(),
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

  describe("createBookingAction", () => {
    it("creates walk-in booking with single slot and redirects to detail page", async () => {
      const createdId = "c3d4e5f6-a1b2-4c3d-8e4f-5a6b7c8d9e0f";
      vi.mocked(createBooking).mockResolvedValue({ success: true, id: createdId });

      const formData = new FormData();
      formData.set("booking_date", "2026-08-20");
      formData.append("time_slots", "19.00 - 20.00");
      formData.set("team_name", "Garuda Walkin");
      formData.set("phone", "08123456789");

      await createBookingAction(formData);
      expect(createBooking).toHaveBeenCalledWith({
        booking_date: "2026-08-20",
        time_slots: ["19.00 - 20.00"],
        team_name: "Garuda Walkin",
        phone: "08123456789",
        notes: null,
        status: "confirmed",
      });
      expect(redirect).toHaveBeenCalledWith(`/bookings/${createdId}?success=created`);
    });

    it("creates walk-in booking with multiple slots in one go", async () => {
      const createdId = "c3d4e5f6-a1b2-4c3d-8e4f-5a6b7c8d9e0f";
      vi.mocked(createBooking).mockResolvedValue({ success: true, id: createdId });

      const formData = new FormData();
      formData.set("booking_date", "2026-08-20");
      formData.append("time_slots", "18.00 - 19.00");
      formData.append("time_slots", "19.00 - 20.00");
      formData.set("team_name", "Garuda Walkin");
      formData.set("phone", "08123456789");

      await createBookingAction(formData);
      expect(createBooking).toHaveBeenCalledWith({
        booking_date: "2026-08-20",
        time_slots: ["18.00 - 19.00", "19.00 - 20.00"],
        team_name: "Garuda Walkin",
        phone: "08123456789",
        notes: null,
        status: "confirmed",
      });
      expect(redirect).toHaveBeenCalledWith(`/bookings/${createdId}?success=created`);
    });

    it("redirects with error parameter on validation failure", async () => {
      const formData = new FormData();
      formData.set("booking_date", "invalid-date");
      formData.append("time_slots", "19.00 - 20.00");
      formData.set("team_name", "");

      await createBookingAction(formData);
      expect(redirect).toHaveBeenCalledWith(expect.stringContaining("/bookings/new?error="));
    });
  });

  describe("updateBookingAction", () => {
    it("updates booking and redirects to detail page with success", async () => {
      const validId = "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d";
      vi.mocked(updateBooking).mockResolvedValue({ success: true });

      const formData = new FormData();
      formData.set("id", validId);
      formData.set("team_name", "Tim Garuda Updated");
      formData.set("phone", "08123456789");
      formData.set("notes", "Catatan baru");

      await updateBookingAction(formData);
      expect(updateBooking).toHaveBeenCalledWith(validId, {
        team_name: "Tim Garuda Updated",
        phone: "08123456789",
        notes: "Catatan baru",
      });
      expect(redirect).toHaveBeenCalledWith(`/bookings/${validId}?success=updated`);
    });
  });
});
