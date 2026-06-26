import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, updateDoc, doc, query, where, getDocs } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyCXSNe9nwJndCLVwVGZYbP_1sOkq5-K_40",
    authDomain: "myorder1-login.firebaseapp.com",
    projectId: "myorder1-login",
    storageBucket: "myorder1-login.firebasestorage.app",
    messagingSenderId: "908669646736",
    appId: "1:908669646736:web:bcd16ca186160ae308e515"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let cart = [];
let selectedLabel = "None";
let wishlist = [];
const PKR_RATE = 280;

// Cache for orders
let ordersCache = {
    current: [],
    history: [],
    loaded: false,
    loading: false
};

function toPKR(usd) { return Math.round(usd * PKR_RATE); }
function formatPKR(amount) { return "Rs. " + amount.toLocaleString(); }

const categoryImage = "https://i.postimg.cc/RVpYHz4s/20260617-115609.png";
const productImages = [
    "https://i.postimg.cc/RVpYHz4s/20260617-115609.png",
    "https://i.postimg.cc/RVpYHz4s/20260617-115609.png",
    "https://i.postimg.cc/RVpYHz4s/20260617-115609.png",
    "https://i.postimg.cc/RVpYHz4s/20260617-115609.png"
];

// ===== WISHLIST FUNCTIONS =====
function loadWishlist() {
    if (!currentUser) return;
    const data = localStorage.getItem(`wishlist_${currentUser.uid}`);
    wishlist = data ? JSON.parse(data) : [];
}

function saveWishlist() {
    if (!currentUser) return;
    localStorage.setItem(`wishlist_${currentUser.uid}`, JSON.stringify(wishlist));
    updateWishlistUI();
}

function toggleWishlist(productId) {
    if (!currentUser) { alert("Please login"); return; }
    const index = wishlist.indexOf(productId);
    if (index > -1) wishlist.splice(index, 1);
    else wishlist.push(productId);
    saveWishlist();
    renderCurrentProducts();
    renderDrawerContent();
    updateStickyBar();
}

function isInWishlist(productId) {
    return wishlist.includes(productId);
}

function updateWishlistUI() {
    const badge = document.querySelector(".drawer-wishlist-badge");
    if (badge) badge.textContent = wishlist.length;
    document.querySelectorAll(".wishlist-btn").forEach(btn => {
        const id = parseInt(btn.dataset.productId);
        if (isInWishlist(id)) {
            btn.classList.add("active");
            btn.textContent = "❤️";
        } else {
            btn.classList.remove("active");
            btn.textContent = "🤍";
        }
    });
}

// ===== CART FUNCTIONS =====
function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    const existing = cart.find(i => i.id === productId);
    if (existing) existing.qty += 1;
    else cart.push({ ...product, qty: 1 });
    renderCart();
    renderCartDrawer();
    renderDrawerContent();
    renderCurrentProducts();
    updateStickyBar();
}

function removeFromCart(productId) {
    const existing = cart.find(i => i.id === productId);
    if (existing) {
        if (existing.qty > 1) existing.qty -= 1;
        else cart = cart.filter(i => i.id !== productId);
        renderCart();
        renderCartDrawer();
        renderDrawerContent();
        renderCurrentProducts();
        updateStickyBar();
    }
}

function getCartQty(productId) {
    const item = cart.find(i => i.id === productId);
    return item ? item.qty : 0;
}

function updateStickyBar() {
    const bar = document.getElementById("stickyCartBar");
    const itemsEl = document.getElementById("stickyItems");
    const priceEl = document.getElementById("stickyPrice");
    const totalItems = cart.reduce((acc, i) => acc + i.qty, 0);
    const totalPrice = cart.reduce((acc, i) => acc + i.price * i.qty, 0);
    if (totalItems === 0) {
        bar.classList.remove("visible");
    } else {
        bar.classList.add("visible");
        itemsEl.textContent = `${totalItems} item${totalItems > 1 ? "s" : ""}`;
        priceEl.textContent = formatPKR(toPKR(totalPrice));
    }
}

document.getElementById("stickyViewCart").addEventListener("click", () => {
    openCartDrawer();
});

// ===== DRAWER MANAGEMENT =====
const cartDrawerOverlay = document.getElementById("cartDrawerOverlay");
const cartDrawer = document.getElementById("cartDrawer");
const cartDrawerClose = document.getElementById("cartDrawerClose");
const cartDrawerItems = document.getElementById("cartDrawerItems");
const cartDrawerTotal = document.getElementById("cartDrawerTotal");

const profileDrawerOverlay = document.getElementById("profileDrawerOverlay");
const profileDrawer = document.getElementById("profileDrawer");
const profileDrawerCloseBtn = document.getElementById("drawerCloseBtn");

function closeAllDrawers() {
    cartDrawerOverlay.classList.remove("open");
    cartDrawer.classList.remove("open");
    profileDrawerOverlay.classList.remove("open");
    profileDrawer.classList.remove("open");
    document.body.style.overflow = "";
}

function openCartDrawer() {
    if (profileDrawer.classList.contains("open")) {
        profileDrawerOverlay.classList.remove("open");
        profileDrawer.classList.remove("open");
        setTimeout(() => {
            cartDrawerOverlay.classList.add("open");
            cartDrawer.classList.add("open");
            document.body.style.overflow = "hidden";
            renderCartDrawer();
            loadDrawerOrders();
        }, 50);
    } else {
        cartDrawerOverlay.classList.add("open");
        cartDrawer.classList.add("open");
        document.body.style.overflow = "hidden";
        renderCartDrawer();
        loadDrawerOrders();
    }
}

function closeCartDrawer() {
    cartDrawerOverlay.classList.remove("open");
    cartDrawer.classList.remove("open");
    document.body.style.overflow = "";
}

function openProfileDrawer() {
    if (cartDrawer.classList.contains("open")) {
        cartDrawerOverlay.classList.remove("open");
        cartDrawer.classList.remove("open");
        setTimeout(() => {
            profileDrawerOverlay.classList.add("open");
            profileDrawer.classList.add("open");
            document.body.style.overflow = "hidden";
            renderDrawerContent();
        }, 50);
    } else {
        profileDrawerOverlay.classList.add("open");
        profileDrawer.classList.add("open");
        document.body.style.overflow = "hidden";
        renderDrawerContent();
    }
}

