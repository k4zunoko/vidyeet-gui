import Store from 'electron-store';

interface CopyTemplate {
  id: string;
  name: string;
  content: string;
  isPreset?: boolean;
}

interface CreateTemplatePayload {
  name: string;
  content: string;
}

interface UpdateTemplatePayload {
  name?: string;
  content?: string;
}



/**
 * Generates a unique ID using timestamp and random value
 * Format: [base36 timestamp][base36 random]
 */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * TemplateStore manages copy templates with persistence via electron-store
 * Initializes with preset templates and allows CRUD operations
 */
class TemplateStore {
  private store: Store;
  private readonly STORE_KEY = 'templates';

  constructor() {
    this.store = new Store();
    this.initialize();
  }

  /**
   * Initialize store with empty templates array if not exists
   */
  private initialize(): void {
    const existing = this.store.get(this.STORE_KEY);
    if (!existing) {
      this.store.set(this.STORE_KEY, []);
    }
  }

  /**
   * Get all templates (both preset and custom)
   */
  getAll(): CopyTemplate[] {
    const templates = this.store.get(this.STORE_KEY) as CopyTemplate[];
    return templates || [];
  }

  /**
   * Get a single template by id
   */
  get(id: string): CopyTemplate | undefined {
    const templates = this.getAll();
    return templates.find(t => t.id === id);
  }

  /**
   * Create a new template with generated id
   */
  create(payload: CreateTemplatePayload): CopyTemplate {
    const newTemplate: CopyTemplate = {
      id: generateId(),
      name: payload.name,
      content: payload.content,
    };

    const templates = this.getAll();
    templates.push(newTemplate);
    this.store.set(this.STORE_KEY, templates);

    return newTemplate;
  }

  /**
   * Update an existing template (partial update)
   */
  update(id: string, patch: UpdateTemplatePayload): CopyTemplate {
    const templates = this.getAll();
    const index = templates.findIndex(t => t.id === id);

    if (index === -1) {
      throw new Error(`Template with id "${id}" not found`);
    }

    const updated = {
      ...templates[index],
      ...patch,
    };

    templates[index] = updated;
    this.store.set(this.STORE_KEY, templates);

    return updated;
  }

  /**
   * Delete a template by id
   */
  delete(id: string): boolean {
    const templates = this.getAll();
    const index = templates.findIndex(t => t.id === id);

    if (index === -1) {
      return false;
    }

    templates.splice(index, 1);
    this.store.set(this.STORE_KEY, templates);
    return true;
  }
}

export default TemplateStore;
export type { CopyTemplate, CreateTemplatePayload, UpdateTemplatePayload };
