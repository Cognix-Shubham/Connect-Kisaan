
/* =========================================================
   KISANCONNECT — Interactive Farmer Marketplace
   Vanilla JavaScript | No external libraries required
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];

  const STORAGE = {
    favorites: "kisanconnect_favorites",
    listings: "kisanconnect_listings"
  };

  const readStorage = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  };

  const saveStorage = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  let favorites = readStorage(STORAGE.favorites, []);
  let newListings = readStorage(STORAGE.listings, []);
  let activeCategory = "all";
  let favoritesOnly = false;
  let sortMode = "default";

  const cropGrid =
    $(".crop-grid") ||
    $(".crops-grid") ||
    $(".marketplace-grid") ||
    $(".products-grid") ||
    $("#cropGrid") ||
    $(".crop-list");

  const searchForm =
    $(".marketplace-search form") ||
    $("#searchForm") ||
    $("form");

  // ---------- Dynamic styles ----------
  const extraCSS = document.createElement("style");
  extraCSS.textContent = `
    .kc-toolbar {
      display:flex; flex-wrap:wrap; gap:12px;
      align-items:center; margin:20px 0;
    }
    .kc-toolbar input,.kc-toolbar select,.kc-modal input,
    .kc-modal select,.kc-modal textarea {
      padding:12px 14px; border:1px solid #d5e2d6;
      border-radius:10px; font:inherit; min-width:0;
      background:#fff; color:#173b25; width:100%;
      box-sizing:border-box;
    }
    .kc-toolbar .kc-search {flex:2 1 220px;}
    .kc-toolbar .kc-location {flex:1 1 150px;}
    .kc-btn {
      border:0; border-radius:10px; padding:12px 16px;
      background:#176b3a; color:white; font:inherit;
      font-weight:700; cursor:pointer; transition:.2s;
    }
    .kc-btn:hover {filter:brightness(1.1); transform:translateY(-1px);}
    .kc-btn.kc-secondary {background:#eaf5ec;color:#176b3a;}
    .kc-card-actions {display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;}
    .kc-favorite {border:1px solid #d5e2d6;background:#fff;
      border-radius:10px;padding:9px 12px;cursor:pointer;font-size:17px;}
    .kc-favorite.active {background:#fff0f0;color:#d92845;}
    .kc-hidden {display:none !important;}
    .kc-toast-wrap {position:fixed;right:18px;bottom:18px;z-index:99999;
      display:grid;gap:10px;width:min(350px,calc(100vw - 36px));}
    .kc-toast {background:#173b25;color:#fff;padding:14px 17px;
      border-radius:12px;box-shadow:0 8px 30px #0002;
      animation:kcEnter .25s ease;}
    @keyframes kcEnter {from{opacity:0;transform:translateY(8px)}
      to{opacity:1;transform:translateY(0)}}
    .kc-modal-backdrop {position:fixed;inset:0;background:#0b2119b8;
      display:grid;place-items:center;padding:18px;z-index:99998;}
    .kc-modal {background:white;color:#173b25;width:min(500px,100%);
      max-height:90vh;overflow:auto;border-radius:18px;padding:24px;
      box-sizing:border-box;box-shadow:0 20px 60px #0003;}
    .kc-modal h2 {margin-top:0;}
    .kc-modal form {display:grid;gap:12px;}
    .kc-modal label {display:grid;gap:6px;font-weight:600;}
    .kc-modal .kc-modal-actions {display:flex;gap:10px;flex-wrap:wrap;}
    .kc-empty {padding:24px;text-align:center;color:#54705b;
      background:#f4f9f4;border-radius:14px;grid-column:1/-1;}
    .kc-status {font-size:13px;color:#54705b;margin-top:8px;}
    .kc-price-selected {outline:2px solid #27884b;background:#effaf1 !important;}
    @media(max-width:600px) {
      .kc-toolbar > * {flex:1 1 100% !important;}
      .kc-modal {padding:18px;}
    }
  `;
  document.head.appendChild(extraCSS);

  // ---------- Notifications ----------
  const toastWrap = document.createElement("div");
  toastWrap.className = "kc-toast-wrap";
  toastWrap.setAttribute("aria-live", "polite");
  document.body.appendChild(toastWrap);

  function toast(message) {
    const item = document.createElement("div");
    item.className = "kc-toast";
    item.textContent = message;
    toastWrap.appendChild(item);

    setTimeout(() => item.remove(), 3200);
  }

  // ---------- Add marketplace controls ----------
  const toolbar = document.createElement("section");
  toolbar.className = "kc-toolbar";
  toolbar.setAttribute("aria-label", "Marketplace controls");

  toolbar.innerHTML = `
    <input class="kc-search" id="kcSearch"
      type="search" placeholder="🔍 Search crops, farmers or locations..."
      aria-label="Search crops, farmers or locations">
    <input class="kc-location" id="kcLocation"
      type="search" placeholder="📍 Filter by location"
      aria-label="Filter by location">
    <select id="kcCategory" aria-label="Crop category">
      <option value="all">All categories</option>
      <option value="grains">Grains</option>
      <option value="vegetables">Vegetables</option>
      <option value="fruits">Fruits</option>
    </select>
    <select id="kcSort" aria-label="Sort crops">
      <option value="default">Recommended order</option>
      <option value="low">Price: low to high</option>
      <option value="high">Price: high to low</option>
      <option value="name">Name: A to Z</option>
    </select>
    <button class="kc-btn kc-secondary" id="kcFavorites">
      ❤️ Favorites only
    </button>
    <button class="kc-btn" id="kcAddCrop">＋ Add crop</button>
  `;

  const marketHeading = $$("h1,h2,h3").find(el =>
    /marketplace|fresh crops|available crops|crops/i.test(el.textContent)
  );

  if (cropGrid) {
    cropGrid.parentNode.insertBefore(toolbar, cropGrid);
  } else if (marketHeading) {
    marketHeading.insertAdjacentElement("afterend", toolbar);
  } else {
    document.body.prepend(toolbar);
  }

  // ---------- Identify existing crop cards ----------
  const findCropCards = () => {
    if (!cropGrid) return [];

    return $$(".crop-card, .product-card, .market-card, [data-crop-card]", cropGrid);
  };

  const originalCards = findCropCards();

  // Build sample cards if the original page has no recognizable crop cards.
  // Edit these demo records to match your own project.
  const demoCrops = [
    {
      id: "demo-wheat",
      name: "Premium Wheat",
      category: "grains",
      price: 2500,
      unit: "quintal",
      location: "Prayagraj",
      farmer: "Demo Farmer",
      emoji: "🌾",
      quantity: 20
    },
    {
      id: "demo-rice",
      name: "Fresh Rice",
      category: "grains",
      price: 4200,
      unit: "quintal",
      location: "Lucknow",
      farmer: "Demo Farmer",
      emoji: "🌾",
      quantity: 15
    },
    {
      id: "demo-potato",
      name: "Farm Potatoes",
      category: "vegetables",
      price: 1200,
      unit: "quintal",
      location: "Kanpur",
      farmer: "Demo Farmer",
      emoji: "🥔",
      quantity: 30
    },
    {
      id: "demo-tomato",
      name: "Fresh Tomatoes",
      category: "vegetables",
      price: 1800,
      unit: "quintal",
      location: "Prayagraj",
      farmer: "Demo Farmer",
      emoji: "🍅",
      quantity: 10
    },
    {
      id: "demo-mango",
      name: "Seasonal Mangoes",
      category: "fruits",
      price: 3500,
      unit: "quintal",
      location: "Lucknow",
      farmer: "Demo Farmer",
      emoji: "🥭",
      quantity: 8
    }
  ];

  // Use your existing crop cards when they are found.
  // Otherwise, generate interactive demo cards.
  let records = [];

  function textOf(el, selectors) {
    for (const selector of selectors) {
      const found = $(selector, el);
      if (found && found.textContent.trim()) return found.textContent.trim();
    }
    return el.textContent.trim().replace(/\s+/g, " ");
  }

  function numberFromText(text) {
    const match = text.replace(/,/g, "").match(/₹\s*(\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : null;
  }

  function normalizeExistingCards() {
    return originalCards.map((card, index) => {
      const name = textOf(card, [
        ".crop-name", ".product-name", ".card-title", "h2", "h3", "h4"
      ]) || `Crop ${index + 1}`;

      const priceText = textOf(card, [
        ".crop-price", ".product-price", ".price", "[data-price]"
      ]);

      const categoryText = card.dataset.category ||
        card.querySelector("[data-category]")?.dataset.category ||
        card.textContent;

      const lower = categoryText.toLowerCase();
      let category = "grains";
      if (/vegetable|tomato|potato|onion|vegetable|सब्जी/.test(lower)) {
        category = "vegetables";
      } else if (/fruit|mango|apple|banana|फल/.test(lower)) {
        category = "fruits";
      }

      const location = textOf(card, [
        ".crop-location", ".location", ".farmer-location", "[data-location]"
      ]);

      const farmer = textOf(card, [
        ".farmer-name", ".seller-name", ".profile-name"
      ]);

      const price = numberFromText(priceText);

      const id = card.dataset.id || `existing-crop-${index}`;
      card.dataset.kcId = id;

      return {
        id,
        name,
        category,
        price,
        location,
        farmer,
        element: card,
        custom: false
      };
    });
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function renderNewCropCard(crop) {
    const card = document.createElement("article");
    card.className = "crop-card";
    card.dataset.kcId = crop.id;
    card.dataset.category = crop.category;

    card.innerHTML = `
      <div style="font-size:40px" aria-hidden="true">${crop.emoji || "🌱"}</div>
      <h3 class="crop-name">${escapeHTML(crop.name)}</h3>
      <p class="crop-price">₹${Number(crop.price).toLocaleString("en-IN")}
        <span>/ ${escapeHTML(crop.unit || "quintal")}</span>
      </p>
      <p>📍 ${escapeHTML(crop.location)}</p>
      <p>👨‍🌾 ${escapeHTML(crop.farmer)}</p>
      <p>Available quantity: ${Number(crop.quantity)} quintal</p>
      <div class="kc-card-actions">
        <button class="kc-btn kc-contact" type="button">Contact farmer</button>
      </div>
    `;

    cropGrid.appendChild(card);
    return card;
  }

  if (originalCards.length) {
    records = normalizeExistingCards();
  } else {
    // If there is no crop grid, create a simple one for the demo.
    if (!cropGrid) {
      const section = document.createElement("section");
      section.style.cssText = "max-width:1150px;margin:24px auto;padding:0 18px";
      section.innerHTML = `
        <h2>🌱 Available Crops</h2>
        <div class="crop-grid" id="kcGeneratedGrid"
          style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px">
        </div>
      `;
      toolbar.insertAdjacentElement("afterend", section);
    }

    const activeGrid = cropGrid || $("#kcGeneratedGrid");

    demoCrops.forEach(crop => {
      const card = renderNewCropCard(crop);
      // renderNewCropCard uses cropGrid; fallback to activeGrid if needed.
      if (activeGrid && card.parentNode !== activeGrid) {
        activeGrid.appendChild(card);
      }
    });

    records = demoCrops.map(crop => ({
      ...crop,
      element: $(`[data-kc-id="${crop.id}"]`) ||
        $$("[data-kc-id]").find(el => el.dataset.kcId === crop.id),
      custom: true
    }));
  }

  function allCards() {
    return records.map(record => {
      if (!record.element) {
        record.element = $$("[data-kc-id]").find(el => el.dataset.kcId === record.id);
      }
      return record;
    });
  }

  // ---------- Favorites ----------
  function addFavoriteButton(record) {
    const card = record.element;
    if (!card || $(".kc-favorite", card)) return;

    const actions = $(".kc-card-actions", card) || card;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "kc-favorite";
    button.dataset.favoriteId = record.id;
    button.setAttribute("aria-label", "Toggle favorite");

    actions.appendChild(button);
    updateFavoriteButton(button);
  }

  function updateFavoriteButton(button) {
    const active = favorites.includes(button.dataset.favoriteId);
    button.classList.toggle("active", active);
    button.textContent = active ? "❤️ Saved" : "♡ Save";
    button.setAttribute("aria-pressed", String(active));
  }

  allCards().forEach(addFavoriteButton);

  document.addEventListener("click", event => {
    const button = event.target.closest(".kc-favorite");
    if (!button) return;

    const id = button.dataset.favoriteId;
    favorites = favorites.includes(id)
      ? favorites.filter(item => item !== id)
      : [...favorites, id];

    saveStorage(STORAGE.favorites, favorites);
    updateFavoriteButton(button);
    filterAndSort();
    toast(favorites.includes(id) ? "❤️ Crop added to favorites!" : "Favorite removed.");
  });

  // ---------- Search, category filter, location and sorting ----------
  const searchInput = $("#kcSearch");
  const locationInput = $("#kcLocation");
  const categorySelect = $("#kcCategory");
  const sortSelect = $("#kcSort");
  const favoritesButton = $("#kcFavorites");

  function recordMatches(record) {
    const search = searchInput.value.trim().toLowerCase();
    const location = locationInput.value.trim().toLowerCase();

    const searchable = [
      record.name, record.farmer, record.location,
      record.category, record.element?.textContent || ""
    ].join(" ").toLowerCase();

    return (
      (!search || searchable.includes(search)) &&
      (!location || String(record.location || "").toLowerCase().includes(location)) &&
      (activeCategory === "all" || record.category === activeCategory) &&
      (!favoritesOnly || favorites.includes(record.id))
    );
  }

  function filterAndSort() {
    let visible = allCards().filter(record => recordMatches(record));

    if (sortMode === "low") {
      visible.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    } else if (sortMode === "high") {
      visible.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
    } else if (sortMode === "name") {
      visible.sort((a, b) => a.name.localeCompare(b.name));
    }

    allCards().forEach(record => {
      if (record.element) record.element.classList.add("kc-hidden");
    });

    visible.forEach(record => {
      if (!record.element) return;
      record.element.classList.remove("kc-hidden");

      if (sortMode !== "default" && cropGrid) {
        cropGrid.appendChild(record.element);
      }
    });

    let empty = $("#kcEmptyState");
    if (!empty && cropGrid) {
      empty = document.createElement("div");
      empty.id = "kcEmptyState";
      empty.className = "kc-empty kc-hidden";
      empty.textContent = "No crops found. Try another search or category.";
      cropGrid.appendChild(empty);
    }

    if (empty) empty.classList.toggle("kc-hidden", visible.length !== 0);
  }

  searchInput.addEventListener("input", filterAndSort);
  locationInput.addEventListener("input", filterAndSort);

  categorySelect.addEventListener("change", () => {
    activeCategory = categorySelect.value;
    filterAndSort();
  });

  sortSelect.addEventListener("change", () => {
    sortMode = sortSelect.value;
    filterAndSort();
  });

  favoritesButton.addEventListener("click", () => {
    favoritesOnly = !favoritesOnly;
    favoritesButton.textContent = favoritesOnly
      ? "🌾 Show all crops"
      : "❤️ Favorites only";
    favoritesButton.setAttribute("aria-pressed", String(favoritesOnly));
    filterAndSort();
  });

  // Make existing category links interactive when their labels match.
  $$("a, button").forEach(button => {
    const label = button.textContent.trim().toLowerCase();
    if (/^all crops$|^all$/.test(label)) {
      button.addEventListener("click", event => {
        if (button.tagName === "A") event.preventDefault();
        activeCategory = "all";
        categorySelect.value = "all";
        filterAndSort();
      });
    } else if (/grains|cereals/.test(label)) {
      button.addEventListener("click", () => {
        activeCategory = "grains";
        categorySelect.value = "grains";
        filterAndSort();
      });
    } else if (/vegetables/.test(label)) {
      button.addEventListener("click", () => {
        activeCategory = "vegetables";
        categorySelect.value = "vegetables";
        filterAndSort();
      });
    } else if (/fruits/.test(label)) {
      button.addEventListener("click", () => {
        activeCategory = "fruits";
        categorySelect.value = "fruits";
        filterAndSort();
      });
    }
  });

  filterAndSort();

  // ---------- Add a new crop listing ----------
  function openModal(title, formMarkup, onSubmit) {
    const backdrop = document.createElement("div");
    backdrop.className = "kc-modal-backdrop";
    backdrop.innerHTML = `
      <section class="kc-modal" role="dialog" aria-modal="true"
        aria-label="${escapeHTML(title)}">
        <h2>${escapeHTML(title)}</h2>
        ${formMarkup}
      </section>
    `;

    document.body.appendChild(backdrop);
    const form = $("form", backdrop);

    backdrop.addEventListener("click", event => {
      if (event.target === backdrop) backdrop.remove();
    });

    const cancel = $(".kc-cancel", backdrop);
    if (cancel) cancel.addEventListener("click", () => backdrop.remove());

    form.addEventListener("submit", event => {
      event.preventDefault();
      onSubmit(new FormData(form), backdrop);
    });

    const firstInput = $("input", form);
    if (firstInput) firstInput.focus();
  }

  $("#kcAddCrop").addEventListener("click", () => {
    openModal("🌱 Add a crop listing", `
      <form id="kcCropForm">
        <label>Crop name
          <input name="name" required maxlength="60" placeholder="e.g. Premium Wheat">
        </label>
        <label>Category
          <select name="category" required>
            <option value="grains">Grains</option>
            <option value="vegetables">Vegetables</option>
            <option value="fruits">Fruits</option>
          </select>
        </label>
        <label>Price per quintal (₹)
          <input name="price" type="number" min="1" max="10000000"
            required placeholder="e.g. 2500">
        </label>
        <label>Quantity (quintals)
          <input name="quantity" type="number" min="1" max="1000000"
            required placeholder="e.g. 20">
        </label>
        <label>Location
          <input name="location" required maxlength="80" placeholder="e.g. Prayagraj">
        </label>
        <label>Farmer name
          <input name="farmer" required maxlength="80" placeholder="Your name">
        </label>
        <div class="kc-modal-actions">
          <button class="kc-btn" type="submit">Publish listing</button>
          <button class="kc-btn kc-secondary kc-cancel" type="button">Cancel</button>
        </div>
        <p class="kc-status">Demo listing: saved only in this browser.</p>
      </form>
    `, (data, backdrop) => {
      const name = String(data.get("name") || "").trim();
      const location = String(data.get("location") || "").trim();
      const farmer = String(data.get("farmer") || "").trim();
      const price = Number(data.get("price"));
      const quantity = Number(data.get("quantity"));
      const category = String(data.get("category"));

      if (!name || !location || !farmer ||
          !Number.isFinite(price) || price <= 0 ||
          !Number.isFinite(quantity) || quantity <= 0) {
        toast("Please enter valid crop details.");
        return;
      }

      const crop = {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name, category, price, quantity, location, farmer,
        unit: "quintal",
        emoji: category === "fruits" ? "🥭" :
          category === "vegetables" ? "🥬" : "🌾"
      };

      if (!cropGrid) {
        toast("Crop grid not found. Please check your HTML.");
        return;
      }

      const card = renderNewCropCard(crop);
      crop.element = card;
      crop.custom = true;

      records.push(crop);
      newListings.push({
        id: crop.id,
        name, category, price, quantity, location, farmer,
        unit: crop.unit, emoji: crop.emoji
      });
      saveStorage(STORAGE.listings, newListings);

      addFavoriteButton(crop);
      backdrop.remove();
      filterAndSort();
      toast("✅ Crop listing added successfully!");
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  // ---------- Restore previously saved user listings ----------
  // The list is restored on reload only if this page has a crop grid.
  // Avoid duplicates when the script is accidentally included twice.
  if (cropGrid) {
    const knownIds = new Set(records.map(record => record.id));

    newListings.forEach(crop => {
      if (knownIds.has(crop.id)) return;

      const card = renderNewCropCard(crop);
      const restored = { ...crop, element: card, custom: true };
      records.push(restored);
      addFavoriteButton(restored);
    });
  }

  // ---------- Contact farmer action ----------
  document.addEventListener("click", event => {
    const button = event.target.closest(".kc-contact, .contact-farmer, [data-contact-farmer]");
    if (!button) return;

    const card = button.closest("[data-kc-id]");
    const record = records.find(item =>
      item.id === card?.dataset.kcId
    );

    if (!record) {
      toast("Farmer contact details are not connected yet.");
      return;
    }

    // This is a demo contact action: there is no real phone number
    // in the sample listing, so we do not pretend a call was made.
    toast(`Contact action selected for ${record.farmer || "this farmer"}. Add a verified phone number to enable calling.`);
  });

  // ---------- Price comparison table interaction ----------
  $$(".price-table tr, table tbody tr").forEach(row => {
    row.tabIndex = 0;
    row.style.cursor = "pointer";

    const selectRow = () => {
      const table = row.closest("table");
      if (table) {
        $$("tr", table).forEach(other => other.classList.remove("kc-price-selected"));
      }
      row.classList.add("kc-price-selected");
      const cropName = row.cells?.[0]?.textContent.trim() || "Selected market";
      toast(`📊 Comparing prices for: ${cropName}`);
    };

    row.addEventListener("click", selectRow);
    row.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectRow();
      }
    });
  });

  // ---------- Demo navigation and form feedback ----------
  if (searchForm) {
    searchForm.addEventListener("submit", event => {
      // Prevent accidental page reload for a demo search form.
      event.preventDefault();
      const field = $("input[type='search'], input[type='text']", searchForm);
      if (field) searchInput.value = field.value;
      filterAndSort();
      toast("🔎 Search results updated.");
    });
  }

  // Make local anchor navigation smooth.
  $$('a[href^="#"]').forEach(link => {
    link.addEventListener("click", event => {
      const target = $(link.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  // ---------- Welcome message ----------
  console.info("🌾 KisanConnect JavaScript loaded successfully!");
  toast("🌱 Welcome to KisanConnect! Explore the marketplace.");
});
