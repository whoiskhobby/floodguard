const topMenuButton = document.getElementById("top-menu-button");
const topMenuDropdown = document.getElementById("top-menu-dropdown");
 
if (topMenuButton && topMenuDropdown) {
  topMenuButton.addEventListener("click", () => {
    const isOpen = !topMenuDropdown.classList.contains("hidden");
    if (isOpen) {
      closeTopMenu();
      return;
    }
    openTopMenu();
  });

  document.addEventListener("click", (event) => {
    const withinMenu = event.target.closest(".top-right-menu");
    if (!withinMenu) {
      closeTopMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeTopMenu();
    }
  });

  topMenuDropdown.addEventListener("click", (event) => {
    const item = event.target.closest(".menu-item");
    if (!item) {
      return;
    }
    closeTopMenu();
  });
}

function openTopMenu() {
  topMenuDropdown.classList.remove("hidden");
  topMenuButton.setAttribute("aria-expanded", "true");
}

function closeTopMenu() {
  topMenuDropdown.classList.add("hidden");
  topMenuButton.setAttribute("aria-expanded", "false");
}
