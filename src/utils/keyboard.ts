export function deleteWordLeft(text: string, cursor: number): [string, number] {
  // If cursor is at the beginning, nothing to delete
  if (cursor === 0) {
    return [text, 0];
  }

  // Split the string into the part before the cursor (prefix) and after (suffix)
  const prefix = text.slice(0, cursor);
  const suffix = text.slice(cursor);

  // Remove the last "word" (one or more non-space chars followed by optional spaces) from the prefix.
  // This roughly emulates typical shell behaviour for Ctrl+W / Option+Delete.
  const newPrefix = prefix.replace(/\S+\s*$/, '');

  // New text and updated cursor position
  const newText = newPrefix + suffix;
  return [newText, newPrefix.length];
}
