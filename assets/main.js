/* main.js - homepage behaviour (academic theme):
   render the full publication list, collapse long news, smooth in-page scroll.
   No canvas / cursor / scroll animations (kept deliberately minimal). */
(function () {
  "use strict";

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
        var supplemental = (p.links || []).filter(function (link) {
          var label = String(link.label || "").toLowerCase();
          if (label === "paper" || label === "arxiv") return false;
          return link.href !== p.titleUrl;
        });
        var links = supplemental
          .map(function (link) {
            return '<a href="' + escapeHtml(link.href) + '">' + escapeHtml(link.label) + "</a>";
          })
          .join("");
        var title = p.titleUrl
          ? '<a href="' + escapeHtml(p.titleUrl) + '">' + escapeHtml(p.title) + "</a>"
          : escapeHtml(p.title);
        var abstract = p.abstract
          ? '<details class="paper-detail"><summary>Abstract</summary><p>' +
            escapeHtml(p.abstract) + "</p></details>"
          : "";
        var bibtex = p.bibtex
          ? '<details class="paper-detail"><summary>BibTeX</summary><pre>' +
            escapeHtml(p.bibtex) + "</pre></details>"
          : "";
        var classes = p.representative ? "publication-card representative" : "publication-card";
        return (
          '<article class="' + classes + '" id="pub-' + escapeHtml(p.id) + '">' +
          '<p class="paper-year">' + escapeHtml(p.year || "Publication") + "</p>" +
          "<h3>" + title + "</h3>" +
          '<p class="paper-authors">' + escapeHtml(p.authors) + "</p>" +
          '<p class="paper-venue">' + escapeHtml(p.venue) + "</p>" +
          (links ? '<div class="paper-links">' + links + "</div>" : "") +
          abstract + bibtex +
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
