// ==UserScript==
// @name         Stremio Open Addon Manager
// @namespace    https://www.mattrangel.net/
// @version      1.3
// @description  Adds a button to your addons page that copies your auth key and opens the community Stremio addon manager site.
// @author       Matt
// @match        https://web.stremio.com/*
// @run-at       document-end
// @icon         https://www.google.com/s2/favicons?sz=64&domain=stremio.com
// @grant        none
// ==/UserScript==
const addonManagerLink = "https://addon-manager.dontwanttos.top/";
const buttonId = "edit-order-button";

function getKey() {
  return JSON.parse(localStorage.getItem("profile"))?.auth?.key;
}

function handleButtonClick() {
  navigator.clipboard.writeText(getKey());
  window.open(addonManagerLink, "_blank");
}

function setupButton() {
  const addonButton = document.querySelector("[class^=add-button-container");
  const editOrderButton = document.createElement("button");

  editOrderButton.classList = addonButton.classList;
  editOrderButton.style = "color: white; font-weight: bold; right: unset;"
  editOrderButton.innerText = "Edit Order";
  editOrderButton.addEventListener("click", handleButtonClick);
  editOrderButton.id = buttonId;

  addonButton.insertAdjacentElement('beforebegin', editOrderButton);
};

const insertButtonObserver = new MutationObserver((_, observer) => {
  if (document.querySelector("[class^=add-button-container")) {
    setupButton();
    observer.disconnect();
  }
});

function buttonIsOnPage() {
  return !!document.querySelector(`#${buttonId}`);
}

function pageIsAddons() {
  return /#\/addons.*/.test(window.location.href);
}

function insertButton() {
  if (pageIsAddons() && !buttonIsOnPage()) {
    insertButtonObserver.observe(document.body, {
      attributes: false,
      characterData: false,
      childList: true,
      subtree: true,
    });
  }
}

insertButton();
window.addEventListener("popstate", insertButton);
