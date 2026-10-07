import { useEffect } from 'react';

/** iOS pans the visual viewport as well as shrinking it for the native keyboard. */
export function useNativeViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const root = document.documentElement;
    let frame = 0;
    let pageHeight = viewport?.height ?? window.innerHeight;
    let pageWidth = viewport?.width ?? window.innerWidth;
    const update = () => {
      frame = 0;
      // Keep browser pinch zoom accessible; it is not a keyboard resize.
      if (viewport && Math.abs(viewport.scale - 1) > 0.05) return;
      const height = viewport?.height ?? window.innerHeight;
      const width = viewport?.width ?? window.innerWidth;
      // Rotating a phone is a new page size, not a keyboard opening.
      if(Math.abs(width-pageWidth)>60)pageHeight=height;
      pageWidth=width;
      const input = document.activeElement;
      const editing = input instanceof HTMLElement && (input.matches('input,textarea') || input.isContentEditable);
      // A smaller desktop window is not a keyboard. Keep the old page height
      // only while editing or during the native keyboard's closing animation.
      const nativeInput = window.matchMedia('(max-width:699px), (any-pointer:coarse)').matches;
      const keyboardOpen = nativeInput && pageHeight - height > 120 && (editing || root.dataset.nativeKeyboard === 'open');
      if (!keyboardOpen) pageHeight = height;
      const offset = keyboardOpen ? Math.max(0, viewport?.offsetTop ?? 0) : 0;
      root.style.setProperty('--native-height', `${height}px`);
      // The page behind a conversation keeps its layout and scroll position.
      // Only the sheet follows the visible area above Safari's keyboard.
      root.style.setProperty('--native-page-height', `${pageHeight}px`);
      root.style.setProperty('--native-keyboard-inset', `${Math.max(0, pageHeight - height - offset)}px`);
      root.dataset.nativeKeyboard = keyboardOpen ? 'open' : 'closed';
      if (!keyboardOpen && window.matchMedia('(max-width:699px)').matches && window.scrollY) window.scrollTo(0, 0);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      root.style.removeProperty('--native-height');
      root.style.removeProperty('--native-page-height');
      root.style.removeProperty('--native-keyboard-inset');
      delete root.dataset.nativeKeyboard;
    };
  }, []);
}
