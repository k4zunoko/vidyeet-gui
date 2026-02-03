import { parseTemplate } from '../templateEngine';

describe('parseTemplate', () => {
  test('replaces ${VAR} placeholders with values', () => {
    const template = 'Hello ${name}, you are ${age} years old';
    const variables = { name: 'Alice', age: 25 };
    const result = parseTemplate(template, variables);
    expect(result).toBe('Hello Alice, you are 25 years old');
  });

  test('handles case-insensitive variable matching', () => {
    const template = 'Hello ${NAME}, ${AGE} years old';
    const variables = { name: 'Bob', age: 30 };
    const result = parseTemplate(template, variables);
    expect(result).toBe('Hello Bob, 30 years old');
  });

  test('throws on unknown variable in template', () => {
    const template = 'Hello ${name}, ${unknown}';
    const variables = { name: 'Charlie' };
    expect(() => parseTemplate(template, variables)).toThrow('Unknown variable: unknown');
  });

  test('throws on null/undefined variable value', () => {
    const template = 'Hello ${name}';
    const variables = { name: null };
    expect(() => parseTemplate(template, variables)).toThrow('name is not available');
  });
});
