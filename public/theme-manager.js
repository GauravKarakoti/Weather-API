/**
 * Theme Manager for Weather API
 * Handles multiple theme switching with system preference detection,
 * persistent storage, and custom theme support
 */

class ThemeManager {
  constructor() {
    this.themes = ['light', 'dark', 'blue', 'green', 'purple', 'orange', 'red', 'dark-blue', 'forest', 'custom'];
    this.currentTheme = this.getStoredTheme() || this.getSystemPreference();
    this.customThemes = this.getStoredCustomThemes();
    this.init();
  }

  init() {
    this.applyTheme(this.currentTheme);
    this.setupThemeSelector();
    this.setupEventListeners();
    this.listenForSystemChanges();
  }

  /**
   * Get system preference for dark mode
   */
  getSystemPreference() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  /**
   * Get stored theme from localStorage
   */
  getStoredTheme() {
    try {
      return localStorage.getItem('weather-theme');
    } catch (e) {
      console.warn('localStorage not available, using system preference');
      return null;
    }
  }

  /**
   * Store theme preference
   */
  setStoredTheme(theme) {
    try {
      localStorage.setItem('weather-theme', theme);
    } catch (e) {
      console.warn('Could not save theme preference');
    }
  }

  /**
   * Get stored custom themes
   */
  getStoredCustomThemes() {
    try {
      const custom = localStorage.getItem('weather-custom-themes');
      return custom ? JSON.parse(custom) : {};
    } catch (e) {
      console.warn('Could not load custom themes');
      return {};
    }
  }

  /**
   * Store custom themes
   */
  setStoredCustomThemes(customThemes) {
    try {
      localStorage.setItem('weather-custom-themes', JSON.stringify(customThemes));
    } catch (e) {
      console.warn('Could not save custom themes');
    }
  }

  /**
   * Apply theme to document
   */
  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.currentTheme = theme;

    // Apply custom theme variables if it's a custom theme
    if (theme === 'custom' && this.customThemes['default']) {
      this.applyCustomTheme(this.customThemes['default']);
    }

