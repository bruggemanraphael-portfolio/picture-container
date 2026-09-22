// Native Web Component <picture> custom element.
// Public API:
//   attributes: initial, camera-enabled, activity-state ("none"|"active"|"inactive"|"pending"), placeholder,
//               image-url (static image, no gif), x, y, zoom
//   properties: initial, isCameraEnabled, activityState, src, placeholder, picInfo, onUpdate(fn)
//   events: "liste-mise-a-jour", "picinfo-change", "placeholder-change", "pic-click"

// Resolved relative to this module so the icon loads regardless of the host page's location.
const CAMERA_ICON_URL = new URL("./camera-icon.svg", import.meta.url).href;

// Animated formats are rejected since the component only ever shows a static frame.
const ANIMATED_IMAGE_EXTENSIONS = ["gif", "apng"];

function isAnimatedImageUrl(url) {
  const match = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(url);
  const ext = match ? match[1].toLowerCase() : "";
  return ANIMATED_IMAGE_EXTENSIONS.includes(ext);
}

const template = document.createElement("template");
template.innerHTML = `
  <style>
    :host {
      display: block;
      max-width: var(--max-width, 180px);
      max-height: var(--max-height, 180px);

      --green: rgba(91, 231, 10, 0.942);
      --red: rgba(193, 60, 30, 0.942);
      --yellow: rgba(231, 209, 10, 0.942);
      --white: rgba(244, 244, 242, 0.942);
      --blue: rgba(111, 0, 255, 0.94);
      --border_color: 0.3px solid rgb(112, 110, 112);
      --background_placeholder: linear-gradient(-10deg, var(--blue), var(--white));
      --initial_color: rgba(248, 250, 250, 0.7);
      --glass: rgba(0, 0, 0, 0.105);
      --inside_shadow: 10px 10px 10px rgba(20, 19, 19, 0.442) inset;
      --outside_shadow: 0 0 10px rgba(54, 61, 62, 0.595);
      --background_btn: rgb(122, 115, 115);
      --color_btn: rgb(213, 204, 204);
      --shadow_btn: -3px -3px 20px rgba(27, 27, 27, 0.8);
    }

    *,
    ::before,
    ::after {
      user-select: none;
      box-sizing: border-box;
    }

    #container.none { border: 3px solid var(--inside_shadow); }
    #container.active { border: 3px solid var(--green); }
    #container.inactive { border: 3px solid var(--red); }
    #container.pending { border: 3px solid var(--yellow); }

    #tmp_container {
      display: block;
      padding: 5px;
      width: var(--max-width, 180px);
      height: var(--max-height, 180px);
      overflow: visible;
    }

    #placeholder {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      overflow: hidden;
      background: var(--background_placeholder);
      z-index: -1;
    }

    #placeholder label {
      font-size: clamp(1rem, var(--max-width, 180px), 2.5rem);
      color: var(--initial_color);
    }

    #container {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: var(--border_color);
      background-color: var(--glass);
      box-shadow: var(--inside_shadow), var(--outside_shadow);
      overflow: hidden;
      touch-action: none;
    }

    #container:hover { cursor: pointer; }
    #container:hover:active { cursor: grab; }

    #camera-btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      top: -50px;
      left: calc(var(--max-width, 180px) - 50px);
      width: 38px;
      height: 38px;
      padding: 0;
      border: none;
      background-color: var(--background_btn);
      color: var(--color_btn);
      border-radius: 50%;
      opacity: 0.7;
      box-shadow: var(--shadow_btn);
      cursor: pointer;
    }

    #camera-btn img {
      width: 20px;
      height: 20px;
    }

    #container img {
      position: relative;
      z-index: -1;
    }
  </style>

  <div id="tmp_container">
    <div id="container" class="none">
      <div id="placeholder">
        <label id="initial-label"></label>
      </div>
      <img id="pic" alt="Profile" style="display:none" />
    </div>
    <input id="fileInput" type="file" hidden />
    <button id="camera-btn" type="button" style="display:none" aria-label="Changer la photo">
      <img id="camera-icon" alt="" />
    </button>
  </div>
`;

export class PictureContainer extends HTMLElement {
  static get observedAttributes() {
    return ["initial", "camera-enabled", "activity-state", "placeholder", "image-url", "x", "y", "zoom"];
  }

  MIN_ZOOM = 0.1;
  MAX_ZOOM = 3;
  ZOOM_STEP = 0.01;

  #infoPic = { zoom: 0.5, top: 0, left: 0 };
  #grapped = false;
  #src = "";
  #placeholder = true;
  #isCameraEnabled = false;
  #activePointers = new Map();
  #pinchStartDistance = null;
  #pinchStartZoom = null;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.onUpdate = null;

    this.containerEl = this.shadowRoot.getElementById("container");
    this.placeholderEl = this.shadowRoot.getElementById("placeholder");
    this.labelEl = this.shadowRoot.getElementById("initial-label");
    this.imgEl = this.shadowRoot.getElementById("pic");
    this.fileInput = this.shadowRoot.getElementById("fileInput");
    this.cameraBtn = this.shadowRoot.getElementById("camera-btn");
    this.shadowRoot.getElementById("camera-icon").src = CAMERA_ICON_URL;

