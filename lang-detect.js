// Pick the docs language from the browser on the first visit.
//
// Mintlify loads every .js file from the content directory on every page.
// On the first visit (no saved choice) a reader whose browser prefers Russian
// is sent to /ru/…, everyone else to /en/… — the same page in the other
// language, since both trees mirror each other. After that the choice is
// remembered: switching the language in the header (or opening a page in
// the other language) updates it, and we never redirect again.
(function () {
    var KEY = 'exode-docs-lang';
    var LANGS = ['en', 'ru'];

    function pathLang(pathname) {
        var m = pathname.match(/^\/(en|ru)(\/|$)/);
        return m ? m[1] : null;
    }

    function browserLang() {
        var list = navigator.languages && navigator.languages.length
            ? navigator.languages
            : [navigator.language || ''];
        for (var i = 0; i < list.length; i++) {
            var code = String(list[i]).toLowerCase().split('-')[0];
            if (LANGS.indexOf(code) !== -1) return code;
        }
        return 'en';
    }

    function load() {
        try { return localStorage.getItem(KEY); } catch (e) { return null; }
    }

    function save(lang) {
        try { localStorage.setItem(KEY, lang); } catch (e) { /* storage blocked */ }
    }

    var current = pathLang(location.pathname);

    var isRoot = location.pathname === '/';

    if (!load()) {
        var wanted = browserLang();
        save(wanted);
        if ((current || isRoot) && current !== wanted) {
            var rest = current ? location.pathname.slice(3) : '';
            location.replace('/' + wanted + (rest && rest !== '/' ? rest : '/welcome') + location.search + location.hash);
            return;
        }
    } else if (current) {
        save(current);
    }

    // Remember the language the reader navigates to (header switcher, links).
    var last = location.pathname;
    setInterval(function () {
        if (location.pathname === last) return;
        last = location.pathname;
        var lang = pathLang(last);
        if (lang) save(lang);
    }, 500);
})();
