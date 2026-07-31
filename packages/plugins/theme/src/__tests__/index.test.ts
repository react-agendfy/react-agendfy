import darkThemePlugin from '../index';

describe('Theme Plugin', () => {
  beforeEach(() => {
    document.documentElement.style.cssText = '';
    document.documentElement.removeAttribute('data-theme');
  });

  it('should apply theme variables', () => {
    darkThemePlugin.activate();
    expect(document.documentElement.style.getPropertyValue('--agendfy-color-surface'))
      .toBe('#141a24');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('should remove theme variables on deactivate', () => {
    darkThemePlugin.activate();
    darkThemePlugin.deactivate();
    expect(document.documentElement.style.getPropertyValue('--agendfy-color-surface'))
      .toBe('');
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('should scope variables to a target element when provided', () => {
    const el = document.createElement('div');
    darkThemePlugin.activate(el);
    expect(el.style.getPropertyValue('--agendfy-color-surface')).toBe('#141a24');
    expect(document.documentElement.style.getPropertyValue('--agendfy-color-surface'))
      .toBe('');
  });
});
