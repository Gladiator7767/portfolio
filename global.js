// Navigation and the contact form use native HTML. JavaScript only adds a theme switch.
const themeContainer = document.querySelector('#theme-control');
if (themeContainer) {
  const label = document.createElement('label');
  label.className = 'theme-label';
  label.append('Theme ');
  const select = document.createElement('select');
  const themes = [
    { value: 'light dark', label: 'Automatic' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];
  for (const theme of themes) {
    const option = document.createElement('option');
    option.value = theme.value;
    option.textContent = theme.label;
    select.append(option);
  }
  label.append(select);
  themeContainer.append(label);

  function applyTheme(value) {
    const validValue = themes.some((theme) => theme.value === value) ? value : 'light dark';
    document.documentElement.style.setProperty('color-scheme', validValue);
    select.value = validValue;
  }

  // Storage may be unavailable in a restricted browser; the switch still works.
  try {
    applyTheme(localStorage.getItem('colorScheme'));
  } catch {
    applyTheme('light dark');
  }
  select.addEventListener('input', () => {
    applyTheme(select.value);
    try {
      localStorage.setItem('colorScheme', select.value);
    } catch {
      // Keep the current page usable even without persistent browser storage.
    }
  });
}
