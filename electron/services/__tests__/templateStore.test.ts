import { describe, it, expect, beforeEach, vi } from 'vitest';
import TemplateStore from '../templateStore';

// Shared mock store state across all instances
let sharedMockStoreData: Record<string, any> = {};

// Mock electron-store with shared state
vi.mock('electron-store', () => ({
  default: class MockStore {
    get(key: string) { return sharedMockStoreData[key]; }
    set(key: string, value: any) { sharedMockStoreData[key] = value; }
  }
}));



describe('TemplateStore', () => {
  let store: TemplateStore;

  beforeEach(() => {
    // Reset shared mock state
    sharedMockStoreData = {};
    // Reset modules to get fresh instances
    vi.resetModules();
    store = new TemplateStore();
  });

  it('Test 1: Returns empty templates by default', () => {
    const templates = store.getAll();
    expect(templates).toHaveLength(0);
    expect(templates).toEqual([]);
  });

  it('Test 2: Creates new template with generated id', () => {
    const newTemplate = store.create({
      name: 'Custom Template',
      content: '${CUSTOM_VAR}',
    });

    expect(newTemplate).toHaveProperty('id');
    expect(newTemplate.id).toBeTruthy();
    expect(newTemplate.name).toBe('Custom Template');
    expect(newTemplate.content).toBe('${CUSTOM_VAR}');
    expect(newTemplate.isPreset).toBeUndefined();

    // Verify it's in the store
    const retrieved = store.get(newTemplate.id);
    expect(retrieved).toEqual(newTemplate);
  });

  it('Test 3: Updates existing template', () => {
    // Create a template first
    const created = store.create({
      name: 'Original Name',
      content: 'Original Content',
    });

    // Update it
    const updated = store.update(created.id, {
      name: 'Updated Name',
      content: 'Updated Content',
    });

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Updated Name');
    expect(updated.content).toBe('Updated Content');

    // Verify the update persisted
    const retrieved = store.get(created.id);
    expect(retrieved).toEqual(updated);
  });

  it('Test 4: Deletes template by id', () => {
    // Create a template
    const created = store.create({
      name: 'To Delete',
      content: 'Delete Me',
    });

    expect(store.get(created.id)).toBeDefined();

    // Delete it
    const deleted = store.delete(created.id);
    expect(deleted).toBe(true);

    // Verify it's gone
    expect(store.get(created.id)).toBeUndefined();

    // Verify total count decreased
    const allBefore = 0 + 1; // 0 presets + 1 created
    const allAfter = store.getAll().length;
    expect(allAfter).toBe(allBefore - 1);
  });

  it('Test 5: Persists changes across instances', () => {
    // DON'T reset state for this test
    // Create template in first instance
    const created = store.create({
      name: 'Persistent Template',
      content: 'Persistent Content',
    });

    const createdId = created.id;

    // Create a new instance (sharing the same mock store state)
    const store2 = new TemplateStore();

    // Verify the template still exists in the new instance
    const retrieved = store2.get(createdId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('Persistent Template');
    expect(retrieved?.content).toBe('Persistent Content');

    // Verify all templates are present
    const allTemplates = store2.getAll();
    expect(allTemplates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: createdId }),
    ]));
  });

  it('Test 6: get() returns undefined for non-existent id', () => {
    const result = store.get('non-existent-id');
    expect(result).toBeUndefined();
  });

  it('Test 7: delete() returns false for non-existent id', () => {
    const result = store.delete('non-existent-id');
    expect(result).toBe(false);
  });

  it('Test 8: Partial update only changes specified fields', () => {
    const created = store.create({
      name: 'Original Name',
      content: 'Original Content',
    });

    // Update only the name
    const updated = store.update(created.id, {
      name: 'New Name',
    });

    expect(updated.name).toBe('New Name');
    expect(updated.content).toBe('Original Content'); // Should remain unchanged
    expect(updated.id).toBe(created.id);
  });

  it('Test 9: Generated ids are unique', () => {
    const template1 = store.create({
      name: 'Template 1',
      content: 'Content 1',
    });

    const template2 = store.create({
      name: 'Template 2',
      content: 'Content 2',
    });

    const template3 = store.create({
      name: 'Template 3',
      content: 'Content 3',
    });

    const ids = [template1.id, template2.id, template3.id];
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(3);
  });

  it('Test 10: Templates can be created and updated', () => {
    // Create a template
    const created = store.create({
      name: 'Original Template',
      content: '${PLAYBACK_ID}',
    });
    
    // Update the template
    const updated = store.update(created.id, {
      name: 'Modified Preset',
    });

    expect(updated.name).toBe('Modified Preset');
    expect(updated.id).toBe(created.id);
  });
});
