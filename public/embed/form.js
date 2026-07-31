/**
 * Transovo embeddable opt-in form loader.
 * Usage:
 *   <div id="transovo-form"></div>
 *   <script src="https://your-app.com/embed/form.js" data-slug="your-form-slug" data-target="transovo-form"></script>
 */
(function () {
  var script = document.currentScript;
  if (!script) return;

  var slug = script.getAttribute("data-slug");
  if (!slug) {
    console.error("[Transovo] data-slug is required on the embed script tag.");
    return;
  }

  var targetId = script.getAttribute("data-target") || "transovo-form";
  var target = document.getElementById(targetId);
  if (!target) {
    console.error("[Transovo] Target element #" + targetId + " not found.");
    return;
  }

  var base = script.getAttribute("data-base");
  if (!base) {
    try {
      var src = script.src || "";
      var u = new URL(src, window.location.href);
      base = u.origin;
    } catch (e) {
      base = window.location.origin;
    }
  }
  base = base.replace(/\/$/, "");

  var height = script.getAttribute("data-height") || "520";
  var iframe = document.createElement("iframe");
  iframe.src = base + "/embed/f/" + encodeURIComponent(slug);
  iframe.title = "SMS opt-in form";
  iframe.setAttribute("loading", "lazy");
  iframe.setAttribute("allow", "clipboard-write");
  iframe.style.cssText =
    "width:100%;border:0;display:block;min-height:" + height + "px;background:transparent;";
  iframe.setAttribute("height", height);

  target.innerHTML = "";
  target.appendChild(iframe);
})();
