import { useEffect } from 'react';

interface ShortcutConfig {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  handler: () => void;
  preventDefault?: boolean;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[], enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrlKey === undefined || event.ctrlKey === shortcut.ctrlKey;
        const shiftMatch = shortcut.shiftKey === undefined || event.shiftKey === shortcut.shiftKey;
        const altMatch = shortcut.altKey === undefined || event.altKey === shortcut.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          shortcut.handler();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
}
