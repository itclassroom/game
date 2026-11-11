const state = {
    placement: {},
    selectedId: null,
  };
  
  let drag = null;
  let suppressClick = null;
  
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
    button.draggable = false;
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

  function rememberClick(x, y, pointerType) {
    suppressClick = { x, y, pointerType, at: Date.now(), until: Date.now() + 280 };
  }

  function kickScroll() {
    if (!drag || drag.scrollQueued) return;
    drag.scrollQueued = true;
    requestAnimationFrame(() => {
      if (drag) drag.scrollQueued = false;
      if (!drag || !drag.moved) return;
      const margin = 56;
      const y = drag.lastY;
      let dy = 0;
      if (y < margin) dy = -Math.max(6, Math.round((margin - y) / 5));
      else if (y > window.innerHeight - margin) dy = Math.max(6, Math.round((y - (window.innerHeight - margin)) / 5));
      if (!dy) return;
      const before = window.scrollY;
      window.scrollBy(0, dy);
      if (window.scrollY === before) return;
      highlightZone(zoneAt(drag.lastX, drag.lastY));
      kickScroll();
    });
  }

  function updateDrag(x, y) {
    if (!drag) return;
    const dx = x - drag.x;
    const dy = y - drag.y;
    if (!drag.moved) {
      const slop = drag.pointerType === "mouse" ? 8 : 12;
      if (Math.hypot(dx, dy) < slop) return;
      drag.moved = true;
      const card = document.querySelector(`.card[data-id="${drag.id}"]`);
      const ghost = card.cloneNode(true);
      ghost.classList.add("ghost");
      ghost.classList.remove("is-selected");
      ghost.setAttribute("aria-hidden", "true");
      ghost.tabIndex = -1;
      ghost.style.left = `${x}px`;
      ghost.style.top = `${y}px`;
      card.classList.add("is-dragging");
      document.body.appendChild(ghost);
      drag.ghost = ghost;
    }
    drag.lastX = x;
    drag.lastY = y;
    drag.ghost.style.left = `${x}px`;
    drag.ghost.style.top = `${y}px`;
    highlightZone(zoneAt(x, y));
    kickScroll();
  }

  function finishDrag(x, y) {
    if (!drag) return;
    const { id, moved, pointerType } = drag;
    const zone = moved ? zoneAt(x, y) : null;
    endDrag();
    drag = null;
    if (!moved) {
      if (pointerType !== "mouse") {
        rememberClick(x, y, pointerType);
        onCardClick(id);
      }
      return;
    }
    rememberClick(x, y, pointerType);
    if (zone) place(id, zone);
  }

  function touchFrom(event) {
    if (!drag || drag.pointerType === "mouse") return null;
    const touches = event.changedTouches;
    if (!touches || !touches.length) return null;
    if (drag.touchId == null) return touches[0];
    return [...touches].find((touch) => touch.identifier === drag.touchId) || null;
  }
  
  document.addEventListener("click", (event) => {
    if (suppressClick && Date.now() <= suppressClick.until) {
      const elapsed = Date.now() - suppressClick.at;
      const near = Math.hypot(event.clientX - suppressClick.x, event.clientY - suppressClick.y) < 40;
      const bogus = event.clientX === 0 && event.clientY === 0 && event.target.closest(".card");
      const onCard = event.target.closest(".card");
      const quickTouchCard = onCard && suppressClick.pointerType !== "mouse" && elapsed < 450;
      if (near || bogus || quickTouchCard) {
        suppressClick = null;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }
    const card = event.target.closest(".card");
    if (!card || card.classList.contains("ghost")) return;
    onCardClick(card.dataset.id);
  }, true);
  
  document.addEventListener("pointerdown", (event) => {
    if (event.isPrimary === false || event.button !== 0) return;
    const card = event.target.closest(".card");
    if (!card || card.classList.contains("ghost") || drag) return;
    if (event.pointerType !== "mouse" && event.cancelable) event.preventDefault();
    drag = {
      id: card.dataset.id,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      touchId: null,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
      ghost: null,
      scrollQueued: false,
    };
    try {
      card.setPointerCapture(event.pointerId);
    } catch (error) {
      // Untrusted or already-ended pointers cannot be captured.
    }
  });
  
  document.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (drag.pointerType !== "mouse" && event.cancelable) event.preventDefault();
    updateDrag(event.clientX, event.clientY);
  });
  
  document.addEventListener("pointerup", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    finishDrag(event.clientX, event.clientY);
  });
  
  document.addEventListener("pointercancel", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    endDrag();
    drag = null;
  });

  document.addEventListener("touchstart", (event) => {
    const card = event.target.closest(".card");
    if (!card || card.classList.contains("ghost")) return;
    if (event.cancelable) event.preventDefault();
    const touch = event.changedTouches[0];
    if (!touch) return;
    if (drag) {
      drag.touchId = touch.identifier;
      return;
    }
    drag = {
      id: card.dataset.id,
      pointerId: null,
      pointerType: "touch",
      touchId: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
      lastX: touch.clientX,
      lastY: touch.clientY,
      moved: false,
      ghost: null,
      scrollQueued: false,
    };
  }, { passive: false });

  document.addEventListener("touchmove", (event) => {
    const touch = touchFrom(event);
    if (!touch) return;
    if (event.cancelable) event.preventDefault();
    updateDrag(touch.clientX, touch.clientY);
  }, { passive: false });

  document.addEventListener("touchend", (event) => {
    const touch = touchFrom(event);
    if (!touch) return;
    finishDrag(touch.clientX, touch.clientY);
  });

  document.addEventListener("touchcancel", (event) => {
    if (!touchFrom(event)) return;
    endDrag();
    drag = null;
  });

  document.addEventListener("contextmenu", (event) => {
    if (event.target.closest(".card")) event.preventDefault();
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
  
