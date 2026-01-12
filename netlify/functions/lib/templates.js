function renderTemplate(template, data) {
  if (!template) {
    return '';
  }
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = data?.[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

module.exports = {
  renderTemplate
};
