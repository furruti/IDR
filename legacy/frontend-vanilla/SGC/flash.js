(function () {
    try {
        var t = localStorage.getItem('IDR_dark');
        if (t === 'true') {
            document.documentElement.classList.add('dark-mode');
        }
    } catch (e) { }
}());