function closeProfileDrawer() {
    profileDrawerOverlay.classList.remove("open");
    profileDrawer.classList.remove("open");
    document.body.style.overflow = "";
}

cartDrawerOverlay.addEventListener("click", closeCartDrawer);
cartDrawerClose.addEventListener("click", closeCartDrawer);
profileDrawerOverlay.addEventListener("click", closeProfileDrawer);
profileDrawerCloseBtn.addEventListener("click", closeProfileDrawer);

document.getElementById("profileIcon").addEventListener("click", function(e) {
    e.stopPropagation();
    openProfileDrawer();
});

// ===== CART TAB SWITCHING =====
document.querySelectorAll('.cart-tabs button').forEach(tab => {
    tab.addEventListener('click', function() {
        document.querySelectorAll('.cart-tabs button').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.cart-tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(this.dataset.tab).classList.add('active');
        document.getElementById('cartDrawerTitle').textContent = this.textContent;
        if (this.dataset.tab === 'ordersTab') {
            renderOrdersFromCache();
        }
    });
});

// ===== CHECKOUT FUNCTIONS =====
function getPhoneNumberDrawer() {
    const input = document.getElementById("drawerPhoneInput");
    if (!input) return "";
    return input.value.replace(/\D/g, "");
}

function setPhoneNumberDrawer(num) {
    const input = document.getElementById("drawerPhoneInput");
    if (!input) return;
    const digits = num.replace(/\D/g, "").slice(0, 11);
    if (digits.length === 0) { input.value = ""; return; }
    let formatted = "";
    if (digits.length >= 4) {
        formatted = digits.slice(0, 4) + "-" + digits.slice(4);
    } else {
        formatted = digits;
    }
    input.value = formatted;
    updateOrderButtonDrawer();
}

function initPhoneInputDrawer() {
    const input = document.getElementById("drawerPhoneInput");
    if (!input) return;
    input.addEventListener("input", function() {
        let digits = this.value.replace(/\D/g, "");
        if (digits.length > 11) digits = digits.slice(0, 11);
        let formatted = "";
        if (digits.length >= 4) {
            formatted = digits.slice(0, 4) + "-" + digits.slice(4);
        } else {
            formatted = digits;
        }
        this.value = formatted;
        savePhoneToStorageDrawer();
        updateOrderButtonDrawer();
    });
    loadPhoneFromStorageDrawer();
}

function savePhoneToStorageDrawer() {
    if (!currentUser) return;
    const phone = getPhoneNumberDrawer();
    if (phone && phone.length === 11) localStorage.setItem(`user_phone_${currentUser.uid}`, phone);
}

function loadPhoneFromStorageDrawer() {
    if (!currentUser) return;
    const saved = localStorage.getItem(`user_phone_${currentUser.uid}`);
    if (saved) {
        const num = saved.replace(/\D/g, "");
        if (num.length === 11) setPhoneNumberDrawer(num);
    }
}

function loadUserDataDrawer() {
    if (!currentUser) return;
    const savedName = localStorage.getItem(`user_name_${currentUser.uid}`);
    const nameInput = document.getElementById("drawerName");
    if (savedName && nameInput) nameInput.value = savedName;
    loadPhoneFromStorageDrawer();
    updateOrderButtonDrawer();
}

function saveUserDataDrawer() {
    if (!currentUser) return;
    const nameInput = document.getElementById("drawerName");
    const name = nameInput ? nameInput.value.trim() : "";
    if (name) localStorage.setItem(`user_name_${currentUser.uid}`, name);
    savePhoneToStorageDrawer();
    updateOrderButtonDrawer();
}

function getSavedAddressesDrawer() {
    if (!currentUser) return [];
    const data = localStorage.getItem(`saved_addresses_${currentUser.uid}`);
    return data ? JSON.parse(data) : [];
}

function saveAddressToStorageDrawer(address, label) {
    if (!currentUser || !address.trim()) return;
    const addresses = getSavedAddressesDrawer();
    const existing = addresses.find(a => a.address === address);
    if (existing) {
        existing.label = label;
    } else {
        addresses.push({ address: address.trim(), label: label || "None", id: Date.now() });
    }
    localStorage.setItem(`saved_addresses_${currentUser.uid}`, JSON.stringify(addresses));
    renderSavedAddressesDrawer();
}

function deleteAddressFromStorageDrawer(id) {
    if (!currentUser) return;
    let addresses = getSavedAddressesDrawer();
    addresses = addresses.filter(a => a.id !== id);
    localStorage.setItem(`saved_addresses_${currentUser.uid}`, JSON.stringify(addresses));
    renderSavedAddressesDrawer();
}

function renderSavedAddressesDrawer() {
    const container = document.getElementById("drawerSavedAddressesList");
    if (!container) return;
    const addresses = getSavedAddressesDrawer();
    container.innerHTML = "";
    if (addresses.length === 0) {
        container.innerHTML = '<div style="color:#64748b;font-size:12px;">No saved addresses</div>';
        return;
    }
    addresses.forEach(addr => {
        const div = document.createElement("div");
        div.className = "saved-addr-item";
        div.innerHTML = `
            <span style="font-weight:600;font-size:10px;padding:1px 8px;border-radius:16px;background:#eef2f7;">${addr.label || "📍"}</span>
            <span style="flex:1;font-size:11px;">${addr.address}</span>
            <div style="display:flex;gap:4px;">
                <button class="drawer-use-addr" data-id="${addr.id}" style="background:#00b14f;border:none;padding:2px 10px;border-radius:30px;color:white;font-size:10px;cursor:pointer;">Use</button>
                <button class="drawer-del-addr" data-id="${addr.id}" style="background:#d93c3c;border:none;padding:2px 10px;border-radius:30px;color:white;font-size:10px;cursor:pointer;">✕</button>
            </div>
        `;
        container.appendChild(div);
        div.querySelector(".drawer-use-addr").addEventListener("click", e => {
            e.stopPropagation();
            setAddressDrawer(addr.address, addr.label);
        });
        div.querySelector(".drawer-del-addr").addEventListener("click", e => {
            e.stopPropagation();
            if (confirm("Delete this saved address?")) deleteAddressFromStorageDrawer(addr.id);
        });
    });
}

