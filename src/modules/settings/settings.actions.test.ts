import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addBankAccountAction,
  deleteBankAccountAction,
  toggleBankAccountStatusAction,
  updateBankAccountAction,
  updateSiteSettingsAction,
} from "./settings.actions";
import {
  createBankAccount,
  deleteBankAccount,
  toggleBankAccountStatus,
  updateBankAccount,
  updateSiteSetting,
} from "@/server/queries";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/server/queries", () => ({
  updateSiteSetting: vi.fn(),
  createBankAccount: vi.fn(),
  updateBankAccount: vi.fn(),
  toggleBankAccountStatus: vi.fn(),
  deleteBankAccount: vi.fn(),
}));

describe("settings.actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateSiteSettingsAction", () => {
    it("updates site settings and returns success", async () => {
      vi.mocked(updateSiteSetting).mockResolvedValue({ success: true });

      const formData = new FormData();
      formData.set("whatsapp_number", "089682620666");
      formData.set("address", "Jl. Lapangan Futsal No. 10");
      formData.set("maps_embed_url", "https://maps.google.com/test");
      formData.set("dp_percent", "50");

      const res = await updateSiteSettingsAction(formData);
      expect(updateSiteSetting).toHaveBeenCalledWith("whatsapp_number", "6289682620666");
      expect(updateSiteSetting).toHaveBeenCalledWith("address", "Jl. Lapangan Futsal No. 10");
      expect(updateSiteSetting).toHaveBeenCalledWith("dp_percent", "50");
      expect(res).toEqual({ success: true });
    });

    it("rejects invalid input and returns error", async () => {
      const formData = new FormData();
      formData.set("whatsapp_number", "");
      formData.set("address", "");

      const res = await updateSiteSettingsAction(formData);
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });
  });

  describe("addBankAccountAction", () => {
    it("adds bank account and returns success", async () => {
      vi.mocked(createBankAccount).mockResolvedValue({ success: true });

      const formData = new FormData();
      formData.set("bank", "BCA");
      formData.set("account_number", "1234567890");
      formData.set("account_holder", "Arena Futsal");
      formData.set("is_active", "on");

      const res = await addBankAccountAction(formData);
      expect(createBankAccount).toHaveBeenCalledWith({
        bank: "BCA",
        account_number: "1234567890",
        account_holder: "Arena Futsal",
        is_active: true,
      });
      expect(res).toEqual({ success: true });
    });

    it("trims whitespace from bank, account_number, and account_holder", async () => {
      vi.mocked(createBankAccount).mockResolvedValue({ success: true });

      const formData = new FormData();
      formData.set("bank", "  BRI  ");
      formData.set("account_number", " 4736-01-017915-53-2 ");
      formData.set("account_holder", "  MARIANA ULFAH ");
      formData.set("is_active", "true");

      const res = await addBankAccountAction(formData);
      expect(createBankAccount).toHaveBeenCalledWith({
        bank: "BRI",
        account_number: "4736-01-017915-53-2",
        account_holder: "MARIANA ULFAH",
        is_active: true,
      });
      expect(res).toEqual({ success: true });
    });
  });

  describe("updateBankAccountAction", () => {
    it("updates bank account details and returns success", async () => {
      vi.mocked(updateBankAccount).mockResolvedValue({ success: true });

      const formData = new FormData();
      formData.set("id", "bank-uuid-123");
      formData.set("bank", "BRI");
      formData.set("account_number", "9876543210");
      formData.set("account_holder", "Arena Futsal Baru");
      formData.set("is_active", "on");

      const res = await updateBankAccountAction(formData);
      expect(updateBankAccount).toHaveBeenCalledWith("bank-uuid-123", {
        bank: "BRI",
        account_number: "9876543210",
        account_holder: "Arena Futsal Baru",
        is_active: true,
      });
      expect(res).toEqual({ success: true });
    });
  });

  describe("toggleBankAccountStatusAction", () => {
    it("toggles active status and returns success", async () => {
      vi.mocked(toggleBankAccountStatus).mockResolvedValue({ success: true });

      const formData = new FormData();
      formData.set("id", "bank-uuid-123");
      formData.set("is_active", "false");

      const res = await toggleBankAccountStatusAction(formData);
      expect(toggleBankAccountStatus).toHaveBeenCalledWith("bank-uuid-123", false);
      expect(res).toEqual({ success: true });
    });
  });

  describe("deleteBankAccountAction", () => {
    it("deletes bank account and returns success", async () => {
      vi.mocked(deleteBankAccount).mockResolvedValue({ success: true });

      const formData = new FormData();
      formData.set("id", "bank-uuid-123");

      const res = await deleteBankAccountAction(formData);
      expect(deleteBankAccount).toHaveBeenCalledWith("bank-uuid-123");
      expect(res).toEqual({ success: true });
    });
  });
});