    this.updateThemeSelector(theme);
    this.setStoredTheme(theme);

    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('themeChanged', {
      detail: { theme: theme }
    }));
  }

  /**
   * Apply custom theme variables
   */
  applyCustomTheme(customTheme) {
    const root = document.documentElement;
    Object.keys(customTheme).forEach(key => {
      root.style.setProperty(`--custom-${key}`, customTheme[key]);
    });
  }

  /**
   * Set specific theme
   */
  setTheme(theme) {
    if (this.themes.includes(theme)) {
      this.applyTheme(theme);
    }
  }

  /**
   * Toggle between light and dark themes (legacy support)
   */
  toggleTheme() {
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme);
  }

  /**
   * Setup theme selector UI
   */
  setupThemeSelector() {
    const selector = document.getElementById('theme-selector');
    if (selector) {
      // Create dropdown options
      selector.innerHTML = this.themes.map(theme => `
        <option value="${theme}">${this.getThemeDisplayName(theme)}</option>
      `).join('');

      selector.value = this.currentTheme;
      selector.addEventListener('change', (e) => {
        this.setTheme(e.target.value);
      });
    }

    // Setup customize button
    const customizeBtn = document.getElementById('customize-theme-btn');
    if (customizeBtn) {
      customizeBtn.addEventListener('click', () => this.toggleCustomizationPanel());
    }

    // Setup customization panel
    this.setupCustomizationPanel();
  }

  /**
   * Toggle customization panel visibility
   */
  toggleCustomizationPanel() {
    const panel = document.getElementById('theme-customization');
    if (panel) {
      panel.classList.toggle('hidden');
    }
  }

  /**
   * Get display name for theme
   */
  getThemeDisplayName(theme) {
    const names = {
      'light': 'Light',
      'dark': 'Dark',
      'blue': 'Blue',
      'green': 'Green',
      'purple': 'Purple',
      'orange': 'Orange',
      'red': 'Red',
      'dark-blue': 'Dark Blue',
      'forest': 'Forest',
      'custom': 'Custom'
    };
    return names[theme] || theme;
  }

  /**
   * Update theme selector UI
   */
  updateThemeSelector(theme) {
    const selector = document.getElementById('theme-selector');
    if (selector) {
      selector.value = theme;
    }
  }

  /**
   * Setup customization panel
   */
  setupCustomizationPanel() {
    const panel = document.getElementById('theme-customization');
    if (!panel) return;

    panel.innerHTML = `
      <h4>Customize Theme</h4>
      <div class="custom-colors">
        <label>
          Primary Background:
          <input type="color" id="custom-bg-primary" value="#f8f9fa">
        </label>
        <label>
          Secondary Background:
          <input type="color" id="custom-bg-secondary" value="#ffffff">
        </label>
        <label>
          Primary Text:
          <input type="color" id="custom-text-primary" value="#202124">
        </label>
        <label>
          Accent Color:
          <input type="color" id="custom-accent-primary" value="#1a73e8">
        </label>
      </div>
      <div class="custom-actions">
        <button id="save-custom-theme">Save Custom Theme</button>
        <button id="reset-custom-theme">Reset to Default</button>
      </div>
    `;

    // Add event listeners
    const inputs = panel.querySelectorAll('input[type="color"]');
    inputs.forEach(input => {
      input.addEventListener('input', () => this.previewCustomTheme());
    });

    document.getElementById('save-custom-theme').addEventListener('click', () => this.saveCustomTheme());
    document.getElementById('reset-custom-theme').addEventListener('click', () => this.resetCustomTheme());

    // Load existing custom theme
    this.loadCustomThemeIntoInputs();
  }

  /**
   * Preview custom theme in real-time
   */
  previewCustomTheme() {
    if (this.currentTheme !== 'custom') return;

    const customTheme = this.getCustomThemeFromInputs();
    this.applyCustomTheme(customTheme);
  }

  /**
   * Get custom theme values from inputs
   */
  getCustomThemeFromInputs() {
    return {
      'bg-primary': document.getElementById('custom-bg-primary').value,
      'bg-secondary': document.getElementById('custom-bg-secondary').value,
      'text-primary': document.getElementById('custom-text-primary').value,
      'accent-primary': document.getElementById('custom-accent-primary').value,
      // Add more mappings as needed
      'bg-tertiary': this.lightenColor(document.getElementById('custom-bg-secondary').value, 0.1),
      'text-secondary': this.lightenColor(document.getElementById('custom-text-primary').value, 0.3),
      'text-muted': this.lightenColor(document.getElementById('custom-text-primary').value, 0.5),
      'accent-secondary': this.lightenColor(document.getElementById('custom-accent-primary').value, 0.2),
      'accent-hover': this.darkenColor(document.getElementById('custom-accent-primary').value, 0.2),
      'border-color': this.lightenColor(document.getElementById('custom-bg-primary').value, 0.2),
      'border-hover': this.lightenColor(document.getElementById('custom-bg-primary').value, 0.3),
      'shadow-light': `rgba(0, 0, 0, 0.1)`,
      'shadow-medium': `rgba(0, 0, 0, 0.15)`,
      'shadow-heavy': `rgba(0, 0, 0, 0.2)`,
      'error-color': '#d93025',
      'success-color': '#137333',
      'warning-color': '#f29900',
      'gradient-primary': `linear-gradient(135deg, ${document.getElementById('custom-bg-primary').value}, ${document.getElementById('custom-accent-primary').value})`,
      'gradient-secondary': `linear-gradient(135deg, ${document.getElementById('custom-accent-primary').value}, ${this.lightenColor(document.getElementById('custom-accent-primary').value, 0.3)})`
    };
  }

  /**
   * Save custom theme
   */
  saveCustomTheme() {
    const customTheme = this.getCustomThemeFromInputs();
    this.customThemes['default'] = customTheme;
    this.setStoredCustomThemes(this.customThemes);
    this.applyTheme('custom');
    alert('Custom theme saved!');
  }

  /**
   * Reset custom theme
   */
  resetCustomTheme() {
    delete this.customThemes['default'];
    this.setStoredCustomThemes(this.customThemes);
    this.loadCustomThemeIntoInputs();
    if (this.currentTheme === 'custom') {
      this.setTheme('light'); // Fallback to light theme
    }
    alert('Custom theme reset!');
  }

  /**
   * Load custom theme into input fields
   */
  loadCustomThemeIntoInputs() {
    const customTheme = this.customThemes['default'] || {};
    document.getElementById('custom-bg-primary').value = customTheme['bg-primary'] || '#f8f9fa';
    document.getElementById('custom-bg-secondary').value = customTheme['bg-secondary'] || '#ffffff';
    document.getElementById('custom-text-primary').value = customTheme['text-primary'] || '#202124';
    document.getElementById('custom-accent-primary').value = customTheme['accent-primary'] || '#1a73e8';
  }

  /**
   * Utility function to lighten color
   */
  lightenColor(color, percent) {
    // Simple color lightening - in production, use a proper color library
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent * 100);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  }

  /**
   * Utility function to darken color
   */
  darkenColor(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent * 100);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    return "#" + (0x1000000 + (R > 255 ? 255 : R < 0 ? 0 : R) * 0x10000 +
      (G > 255 ? 255 : G < 0 ? 0 : G) * 0x100 +
      (B > 255 ? 255 : B < 0 ? 0 : B)).toString(16).slice(1);
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Keyboard support
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        this.toggleTheme();
      }
    });
  }

  /**
   * Listen for system theme changes
   */
  listenForSystemChanges() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      // Only auto-switch if user hasn't manually set a preference
      if (!this.getStoredTheme()) {
        const newTheme = e.matches ? 'dark' : 'light';
        this.applyTheme(newTheme);
      }
    });
  }

  /**
   * Get current theme
   */
  getCurrentTheme() {
    return this.currentTheme;
  }

  /**
   * Get available themes
   */
  getAvailableThemes() {
    return this.themes;
  }
}

// Initialize theme manager when DOM is ready
if (typeof window !== 'undefined') {
  let themeManager;
  
  function initThemeManager() {
    themeManager = new ThemeManager();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeManager);
  } else {
    initThemeManager();
  }

  // Export for use in other modules
  window.ThemeManager = ThemeManager;
}