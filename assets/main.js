/* main.js - homepage behaviour (academic theme):
   render the full publication list, collapse long news, smooth in-page scroll.
   No canvas / cursor / scroll animations (kept deliberately minimal). */
(function () {
  "use strict";

  var ICON_GH =
    '<svg class="ico" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">' +
    '<path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59' +
    '.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23' +
    '-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87' +
    '.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82' +
    '-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 3.86c.68 0 ' +
    '1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27' +
    '.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 ' +
    '2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>';

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderPublications() {
    var list = document.getElementById("publication-list");
    var pubs = window.LEGACY_PUBLICATIONS || [];
    if (!list || !pubs.length) return;

    list.innerHTML = pubs
      .map(function (p) {
        var title = p.titleUrl
          ? '<a href="' + escapeHtml(p.titleUrl) + '">' + escapeHtml(p.title) + "</a>"
          : escapeHtml(p.title);
        var authors = escapeHtml(p.authors || "").replace(
          "Arun Sharma", "<strong>Arun Sharma</strong>");
        var chips = (p.links || []).map(function (link) {
          var label = String(link.label || "").toLowerCase();
          var href = escapeHtml(link.href);
          if (label === "code" || label === "github") {
            return '<a class="ico-link" href="' + href + '" target="_blank" rel="noopener" ' +
              'title="Code on GitHub" aria-label="Code on GitHub">' + ICON_GH + "</a>";
          }
          if (label === "paper" || label === "pdf") {
            return '<a href="' + href + '">PDF</a>';
          }
          if (label === "arxiv") {
            return '<a href="' + href + '">arXiv</a>';
          }
          return '<a href="' + href + '">' + escapeHtml(link.label) + "</a>";
        });
        var linkRow = chips.length
          ? '<p class="pub-links">' + chips.join(" &middot; ") + "</p>"
          : "";
        var venue = p.venue ? '<p class="pub-venue">' + escapeHtml(p.venue) + "</p>" : "";
        var abstract = p.abstract
          ? '<details class="pub-fold"><summary>Abstract</summary><p>' +
            escapeHtml(p.abstract) + "</p></details>"
          : "";
        var bibtex = p.bibtex
          ? '<details class="pub-fold"><summary>BibTeX</summary><pre>' +
            escapeHtml(p.bibtex) + "</pre></details>"
          : "";
        return (
          '<article class="pub-entry" id="pub-' + escapeHtml(p.id) + '">' +
          "<h3>" + title + "</h3>" +
          '<p class="pub-authors">' + authors + "</p>" +
          venue + linkRow + abstract + bibtex +
          "</article>"
        );
      })
      .join("");

    list.querySelectorAll('a[href^="http"]').forEach(function (a) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    });
  }

  function collapseNews(limit) {
    var ol = document.querySelector(".news-list");
    if (!ol) return;
    var items = Array.from(ol.children);
    if (items.length <= limit) return;
    ol.classList.add("collapsed");
    items.forEach(function (li, i) {
      if (i >= limit) li.classList.add("hidden");
    });
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "news-toggle";
    var hidden = items.length - limit;
    btn.textContent = "Show " + hidden + " earlier items";
    btn.addEventListener("click", function () {
      var collapsed = ol.classList.toggle("collapsed");
      items.forEach(function (li, i) {
        if (i >= limit) li.classList.toggle("hidden", collapsed);
      });
      btn.textContent = collapsed ? "Show " + hidden + " earlier items" : "Show fewer";
    });
    ol.insertAdjacentElement("afterend", btn);
  }

  function smoothAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("href").slice(1);
        var el = id && document.getElementById(id);
        if (el) {
          e.preventDefault();
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }

  renderPublications();
  collapseNews(10);
  smoothAnchors();
})();