function updateLabelButtonsDrawer() {
    document.querySelectorAll(".drawer-label-btn").forEach(btn => {
        btn.className = "drawer-label-btn label-btn";
        if (btn.dataset.label === selectedLabel) {
            if (selectedLabel === "Home") btn.classList.add("active-home");
            else if (selectedLabel === "Office") btn.classList.add("active-office");
            else btn.classList.add("active-none");
        }
    });
}

function setAddressDrawer(address, label = null) {
    const input = document.getElementById("drawerAddress");
    if (!input) return;
    input.value = address;
    if (label) {
        selectedLabel = label;
        updateLabelButtonsDrawer();
        saveAddressToStorageDrawer(address, label);
    }
    const savedAs = document.getElementById("drawerSavedAsSection");
    if (savedAs) savedAs.style.display = "block";
    updateOrderButtonDrawer();
    renderSavedAddressesDrawer();
}

function clearAddressDrawer() {
    const input = document.getElementById("drawerAddress");
    if (!input) return;
    input.value = "";
    input.disabled = false;
    const savedAs = document.getElementById("drawerSavedAsSection");
    if (savedAs) savedAs.style.display = "none";
    selectedLabel = "None";
    updateLabelButtonsDrawer();
    updateOrderButtonDrawer();
}

function startQuickLocationDrawer() {
    if (!currentUser) { alert("Please login first"); return; }
    if (!navigator.geolocation) { alert("Geolocation not supported"); return; }
    const input = document.getElementById("drawerAddress");
    if (!input) return;
    input.value = "Fetching location...";
    input.disabled = true;
    navigator.geolocation.getCurrentPosition(
        async pos => {
            const address = `📍 ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
            input.value = address;
            input.disabled = false;
            if (selectedLabel !== "None") {
                saveAddressToStorageDrawer(address, selectedLabel);
            }
            const savedAs = document.getElementById("drawerSavedAsSection");
            if (savedAs) savedAs.style.display = "block";
            updateOrderButtonDrawer();
            renderSavedAddressesDrawer();
        },
        () => {
            input.value = "";
            input.disabled = false;
            alert("Could not get location. Please enter manually.");
        }
    );
}

function updateOrderButtonDrawer() {
    const nameInput = document.getElementById("drawerName");
    const addressInput = document.getElementById("drawerAddress");
    const name = nameInput ? nameInput.value.trim() : "";
    const phone = getPhoneNumberDrawer();
    const address = addressInput ? addressInput.value.trim() : "";
    const btn = document.getElementById("drawerPlaceOrderBtn");
    if (!btn) return;
    if (name && phone.length === 11 && address) {
        btn.classList.add("ready");
        btn.disabled = false;
        btn.textContent = "📦 Place Order";
    } else {
        btn.classList.remove("ready");
        btn.disabled = true;
        btn.textContent = "📦 Complete All Details";
    }
}

function renderCartDrawer() {
    let itemsHtml = "";
    let total = 0;
    if (cart.length === 0) {
        itemsHtml = '<div class="cart-drawer-empty">Your cart is empty</div>';
        cartDrawerTotal.textContent = "Rs. 0";
    } else {
        cart.forEach(item => {
            total += item.price * item.qty;
            itemsHtml += `<div class="cart-drawer-item">
                <div class="item-info">
                    <div class="item-name">${item.name}</div>
                    <div class="item-price">${formatPKR(toPKR(item.price))}</div>
                </div>
                <div class="item-qty-controls">
                    <button class="cart-minus" data-id="${item.id}">−</button>
                    <span class="qty">${item.qty}</span>
                    <button class="cart-plus" data-id="${item.id}">+</button>
                </div>
            </div>`;
        });
        cartDrawerTotal.textContent = formatPKR(toPKR(total));
    }
    cartDrawerItems.innerHTML = itemsHtml;
    cartDrawerItems.querySelectorAll(".cart-plus").forEach(btn => {
        btn.addEventListener("click", () => addToCart(parseInt(btn.dataset.id)));
    });
    cartDrawerItems.querySelectorAll(".cart-minus").forEach(btn => {
        btn.addEventListener("click", () => removeFromCart(parseInt(btn.dataset.id)));
    });

    const checkoutBtn = document.getElementById("cartDrawerCheckout");
    if (checkoutBtn) {
        checkoutBtn.onclick = function() {
            if (!currentUser) { alert("Please Login first"); return; }
            if (cart.length === 0) { alert("Cart is empty"); return; }
            const section = document.getElementById("drawerCheckoutSection");
            if (section) {
                if (section.style.display === "none") {
                    section.style.display = "block";
                    initPhoneInputDrawer();
                    loadUserDataDrawer();
                    renderSavedAddressesDrawer();
                    clearAddressDrawer();
                    updateOrderButtonDrawer();

                    document.querySelectorAll(".drawer-label-btn").forEach(btn => {
                        btn.onclick = function() {
                            const label = this.dataset.label;
                            if (label === "None") {
                                selectedLabel = "None";
                                updateLabelButtonsDrawer();
                                return;
                            }
                            selectedLabel = label;
                            updateLabelButtonsDrawer();
                            const address = document.getElementById("drawerAddress");
                            if (address && address.value.trim()) {
                                saveAddressToStorageDrawer(address.value.trim(), label);
                                renderSavedAddressesDrawer();
                            }
                        };
                    });

                    document.getElementById("drawerQuickLocationBtn").onclick = startQuickLocationDrawer;
                    document.getElementById("drawerClearAddressBtn").onclick = clearAddressDrawer;

                    document.getElementById("drawerName").oninput = function() {
                        saveUserDataDrawer();
                        updateOrderButtonDrawer();
                    };

                    document.getElementById("drawerPhoneInput").oninput = function() {
                        savePhoneToStorageDrawer();
                        updateOrderButtonDrawer();
                    };

                    document.getElementById("drawerAddress").oninput = function() {
                        updateOrderButtonDrawer();
                        if (this.value.trim()) {
                            document.getElementById("drawerSavedAsSection").style.display = "block";
                        }
                    };

                    document.getElementById("drawerPlaceOrderBtn").onclick = async function() {
                        if (this.disabled) {
                            alert("Please fill in all details correctly.");
                            return;
                        }
                        try {
                            const name = document.getElementById("drawerName").value.trim();
                            const phone = getPhoneNumberDrawer();
                            const address = document.getElementById("drawerAddress").value.trim();

                            if (!name || phone.length !== 11 || !address) {
                                alert("Please fill in all details correctly.");
                                return;
                            }

                            saveUserDataDrawer();
                            if (selectedLabel !== "None" && address) {
                                saveAddressToStorageDrawer(address, selectedLabel);
                            }

                            let total = 0;
                            cart.forEach(item => { total += item.price * item.qty; });

                            await addDoc(collection(db, "orders"), {
                                userEmail: currentUser.email,
                                customerName: name,
                                phone: phone,
                                address: address,
                                addressLabel: selectedLabel !== "None" ? selectedLabel : "",
                                items: cart,
                                totalBill: toPKR(total),
                                status: "Pending",
                                canCancel: true,
                                orderTime: Date.now()
                            });

                            alert("✅ Order Placed Successfully!");
                            cart = [];
                            renderCart();
                            renderCartDrawer();
                            clearAddressDrawer();
                            selectedLabel = "None";
                            updateLabelButtonsDrawer();
                            ordersCache.loaded = false;
                            loadDrawerOrders();
                            renderCurrentProducts();
                            updateStickyBar();
                            section.style.display = "none";
                        } catch (err) {
                            alert("Error placing order: " + err.message);
                        }
                    };
                } else {
                    section.style.display = "none";
                }
            }
        };
    }
}

// ===== ORDER FUNCTIONS =====
async function loadDrawerOrders() {
    if (ordersCache.loaded) {
        renderOrdersFromCache();
        return;
    }

    if (ordersCache.loading) {
        const checkLoaded = setInterval(() => {
            if (ordersCache.loaded) {
                clearInterval(checkLoaded);
                renderOrdersFromCache();
            }
        }, 100);
        return;
    }

    const currentContainer = document.getElementById("drawerCurrentOrders");
    const historyContainer = document.getElementById("drawerHistoryOrders");
    if (!currentContainer || !historyContainer) return;

    if (!currentUser) {
        const activeTab = document.querySelector('.orders-tabs .tab-btn.active');
        if (activeTab) {
            const targetId = activeTab.dataset.tab;
            const container = document.getElementById(targetId === 'drawerCurrentTab' ? 'drawerCurrentOrders' : 'drawerHistoryOrders');
            if (container) {
                container.innerHTML = '<div class="card" style="text-align:center;color:#64748b;padding:30px 20px;">🔒 Please login to view your orders</div>';
            }
            const inactiveContainer = document.getElementById(targetId === 'drawerCurrentTab' ? 'drawerHistoryOrders' : 'drawerCurrentOrders');
            if (inactiveContainer) inactiveContainer.innerHTML = "";
        }
        return;
    }

    ordersCache.loading = true;
    try {
        const q = query(collection(db, "orders"), where("userEmail", "==", currentUser.email));
        const snapshot = await getDocs(q);
        ordersCache.current = [];
        ordersCache.history = [];

        if (!snapshot.empty) {
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const status = data.status || "Pending";
                if (status === "Pending" || status === "Packed" || status === "PickedUp") {
                    ordersCache.current.push({ doc: docSnap, data: data });
                } else if (status === "Delivered" || status === "Cancelled" || status === "Completed") {
                    ordersCache.history.push({ doc: docSnap, data: data });
                } else {
                    ordersCache.current.push({ doc: docSnap, data: data });
                }
            });
            ordersCache.current.sort((a, b) => (b.data.orderTime || 0) - (a.data.orderTime || 0));
            ordersCache.history.sort((a, b) => (b.data.orderTime || 0) - (a.data.orderTime || 0));
        }
        ordersCache.loaded = true;
        ordersCache.loading = false;
        renderOrdersFromCache();
    } catch (e) {
        console.error("loadDrawerOrders error:", e);
        ordersCache.loading = false;
        const activeTab = document.querySelector('.orders-tabs .tab-btn.active');
        if (activeTab) {
            const targetId = activeTab.dataset.tab;
            const container = document.getElementById(targetId === 'drawerCurrentTab' ? 'drawerCurrentOrders' : 'drawerHistoryOrders');
            if (container) {
                container.innerHTML = '<div class="card" style="text-align:center;color:#ef4444;padding:30px 20px;">❌ Error loading orders</div>';
            }
        }
    }
}

function renderOrdersFromCache() {
    const currentContainer = document.getElementById("drawerCurrentOrders");
    const historyContainer = document.getElementById("drawerHistoryOrders");
    if (!currentContainer || !historyContainer) return;

    if (!currentUser) {
        const activeTab = document.querySelector('.orders-tabs .tab-btn.active');
        if (activeTab) {
            const targetId = activeTab.dataset.tab;
            const container = document.getElementById(targetId === 'drawerCurrentTab' ? 'drawerCurrentOrders' : 'drawerHistoryOrders');
            if (container) {
                container.innerHTML = '<div class="card" style="text-align:center;color:#64748b;padding:30px 20px;">🔒 Please login to view your orders</div>';
            }
            const inactiveContainer = document.getElementById(targetId === 'drawerCurrentTab' ? 'drawerHistoryOrders' : 'drawerCurrentOrders');
            if (inactiveContainer) inactiveContainer.innerHTML = "";
        }
        return;
    }

    if (!ordersCache.loaded) {
        currentContainer.innerHTML = '<div class="card" style="text-align:center;color:#64748b;padding:30px 20px;">⏳ Loading orders...</div>';
        historyContainer.innerHTML = '';
        if (!ordersCache.loading) loadDrawerOrders();
        return;
    }

    const activeTab = document.querySelector('.orders-tabs .tab-btn.active');
    const isCurrentTab = activeTab && activeTab.dataset.tab === 'drawerCurrentTab';
    currentContainer.innerHTML = "";
    historyContainer.innerHTML = "";

    if (isCurrentTab) {
        if (ordersCache.current.length === 0) {
            currentContainer.innerHTML = '<div class="card" style="text-align:center;color:#64748b;padding:30px 20px;">📭 No current orders</div>';
        } else {
            ordersCache.current.forEach(({ doc, data }) => {
                currentContainer.appendChild(buildOrderCardDrawer(doc, data));
            });
        }
    } else {
        if (ordersCache.history.length === 0) {
            historyContainer.innerHTML = '<div class="card" style="text-align:center;color:#64748b;padding:30px 20px;">📭 No history orders</div>';
        } else {
            ordersCache.history.forEach(({ doc, data }) => {
                const card = buildOrderCardDrawer(doc, data);
                const cancelBtn = card.querySelector("button.cancel");
                if (cancelBtn) cancelBtn.remove();
                historyContainer.appendChild(card);
            });
        }
    }
}

function buildOrderCardDrawer(docSnap, orderData) {
    const order = orderData || docSnap.data();
    const docId = docSnap.id || docSnap?.id || Math.random().toString(36).substr(2, 6);
    const div = document.createElement("div");
    div.className = "card";
    let itemsHtml = order.items ? order.items.map(item =>
        `<p style="font-size:11px;margin:2px 0;">${item.name} x ${item.qty} = ${formatPKR(toPKR(item.price * item.qty))}</p>`
    ).join("") : "";
    let statusHtml = `<div class="status-timeline">
        <div class="status-step ${order.status === "Pending" ? "active" : (order.status !== "Pending" && order.status !== "Cancelled" ? "completed" : "")}">📦</div>
        <div class="status-step ${order.status === "Packed" ? "active" : (order.status === "PickedUp" || order.status === "Delivered" ? "completed" : "")}">📋</div>
        <div class="status-step ${order.status === "PickedUp" ? "active" : (order.status === "Delivered" ? "completed" : "")}">🚴</div>
        <div class="status-step ${order.status === "Delivered" ? "active completed" : ""}">🏠</div>
    </div>`;
    div.innerHTML = `
        <div style="font-weight:600;font-size:13px;">Order #${docId.slice(-6)}</div>
        ${statusHtml}
        <div><strong>Status:</strong> <span class="ok">${order.status}</span></div>
        <div><strong>Total:</strong> ${formatPKR(order.totalBill || 0)}</div>
        <div style="font-size:11px;color:#64748b;">${order.address}</div>
        <hr style="margin:4px 0;">
        ${itemsHtml}
    `;
    if (order.status === "Pending" || order.status === "Packed") {
        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = "❌ Cancel";
        cancelBtn.className = "cancel";
        cancelBtn.onclick = async () => {
            if (!confirm("Cancel order?")) return;
            try {
                await updateDoc(doc(db, "orders", docId), {
                    status: "Cancelled",
                    cancelledTime: Date.now()
                });
                alert("✅ Order Cancelled");
                ordersCache.loaded = false;
                loadDrawerOrders();
            } catch (err) {
                alert("Error cancelling: " + err.message);
            }
        };
        div.appendChild(cancelBtn);
    }
    return div;
}

// ===== DRAWER MENU =====
const drawerMenuItems = document.getElementById("drawerMenuItems");
const drawerUserPic = document.getElementById("drawerUserPic");
const drawerUserName = document.getElementById("drawerUserName");
const drawerUserEmail = document.getElementById("drawerUserEmail");

function renderWishlistItems() {
    if (!currentUser || wishlist.length === 0) {
        return '<div style="color:#94a3b8;font-size:13px;padding:6px 0;">No favorites yet ❤️</div>';
    }
    let html = '';
    wishlist.forEach(id => {
        const product = allProducts.find(p => p.id === id);
        if (product) {
            const qty = getCartQty(id);
            html += `<div class="wishlist-drawer-item">
                <span class="emoji">${product.catEmoji || "📦"}</span>
                <div class="info">
                    <div class="name">${product.name}</div>
                    <div class="price">${formatPKR(toPKR(product.price))}</div>
                </div>
                <div class="cart-actions">
                    <button class="wishlist-minus" data-id="${product.id}">−</button>
                    <span class="qty">${qty}</span>
                    <button class="wishlist-plus" data-id="${product.id}">+</button>
                </div>
                <button class="remove-wishlist" data-id="${product.id}">✕</button>
            </div>`;
        }
    });
    return html;
}

function renderDrawerContent() {
    if (currentUser) {
        drawerUserPic.src = currentUser.photoURL || "https://ui-avatars.com/api/?name=" + encodeURIComponent(currentUser.displayName || "User") + "&background=00b14f&color=fff&size=56";
        drawerUserPic.style.display = "block";
        drawerUserName.textContent = currentUser.displayName || currentUser.email || "User";
        drawerUserEmail.textContent = currentUser.email || "";
        drawerMenuItems.innerHTML = `
            <div class="drawer-menu-item" id="drawerWishlistToggle">
                <span class="icon">❤️</span>
                <span>Favorites</span>
                <span class="drawer-wishlist-badge">${wishlist.length}</span>
            </div>
            <div id="wishlistItemsContainer" style="padding-left:46px;margin-bottom:8px;font-size:13px;">
                ${renderWishlistItems()}
            </div>
            <div class="drawer-menu-item" id="drawerOrdersNav">
                <span class="icon">📦</span>
                <span>My Orders</span>
            </div>
            <button class="drawer-logout-btn" id="drawerLogoutBtn">🚪 Logout</button>
        `;
        document.getElementById("drawerLogoutBtn").addEventListener("click", () => { signOut(auth); closeProfileDrawer(); });
        document.getElementById("drawerOrdersNav").addEventListener("click", () => { closeProfileDrawer(); openCartDrawer(); document.querySelector('.cart-tabs button[data-tab="ordersTab"]').click(); });

        document.getElementById("drawerWishlistToggle").addEventListener("click", function() {
            const container = document.getElementById("wishlistItemsContainer");
            if (container.style.display === "none") {
                container.style.display = "block";
                this.querySelector(".drawer-wishlist-badge").textContent = wishlist.length;
            } else {
                container.style.display = "none";
                this.querySelector(".drawer-wishlist-badge").textContent = wishlist.length;
            }
            container.innerHTML = renderWishlistItems();
            attachWishlistEvents();
        });

        const container = document.getElementById("wishlistItemsContainer");
        container.innerHTML = renderWishlistItems();
        attachWishlistEvents();
    } else {
        drawerUserPic.src = "";
        drawerUserPic.style.display = "none";
        drawerUserName.textContent = "Guest";
        drawerUserEmail.textContent = "Not logged in";
        drawerMenuItems.innerHTML = `
            <button class="drawer-login-btn" id="drawerLoginBtn">🔑 Sign in with Google</button>
            <div style="margin-top:20px;color:#94a3b8;font-size:13px;text-align:center;">Login to access your orders & favorites</div>
        `;
        document.getElementById("drawerLoginBtn").addEventListener("click", () => { loginGoogle(); closeProfileDrawer(); });
    }
}

function attachWishlistEvents() {
    document.querySelectorAll(".wishlist-plus").forEach(btn => {
        btn.addEventListener("click", e => {
            e.stopPropagation();
            addToCart(parseInt(btn.dataset.id));
            const item = btn.closest(".wishlist-drawer-item");
            if (item) {
                const qtyDisplay = item.querySelector(".qty");
                const id = parseInt(btn.dataset.id);
                qtyDisplay.textContent = getCartQty(id);
            }
        });
    });
    document.querySelectorAll(".wishlist-minus").forEach(btn => {
        btn.addEventListener("click", e => {
            e.stopPropagation();
            removeFromCart(parseInt(btn.dataset.id));
            const item = btn.closest(".wishlist-drawer-item");
            if (item) {
                const qtyDisplay = item.querySelector(".qty");
                const id = parseInt(btn.dataset.id);
                qtyDisplay.textContent = getCartQty(id);
            }
        });
    });
    document.querySelectorAll(".remove-wishlist").forEach(btn => {
        btn.addEventListener("click", e => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            const index = wishlist.indexOf(id);
            if (index > -1) {
                wishlist.splice(index, 1);
                saveWishlist();
                renderDrawerContent();
                renderCurrentProducts();
                updateStickyBar();
            }
        });
    });
}

// ===== ORDER TAB SUB-TABS =====
document.querySelectorAll('.orders-tabs .tab-btn').forEach(tab => {
    tab.addEventListener('click', function() {
        document.querySelectorAll('.orders-tabs .tab-btn').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.orders-tabs .tab-content').forEach(c => c.classList.remove('active'));
        const target = document.getElementById(this.dataset.tab);
        if (target) {
            target.classList.add('active');
            renderOrdersFromCache();
        }
    });
});

// ===== PRODUCT DATA =====
const categoryData = [
    {
        name: "Grocery", emoji: "🛒",
        boxes: [
            { label: "🛢️ Oil & Ghee", items: [{ name: "Sultan Ghee 1kg", price: 4.5 }, { name: "Sunflower Oil 1L", price: 3.2 }, { name: "Olive Oil 500ml", price: 5 }, { name: "Cooking Oil 3L", price: 8 }] },
            { label: "🍬 Sugar & Gur", items: [{ name: "Sugar 1kg", price: 1.2 }, { name: "Brown Sugar 500g", price: 1.8 }, { name: "Gur 1kg", price: 2.5 }, { name: "Honey 500g", price: 4 }] },
            { label: "🌾 Flour & Grains", items: [{ name: "White Flour 5kg", price: 3 }, { name: "Whole Wheat 5kg", price: 3.5 }, { name: "Rice Basmati 1kg", price: 2.2 }, { name: "Oats 1kg", price: 2 }] },
            { label: "🧂 Spices", items: [{ name: "Salt 1kg", price: .8 }, { name: "Black Pepper 100g", price: 1.5 }, { name: "Turmeric 100g", price: 1 }, { name: "Cumin 100g", price: 1.2 }] }
        ]
    },
    {
        name: "Snacks & Drinks", emoji: "🥤",
        boxes: [
            { label: "🥤 Cold Drinks", items: [{ name: "Pepsi 1.5L", price: 1.5 }, { name: "Coca-Cola 1.5L", price: 1.5 }, { name: "Sprite 1.5L", price: 1.5 }, { name: "Mtn Dew 1.5L", price: 1.7 }] },
            { label: "🍪 Biscuits", items: [{ name: "Oreo 200g", price: 2 }, { name: "Peek Freans 200g", price: 1.8 }, { name: "Cake Rusk 200g", price: 1.5 }, { name: "Glucose Biscuit", price: 1.2 }] },
            { label: "🍿 Chips", items: [{ name: "Lays 60g", price: .9 }, { name: "Kurkure 60g", price: .9 }, { name: "Cheetos 60g", price: .9 }, { name: "Namkeen 200g", price: 1.2 }] },
            { label: "☕ Tea/Coffee", items: [{ name: "Tea Bag 25ct", price: 1.8 }, { name: "Loose Tea 250g", price: 2.5 }, { name: "Coffee 100g", price: 3 }, { name: "Green Tea 20ct", price: 2.2 }] }
        ]
    },
    {
        name: "Beauty & Personal Care", emoji: "🧴",
        boxes: [
            { label: "🧴 Shampoo", items: [{ name: "Pantene 500ml", price: 4.5 }, { name: "Dove Conditioner", price: 4 }, { name: "Head & Shoulders", price: 5 }, { name: "Sunsilk 400ml", price: 3.5 }] },
            { label: "🧼 Soap", items: [{ name: "Dove Soap 100g", price: 1.8 }, { name: "Lifebuoy 125g", price: 1.2 }, { name: "Lux Soap 125g", price: 1.5 }, { name: "Body Wash 500ml", price: 4 }] },
            { label: "🪥 Oral", items: [{ name: "Colgate Toothpaste", price: 2 }, { name: "Sensodyne", price: 3 }, { name: "Toothbrush 2pk", price: 1.5 }, { name: "Mouthwash 500ml", price: 3.5 }] },
            { label: "💄 Skincare", items: [{ name: "Face Wash 150ml", price: 3.5 }, { name: "Moisturizer 100ml", price: 4 }, { name: "Deodorant 150ml", price: 2.5 }, { name: "Sunscreen SPF50", price: 5 }] }
        ]
    },
    {
        name: "Household", emoji: "🧹",
        boxes: [
            { label: "🧹 Cleaning", items: [{ name: "Flooqr Cleaner 1L", price: 2.5 }, { name: "Dish Soap 500ml", price: 1.8 }, { name: "Sponge Pack", price: 1.2 }, { name: "Glass Cleaner", price: 2 }] },
            { label: "🧻 Paper", items: [{ name: "Toilet Paper 4pk", price: 3 }, { name: "Paper Towel 2pk", price: 2.5 }, { name: "Tissue Box", price: 1.5 }, { name: "Napkins 100ct", price: 1.8 }] },
            { label: "🧴 Laundry", items: [{ name: "Detergent 1kg", price: 4 }, { name: "Fabric Softener", price: 3 }, { name: "Stain Remover", price: 2.5 }, { name: "Bleach 1L", price: 1.8 }] },
            { label: "🍳 Kitchen", items: [{ name: "Aluminum Foil", price: 2 }, { name: "Cling Wrap", price: 1.5 }, { name: "Ziplock Bags", price: 2.2 }, { name: "Trash Bags", price: 2.8 }] }
        ]
    },
    {
        name: "Baby Care", emoji: "🍼",
        boxes: [
            { label: "🍼 Formula", items: [{ name: "Baby Formula 400g", price: 12 }, { name: "Stage 2 Formula", price: 13.5 }, { name: "Organic Formula", price: 15 }] },
            { label: "🧷 Diapers", items: [{ name: "Diapers Size 3", price: 10 }, { name: "Diapers Size 4", price: 11 }, { name: "Diapers Size 5", price: 12 }] },
            { label: "🧴 Baby Care", items: [{ name: "Baby Lotion", price: 4.5 }, { name: "Diaper Cream", price: 3.5 }, { name: "Baby Shampoo", price: 4 }] },
            { label: "🍼 Feeding", items: [{ name: "Bottle 250ml", price: 5 }, { name: "Sippy Cup", price: 4 }, { name: "Pacifier 2pk", price: 3 }] }
        ]
    },
    {
        name: "Frozen Food", emoji: "❄️",
        boxes: [
            { label: "🥦 Frozen Veg", items: [{ name: "Mixed Veg 500g", price: 2.5 }, { name: "Peas 500g", price: 2 }, { name: "Corn 500g", price: 2.2 }, { name: "Spinach 400g", price: 1.8 }] },
            { label: "🍗 Frozen Meat", items: [{ name: "Chicken Breast 1kg", price: 6 }, { name: "Fish Fillet 500g", price: 7 }, { name: "Beef Mince 500g", price: 5.5 }] },
            { label: "🍕 Ready Meals", items: [{ name: "Pizza 12\"", price: 8 }, { name: "Lasagna 400g", price: 6.5 }, { name: "Spring Rolls 6pk", price: 4 }] },
            { label: "🍦 Desserts", items: [{ name: "Ice Cream 1L", price: 4.5 }, { name: "Fruit Sorbet", price: 5 }, { name: "Frozen Yogurt", price: 4 }] }
        ]
    }
];

let allProducts = [];
let productIdCounter = 1;
categoryData.forEach(cat => {
    cat.boxes.forEach(box => {
        box.items.forEach(item => {
            allProducts.push({
                id: productIdCounter++,
                name: item.name,
                price: item.price,
                category: cat.name,
                boxLabel: box.label,
                catEmoji: cat.emoji
            });
        });
    });
});

// ===== RENDER FUNCTIONS =====
function renderCategories() {
    const container = document.getElementById("categories");
    container.innerHTML = "";
    categoryData.forEach(cat => {
        const title = document.createElement("div");
        title.className = "section-title";
        title.textContent = `${cat.emoji} ${cat.name}`;
        container.appendChild(title);
        const grid = document.createElement("div");
        grid.className = "category-grid";
        cat.boxes.forEach(box => {
            const card = document.createElement("div");
            card.className = "category-card";
            card.innerHTML = `<img class="cat-img" src="${categoryImage}" alt="${box.label}" loading="lazy"><span class="cat-name">${box.label}</span>`;
            card.addEventListener("click", () => showBoxProducts(cat.name, box.label, box.items));
            grid.appendChild(card);
        });
        container.appendChild(grid);
    });
}

function renderCurrentProducts() {
    const section = document.getElementById("productsSection");
    if (section.style.display === "block") {
        document.querySelectorAll(".wishlist-btn").forEach(btn => {
            const id = parseInt(btn.dataset.productId);
            if (isInWishlist(id)) {
                btn.classList.add("active");
                btn.textContent = "❤️";
            } else {
                btn.classList.remove("active");
                btn.textContent = "🤍";
            }
        });
        document.querySelectorAll(".qty-display").forEach(el => {
            const id = parseInt(el.dataset.id);
            el.textContent = getCartQty(id);
        });
        document.querySelectorAll(".product-card").forEach(card => {
            const id = parseInt(card.dataset.productId);
            const qty = getCartQty(id);
            const btn = card.querySelector(".add-to-cart-btn");
            const controls = card.querySelector(".qty-controls");
            if (qty > 0) {
                if (btn) btn.style.display = "none";
                if (controls) {
                    controls.classList.remove("hidden");
                    controls.querySelector(".qty-display").textContent = qty;
                }
            } else {
                if (btn) btn.style.display = "block";
                if (controls) controls.classList.add("hidden");
            }
        });
    }
}

function showBoxProducts(cat, label, items) {
    const section = document.getElementById("productsSection");
    const title = document.getElementById("categoryTitle");
    const productContainer = document.getElementById("products");
    section.style.display = "block";
    document.getElementById("categories").style.display = "none";
    title.textContent = label;
    productContainer.innerHTML = "";
    items.forEach((item, index) => {
        const prod = allProducts.find(p => p.name === item.name && p.price === item.price);
        const id = prod ? prod.id : Math.random().toString(36).substr(2, 5);
        const qty = getCartQty(id);
        const isFav = isInWishlist(id);
        const card = document.createElement("div");
        card.className = "product-card";
        card.dataset.productId = id;
        const hasQty = qty > 0;
        const imgSrc = productImages[index % productImages.length];
        card.innerHTML = `
            <button class="wishlist-btn ${isFav ? "active" : ""}" data-product-id="${id}">${isFav ? "❤️" : "🤍"}</button>
            <img class="product-img" src="${imgSrc}" alt="${item.name}" loading="lazy">
            <div class="product-name">${item.name}</div>
            <div class="product-price">${formatPKR(toPKR(item.price))}</div>
            <button class="add-to-cart-btn" data-id="${id}" style="${hasQty ? "display:none" : ""}">Add to Cart</button>
            <div class="qty-controls ${hasQty ? "" : "hidden"}">
                <button class="qty-minus" data-id="${id}">−</button>
                <span class="qty-display" data-id="${id}">${qty}</span>
                <button class="qty-plus" data-id="${id}">+</button>
            </div>
        `;
        productContainer.appendChild(card);
        const atcBtn = card.querySelector(".add-to-cart-btn");
        if (atcBtn) {
            atcBtn.addEventListener("click", e => {
                e.stopPropagation();
                addToCart(id);
            });
        }
        card.querySelector(".wishlist-btn").addEventListener("click", e => {
            e.stopPropagation();
            toggleWishlist(id);
        });
        card.querySelector(".qty-plus").addEventListener("click", e => {
            e.stopPropagation();
            addToCart(id);
        });
        card.querySelector(".qty-minus").addEventListener("click", e => {
            e.stopPropagation();
            removeFromCart(id);
        });
    });
}

function goToCategories() {
    document.getElementById("productsSection").style.display = "none";
    document.getElementById("categories").style.display = "block";
    history.pushState({ page: "categories" }, "");
}

window.addEventListener("popstate", () => {
    if (document.getElementById("productsSection").style.display === "block") goToCategories();
});
history.replaceState({ page: "categories" }, "");
document.getElementById("backToCategoriesBtn").addEventListener("click", goToCategories);

const origShowBoxProducts = showBoxProducts;
showBoxProducts = function(cat, label, items) {
    origShowBoxProducts(cat, label, items);
    history.pushState({ page: "products" }, "");
};
window.showBoxProducts = showBoxProducts;

function renderCart() {}

// ===== SEARCH FUNCTIONALITY =====
const searchInput = document.getElementById("searchInput");
const placeholder = document.getElementById("searchPlaceholder");
searchInput.addEventListener("focus", () => {
    placeholder.style.opacity = "0";
});
searchInput.addEventListener("blur", () => {
    if (searchInput.value === "") {
        placeholder.style.opacity = "1";
    }
});

document.getElementById("searchInput").addEventListener("input", function(e) {
    const query = e.target.value.trim().toLowerCase();
    if (query === "") {
        document.getElementById("categories").style.display = "block";
        document.getElementById("productsSection").style.display = "none";
        history.pushState({ page: "categories" }, "");
        return;
    }
    const results = allProducts.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
    );
    const section = document.getElementById("productsSection");
    section.style.display = "block";
    document.getElementById("categories").style.display = "none";
    document.getElementById("categoryTitle").textContent = results.length ? `Results (${results.length})` : "No results";
    const productContainer = document.getElementById("products");
    productContainer.innerHTML = "";
    if (results.length === 0) {
        productContainer.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:#64748b;">No products found</div>';
        return;
    }
    results.forEach((prod, index) => {
        const qty = getCartQty(prod.id);
        const isFav = isInWishlist(prod.id);
        const card = document.createElement("div");
        card.className = "product-card";
        card.dataset.productId = prod.id;
        const hasQty = qty > 0;
        const imgSrc = productImages[index % productImages.length];
        card.innerHTML = `
            <button class="wishlist-btn ${isFav ? "active" : ""}" data-product-id="${prod.id}">${isFav ? "❤️" : "🤍"}</button>
            <img class="product-img" src="${imgSrc}" alt="${prod.name}" loading="lazy">
            <div class="product-name">${prod.name}</div>
            <div class="product-price">${formatPKR(toPKR(prod.price))}</div>
            <button class="add-to-cart-btn" data-id="${prod.id}" style="${hasQty ? "display:none" : ""}">Add to Cart</button>
            <div class="qty-controls ${hasQty ? "" : "hidden"}">
                <button class="qty-minus" data-id="${prod.id}">−</button>
                <span class="qty-display" data-id="${prod.id}">${qty}</span>
                <button class="qty-plus" data-id="${prod.id}">+</button>
            </div>
        `;
        productContainer.appendChild(card);
        const atcBtn = card.querySelector(".add-to-cart-btn");
        if (atcBtn) {
            atcBtn.addEventListener("click", e => {
                e.stopPropagation();
                addToCart(prod.id);
            });
        }
        card.querySelector(".wishlist-btn").addEventListener("click", e => {
            e.stopPropagation();
            toggleWishlist(prod.id);
        });
        card.querySelector(".qty-plus").addEventListener("click", e => {
            e.stopPropagation();
            addToCart(prod.id);
        });
        card.querySelector(".qty-minus").addEventListener("click", e => {
            e.stopPropagation();
            removeFromCart(prod.id);
        });
    });
    history.pushState({ page: "products" }, "");
});

// ===== AUTHENTICATION =====
async function loginGoogle() {
    try {
        const result = await signInWithPopup(auth, provider);
        currentUser = result.user;
        loadWishlist();
        updateProfileDisplay(currentUser);
        renderDrawerContent();
        renderCurrentProducts();
        updateStickyBar();
        ordersCache.loaded = false;
        loadDrawerOrders();
    } catch (e) {
        alert("Login failed: " + e.message);
    }
}

function updateProfileDisplay(user) {
    const profileSvg = document.getElementById("profileSvg");
    const profileImg = document.getElementById("profileImg");
    if (user && user.photoURL) {
        profileSvg.style.display = "none";
        profileImg.style.display = "block";
        profileImg.src = user.photoURL;
    } else {
        profileSvg.style.display = "block";
        profileImg.style.display = "none";
    }
}

// ===== AUTH STATE OBSERVER =====
onAuthStateChanged(auth, user => {
    if (user) {
        currentUser = user;
        loadWishlist();
        document.getElementById("customerArea").style.display = "block";
        renderCategories();
        document.getElementById("productsSection").style.display = "none";
        document.getElementById("categories").style.display = "block";
        updateProfileDisplay(user);
        renderDrawerContent();
        renderCurrentProducts();
        renderCartDrawer();
        updateStickyBar();
        ordersCache.loaded = false;
        loadDrawerOrders();
    } else {
        currentUser = null;
        wishlist = [];
        renderCategories();
        document.getElementById("productsSection").style.display = "none";
        document.getElementById("categories").style.display = "block";
        cart = [];
        renderCart();
        renderCartDrawer();
        renderDrawerContent();
        renderCurrentProducts();
        updateStickyBar();
        updateProfileDisplay(null);
        ordersCache.loaded = false;
        ordersCache.current = [];
        ordersCache.history = [];
    }
});

// ===== INITIALIZATION =====
renderCategories();
renderCart();
renderCartDrawer();
document.getElementById("productsSection").style.display = "none";
document.getElementById("categories").style.display = "block";
updateStickyBar();
console.log("✅ FreshMart Loaded with PKR currency, category image, and drawer animations");
