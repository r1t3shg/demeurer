/*
 * Demeurer preview bridge.
 *
 * Loaded inside the canvas iframe. Hand-written, no bundler step, no
 * dependencies. Two jobs:
 *   1. Translate clicks on [data-demeurer-block-id] into a
 *      `demeurer:select-block` postMessage to the editor.
 *   2. Receive `demeurer:set-selection`, `demeurer:scroll-to-block`,
 *      and `demeurer:restore-scroll` messages from the editor.
 * Plus: prevent default on links and forms so the iframe can't navigate
 * away from the preview document.
 *
 * IMPORTANT: this file ships with the preview iframe ONLY. It is NEVER
 * referenced from the compiled Liquid output that lands in the
 * merchant's theme.
 */

(function () {
  "use strict";

  // postMessage targets — editor and iframe share an origin in our setup,
  // but be explicit so a future split doesn't quietly leak messages.
  var allowedOrigin = window.location.origin;

  function findBlockEl(target) {
    var el = target;
    while (el && el !== document.body) {
      if (el.getAttribute && el.getAttribute("data-demeurer-block-id")) {
        return el;
      }
      el = el.parentNode;
    }
    return null;
  }

  function send(message) {
    if (window.parent === window) return;
    window.parent.postMessage(message, allowedOrigin);
  }

  // 1. Click → select.

  document.addEventListener(
    "click",
    function (e) {
      // Stop the merchant's theme JS from navigating, opening drawers,
      // submitting forms, etc. The editor is read-only for navigation.
      // Allow cmd/ctrl-click — that's the merchant's escape hatch to
      // open a real link in a new tab while debugging.
      var openInNewTab = e.metaKey || e.ctrlKey;
      var anchor = e.target && e.target.closest ? e.target.closest("a") : null;
      if (anchor && !openInNewTab) {
        e.preventDefault();
      }
      if (e.target && e.target.closest && e.target.closest("button[type=submit], input[type=submit]")) {
        e.preventDefault();
      }

      var block = findBlockEl(e.target);
      if (!block) return;
      var id = block.getAttribute("data-demeurer-block-id");
      if (!id) return;
      send({ type: "demeurer:select-block", blockId: id });
    },
    true,
  );

  // Block any form submit attempts wholesale.
  document.addEventListener(
    "submit",
    function (e) {
      e.preventDefault();
    },
    true,
  );

  // 2. Editor messages → iframe state.

  window.addEventListener("message", function (e) {
    if (e.origin !== allowedOrigin) return;
    var msg = e.data;
    if (!msg || typeof msg.type !== "string") return;

    if (msg.type === "demeurer:set-selection") {
      setSelection(msg.blockId);
    } else if (msg.type === "demeurer:scroll-to-block") {
      scrollToBlock(msg.blockId);
    } else if (msg.type === "demeurer:restore-scroll") {
      // Number, in pixels.
      if (typeof msg.y === "number") {
        window.scrollTo(0, msg.y);
      }
    }
  });

  function setSelection(blockId) {
    var prev = document.querySelectorAll(".demeurer-block.is-selected");
    for (var i = 0; i < prev.length; i++) {
      prev[i].classList.remove("is-selected");
    }
    if (!blockId) return;
    var next = document.querySelector(
      '[data-demeurer-block-id="' + cssEscape(blockId) + '"]',
    );
    if (next) next.classList.add("is-selected");
  }

  function scrollToBlock(blockId) {
    if (!blockId) return;
    var el = document.querySelector(
      '[data-demeurer-block-id="' + cssEscape(blockId) + '"]',
    );
    if (!el) return;
    if (typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // CSS.escape isn't available in older WebKit reliably — and the
  // bridge has to be tiny. The id format is `blk_<random>` so a
  // straightforward escape covers the surface we care about.
  function cssEscape(s) {
    return String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  // 3. Tell the editor we're ready so it can sync the current selection
  // and scroll position straight away.

  window.addEventListener("load", function () {
    send({ type: "demeurer:ready" });
  });
})();
