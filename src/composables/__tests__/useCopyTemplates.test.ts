/**
 * useCopyTemplates Composable Tests
 *
 * TDD approach: RED phase - Tests first
 * These tests define the expected behavior of the useCopyTemplates composable
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { useCopyTemplates } from "../useCopyTemplates";
import type { CopyTemplate } from "../../../electron/types/ipc";

// Mock data
const mockTemplates: CopyTemplate[] = [
  { id: "1", name: "URL Template", content: "[URL]", isPreset: true },
  { id: "2", name: "MP4 Link", content: "[MP4_LINK]", isPreset: true },
  { id: "3", name: "Custom", content: "Custom content", isPreset: false },
];

describe("useCopyTemplates", () => {
  beforeEach(() => {
    // Setup global window.vidyeet mock
    (global as any).window = {
      vidyeet: {
        getTemplates: vi.fn().mockResolvedValue(mockTemplates),
        getTemplate: vi.fn().mockImplementation((req: { id: string }) => {
          const template = mockTemplates.find((t) => t.id === req.id);
          return template
            ? Promise.resolve(template)
            : Promise.reject({ code: "TEMPLATE_NOT_FOUND", message: "Not found" });
        }),
        saveTemplate: vi.fn().mockImplementation((req) =>
          Promise.resolve({
            template: {
              id: req.id || `new-${Date.now()}`,
              name: req.name,
              content: req.content,
              isPreset: false,
            },
          })
        ),
        deleteTemplate: vi.fn().mockResolvedValue({ success: true }),
        applyTemplate: vi.fn().mockImplementation((req) =>
          Promise.resolve({ result: "rendered-content-" + req.templateId })
        ),
      },
    };
  });

  describe("initialization", () => {
    it("should initialize with empty templates array and loading false", () => {
      const { templates, isLoading, error } = useCopyTemplates();

      expect(templates.value).toEqual([]);
      expect(isLoading.value).toBe(false);
      expect(error.value).toBeNull();
    });
  });

  describe("loadTemplates", () => {
    it("should load templates via explicit loadTemplates call", async () => {
      const { templates, loadTemplates } = useCopyTemplates();

      await loadTemplates();

      expect(templates.value).toEqual(mockTemplates);
      expect((global as any).window.vidyeet.getTemplates).toHaveBeenCalled();
    });

    it("should set isLoading to true during fetch and false after", async () => {
      const { isLoading, loadTemplates } = useCopyTemplates();

      const promise = loadTemplates();
      // Note: isLoading should be true during the async operation
      // but might be false immediately after if execution is too fast in tests
      // We can't reliably test this synchronously, but the implementation should set it

      await promise;

      expect(isLoading.value).toBe(false);
    });

    it("should handle error on load failure", async () => {
      const mockError = {
        code: "CLI_NOT_FOUND",
        message: "Templates service unavailable",
      };
      (global as any).window.vidyeet.getTemplates = vi
        .fn()
        .mockRejectedValue(mockError);

      const { error, loadTemplates } = useCopyTemplates();

      await loadTemplates();

      expect(error.value).not.toBeNull();
      expect(error.value).toContain("unavailable");
    });

    it("should clear error on successful load", async () => {
      const { error, loadTemplates } = useCopyTemplates();

      // First, induce an error
      (global as any).window.vidyeet.getTemplates = vi
        .fn()
        .mockRejectedValueOnce({
          code: "CLI_NOT_FOUND",
          message: "Error",
        });

      await loadTemplates();
      expect(error.value).not.toBeNull();

      // Now succeed
      (global as any).window.vidyeet.getTemplates = vi
        .fn()
        .mockResolvedValueOnce(mockTemplates);

      await loadTemplates();
      expect(error.value).toBeNull();
    });
  });

  describe("addTemplate", () => {
    it("should call saveTemplate and update local state", async () => {
      const { templates, addTemplate } = useCopyTemplates();

      const newTemplate = { name: "New Template", content: "New content" };
      const result = await addTemplate(newTemplate);

      expect((global as any).window.vidyeet.saveTemplate).toHaveBeenCalledWith(
        newTemplate
      );
      expect(result.id).toBeDefined();
      expect(result.name).toBe("New Template");
      expect(templates.value).toContainEqual(expect.objectContaining(newTemplate));
    });

    it("should return the created template with id", async () => {
      const { addTemplate } = useCopyTemplates();

      const newTemplate = { name: "Test", content: "Test content" };
      const result = await addTemplate(newTemplate);

      expect(result.id).toBeDefined();
      expect(result.name).toBe("Test");
      expect(result.content).toBe("Test content");
    });

    it("should handle error during add", async () => {
      const mockError = { code: "TEMPLATE_ERROR", message: "Save failed" };
      (global as any).window.vidyeet.saveTemplate = vi
        .fn()
        .mockRejectedValue(mockError);

      const { error, addTemplate } = useCopyTemplates();

      await expect(addTemplate({ name: "Test", content: "Test" })).rejects.toThrow();
      expect(error.value).not.toBeNull();
    });
  });

  describe("updateTemplate", () => {
    it("should update local state on success", async () => {
      const { templates, loadTemplates, updateTemplate } = useCopyTemplates();

      // First load templates
      await loadTemplates();
      expect(templates.value.length).toBeGreaterThan(0);

      const templateId = templates.value[0].id;
      const updated = await updateTemplate(templateId, {
        name: "Updated Name",
      });

      expect(updated.name).toBe("Updated Name");
      // Check that the local template was updated
      const localTemplate = templates.value.find((t) => t.id === templateId);
      expect(localTemplate?.name).toBe("Updated Name");
    });

    it("should preserve other fields when patching", async () => {
      const { templates, loadTemplates, updateTemplate } = useCopyTemplates();

      await loadTemplates();
      const originalTemplate = templates.value[0];

      const updated = await updateTemplate(originalTemplate.id, {
        name: "New Name",
      });

      expect(updated.content).toBe(originalTemplate.content);
      expect(updated.id).toBe(originalTemplate.id);
    });

    it("should handle error during update", async () => {
      const mockError = { code: "TEMPLATE_ERROR", message: "Update failed" };
      (global as any).window.vidyeet.saveTemplate = vi
        .fn()
        .mockRejectedValue(mockError);

      const { error, updateTemplate } = useCopyTemplates();

      await expect(
        updateTemplate("1", { name: "Updated" })
      ).rejects.toThrow();
      expect(error.value).not.toBeNull();
    });
  });

  describe("deleteTemplate", () => {
    it("should remove template from local state on success", async () => {
      const { templates, loadTemplates, deleteTemplate } = useCopyTemplates();

      await loadTemplates();
      const initialLength = templates.value.length;
      const templateIdToDelete = templates.value[0].id;

      const success = await deleteTemplate(templateIdToDelete);

      expect(success).toBe(true);
      expect(templates.value.length).toBe(initialLength - 1);
      expect(templates.value.find((t) => t.id === templateIdToDelete)).toBeUndefined();
    });

    it("should call deleteTemplate IPC method with correct id", async () => {
      const { loadTemplates, deleteTemplate } = useCopyTemplates();

      await loadTemplates();
      const templateId = "1";

      await deleteTemplate(templateId);

      expect((global as any).window.vidyeet.deleteTemplate).toHaveBeenCalledWith({
        id: templateId,
      });
    });

    it("should handle error during delete", async () => {
      const mockError = { code: "TEMPLATE_ERROR", message: "Delete failed" };
      (global as any).window.vidyeet.deleteTemplate = vi
        .fn()
        .mockRejectedValue(mockError);

      const { error, deleteTemplate } = useCopyTemplates();

      const result = await deleteTemplate("1");
      expect(result).toBe(false);
      expect(error.value).not.toBeNull();
    });

    it("should return false on delete failure", async () => {
      (global as any).window.vidyeet.deleteTemplate = vi
        .fn()
        .mockResolvedValue({ success: false });

      const { deleteTemplate } = useCopyTemplates();

      const result = await deleteTemplate("1");

      expect(result).toBe(false);
    });
  });

  describe("applyTemplate", () => {
    it("should return rendered result from IPC", async () => {
      const { applyTemplate } = useCopyTemplates();

      const result = await applyTemplate("1", { name: "John" });

      expect(result).toBe("rendered-content-1");
      expect((global as any).window.vidyeet.applyTemplate).toHaveBeenCalledWith({
        templateId: "1",
        variables: { name: "John" },
      });
    });

    it("should handle variables in apply request", async () => {
      const { applyTemplate } = useCopyTemplates();

      const variables = { url: "https://example.com", title: "Example" };
      await applyTemplate("2", variables);

      expect((global as any).window.vidyeet.applyTemplate).toHaveBeenCalledWith({
        templateId: "2",
        variables,
      });
    });

    it("should handle error gracefully during apply", async () => {
      const mockError = { code: "TEMPLATE_ERROR", message: "Apply failed" };
      (global as any).window.vidyeet.applyTemplate = vi
        .fn()
        .mockRejectedValue(mockError);

      const { error, applyTemplate } = useCopyTemplates();

      await expect(applyTemplate("1", {})).rejects.toThrow();
      expect(error.value).not.toBeNull();
    });

    it("should accept null and undefined values in variables", async () => {
      const { applyTemplate } = useCopyTemplates();

      const variables = {
        name: "John",
        optional: null,
        undefined: undefined,
      };
      await applyTemplate("1", variables);

      expect((global as any).window.vidyeet.applyTemplate).toHaveBeenCalledWith({
        templateId: "1",
        variables,
      });
    });
  });

  describe("lifecycle independence", () => {
    it("should not call loadTemplates automatically on composition", async () => {
      useCopyTemplates();

      // Small delay to ensure any auto-call would have happened
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect((global as any).window.vidyeet.getTemplates).not.toHaveBeenCalled();
    });
  });

  describe("error state management", () => {
    it("should set error message on IPC error", async () => {
      const mockError = {
        code: "CLI_NOT_FOUND",
        message: "CLI not found",
      };
      (global as any).window.vidyeet.getTemplates = vi
        .fn()
        .mockRejectedValue(mockError);

      const { error, loadTemplates } = useCopyTemplates();

      await loadTemplates();

      expect(error.value).not.toBeNull();
      expect(typeof error.value).toBe("string");
    });

    it("should clear error when operation succeeds", async () => {
      const { error, loadTemplates } = useCopyTemplates();

      // Cause an error
      (global as any).window.vidyeet.getTemplates = vi
        .fn()
        .mockRejectedValueOnce({
          code: "CLI_NOT_FOUND",
          message: "Error",
        });
      await loadTemplates();
      expect(error.value).not.toBeNull();

      // Succeed
      (global as any).window.vidyeet.getTemplates = vi
        .fn()
        .mockResolvedValueOnce(mockTemplates);
      await loadTemplates();

      expect(error.value).toBeNull();
    });
  });
});
