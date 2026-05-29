/**
 * Inline script untuk menerapkan tema sebelum React hydrate (anti-FOUC).
 * Membaca query param `theme=light|dark|system`.
 */
export function ThemeScript() {
  const code = `(function(){try{
    var p = new URLSearchParams(window.location.search);
    var v = p.get('theme');
    var t = (v === 'light' || v === 'dark' || v === 'system') ? v : 'system';
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = t === 'dark' || (t === 'system' && prefersDark);
    document.documentElement.classList.toggle('dark', dark);
  }catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
