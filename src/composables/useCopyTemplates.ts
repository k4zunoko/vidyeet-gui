/**
 * useCopyTemplates Composable
 *
 * Copy template管理のcomposable
 *
 * 設計方針:
 * - 明示的なloadTemplates呼び出しまで自動でテンプレートを読み込まない（ライフサイクル独立）
 * - IPC通信を通じてテンプレートCRUD操作を実行
 * - エラー状態を適切に管理
 * - Ref-based stateで反応性を確保
 */

import { ref, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import type {
   CopyTemplate,
   ApplyTemplateRequest,
   SaveTemplateRequest,
   DeleteTemplateRequest,
 } from "../../electron/types/ipc";
import { isIpcError } from "../../electron/types/ipc";

/**
 * useCopyTemplates の戻り値型
 */
export interface UseCopyTemplates {
  /** テンプレート一覧 */
  templates: Ref<CopyTemplate[]>;
  /** ローディング状態 */
  isLoading: Ref<boolean>;
  /** エラーメッセージ（nullの場合はエラーなし） */
  error: Ref<string | null>;
  /** テンプレートを明示的に読み込む */
  loadTemplates: () => Promise<void>;
  /** テンプレートを追加 */
  addTemplate: (payload: Omit<CopyTemplate, "id">) => Promise<CopyTemplate>;
  /** テンプレートを更新 */
  updateTemplate: (
    id: string,
    patch: Partial<CopyTemplate>
  ) => Promise<CopyTemplate>;
  /** テンプレートを削除 */
  deleteTemplate: (id: string) => Promise<boolean>;
  /** テンプレートを適用（変数を置換） */
  applyTemplate: (
    id: string,
    variables: Record<string, string | number | null | undefined>
  ) => Promise<string>;
}

/**
 * useCopyTemplatesのcomposable
 *
 * @returns テンプレート管理の状態と操作メソッド
 */
export function useCopyTemplates(): UseCopyTemplates {
  // テンプレート一覧
  const templates = ref<CopyTemplate[]>([]);

  // ローディング状態
  const isLoading = ref<boolean>(false);

  // エラーメッセージ
  const error = ref<string | null>(null);

  /**
   * エラー処理用のヘルパー関数
   */
  function handleError(err: unknown): string {
    if (isIpcError(err)) {
      return err.message || "Unknown error occurred";
    }
    if (err instanceof Error) {
      return err.message;
    }
    return "Unknown error occurred";
  }

  /**
   * テンプレートを明示的に読み込む
   *
   * ライフサイクルに依存しない設計のため、呼び出し側が明示的に呼ぶ必要がある
   */
  async function loadTemplates(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const result = await (window as any).vidyeet.getTemplates();

      if (isIpcError(result)) {
        error.value = handleError(result);
        templates.value = [];
        return;
      }

      templates.value = result;
      error.value = null;
    } catch (err) {
      error.value = handleError(err);
      templates.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * テンプレートを追加
   *
   * @param payload - 新しいテンプレートのペイロード（id除外）
   * @returns 作成されたテンプレート
   */
  async function addTemplate(
    payload: Omit<CopyTemplate, "id">
  ): Promise<CopyTemplate> {
    error.value = null;

    try {
      const request: SaveTemplateRequest = {
        name: payload.name,
        content: payload.content,
      };

      const result = await (window as any).vidyeet.saveTemplate(request);

      if (isIpcError(result)) {
        error.value = handleError(result);
        throw new Error(error.value);
      }

      const template = result.template;

      // ローカル状態を更新
      templates.value.push(template);

      return template;
    } catch (err) {
      if (!error.value) {
        error.value = handleError(err);
      }
      throw err;
    }
  }

  /**
   * テンプレートを更新
   *
   * @param id - テンプレートID
   * @param patch - 更新内容（部分更新）
   * @returns 更新されたテンプレート
   */
  async function updateTemplate(
    id: string,
    patch: Partial<CopyTemplate>
  ): Promise<CopyTemplate> {
    error.value = null;

    try {
      // 既存テンプレートを探す
      const existing = templates.value.find((t) => t.id === id);
      if (!existing) {
        throw new Error("Template not found");
      }

      // マージしたテンプレートを作成
      const updated = { ...existing, ...patch, id };

      const request: SaveTemplateRequest = {
        id: updated.id,
        name: updated.name,
        content: updated.content,
      };

      const result = await (window as any).vidyeet.saveTemplate(request);

      if (isIpcError(result)) {
        error.value = handleError(result);
        throw new Error(error.value);
      }

      const updatedTemplate = result.template;

      // ローカル状態を更新
      const index = templates.value.findIndex((t) => t.id === id);
      if (index !== -1) {
        templates.value[index] = updatedTemplate;
      }

      return updatedTemplate;
    } catch (err) {
      if (!error.value) {
        error.value = handleError(err);
      }
      throw err;
    }
  }

   /**
    * テンプレートを削除
    *
    * @param id - テンプレートID
    * @returns 成功したかどうか
    */
   async function deleteTemplate(id: string): Promise<boolean> {
     const { t } = useI18n();
     error.value = null;

     try {
       const request: DeleteTemplateRequest = { id };
       const result = await (window as any).vidyeet.deleteTemplate(request);

       if (isIpcError(result)) {
         error.value = handleError(result);
         return false;
       }

       if (!result.success) {
         error.value = t("copyTemplate.errors.deleteFailed");
         return false;
       }

       // ローカル状態から削除
       templates.value = templates.value.filter((t) => t.id !== id);

       return true;
     } catch (err) {
       error.value = handleError(err);
       return false;
     }
   }

  /**
   * テンプレートを適用（変数を置換）
   *
   * @param id - テンプレートID
   * @param variables - 置換する変数
   * @returns レンダリングされた結果
   */
  async function applyTemplate(
    id: string,
    variables: Record<string, string | number | null | undefined>
  ): Promise<string> {
    error.value = null;

    try {
      const request: ApplyTemplateRequest = {
        templateId: id,
        variables,
      };

      const result = await (window as any).vidyeet.applyTemplate(request);

      if (isIpcError(result)) {
        error.value = handleError(result);
        throw new Error(error.value);
      }

      return result.result;
    } catch (err) {
      if (!error.value) {
        error.value = handleError(err);
      }
      throw err;
    }
  }

  return {
    templates,
    isLoading,
    error,
    loadTemplates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    applyTemplate,
  };
}
