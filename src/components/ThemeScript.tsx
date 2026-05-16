/**
 * Inline script untuk menerapkan tema sebelum React hydrate (anti-FOUC).
 * Membaca localStorage 'theme' (light/dark/system).
 */
export function ThemeScript() {
  const code = `(function(){try{
    var t = localStorage.getItem('theme') || 'system';
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = t === 'dark' || (t === 'system' && prefersDark);
    if (dark) document.documentElement.classList.add('dark');
  }catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
