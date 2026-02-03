/**
 * Template IPC Handlers
 *
 * Handles:
 * - templates:list
 * - templates:get
 * - templates:save
 * - templates:delete
 * - templates:apply
 */

import { ipcMain } from "electron";
import TemplateStore from "../services/templateStore";
import { parseTemplate } from "../../src/utils/templateEngine";
import {
  IpcChannels,
  type IpcError,
  type GetTemplatesRequest,
  type GetTemplatesResponse,
  type GetTemplateRequest,
  type SaveTemplateRequest,
  type SaveTemplateResponse,
  type DeleteTemplateRequest,
  type DeleteTemplateResponse,
  type ApplyTemplateRequest,
  type ApplyTemplateResponse,
} from "../types/ipc";

// Singleton store instance
const store = new TemplateStore();

/**
 * Register template IPC handlers
 */
export function registerTemplateHandlers(): void {
  /**
   * templates:list - Get all templates
   */
  ipcMain.handle(
    IpcChannels.TEMPLATES_LIST,
    (_event, _request: GetTemplatesRequest): GetTemplatesResponse | IpcError => {
      try {
        return store.getAll();
      } catch (error) {
        return {
          code: "TEMPLATE_ERROR",
          message: error instanceof Error ? error.message : "Failed to get templates",
          details: error,
        };
      }
    }
  );

  /**
   * templates:get - Get a single template by id
   */
  ipcMain.handle(
    IpcChannels.TEMPLATES_GET,
    (_event, request: GetTemplateRequest): ReturnType<typeof store.get> | IpcError => {
      try {
        const template = store.get(request.id);
        if (!template) {
          return {
            code: "TEMPLATE_NOT_FOUND",
            message: `Template with id "${request.id}" not found`,
          };
        }
        return template;
      } catch (error) {
        return {
          code: "TEMPLATE_ERROR",
          message: error instanceof Error ? error.message : "Failed to get template",
          details: error,
        };
      }
    }
  );

  /**
   * templates:save - Save a template (create or update)
   */
  ipcMain.handle(
    IpcChannels.TEMPLATES_SAVE,
    (_event, request: SaveTemplateRequest): SaveTemplateResponse | IpcError => {
      try {
        let template;

        if (request.id) {
          // Update existing template
          template = store.update(request.id, {
            name: request.name,
            content: request.content,
          });
        } else {
          // Create new template
          template = store.create({
            name: request.name,
            content: request.content,
          });
        }

        return { template };
      } catch (error) {
        return {
          code: "TEMPLATE_ERROR",
          message: error instanceof Error ? error.message : "Failed to save template",
          details: error,
        };
      }
    }
  );

  /**
   * templates:delete - Delete a template by id
   */
  ipcMain.handle(
    IpcChannels.TEMPLATES_DELETE,
    (_event, request: DeleteTemplateRequest): DeleteTemplateResponse | IpcError => {
      try {
        const success = store.delete(request.id);
        return { success };
      } catch (error) {
        return {
          code: "TEMPLATE_ERROR",
          message: error instanceof Error ? error.message : "Failed to delete template",
          details: error,
        };
      }
    }
  );

  /**
   * templates:apply - Apply a template with variables
   */
  ipcMain.handle(
    IpcChannels.TEMPLATES_APPLY,
    (_event, request: ApplyTemplateRequest): ApplyTemplateResponse | IpcError => {
      try {
        const template = store.get(request.templateId);
        if (!template) {
          return {
            code: "TEMPLATE_NOT_FOUND",
            message: `Template with id "${request.templateId}" not found`,
          };
        }

        const result = parseTemplate(template.content, request.variables);
        return { result };
      } catch (error) {
        return {
          code: "TEMPLATE_ERROR",
          message: error instanceof Error ? error.message : "Failed to apply template",
          details: error,
        };
      }
    }
  );
}
