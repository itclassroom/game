const state = {
    placement: {},
    selectedId: null,
  };
  
  let drag = null;
  let blockClick = false;
  
  const $ = (id) => document.getElementById(id);
  
  function shuffle(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  
  function itemById(id) {
    return ITEMS.find((item) => item.id === id);
  }
  
  function announce(text) {
    const live = $("live");
    live.textContent = "";
    window.setTimeout(() => {
      live.textContent = text;
    }, 30);
  }
  
  function cardLabel(item) {
    const zone = state.placement[item.id];
    if (zone === "pool") return `${item.name}，未分類`;
    return `${item.name}，已放在${ZONE_LABEL[zone]}`;
  }
  
  function updateCards() {
    document.querySelectorAll(".card").forEach((card) => {
      const item = itemById(card.dataset.id);
      const selected = state.selectedId === item.id;
      card.classList.toggle("is-selected", selected);
      card.setAttribute("aria-pressed", String(selected));
      card.setAttribute("aria-label", cardLabel(item));
    });
  }
  
  function updateEmpty() {
    ["pool", "living", "nonliving"].forEach((zone) => {
      const el = $(zone);
      el.classList.toggle("is-empty", el.children.length === 0);
    });
  }
  
  function updateProgress() {
    const placed = ITEMS.filter((item) => state.placement[item.id] !== "pool").length;
    const total = ITEMS.length;
    $("progress-text").textContent = `已分類 ${placed} / ${total}`;
    $("progress-bar").style.width = `${(placed / total) * 100}%`;
    $("count-pool").textContent = String(total - placed);
    $("count-living").textContent = String(
      ITEMS.filter((item) => state.placement[item.id] === "living").length
    );
    $("count-nonliving").textContent = String(
      ITEMS.filter((item) => state.placement[item.id] === "nonliving").length
    );
    updateEmpty();
  }
  
  function updateSelection() {
    const bar = $("selected-bar");
    const item = state.selectedId ? itemById(state.selectedId) : null;
    document.body.classList.toggle("has-selection", Boolean(item));
    if (!item) {
      bar.hidden = true;
      updateCards();
      return;
    }
    bar.hidden = false;
    $("selected-art").src = item.file;
    const zone = state.placement[item.id];
    $("place-living").disabled = zone === "living";
    $("place-nonliving").disabled = zone === "nonliving";
    $("place-pool").hidden = zone === "pool";
    updateCards();
  }
  
  function place(id, zone) {
    const item = itemById(id);
    state.placement[id] = zone;
    $(zone).appendChild(document.querySelector(`.card[data-id="${id}"]`));
    state.selectedId = null;
    updateProgress();
    updateSelection();
    announce(`已把${item.name}放到${ZONE_LABEL[zone]}`);
  }
  
  function clearBoard() {
    ["pool", "living", "nonliving"].forEach((zone) => {
      $(zone).replaceChildren();
    });
  }
  
  function createCard(item) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card";
    button.dataset.id = item.id;
  
    const art = document.createElement("span");
    art.className = "art";
    const img = document.createElement("img");
    img.src = item.file;
    img.alt = "";
    img.width = 200;
    img.height = 200;
    img.draggable = false;
    art.appendChild(img);
    button.append(art);
    return button;
  }
  
  function buildBoard() {
    state.selectedId = null;
    state.placement = {};
    clearBoard();
  
    shuffle(ITEMS).forEach((item) => {
      state.placement[item.id] = "pool";
      $("pool").appendChild(createCard(item));
    });
    updateProgress();
    updateSelection();
  }
  
  function onCardClick(id) {
    if (blockClick) return;
    state.selectedId = state.selectedId === id ? null : id;
    updateSelection();
  }
  
  function zoneAt(x, y) {
    const ghost = document.querySelector(".card.ghost");
    if (ghost) ghost.hidden = true;
    const el = document.elementFromPoint(x, y);
    if (ghost) ghost.hidden = false;
    const zone = el && el.closest("[data-zone]");
    return zone ? zone.dataset.zone : null;
  }
  
  function highlightZone(zone) {
    document.querySelectorAll("[data-zone]").forEach((el) => {
      el.classList.toggle("is-target", el.dataset.zone === zone);
    });
  }
  
  function endDrag() {
    if (drag && drag.ghost) drag.ghost.remove();
    document.querySelectorAll(".card.is-dragging").forEach((card) => {
      card.classList.remove("is-dragging");
    });
    highlightZone(null);
  }
  
  document.addEventListener("click", (event) => {
    const card = event.target.closest(".card");
    if (!card) return;
    onCardClick(card.dataset.id);
  });
  
  document.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const card = event.target.closest(".card");
    if (!card) return;
    drag = {
      id: card.dataset.id,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      ghost: null,
    };
  });
  
  document.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 8) return;
      drag.moved = true;
      const card = document.querySelector(`.card[data-id="${drag.id}"]`);
      const ghost = card.cloneNode(true);
      ghost.classList.add("ghost");
      ghost.classList.remove("is-selected");
      card.classList.add("is-dragging");
      document.body.appendChild(ghost);
      drag.ghost = ghost;
    }
    drag.ghost.style.left = `${event.clientX}px`;
    drag.ghost.style.top = `${event.clientY}px`;
    highlightZone(zoneAt(event.clientX, event.clientY));
  });
  
  document.addEventListener("pointerup", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { id, moved } = drag;
    const zone = moved ? zoneAt(event.clientX, event.clientY) : null;
    endDrag();
    drag = null;
    if (moved) {
      blockClick = true;
      queueMicrotask(() => {
        blockClick = false;
      });
      if (zone) place(id, zone);
    }
  });
  
  document.addEventListener("pointercancel", () => {
    if (!drag) return;
    endDrag();
    drag = null;
  });
  
  $("start-btn").addEventListener("click", () => {
    $("welcome").hidden = true;
    $("sheet").inert = false;
    $("pool").focus({ preventScroll: true });
  });
  
  $("place-living").addEventListener("click", () => {
    if (state.selectedId) place(state.selectedId, "living");
  });
  
  $("place-nonliving").addEventListener("click", () => {
    if (state.selectedId) place(state.selectedId, "nonliving");
  });
  
  $("place-pool").addEventListener("click", () => {
    if (state.selectedId) place(state.selectedId, "pool");
  });
  
  $("reset-btn").addEventListener("click", () => {
    buildBoard();
    announce("已重新分類");
  });
  
  buildBoard();
  $("start-btn").focus();
  