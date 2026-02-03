/**
 * Parse a template string by replacing ${VAR} placeholders with values
 * @param template The template string containing ${VAR} placeholders
 * @param variables Object with variable names as keys and their values
 * @returns The parsed template string with placeholders replaced
 * @throws Error if unknown variable or null/undefined value is encountered
 */
export function parseTemplate(
  template: string,
  variables: Record<string, string | number | null | undefined>
): string {
  // Find all ${...} placeholders
  const placeholderRegex = /\$\{([^}]+)\}/g;
  const placeholders = new Set<string>();

  // Collect all placeholders in the template
  let match: RegExpExecArray | null = placeholderRegex.exec(template);
  while (match !== null) {
    placeholders.add(match[1]);
    match = placeholderRegex.exec(template);
  }

  // Validate all placeholders exist and have values
  for (const placeholder of placeholders) {
    // Check if variable exists (case-insensitive lookup)
    const variableKey = Object.keys(variables).find(
      (key) => key.toLowerCase() === placeholder.toLowerCase()
    );

    if (!variableKey) {
      throw new Error(`Unknown variable: ${placeholder}`);
    }

    // Check if value is null or undefined
    const value = variables[variableKey];
    if (value === null || value === undefined) {
      throw new Error(`${placeholder} is not available`);
    }
  }

  // Replace all placeholders with their values (case-insensitive)
  let result = template;
  for (const placeholder of placeholders) {
    const variableKey = Object.keys(variables).find(
      (key) => key.toLowerCase() === placeholder.toLowerCase()
    )!;
    const value = variables[variableKey];
    const placeholderRegexReplace = new RegExp(
      `\\$\\{${placeholder}\\}`,
      'gi'
    );
    result = result.replace(placeholderRegexReplace, String(value));
  }

  return result;
}