    this._onWheel = (e) => this.onMouseWheel(e);
    this._onPointerDown = (e) => this.onMouseDown(e);
    this._onPointerUp = (e) => this.onMouseUp(e);
    this._onPointerMove = (e) => this.onMouseMove(e);
    this._onPointerLeave = (e) => this.onMouseLeave(e);
    this._onDrop = (e) => this.onDrop(e);
    this._onDragOver = (e) => this.onDragOver(e);
    this._onFileChange = (e) => this.onFileChange(e);
    this._onImgClick = () =>
      this.dispatchEvent(new CustomEvent("pic-click", { bubbles: true, composed: true }));
    this._onCameraClick = () => this.openFile();
  }

  connectedCallback() {
    this.containerEl.addEventListener("wheel", this._onWheel, { passive: false });
    this.containerEl.addEventListener("pointerdown", this._onPointerDown);
    this.containerEl.addEventListener("pointerup", this._onPointerUp);
    this.containerEl.addEventListener("pointermove", this._onPointerMove);
    this.containerEl.addEventListener("pointerleave", this._onPointerLeave);
    this.containerEl.addEventListener("mouseleave", this._onPointerLeave);
    this.containerEl.addEventListener("drop", this._onDrop);
    this.containerEl.addEventListener("dragover", this._onDragOver);
    this.fileInput.addEventListener("change", this._onFileChange);
    this.imgEl.addEventListener("click", this._onImgClick);
    this.cameraBtn.addEventListener("click", this._onCameraClick);

    if (this.hasAttribute("initial")) this.initial = this.getAttribute("initial");
    if (this.hasAttribute("camera-enabled")) this.isCameraEnabled = true;
    if (this.hasAttribute("activity-state")) this.activityState = this.getAttribute("activity-state");
    if (this.hasAttribute("placeholder")) this.placeholder = this.getAttribute("placeholder") !== "false";
    if (this.hasAttribute("image-url")) this.src = this.getAttribute("image-url");
    if (this.hasAttribute("x") || this.hasAttribute("y") || this.hasAttribute("zoom")) {
      this.picInfo = {
        left: parseFloat(this.getAttribute("x")) || this.picInfo.left,
        top: parseFloat(this.getAttribute("y")) || this.picInfo.top,
        zoom: parseFloat(this.getAttribute("zoom")) || this.picInfo.zoom,
      };
    }

    this.updatePlaceholderVisibility();
    this.updateTransform();

    if (typeof this.onUpdate === "function") {
      this.onUpdate(this.picInfo);
    }
    this.dispatchEvent(
      new CustomEvent("liste-mise-a-jour", { detail: { data: this.picInfo }, bubbles: true })
    );
  }

  disconnectedCallback() {
    this.containerEl.removeEventListener("wheel", this._onWheel);
    this.containerEl.removeEventListener("pointerdown", this._onPointerDown);
    this.containerEl.removeEventListener("pointerup", this._onPointerUp);
    this.containerEl.removeEventListener("pointermove", this._onPointerMove);
    this.containerEl.removeEventListener("pointerleave", this._onPointerLeave);
    this.containerEl.removeEventListener("mouseleave", this._onPointerLeave);
    this.containerEl.removeEventListener("drop", this._onDrop);
    this.containerEl.removeEventListener("dragover", this._onDragOver);
    this.fileInput.removeEventListener("change", this._onFileChange);
    this.imgEl.removeEventListener("click", this._onImgClick);
    this.cameraBtn.removeEventListener("click", this._onCameraClick);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    switch (name) {
      case "initial":
        this.initial = newValue ?? "";
        break;
      case "camera-enabled":
        this.isCameraEnabled = newValue !== null;
        break;
      case "activity-state":
        this.activityState = newValue ?? "none";
        break;
      case "placeholder":
        this.placeholder = newValue !== "false";
        break;
      case "image-url":
        this.src = newValue ?? "";
        break;
      case "x":
        this.picInfo = { left: parseFloat(newValue) || 0 };
        break;
      case "y":
        this.picInfo = { top: parseFloat(newValue) || 0 };
        break;
      case "zoom":
        this.picInfo = { zoom: parseFloat(newValue) || this.MIN_ZOOM };
        break;
    }
  }

  // ---- Public API ----

  get initial() {
    return this.labelEl.textContent;
  }
  set initial(value) {
    this.labelEl.textContent = value ?? "";
  }

  get isCameraEnabled() {
    return this.#isCameraEnabled;
  }
  set isCameraEnabled(value) {
    this.#isCameraEnabled = !!value;
    this.cameraBtn.style.display = this.#isCameraEnabled ? "" : "none";
  }

  get activityState() {
    return this.containerEl.dataset.state || "none";
  }
  set activityState(value) {
    const state = value || "none";
    this.containerEl.classList.remove("none", "active", "inactive", "pending");
    this.containerEl.classList.add(state);
    this.containerEl.dataset.state = state;
  }

  get src() {
    return this.#src;
  }
  set src(value) {
    const url = value || "";
    if (url && isAnimatedImageUrl(url)) {
      console.warn(`picture-container: format animé non supporté pour "${url}", utilisez une image statique.`);
      return;
    }
    this.#src = url;
    this.imgEl.src = this.#src;
    this.placeholder = !this.#src;
    this.dispatchEvent(new CustomEvent("src-change", { detail: this.#src }));
  }

  get placeholder() {
    return this.#placeholder;
  }
  set placeholder(value) {
    this.#placeholder = !!value;
    this.updatePlaceholderVisibility();
    this.dispatchEvent(new CustomEvent("placeholder-change", { detail: this.#placeholder }));
  }

  get picInfo() {
    return { ...this.#infoPic };
  }
  set picInfo(value) {
    if (!value) return;
    this.#infoPic = { ...this.#infoPic, ...value };
    this.updateTransform();
  }

  updatePlaceholderVisibility() {
    this.placeholderEl.style.display = this.#placeholder ? "flex" : "none";
    this.imgEl.style.display = this.#placeholder ? "none" : "block";
  }

  openFile() {
    this.fileInput?.click();
  }

  onMouseWheel(e) {
    e.preventDefault();
    if (e.deltaY < 0) {
      this.#infoPic.zoom = Math.min(this.#infoPic.zoom + this.ZOOM_STEP, this.MAX_ZOOM);
    } else {
      this.#infoPic.zoom = Math.max(this.#infoPic.zoom - this.ZOOM_STEP, this.MIN_ZOOM);
    }
    this.updateTransform();
    this.clampToContainer();
  }

  onDragOver(event) {
    event.preventDefault();
  }

  onDrop(event) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) this.loadFile(file);
  }

  onMouseDown(e) {
    this.containerEl.setPointerCapture?.(e.pointerId);
    this.#activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.#activePointers.size === 2) {
      this.#grapped = false;
      this.#pinchStartDistance = this.#pointerDistance();
      this.#pinchStartZoom = this.#infoPic.zoom;
    } else {
      this.#grapped = true;
    }
  }

  onMouseMove(e) {
    e.preventDefault();
    if (!this.#activePointers.has(e.pointerId)) return;
    this.#activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.#activePointers.size === 2) {
      this.onPinchZoom();
      return;
    }

    if (!this.#grapped || !this.#src) return;
    this.#infoPic.left += e.movementX;
    this.#infoPic.top += e.movementY;
    this.updateTransform();
    this.clampToContainer();
  }

  onPinchZoom() {
    const distance = this.#pointerDistance();
    if (!distance || !this.#pinchStartDistance) return;

    const ratio = distance / this.#pinchStartDistance;
    this.#infoPic.zoom = Math.min(Math.max(this.#pinchStartZoom * ratio, this.MIN_ZOOM), this.MAX_ZOOM);
    this.updateTransform();
    this.clampToContainer();
  }

  #pointerDistance() {
    const points = [...this.#activePointers.values()];
    if (points.length < 2) return null;
    const [a, b] = points;
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  onMouseUp(e) {
    this.#activePointers.delete(e?.pointerId);
    if (this.#activePointers.size < 2) {
      this.#pinchStartDistance = null;
      this.#pinchStartZoom = null;
    }
    this.#grapped = this.#activePointers.size === 1;
  }

  onMouseLeave(e) {
    this.#activePointers.delete(e?.pointerId);
    this.#pinchStartDistance = null;
    this.#pinchStartZoom = null;
    this.#grapped = false;
  }

  loadFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.src = e.target?.result;
      this.placeholder = false;
      requestAnimationFrame(() => {
        this.updateTransform();
        this.clampToContainer();
      });
    };
    reader.readAsDataURL(file);
  }

  onFileChange(event) {
    const input = event.target;
    if (input.files && input.files[0]) {
      this.loadFile(input.files[0]);
    }
  }

  updateTransform() {
    this.imgEl.style.transform = `translate(${this.#infoPic.left}px, ${this.#infoPic.top}px) scale(${this.#infoPic.zoom})`;
    this.dispatchEvent(new CustomEvent("picinfo-change", { detail: this.picInfo }));
  }

  clampToContainer() {
    if (!this.containerEl || !this.imgEl) return;

    const contRect = this.containerEl.getBoundingClientRect();
    const imgRect = this.imgEl.getBoundingClientRect();

    let dx = 0;
    let dy = 0;

    if (imgRect.left > contRect.left) dx = contRect.left - imgRect.left;
    if (imgRect.right < contRect.right) dx = contRect.right - imgRect.right;
    if (imgRect.top > contRect.top) dy = contRect.top - imgRect.top;
    if (imgRect.bottom < contRect.bottom) dy = contRect.bottom - imgRect.bottom;

    if (dx !== 0 || dy !== 0) {
      this.#infoPic.left += dx;
      this.#infoPic.top += dy;
      this.updateTransform();
    }

    const imgW = imgRect.width;
    const imgH = imgRect.height;
    if (imgW < contRect.width || imgH < contRect.height) {
      this.#infoPic.left = 0;
      this.#infoPic.top = 0;
      this.updateTransform();
    }
  }
}

customElements.define("picture-container", PictureContainer);
