(function () {
    'use strict';
    try {
        if (localStorage.getItem('IDR_dark') === 'true') {
            document.documentElement.classList.add('dark-mode');
        }
    } catch (e) { }
}());
