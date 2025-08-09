/**
 * Theme Manager for Weather API
 * Handles dark/light mode switching with system preference detection
 * and persistent storage
 */

class ThemeManager {
  constructor() {
    this.currentTheme = this.getStoredTheme() || this.getSystemPreference();
    this.init();
  }

  init() {
    this.applyTheme(this.currentTheme);
    this.setupToggleButtons();
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
   * Apply theme to document
   */
  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.currentTheme = theme;
    this.updateToggleButton(theme);
    this.setStoredTheme(theme);
  }

  /**
   * Toggle between light and dark themes
   */
  toggleTheme() {
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme);
    
    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('themeChanged', { 
      detail: { theme: newTheme } 
    }));
  }

  /**
   * Setup existing theme toggle buttons
   */
  setupToggleButtons() {
    const toggleButtons = document.querySelectorAll('#theme-toggle');
    toggleButtons.forEach(button => {
      button.addEventListener('click', () => this.toggleTheme());
      this.updateToggleButton(this.currentTheme);
    });
  }

  /**
   * Update toggle button appearance
   */
  updateToggleButton(theme) {
    const button = document.getElementById('theme-toggle');
    if (button) {
      // Support both enhanced icon toggles and simple text toggles
    const moonIcon = button.querySelector('.moon-icon');
    const sunIcon = button.querySelector('.sun-icon');
    
    if (moonIcon && sunIcon) {
      // Enhanced toggle with icons - CSS handles visibility
      button.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
    } else {
      // Simple text toggle
      button.innerHTML = this.getToggleIcon(theme);
    }
      button.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
    }
  }

  /**
   * Get toggle icon based on current theme
   */
  getToggleIcon(theme) {
    return theme === 'dark' 
      ? '<i class="fas fa-sun" aria-hidden="true"></i>'
      : '<i class="fas fa-moon" aria-hidden="true"></i>';
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
   * Set specific theme
   */
  setTheme(theme) {
    if (['light', 'dark'].includes(theme)) {
      this.applyTheme(theme);
    }
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