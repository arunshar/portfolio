/* paper.js - minimal behaviour for per-project paper pages:
   copy-to-clipboard for the BibTeX block, and smooth in-page scrolling. */
(function () {
  "use strict";

  // BibTeX copy buttons
  document.querySelectorAll(".copy-bib").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = document.getElementById(btn.getAttribute("data-target"));
      if (!target) return;
      var text = target.innerText;
      var done = function () {
        var old = btn.textContent;
        btn.textContent = "Copied";
        btn.classList.add("copied");
        setTimeout(function () {
          btn.textContent = old;
          btn.classList.remove("copied");
        }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(fallback);
      } else {
        fallback();
      }
      function fallback() {
        var r = document.createRange();
        r.selectNodeContents(target);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        try { document.execCommand("copy"); done(); } catch (e) {}
        sel.removeAllRanges();
      }
    });
  });

  // in-page anchor scrolling (TOC, BibTeX jump) is handled natively by the
  // browser plus CSS `scroll-behavior:smooth` (robust even without JS).
})();
